import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { de } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  getGanzHaehnchenEintraege,
  upsertGanzHaehnchenEintrag,
  deleteGanzHaehnchenEintrag,
  getGanzHaehnchenConfig,
  updateGanzHaehnchenConfig,
  getAllGefluegelZerleger,
} from "../../backend/api";
import {
  GanzHaehnchenEintragResource,
  GanzHaehnchenConfigResource,
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
  gewichtGesamt: string;
  brust: string;
  keule: string;
  fluegel: string;
};

const EMPTY_DRAFT: Draft = {
  anzahlKisten: "",
  gewichtGesamt: "",
  brust: "",
  keule: "",
  fluegel: "",
};

type DraftField = keyof Draft;
const FIELDS: DraftField[] = ["anzahlKisten", "gewichtGesamt", "brust", "keule", "fluegel"];

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

export default function GanzHaehnchenUebersicht() {
  const [datum, setDatum] = useState(formatDate(new Date()));
  const [zerleger, setZerleger] = useState<GefluegelZerlegerResource[]>([]);
  const [eintraege, setEintraege] = useState<GanzHaehnchenEintragResource[]>([]);
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [config, setConfig] = useState<GanzHaehnchenConfigResource>({
    sollBrust: 0.436,
    sollKeule: 0.358,
    sollFluegel: 0.087,
  });
  const [editSoll, setEditSoll] = useState(false);
  const [sollForm, setSollForm] = useState({ brust: "43.6", keule: "35.8", fluegel: "8.7" });
  const [hideEmpty, setHideEmpty] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const loadData = useCallback(async () => {
    try {
      const [z, e, c] = await Promise.all([
        getAllGefluegelZerleger(),
        getGanzHaehnchenEintraege(datum),
        getGanzHaehnchenConfig(),
      ]);
      setZerleger(z);
      setEintraege(e);
      setConfig(c);

      const newDrafts = new Map<string, Draft>();
      const active = z.filter((zer) => zer.aktiv && zer.kategorien?.includes("ganz_haehnchen"));
      for (const zer of active) {
        const entry = e.find((en) => en.zerlegerId === zer.id);
        newDrafts.set(zer.id!, {
          anzahlKisten: entry && entry.anzahlKisten ? String(entry.anzahlKisten) : "",
          gewichtGesamt: entry && entry.gewichtGesamt ? String(entry.gewichtGesamt) : "",
          brust: entry && entry.brust ? String(entry.brust) : "",
          keule: entry && entry.keule ? String(entry.keule) : "",
          fluegel: entry && entry.fluegel ? String(entry.fluegel) : "",
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
        .filter((z) => z.aktiv && z.kategorien?.includes("ganz_haehnchen"))
        .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || a.name.localeCompare(b.name)),
    [zerleger]
  );

  const visibleZerleger = hideEmpty
    ? activeZerleger.filter((z) => {
        const d = drafts.get(z.id!);
        return d && (d.gewichtGesamt || d.brust || d.keule || d.fluegel);
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
        gewichtGesamt: autoSum(draft.gewichtGesamt),
        brust: autoSum(draft.brust),
        keule: autoSum(draft.keule),
        fluegel: autoSum(draft.fluegel),
      };
      if (JSON.stringify(summed) !== JSON.stringify(draft)) {
        setDrafts((prev) => {
          const next = new Map(prev);
          next.set(zerlegerId, summed);
          return next;
        });
      }

      const kistenN = parseNum(summed.anzahlKisten);
      const gewN = parseNum(summed.gewichtGesamt);
      const bN = parseNum(summed.brust);
      const kN = parseNum(summed.keule);
      const fN = parseNum(summed.fluegel);

      const existing = eintraege.find((e) => e.zerlegerId === zerlegerId);

      if (gewN === 0 && bN === 0 && kN === 0 && fN === 0 && kistenN === 0) {
        if (existing?.id) {
          try {
            await deleteGanzHaehnchenEintrag(existing.id);
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
        const result = await upsertGanzHaehnchenEintrag({
          datum,
          zerlegerId,
          zerlegerName,
          anzahlKisten: kistenN,
          gewichtGesamt: gewN,
          brust: bN,
          keule: kN,
          fluegel: fN,
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
    const brust = parseFloat(sollForm.brust.replace(",", "."));
    const keule = parseFloat(sollForm.keule.replace(",", "."));
    const fluegel = parseFloat(sollForm.fluegel.replace(",", "."));
    if ([brust, keule, fluegel].some((x) => isNaN(x) || x < 0 || x > 100)) return;
    try {
      const result = await updateGanzHaehnchenConfig({
        sollBrust: brust / 100,
        sollKeule: keule / 100,
        sollFluegel: fluegel / 100,
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

  // Keyboard-Navigation
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

  // Totals
  const totalKisten = eintraege.reduce((s, e) => s + e.anzahlKisten, 0);
  const totalGew = eintraege.reduce((s, e) => s + e.gewichtGesamt, 0);
  const totalB = eintraege.reduce((s, e) => s + e.brust, 0);
  const totalK = eintraege.reduce((s, e) => s + e.keule, 0);
  const totalF = eintraege.reduce((s, e) => s + e.fluegel, 0);
  const totalPctB = totalGew > 0 ? (totalB / totalGew) * 100 : 0;
  const totalPctK = totalGew > 0 ? (totalK / totalGew) * 100 : 0;
  const totalPctF = totalGew > 0 ? (totalF / totalGew) * 100 : 0;

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
            SOLL: B {(config.sollBrust * 100).toFixed(1)}% · K {(config.sollKeule * 100).toFixed(1)}% · F {(config.sollFluegel * 100).toFixed(1)}%
          </span>
          {!editSoll ? (
            <button
              className="btn btn-outline-secondary btn-sm rounded-3"
              onClick={() => {
                setSollForm({
                  brust: (config.sollBrust * 100).toFixed(1),
                  keule: (config.sollKeule * 100).toFixed(1),
                  fluegel: (config.sollFluegel * 100).toFixed(1),
                });
                setEditSoll(true);
              }}
            >
              SOLL ändern
            </button>
          ) : (
            <div className="d-flex gap-1 flex-wrap">
              <input type="text" className="form-control form-control-sm" style={{ maxWidth: 70 }}
                value={sollForm.brust} onChange={(e) => setSollForm({ ...sollForm, brust: e.target.value })} placeholder="Brust %" />
              <input type="text" className="form-control form-control-sm" style={{ maxWidth: 70 }}
                value={sollForm.keule} onChange={(e) => setSollForm({ ...sollForm, keule: e.target.value })} placeholder="Keule %" />
              <input type="text" className="form-control form-control-sm" style={{ maxWidth: 70 }}
                value={sollForm.fluegel} onChange={(e) => setSollForm({ ...sollForm, fluegel: e.target.value })} placeholder="Flügel %" />
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
          Keine Zerleger für Ganz Hähnchen zugewiesen.
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
                    <th className="text-center" style={{ minWidth: 90, background: "#212529" }}>Gewicht</th>
                    <th className="text-center" style={{ minWidth: 90, background: "#212529" }}>
                      Brust <span className="fw-normal opacity-75">({(config.sollBrust * 100).toFixed(1)}%)</span>
                    </th>
                    <th className="text-center" style={{ minWidth: 65, background: "#212529" }}>% B</th>
                    <th className="text-center" style={{ minWidth: 90, background: "#212529" }}>
                      Keule <span className="fw-normal opacity-75">({(config.sollKeule * 100).toFixed(1)}%)</span>
                    </th>
                    <th className="text-center" style={{ minWidth: 65, background: "#212529" }}>% K</th>
                    <th className="text-center" style={{ minWidth: 90, background: "#212529" }}>
                      Flügel <span className="fw-normal opacity-75">({(config.sollFluegel * 100).toFixed(1)}%)</span>
                    </th>
                    <th className="text-center" style={{ minWidth: 65, background: "#212529" }}>% F</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleZerleger.map((zer, rowIdx) => {
                    const draft = drafts.get(zer.id!) ?? EMPTY_DRAFT;
                    const gew = parseNum(draft.gewichtGesamt);
                    const b = parseNum(draft.brust);
                    const k = parseNum(draft.keule);
                    const f = parseNum(draft.fluegel);
                    const pctB = gew > 0 ? (b / gew) * 100 : 0;
                    const pctK = gew > 0 ? (k / gew) * 100 : 0;
                    const pctF = gew > 0 ? (f / gew) * 100 : 0;
                    const isSaving = saving.has(zer.id!);
                    const hasData = gew > 0;

                    const pctCell = (val: number, pct: number, soll: number) => (
                      <td
                        className={`text-center fw-bold ${
                          hasData && val > 0
                            ? pct / 100 >= soll
                              ? "text-success"
                              : "text-danger"
                            : "text-muted"
                        }`}
                        style={{ height: 28, lineHeight: "28px", fontSize: "0.82rem" }}
                      >
                        {hasData && val > 0 ? pct.toFixed(1) + "%" : ""}
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
                          // Render editable input, and after Brust/Keule/Fluegel insert % readonly cells
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
                          // Insert readonly %-cell after each output field
                          if (field === "brust") return [cell, pctCell(b, pctB, config.sollBrust)];
                          if (field === "keule") return [cell, pctCell(k, pctK, config.sollKeule)];
                          if (field === "fluegel") return [cell, pctCell(f, pctF, config.sollFluegel)];
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
                    <td className="text-center">{totalB > 0 ? totalB.toFixed(1) : ""}</td>
                    <td className={`text-center ${totalB > 0 ? (totalPctB / 100 >= config.sollBrust ? "text-success" : "text-danger") : ""}`}>
                      {totalB > 0 ? totalPctB.toFixed(1) + "%" : ""}
                    </td>
                    <td className="text-center">{totalK > 0 ? totalK.toFixed(1) : ""}</td>
                    <td className={`text-center ${totalK > 0 ? (totalPctK / 100 >= config.sollKeule ? "text-success" : "text-danger") : ""}`}>
                      {totalK > 0 ? totalPctK.toFixed(1) + "%" : ""}
                    </td>
                    <td className="text-center">{totalF > 0 ? totalF.toFixed(1) : ""}</td>
                    <td className={`text-center ${totalF > 0 ? (totalPctF / 100 >= config.sollFluegel ? "text-success" : "text-danger") : ""}`}>
                      {totalF > 0 ? totalPctF.toFixed(1) + "%" : ""}
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
