import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { de } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  getPuteEintraege,
  upsertPuteEintrag,
  deletePuteEintrag,
  getPuteConfigs,
  upsertPuteConfig,
  getAllGefluegelZerleger,
} from "../../backend/api";
import {
  PuteEintragResource,
  PuteConfigResource,
  PuteKategorie,
  GefluegelZerlegerResource,
} from "../../Resources";

registerLocale("de", de);

type CellDraft = { mitKnochen: string; ohneKnochen: string };

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function autoSum(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) return trimmed;
  const nums = parts.map((s) => Number(s.replace(",", "."))).filter((n) => !isNaN(n));
  if (nums.length === 0) return trimmed;
  const sum = nums.reduce((a, b) => a + b, 0);
  return sum === Math.floor(sum) ? String(sum) : sum.toFixed(1);
}

const KATEGORIE_LABELS: Record<PuteKategorie, string> = {
  pute_fluegel: "Puten Flügel",
  pute_keule: "Puten Keule",
};

export default function PuteUebersicht() {
  const [datum, setDatum] = useState(formatDate(new Date()));
  const [kategorie, setKategorie] = useState<PuteKategorie>("pute_fluegel");
  const [zerleger, setZerleger] = useState<GefluegelZerlegerResource[]>([]);
  const [eintraege, setEintraege] = useState<PuteEintragResource[]>([]);
  const [drafts, setDrafts] = useState<Map<string, CellDraft>>(new Map());
  const [configs, setConfigs] = useState<PuteConfigResource[]>([]);
  const [editSoll, setEditSoll] = useState(false);
  const [sollInput, setSollInput] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const sollConfig = configs.find((c) => c.kategorie === kategorie);
  const sollProzent = sollConfig?.sollProzent ?? 0.65;

  const loadData = useCallback(async () => {
    try {
      const [z, e, c] = await Promise.all([
        getAllGefluegelZerleger(),
        getPuteEintraege(datum, kategorie),
        getPuteConfigs(),
      ]);
      setZerleger(z);
      setEintraege(e);
      setConfigs(c);

      const newDrafts = new Map<string, CellDraft>();
      const activeZ = z.filter(
        (zer) => zer.aktiv && zer.kategorien?.includes(kategorie)
      );
      for (const zer of activeZ) {
        const entry = e.find((en) => en.zerlegerId === zer.id);
        newDrafts.set(zer.id!, {
          mitKnochen: entry ? String(entry.mitKnochen) : "",
          ohneKnochen: entry ? String(entry.ohneKnochen) : "",
        });
      }
      setDrafts(newDrafts);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    }
  }, [datum, kategorie]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeZerleger = useMemo(
    () =>
      zerleger
        .filter((z) => z.aktiv && z.kategorien?.includes(kategorie))
        .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || a.name.localeCompare(b.name)),
    [zerleger, kategorie]
  );

  const visibleZerleger = hideEmpty
    ? activeZerleger.filter((z) => {
        const d = drafts.get(z.id!);
        return d && (d.mitKnochen || d.ohneKnochen);
      })
    : activeZerleger;

  const handleChange = (
    zerlegerId: string,
    field: "mitKnochen" | "ohneKnochen",
    value: string
  ) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const current = next.get(zerlegerId) || { mitKnochen: "", ohneKnochen: "" };
      next.set(zerlegerId, { ...current, [field]: value });
      return next;
    });
  };

  const saveCell = useCallback(
    async (zerlegerId: string, zerlegerName: string) => {
      const draft = drafts.get(zerlegerId);
      if (!draft) return;

      const mk = autoSum(draft.mitKnochen);
      const ok = autoSum(draft.ohneKnochen);

      if (mk !== draft.mitKnochen || ok !== draft.ohneKnochen) {
        setDrafts((prev) => {
          const next = new Map(prev);
          next.set(zerlegerId, { mitKnochen: mk, ohneKnochen: ok });
          return next;
        });
      }

      const mkNum = parseFloat(mk.replace(",", ".")) || 0;
      const okNum = parseFloat(ok.replace(",", ".")) || 0;

      if (mkNum === 0 && okNum === 0) {
        const existing = eintraege.find(
          (e) => e.zerlegerId === zerlegerId && e.kategorie === kategorie
        );
        if (existing?.id) {
          try {
            await deletePuteEintrag(existing.id);
            setEintraege((prev) => prev.filter((e) => e.id !== existing.id));
          } catch (err) {
            console.error("Fehler beim Löschen:", err);
          }
        }
        return;
      }

      if (!mk || !ok) return;

      setSaving((prev) => new Set(prev).add(zerlegerId));
      try {
        const result = await upsertPuteEintrag({
          datum,
          kategorie,
          zerlegerId,
          zerlegerName,
          mitKnochen: mkNum,
          ohneKnochen: okNum,
        });
        setEintraege((prev) => {
          const idx = prev.findIndex(
            (e) => e.zerlegerId === zerlegerId && e.kategorie === kategorie
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = result;
            return next;
          }
          return [...prev, result];
        });
      } catch (err) {
        console.error("Fehler beim Speichern:", err);
      } finally {
        setSaving((prev) => {
          const next = new Set(prev);
          next.delete(zerlegerId);
          return next;
        });
      }
    },
    [drafts, datum, kategorie, eintraege]
  );

  const handleSollSave = async () => {
    const val = parseFloat(sollInput.replace(",", "."));
    if (isNaN(val) || val < 0 || val > 100) return;
    try {
      const result = await upsertPuteConfig({
        kategorie,
        sollProzent: val / 100,
      });
      setConfigs((prev) => {
        const idx = prev.findIndex((c) => c.kategorie === kategorie);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = result;
          return next;
        }
        return [...prev, result];
      });
      setEditSoll(false);
    } catch (err) {
      console.error("Fehler beim Speichern der Config:", err);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(datum + "T12:00:00");
    d.setDate(d.getDate() + days);
    setDatum(formatDate(d));
  };

  // Keyboard navigation: 2 cols per row (mitKnochen, ohneKnochen)
  const totalCols = 2;
  const totalRows = visibleZerleger.length;

  function cellKey(row: number, col: number) {
    return `${row}_${col}`;
  }

  function focusCell(row: number, col: number) {
    const r = Math.max(0, Math.min(row, totalRows - 1));
    const c = Math.max(0, Math.min(col, totalCols - 1));
    const ref = inputRefs.current.get(cellKey(r, c));
    if (ref) {
      ref.focus();
      ref.select();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, row: number, col: number) {
    if (e.key === " " || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) return;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        focusCell(row - 1, col);
        break;
      case "ArrowDown":
        e.preventDefault();
        focusCell(row + 1, col);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusCell(row, col - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        focusCell(row, col + 1);
        break;
      case "Enter":
        e.preventDefault();
        focusCell(row + 1, col);
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          if (col > 0) focusCell(row, col - 1);
          else if (row > 0) focusCell(row - 1, totalCols - 1);
        } else {
          if (col < totalCols - 1) focusCell(row, col + 1);
          else if (row < totalRows - 1) focusCell(row + 1, 0);
        }
        break;
      case "Escape":
        (e.target as HTMLInputElement).blur();
        break;
    }
  }

  const totalMk = eintraege
    .filter((e) => e.kategorie === kategorie)
    .reduce((s, e) => s + e.mitKnochen, 0);
  const totalOk = eintraege
    .filter((e) => e.kategorie === kategorie)
    .reduce((s, e) => s + e.ohneKnochen, 0);
  const totalProzent = totalMk > 0 ? (totalOk / totalMk) * 100 : 0;

  return (
    <div>
      {/* Kategorie Tabs */}
      <ul className="nav nav-tabs mb-3">
        {(["pute_fluegel", "pute_keule"] as PuteKategorie[]).map((kat) => (
          <li className="nav-item" key={kat}>
            <button
              className={`nav-link ${kategorie === kat ? "active" : ""}`}
              onClick={() => setKategorie(kat)}
            >
              {KATEGORIE_LABELS[kat]}
            </button>
          </li>
        ))}
      </ul>

      {/* Datum Navigation */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => shiftDate(-1)}>
          <i className="bi bi-chevron-left" />
        </button>
        <DatePicker
          selected={datum ? new Date(datum + "T00:00:00") : null}
          onChange={(d: Date | null) => { if (d) setDatum(formatDate(d)); }}
          dateFormat="dd.MM.yyyy"
          locale="de"
          className="form-control form-control-sm"
          calendarStartDay={1}
          showWeekNumbers
          popperPlacement="bottom-start"
          portalId="datepicker-portal"
        />
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => shiftDate(1)}>
          <i className="bi bi-chevron-right" />
        </button>
        <button
          className="btn btn-outline-dark btn-sm rounded-3 ms-2"
          onClick={() => setDatum(formatDate(new Date()))}
        >
          Heute
        </button>

        <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
          <span className="badge bg-secondary">SOLL: {(sollProzent * 100).toFixed(1)}%</span>
          {!editSoll ? (
            <button
              className="btn btn-outline-secondary btn-sm rounded-3"
              onClick={() => {
                setSollInput((sollProzent * 100).toFixed(1));
                setEditSoll(true);
              }}
            >
              SOLL ändern
            </button>
          ) : (
            <div className="d-flex gap-1">
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ maxWidth: 80 }}
                value={sollInput}
                onChange={(e) => setSollInput(e.target.value)}
                placeholder="%"
              />
              <button className="btn btn-success btn-sm" onClick={handleSollSave}>OK</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditSoll(false)}>X</button>
            </div>
          )}

          <button
            className={`btn btn-sm rounded-3 ${hideEmpty ? "btn-dark" : "btn-outline-secondary"}`}
            onClick={() => setHideEmpty((p) => !p)}
          >
            <i className="bi bi-eye-slash me-1" />
            Leere ausblenden
          </button>
        </div>
      </div>

      {visibleZerleger.length === 0 ? (
        <div className="alert alert-info">
          Keine Zerleger für {KATEGORIE_LABELS[kategorie]} zugewiesen. Zerleger können in der
          Zerleger-Verwaltung der Kategorie zugeordnet werden.
        </div>
      ) : (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-0">
            <div style={{ overflowX: "auto" }}>
              <table
                className="table table-sm table-bordered mb-0"
                style={{ fontSize: "0.82rem", borderCollapse: "collapse" }}
              >
                <thead style={{ position: "sticky", top: 0, zIndex: 4 }}>
                  <tr className="table-dark">
                    <th
                      className="align-middle text-center"
                      style={{
                        minWidth: 130,
                        position: "sticky",
                        left: 0,
                        zIndex: 5,
                        background: "#212529",
                      }}
                    >
                      Name
                    </th>
                    <th className="text-center" style={{ minWidth: 100, background: "#212529" }}>Mit Knochen (kg)</th>
                    <th className="text-center" style={{ minWidth: 100, background: "#212529" }}>Ohne Knochen (kg)</th>
                    <th className="text-center" style={{ minWidth: 70, background: "#212529" }}>%</th>
                    <th className="text-center" style={{ minWidth: 80, background: "#212529" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleZerleger.map((zer, rowIdx) => {
                    const draft = drafts.get(zer.id!) || { mitKnochen: "", ohneKnochen: "" };
                    const mk = parseFloat(draft.mitKnochen.replace(",", ".")) || 0;
                    const ok = parseFloat(draft.ohneKnochen.replace(",", ".")) || 0;
                    const pct = mk > 0 ? (ok / mk) * 100 : 0;
                    const isSaving = saving.has(zer.id!);
                    const hasData = mk > 0 && ok > 0;
                    const isAbove = hasData && pct / 100 >= sollProzent;
                    const isBelow = hasData && pct / 100 < sollProzent;

                    return (
                      <tr key={zer.id}>
                        <td
                          className="fw-medium"
                          style={{
                            position: "sticky",
                            left: 0,
                            zIndex: 1,
                            background:
                              focusedRow === rowIdx ? "#cfe2ff" : rowIdx % 2 === 0 ? "#fff" : "#f8f9fa",
                            whiteSpace: "nowrap",
                            fontWeight: focusedRow === rowIdx ? 700 : undefined,
                            transition: "background 0.15s",
                          }}
                        >
                          {zer.name}
                        </td>
                        <td className="p-0" style={{ background: isSaving ? "#e8f5e9" : undefined }}>
                          <input
                            ref={(el) => { if (el) inputRefs.current.set(cellKey(rowIdx, 0), el); }}
                            type="text"
                            autoComplete="off"
                            className="form-control form-control-sm border-0 text-center rounded-0 bg-transparent"
                            style={{ height: 28, fontSize: "0.82rem" }}
                            value={draft.mitKnochen}
                            onChange={(e) => handleChange(zer.id!, "mitKnochen", e.target.value)}
                            onBlur={() => saveCell(zer.id!, zer.name)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, 0)}
                            onFocus={(e) => { setFocusedRow(rowIdx); e.target.select(); }}
                          />
                        </td>
                        <td className="p-0" style={{ background: isSaving ? "#e8f5e9" : undefined }}>
                          <input
                            ref={(el) => { if (el) inputRefs.current.set(cellKey(rowIdx, 1), el); }}
                            type="text"
                            autoComplete="off"
                            className="form-control form-control-sm border-0 text-center rounded-0 bg-transparent"
                            style={{ height: 28, fontSize: "0.82rem" }}
                            value={draft.ohneKnochen}
                            onChange={(e) => handleChange(zer.id!, "ohneKnochen", e.target.value)}
                            onBlur={() => saveCell(zer.id!, zer.name)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, 1)}
                            onFocus={(e) => { setFocusedRow(rowIdx); e.target.select(); }}
                          />
                        </td>
                        <td
                          className={`text-center fw-bold ${isAbove ? "text-success" : isBelow ? "text-danger" : "text-muted"}`}
                          style={{ height: 28, lineHeight: "28px", fontSize: "0.82rem" }}
                        >
                          {hasData ? pct.toFixed(1) + "%" : ""}
                        </td>
                        <td className="text-center" style={{ height: 28, lineHeight: "28px" }}>
                          {isSaving ? (
                            <span className="spinner-border spinner-border-sm" />
                          ) : isAbove ? (
                            <span className="text-success">Gut</span>
                          ) : isBelow ? (
                            <span className="text-danger">Unter SOLL</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Gesamt-Zeile */}
                  <tr className="table-warning fw-bold">
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        background: "#fff3cd",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Gesamt
                    </td>
                    <td className="text-center">{totalMk > 0 ? totalMk.toFixed(1) : ""}</td>
                    <td className="text-center">{totalOk > 0 ? totalOk.toFixed(1) : ""}</td>
                    <td className={`text-center ${totalMk > 0 ? (totalProzent / 100 >= sollProzent ? "text-success" : "text-danger") : ""}`}>
                      {totalMk > 0 ? totalProzent.toFixed(1) + "%" : ""}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
