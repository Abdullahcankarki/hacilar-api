import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { de } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  getBrustEintraege,
  upsertBrustEintrag,
  deleteBrustEintrag,
  getBrustConfig,
  updateBrustConfig,
  getAllGefluegelZerleger,
} from "../../backend/api";
import {
  BrustEintragResource,
  BrustConfigResource,
  GefluegelZerlegerResource,
} from "../../Resources";

registerLocale("de", de);

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Draft = {
  anzahlKisten: string;
  gewichtMitKnochen: string;
  brustMitHaut: string;
  brustOhneHaut: string;
  haut: string;
};

const EMPTY_DRAFT: Draft = {
  anzahlKisten: "",
  gewichtMitKnochen: "",
  brustMitHaut: "",
  brustOhneHaut: "",
  haut: "",
};

type DraftField = keyof Draft;
const FIELDS: DraftField[] = [
  "anzahlKisten",
  "gewichtMitKnochen",
  "brustMitHaut",
  "brustOhneHaut",
  "haut",
];

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

function parseNum(s: string): number {
  return parseFloat(s.replace(",", ".")) || 0;
}

export default function BrustUebersicht() {
  const [datum, setDatum] = useState(formatDate(new Date()));
  const [zerleger, setZerleger] = useState<GefluegelZerlegerResource[]>([]);
  const [eintraege, setEintraege] = useState<BrustEintragResource[]>([]);
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [config, setConfig] = useState<BrustConfigResource>({
    sollMitHaut: 0.9,
    sollOhneHaut: 0.81,
    sollHaut: 0.09,
  });
  const [editSoll, setEditSoll] = useState(false);
  const [sollForm, setSollForm] = useState({ mitHaut: "90", ohneHaut: "81", haut: "9" });
  const [hideEmpty, setHideEmpty] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const loadData = useCallback(async () => {
    try {
      const [z, e, c] = await Promise.all([
        getAllGefluegelZerleger(),
        getBrustEintraege(datum),
        getBrustConfig(),
      ]);
      setZerleger(z);
      setEintraege(e);
      setConfig(c);

      const newDrafts = new Map<string, Draft>();
      const active = z.filter((zer) => zer.aktiv && zer.kategorien?.includes("brust"));
      for (const zer of active) {
        const entry = e.find((en) => en.zerlegerId === zer.id);
        newDrafts.set(zer.id!, {
          anzahlKisten: entry && entry.anzahlKisten ? String(entry.anzahlKisten) : "",
          gewichtMitKnochen: entry && entry.gewichtMitKnochen ? String(entry.gewichtMitKnochen) : "",
          brustMitHaut: entry && entry.brustMitHaut > 0 ? String(entry.brustMitHaut) : "",
          brustOhneHaut: entry && entry.brustOhneHaut > 0 ? String(entry.brustOhneHaut) : "",
          haut: entry && entry.haut > 0 ? String(entry.haut) : "",
        });
      }
      setDrafts(newDrafts);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    }
  }, [datum]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeZerleger = useMemo(
    () =>
      zerleger
        .filter((z) => z.aktiv && z.kategorien?.includes("brust"))
        .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || a.name.localeCompare(b.name)),
    [zerleger]
  );

  const visibleZerleger = hideEmpty
    ? activeZerleger.filter((z) => {
        const d = drafts.get(z.id!);
        return d && (d.gewichtMitKnochen || d.brustMitHaut || d.brustOhneHaut);
      })
    : activeZerleger;

  const handleChange = (zerlegerId: string, field: DraftField, value: string) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const current = next.get(zerlegerId) ?? EMPTY_DRAFT;
      next.set(zerlegerId, { ...current, [field]: value });
      return next;
    });
  };

  const saveRow = useCallback(
    async (zerlegerId: string, zerlegerName: string) => {
      const draft = drafts.get(zerlegerId);
      if (!draft) return;

      const summed: Draft = {
        anzahlKisten: autoSum(draft.anzahlKisten),
        gewichtMitKnochen: autoSum(draft.gewichtMitKnochen),
        brustMitHaut: autoSum(draft.brustMitHaut),
        brustOhneHaut: autoSum(draft.brustOhneHaut),
        haut: autoSum(draft.haut),
      };
      if (JSON.stringify(summed) !== JSON.stringify(draft)) {
        setDrafts((prev) => {
          const next = new Map(prev);
          next.set(zerlegerId, summed);
          return next;
        });
      }

      const gewN = parseNum(summed.gewichtMitKnochen);
      const mhN = parseNum(summed.brustMitHaut);
      const ohN = parseNum(summed.brustOhneHaut);
      const hN = parseNum(summed.haut);
      const kistenN = parseNum(summed.anzahlKisten);

      const existing = eintraege.find((e) => e.zerlegerId === zerlegerId);

      if (gewN === 0 && mhN === 0 && ohN === 0 && hN === 0 && kistenN === 0) {
        if (existing?.id) {
          try {
            await deleteBrustEintrag(existing.id);
            setEintraege((prev) => prev.filter((e) => e.id !== existing.id));
          } catch (err) {
            console.error("Fehler beim Löschen:", err);
          }
        }
        return;
      }

      if (gewN === 0) return;

      setSaving((prev) => new Set(prev).add(zerlegerId));
      try {
        const result = await upsertBrustEintrag({
          datum,
          zerlegerId,
          zerlegerName,
          anzahlKisten: kistenN,
          gewichtMitKnochen: gewN,
          brustMitHaut: mhN,
          brustOhneHaut: ohN,
          haut: hN,
        });
        setEintraege((prev) => {
          const idx = prev.findIndex((e) => e.zerlegerId === zerlegerId);
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
    [drafts, datum, eintraege]
  );

  const handleSollSave = async () => {
    const mh = parseFloat(sollForm.mitHaut.replace(",", "."));
    const oh = parseFloat(sollForm.ohneHaut.replace(",", "."));
    const h = parseFloat(sollForm.haut.replace(",", "."));
    if ([mh, oh, h].some((x) => isNaN(x) || x < 0 || x > 100)) return;
    try {
      const result = await updateBrustConfig({
        sollMitHaut: mh / 100,
        sollOhneHaut: oh / 100,
        sollHaut: h / 100,
      });
      setConfig(result);
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

  const totalCols = FIELDS.length;
  const totalRows = visibleZerleger.length;
  const cellKey = (r: number, c: number) => `${r}_${c}`;

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
      case "ArrowUp": e.preventDefault(); focusCell(row - 1, col); break;
      case "ArrowDown": e.preventDefault(); focusCell(row + 1, col); break;
      case "ArrowLeft": e.preventDefault(); focusCell(row, col - 1); break;
      case "ArrowRight": e.preventDefault(); focusCell(row, col + 1); break;
      case "Enter": e.preventDefault(); focusCell(row + 1, col); break;
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

  const totalKisten = eintraege.reduce((s, e) => s + e.anzahlKisten, 0);
  const totalGew = eintraege.reduce((s, e) => s + e.gewichtMitKnochen, 0);
  const totalMh = eintraege.reduce((s, e) => s + e.brustMitHaut, 0);
  const totalOh = eintraege.reduce((s, e) => s + e.brustOhneHaut, 0);
  const totalH = eintraege.reduce((s, e) => s + e.haut, 0);

  return (
    <div>
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
          <span className="badge bg-secondary">
            SOLL: m.Haut {(config.sollMitHaut * 100).toFixed(1)}% · o.Haut {(config.sollOhneHaut * 100).toFixed(1)}% · Haut {(config.sollHaut * 100).toFixed(1)}%
          </span>
          {!editSoll ? (
            <button
              className="btn btn-outline-secondary btn-sm rounded-3"
              onClick={() => {
                setSollForm({
                  mitHaut: (config.sollMitHaut * 100).toFixed(1),
                  ohneHaut: (config.sollOhneHaut * 100).toFixed(1),
                  haut: (config.sollHaut * 100).toFixed(1),
                });
                setEditSoll(true);
              }}
            >
              SOLL ändern
            </button>
          ) : (
            <div className="d-flex gap-1 flex-wrap">
              <input type="text" className="form-control form-control-sm" style={{ maxWidth: 70 }}
                value={sollForm.mitHaut} onChange={(e) => setSollForm({ ...sollForm, mitHaut: e.target.value })} placeholder="m.Haut" />
              <input type="text" className="form-control form-control-sm" style={{ maxWidth: 70 }}
                value={sollForm.ohneHaut} onChange={(e) => setSollForm({ ...sollForm, ohneHaut: e.target.value })} placeholder="o.Haut" />
              <input type="text" className="form-control form-control-sm" style={{ maxWidth: 70 }}
                value={sollForm.haut} onChange={(e) => setSollForm({ ...sollForm, haut: e.target.value })} placeholder="Haut" />
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
          Keine Zerleger für Brust zugewiesen.
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
                    <th className="text-center" style={{ minWidth: 75, background: "#212529" }}>Kisten</th>
                    <th className="text-center" style={{ minWidth: 100, background: "#212529" }}>Mit Knochen</th>
                    <th className="text-center" style={{ minWidth: 100, background: "#212529" }}>
                      Brust m. Haut <span className="fw-normal opacity-75">({(config.sollMitHaut * 100).toFixed(1)}%)</span>
                    </th>
                    <th className="text-center" style={{ minWidth: 65, background: "#212529" }}>% m.H</th>
                    <th className="text-center" style={{ minWidth: 100, background: "#212529" }}>
                      Brust o. Haut <span className="fw-normal opacity-75">({(config.sollOhneHaut * 100).toFixed(1)}%)</span>
                    </th>
                    <th className="text-center" style={{ minWidth: 65, background: "#212529" }}>% o.H</th>
                    <th className="text-center" style={{ minWidth: 85, background: "#212529" }}>
                      Haut <span className="fw-normal opacity-75">({(config.sollHaut * 100).toFixed(1)}%)</span>
                    </th>
                    <th className="text-center" style={{ minWidth: 65, background: "#212529" }}>% Haut</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleZerleger.map((zer, rowIdx) => {
                    const draft = drafts.get(zer.id!) ?? EMPTY_DRAFT;
                    const gew = parseNum(draft.gewichtMitKnochen);
                    const mh = parseNum(draft.brustMitHaut);
                    const oh = parseNum(draft.brustOhneHaut);
                    const h = parseNum(draft.haut);
                    const pctMh = gew > 0 ? (mh / gew) * 100 : 0;
                    const pctOh = gew > 0 ? (oh / gew) * 100 : 0;
                    const pctH = gew > 0 ? (h / gew) * 100 : 0;
                    const isSaving = saving.has(zer.id!);

                    const pctCell = (val: number, pct: number, soll: number) => (
                      <td
                        className={`text-center fw-bold ${
                          gew > 0 && val > 0
                            ? pct / 100 >= soll
                              ? "text-success"
                              : "text-danger"
                            : "text-muted"
                        }`}
                        style={{ height: 28, lineHeight: "28px", fontSize: "0.82rem" }}
                      >
                        {gew > 0 && val > 0 ? pct.toFixed(1) + "%" : ""}
                      </td>
                    );

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
                        {FIELDS.map((field, colIdx) => {
                          const cell = (
                            <td
                              key={field}
                              className="p-0"
                              style={{ background: isSaving ? "#e8f5e9" : undefined }}
                            >
                              <input
                                ref={(el) => { if (el) inputRefs.current.set(cellKey(rowIdx, colIdx), el); }}
                                type="text"
                                autoComplete="off"
                                className="form-control form-control-sm border-0 text-center rounded-0 bg-transparent"
                                style={{ height: 28, fontSize: "0.82rem" }}
                                value={draft[field]}
                                onChange={(e) => handleChange(zer.id!, field, e.target.value)}
                                onBlur={() => saveRow(zer.id!, zer.name)}
                                onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                                onFocus={(e) => { setFocusedRow(rowIdx); e.target.select(); }}
                              />
                            </td>
                          );
                          if (field === "brustMitHaut") return [cell, pctCell(mh, pctMh, config.sollMitHaut)];
                          if (field === "brustOhneHaut") return [cell, pctCell(oh, pctOh, config.sollOhneHaut)];
                          if (field === "haut") return [cell, pctCell(h, pctH, config.sollHaut)];
                          return cell;
                        })}
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
                    <td className="text-center">{totalKisten || ""}</td>
                    <td className="text-center">{totalGew > 0 ? totalGew.toFixed(1) : ""}</td>
                    <td className="text-center">{totalMh > 0 ? totalMh.toFixed(1) : ""}</td>
                    <td className={`text-center ${totalMh > 0 ? ((totalMh / totalGew) >= config.sollMitHaut ? "text-success" : "text-danger") : ""}`}>
                      {totalMh > 0 && totalGew > 0 ? ((totalMh / totalGew) * 100).toFixed(1) + "%" : ""}
                    </td>
                    <td className="text-center">{totalOh > 0 ? totalOh.toFixed(1) : ""}</td>
                    <td className={`text-center ${totalOh > 0 ? ((totalOh / totalGew) >= config.sollOhneHaut ? "text-success" : "text-danger") : ""}`}>
                      {totalOh > 0 && totalGew > 0 ? ((totalOh / totalGew) * 100).toFixed(1) + "%" : ""}
                    </td>
                    <td className="text-center">{totalH > 0 ? totalH.toFixed(1) : ""}</td>
                    <td className={`text-center ${totalH > 0 ? ((totalH / totalGew) >= config.sollHaut ? "text-success" : "text-danger") : ""}`}>
                      {totalH > 0 && totalGew > 0 ? ((totalH / totalGew) * 100).toFixed(1) + "%" : ""}
                    </td>
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
