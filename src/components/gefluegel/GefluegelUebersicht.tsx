import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  getAllGefluegelLieferanten,
  getAllGefluegelZerleger,
  getGefluegelEintraege,
  upsertGefluegelEintrag,
  deleteGefluegelEintrag,
  getGefluegelTagesConfig,
  saveGefluegelTagesConfig,
} from "../../backend/api";
import {
  GefluegelLieferantResource,
  GefluegelZerlegerResource,
  GefluegelEintragResource,
} from "../../Resources";
import GefluegelStatistik from "./GefluegelStatistik";

type Toast = { type: "success" | "error"; msg: string } | null;

/** Lokaler Zellenwert (noch nicht gespeichert) */
type CellDraft = { kisten: string; kg: string };

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type Tab = "tag" | "woche" | "monat" | "formeln";

export default function GefluegelUebersicht() {
  const [activeTab, setActiveTab] = useState<Tab>("tag");
  const [datum, setDatum] = useState(formatDate(new Date()));
  const [lieferanten, setLieferanten] = useState<GefluegelLieferantResource[]>([]);
  const [zerleger, setZerleger] = useState<GefluegelZerlegerResource[]>([]);
  const [eintraege, setEintraege] = useState<GefluegelEintragResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [saving, setSaving] = useState<string | null>(null); // "zerlegerId_lieferantId" currently saving
  const [vkDurchschnitt, setVkDurchschnitt] = useState(3.3);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [hiddenLieferanten, setHiddenLieferantenRaw] = useState<Set<string>>(new Set());
  const [showLiefFilter, setShowLiefFilter] = useState(false);
  const [hideEmptyZerleger, setHideEmptyZerleger] = useState(false);

  // (Quick-Calculator removed – inline sum via spaces in fields)

  const setHiddenLieferanten = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setHiddenLieferantenRaw((prev) => {
      const newSet = updater(prev);
      saveGefluegelTagesConfig(datum, Array.from(newSet)).catch(() => {});
      return newSet;
    });
  }, [datum]);

  // Refs für alle editierbaren Inputs: key = "row_col"
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const activeLieferanten = useMemo(
    () => lieferanten.filter((l) => l.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge),
    [lieferanten]
  );

  const visibleLieferanten = useMemo(
    () => activeLieferanten.filter((l) => !hiddenLieferanten.has(l.id!)),
    [activeLieferanten, hiddenLieferanten]
  );

  const activeZerleger = useMemo(
    () => zerleger.filter((z) => z.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name)),
    [zerleger]
  );

  const visibleZerleger = useMemo(() => {
    if (!hideEmptyZerleger) return activeZerleger;
    return activeZerleger.filter((z) =>
      eintraege.some((e) => e.zerlegerId === z.id && (e.kisten > 0 || e.kg > 0))
    );
  }, [activeZerleger, eintraege, hideEmptyZerleger]);

  // Lokale Draft-Werte für alle Zellen (String, damit leere Felder möglich sind)
  const [drafts, setDrafts] = useState<Map<string, CellDraft>>(new Map());

  const eintragMap = useMemo(() => {
    const map = new Map<string, GefluegelEintragResource>();
    for (const e of eintraege) {
      map.set(`${e.zerlegerId}_${e.lieferantId}`, e);
    }
    return map;
  }, [eintraege]);

  // Drafts aus Einträgen initialisieren
  const syncDrafts = useCallback(
    (entries: GefluegelEintragResource[]) => {
      const map = new Map<string, CellDraft>();
      for (const z of activeZerleger) {
        for (const l of activeLieferanten) {
          const key = `${z.id}_${l.id}`;
          const e = entries.find(
            (x) => x.zerlegerId === z.id && x.lieferantId === l.id
          );
          map.set(key, {
            kisten: e && e.kisten ? String(e.kisten) : "",
            kg: e && e.kg ? String(e.kg) : "",
          });
        }
      }
      setDrafts(map);
    },
    [activeZerleger, activeLieferanten]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lief, zerl, eint, cfg] = await Promise.all([
        getAllGefluegelLieferanten(),
        getAllGefluegelZerleger(),
        getGefluegelEintraege(datum),
        getGefluegelTagesConfig(datum),
      ]);
      setLieferanten(lief);
      setZerleger(zerl);
      setEintraege(eint);
      setHiddenLieferantenRaw(new Set(cfg.hiddenLieferanten));
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Laden fehlgeschlagen" });
    } finally {
      setLoading(false);
    }
  }, [datum]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Wenn Daten geladen, Drafts initialisieren
  useEffect(() => {
    if (activeZerleger.length > 0 && activeLieferanten.length > 0) {
      syncDrafts(eintraege);
    }
  }, [eintraege, activeZerleger, activeLieferanten, syncDrafts]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const changeDate = (days: number) => {
    const d = new Date(datum + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDatum(formatDate(d));
  };

  // --- Grid Navigation ---
  // Editierbare Spalten pro Zeile: [kisten_0, kg_0, kisten_1, kg_1, ...]
  const totalCols = visibleLieferanten.length * 2;
  const totalRows = visibleZerleger.length;

  function cellKey(row: number, col: number) {
    return `${row}_${col}`;
  }

  function focusCell(row: number, col: number) {
    const clamped = {
      row: Math.max(0, Math.min(row, totalRows - 1)),
      col: Math.max(0, Math.min(col, totalCols - 1)),
    };
    const ref = inputRefs.current.get(cellKey(clamped.row, clamped.col));
    if (ref) {
      ref.focus();
      ref.select();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, row: number, col: number) {
    // Leerzeichen und normale Zeichen durchlassen (fuer inline-Rechner)
    if (e.key === " " || e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      return; // nicht abfangen
    }
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
          // Rückwärts
          if (col > 0) {
            focusCell(row, col - 1);
          } else if (row > 0) {
            focusCell(row - 1, totalCols - 1);
          }
        } else {
          // Vorwärts
          if (col < totalCols - 1) {
            focusCell(row, col + 1);
          } else if (row < totalRows - 1) {
            focusCell(row + 1, 0);
          }
        }
        break;
      case "Escape":
        (e.target as HTMLInputElement).blur();
        break;
    }
  }

  /** Parse a field value: if it contains spaces, sum all numbers. */
  function autoSum(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    const parts = trimmed.split(/\s+/);
    if (parts.length <= 1) return trimmed;
    const nums = parts.map((s) => Number(s.replace(",", "."))).filter((n) => !isNaN(n));
    if (nums.length === 0) return trimmed;
    const sum = nums.reduce((a, b) => a + b, 0);
    // Format: if integer show as integer, otherwise 1 decimal
    return sum === Math.floor(sum) ? String(sum) : sum.toFixed(1);
  }

  // --- Auto-sum + Auto-Save bei Blur ---
  const handleBlur = useCallback(
    (zerlegerId: string, lieferantId: string) => {
      const key = `${zerlegerId}_${lieferantId}`;
      const draft = drafts.get(key);
      if (!draft) return;
      const summedKisten = autoSum(draft.kisten);
      const summedKg = autoSum(draft.kg);
      if (summedKisten !== draft.kisten || summedKg !== draft.kg) {
        setDrafts((prev) => {
          const next = new Map(prev);
          next.set(key, { kisten: summedKisten, kg: summedKg });
          return next;
        });
      }
      // saveCell will read from the updated drafts via setTimeout
      setTimeout(() => saveCellInner(zerlegerId, lieferantId, summedKisten, summedKg), 0);
    },
    [drafts]
  );

  const saveCellInner = useCallback(
    async (zerlegerId: string, lieferantId: string, kistenStr: string, kgStr: string) => {
      const key = `${zerlegerId}_${lieferantId}`;

      const kisten = kistenStr ? parseFloat(kistenStr.replace(",", ".")) : 0;
      const kg = kgStr ? parseFloat(kgStr.replace(",", ".")) : 0;

      // Prüfen ob sich etwas geändert hat
      const existing = eintragMap.get(key);
      const oldKisten = existing?.kisten ?? 0;
      const oldKg = existing?.kg ?? 0;
      if (kisten === oldKisten && kg === oldKg) return;

      // Wenn beides 0/leer und Eintrag existiert → löschen
      if (kisten === 0 && kg === 0) {
        if (existing?.id) {
          setSaving(key);
          try {
            await deleteGefluegelEintrag(existing.id);
            setEintraege((prev) => prev.filter((e) => e.id !== existing.id));
          } catch (e: any) {
            setToast({ type: "error", msg: e?.message ?? "Fehler" });
          } finally {
            setSaving(null);
          }
        }
        return;
      }

      // Wenn nur ein Feld gefüllt ist, noch nicht speichern
      if ((kisten > 0 && kg === 0) || (kisten === 0 && kg > 0)) return;

      const z = activeZerleger.find((x) => x.id === zerlegerId);
      const l = activeLieferanten.find((x) => x.id === lieferantId);
      if (!z || !l) return;

      setSaving(key);
      try {
        const saved = await upsertGefluegelEintrag({
          datum,
          zerlegerId: z.id!,
          zerlegerName: z.name,
          lieferantId: l.id!,
          lieferantName: l.name,
          kisten,
          kg,
        });
        setEintraege((prev) => {
          const idx = prev.findIndex(
            (e) => e.zerlegerId === saved.zerlegerId && e.lieferantId === saved.lieferantId
          );
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = saved;
            return copy;
          }
          return [...prev, saved];
        });
      } catch (e: any) {
        setToast({ type: "error", msg: e?.message ?? "Speichern fehlgeschlagen" });
      } finally {
        setSaving(null);
      }
    },
    [eintragMap, activeZerleger, activeLieferanten, datum]
  );

  // --- Berechnungen ---
  function calcProzent(kisten: number, kg: number, kistenGewichtKg: number): number | null {
    if (!kisten || kisten === 0) return null;
    return kg / (kisten * kistenGewichtKg);
  }

  function calcEkNachZerlegung(
    kisten: number, kg: number, ekProKg: number,
    zerlegungskostenProKiste: number, kistenGewichtKg: number
  ): number | null {
    if (!kg || kg === 0) return null;
    return (kisten * kistenGewichtKg * ekProKg + kisten * zerlegungskostenProKiste) / kg;
  }

  const lieferantSummen = useMemo(() => {
    const sums: Record<string, { kisten: number; kg: number }> = {};
    for (const l of activeLieferanten) sums[l.id!] = { kisten: 0, kg: 0 };
    for (const e of eintraege) {
      if (sums[e.lieferantId]) {
        sums[e.lieferantId].kisten += e.kisten;
        sums[e.lieferantId].kg += e.kg;
      }
    }
    return sums;
  }, [eintraege, activeLieferanten]);

  // --- Rendering ---

  if (loading)
    return (
      <div className="container-fluid my-4 text-center">
        <div className="spinner-border" />
      </div>
    );

  return (
    <div className="container-fluid my-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="mb-0">Geflügel-Zerlegung — Hä. Keule</h4>
        {saving && activeTab === "tag" && (
          <span className="text-muted small">
            <span className="spinner-border spinner-border-sm me-1" />
            Speichert…
          </span>
        )}
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        {([["tag", "Tag"], ["woche", "Woche"], ["monat", "Monat"], ["formeln", "Formeln"]] as [Tab, string][]).map(
          ([key, label]) => (
            <li className="nav-item" key={key}>
              <button
                className={`nav-link ${activeTab === key ? "active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            </li>
          )
        )}
      </ul>

      {activeTab === "woche" || activeTab === "monat" ? (
        <GefluegelStatistik mode={activeTab} />
      ) : activeTab === "formeln" ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-header bg-dark text-white rounded-top-4">
            <h6 className="mb-0">Berechnungsformeln</h6>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-sm table-bordered mb-0" style={{ fontSize: "0.85rem" }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "30%" }}>Kennzahl</th>
                    <th>Formel</th>
                    <th style={{ width: "30%" }}>Beispiel</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-medium">%-IST (Ausbeute)</td>
                    <td><code>Kg / (Kisten × Kg pro Kiste)</code></td>
                    <td className="text-muted">208 / (30 × 10) = <strong>69,3%</strong></td>
                  </tr>
                  <tr>
                    <td className="fw-medium">EK nach Zerlegung</td>
                    <td><code>(Kisten × Kg/Kiste × EK/Kg + Kisten × Zer.Kosten/Kiste) / Kg</code></td>
                    <td className="text-muted">(30 × 10 × 1,94 + 30 × 1,50) / 208 = <strong>2,82 €/Kg</strong></td>
                  </tr>
                  <tr>
                    <td className="fw-medium">Verlust-%</td>
                    <td><code>SOLL-% − %-IST</code></td>
                    <td className="text-muted">68,5% − 69,3% = <strong>−0,8%</strong> (Gewinn)</td>
                  </tr>
                  <tr>
                    <td className="fw-medium">Verlust Kg</td>
                    <td><code>(Kisten × Kg/Kiste × SOLL-%) − Kg</code></td>
                    <td className="text-muted">(30 × 10 × 0,685) − 208 = <strong>−2,5 kg</strong> (Gewinn)</td>
                  </tr>
                  <tr>
                    <td className="fw-medium">Verlust €</td>
                    <td><code>Verlust Kg × VK-Durchschnitt</code></td>
                    <td className="text-muted">−2,5 × 3,30 = <strong>−8,25 €</strong> (Gewinn)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <h6 className="fw-semibold mb-2">Legende</h6>
              <ul className="list-unstyled mb-0" style={{ fontSize: "0.85rem" }}>
                <li className="mb-1"><span className="text-success fw-bold">Grün</span> = %-IST ≥ SOLL-% (Ziel erreicht / Gewinn)</li>
                <li className="mb-1"><span className="text-danger fw-bold">Rot</span> = %-IST &lt; SOLL-% (Ziel nicht erreicht / Verlust)</li>
                <li className="mb-1"><strong>EK/Kg</strong> = Einkaufspreis pro Kilogramm (vom Lieferanten)</li>
                <li className="mb-1"><strong>Zer.Kosten/Kiste</strong> = Zerlegungskosten pro Kiste (Arbeitskosten)</li>
                <li className="mb-1"><strong>VK-Durchschnitt</strong> = Durchschnittlicher Verkaufspreis pro Kg (editierbar, Standard: 3,30 €)</li>
                <li><strong>Kg pro Kiste</strong> = Gewicht einer vollen Kiste (Standard: 10 kg)</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Datum Navigation */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => changeDate(-1)}>
          <i className="bi bi-chevron-left" />
        </button>
        <input
          type="date"
          className="form-control form-control-sm"
          style={{ maxWidth: 180 }}
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
        />
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => changeDate(1)}>
          <i className="bi bi-chevron-right" />
        </button>
        <span className="text-muted small ms-2">{displayDate(datum)}</span>
        <button
          className="btn btn-outline-dark btn-sm rounded-3 ms-2"
          onClick={() => setDatum(formatDate(new Date()))}
        >
          Heute
        </button>
      </div>

      {/* Filter */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <button
          className={`btn btn-sm rounded-3 ${hideEmptyZerleger ? "btn-dark" : "btn-outline-secondary"}`}
          onClick={() => setHideEmptyZerleger((p) => !p)}
          title="Leere Zerleger ausblenden"
        >
          <i className="bi bi-eye-slash me-1" />
          Leere ausblenden
        </button>
        <div className="position-relative">
          <button
            className="btn btn-outline-secondary btn-sm rounded-3"
            onClick={() => setShowLiefFilter(!showLiefFilter)}
          >
            <i className="bi bi-funnel me-1" />
            Lieferanten ({visibleLieferanten.length}/{activeLieferanten.length})
          </button>
          {showLiefFilter && (
            <>
            <div
              className="position-fixed top-0 start-0 w-100 h-100"
              style={{ zIndex: 9 }}
              onClick={() => setShowLiefFilter(false)}
            />
            <div
              className="position-absolute bg-white border rounded-3 shadow-sm p-2 mt-1"
              style={{ zIndex: 10, minWidth: 200 }}
            >
              {activeLieferanten.map((l) => (
                <div className="form-check" key={l.id}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={!hiddenLieferanten.has(l.id!)}
                    onChange={() => {
                      setHiddenLieferanten((prev) => {
                        const next = new Set(prev);
                        if (next.has(l.id!)) next.delete(l.id!);
                        else next.add(l.id!);
                        return next;
                      });
                    }}
                  />
                  <label className="form-check-label" style={{ fontSize: "0.85rem" }}>
                    {l.name}
                  </label>
                </div>
              ))}
              <hr className="my-1" />
              <div className="d-flex gap-1">
                <button
                  className="btn btn-outline-dark btn-sm flex-fill"
                  onClick={() => setHiddenLieferanten(() => new Set())}
                >
                  Alle
                </button>
                <button
                  className="btn btn-outline-dark btn-sm flex-fill"
                  onClick={() => setHiddenLieferanten(() => new Set(activeLieferanten.map((l) => l.id!)))}
                >
                  Keine
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      </div>

      {activeLieferanten.length === 0 ? (
        <div className="alert alert-info">
          Keine Lieferanten vorhanden. Bitte zuerst Lieferanten anlegen.
        </div>
      ) : activeZerleger.length === 0 ? (
        <div className="alert alert-info">
          Keine Zerleger vorhanden. Bitte zuerst Zerleger anlegen.
        </div>
      ) : (
        <>
          {/* Haupttabelle — Excel-Style */}
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
                        rowSpan={2}
                        className="align-middle text-center"
                        style={{
                          minWidth: 110,
                          position: "sticky",
                          left: 0,
                          zIndex: 5,
                          background: "#212529",
                        }}
                      >
                        Name
                      </th>
                      {visibleLieferanten.map((l) => (
                        <th key={l.id} colSpan={3} className="text-center border-start" style={{ background: "#212529" }}>
                          {l.name}{" "}
                          <span className="fw-normal opacity-75">
                            ({(l.sollProzent * 100).toFixed(1)}%)
                          </span>
                        </th>
                      ))}
                      <th rowSpan={2} className="align-middle text-center border-start" style={{ minWidth: 65, background: "#212529" }}>
                        Ges.
                      </th>
                    </tr>
                    <tr className="table-secondary">
                      {visibleLieferanten.map((l) => (
                        <React.Fragment key={l.id}>
                          <th className="text-center" style={{ minWidth: 75, background: "#e2e3e5" }}>Kiste</th>
                          <th className="text-center" style={{ minWidth: 80, background: "#e2e3e5" }}>Kg</th>
                          <th className="text-center" style={{ minWidth: 65, background: "#e2e3e5" }}>%</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleZerleger.map((z, rowIdx) => (
                      <tr key={z.id}>
                        <td
                          className="fw-medium"
                          style={{
                            position: "sticky",
                            left: 0,
                            zIndex: 1,
                            background: focusedRow === rowIdx ? "#cfe2ff" : rowIdx % 2 === 0 ? "#fff" : "#f8f9fa",
                            whiteSpace: "nowrap",
                            fontWeight: focusedRow === rowIdx ? 700 : undefined,
                            transition: "background 0.15s",
                          }}
                        >
                          {z.name}
                        </td>
                        {visibleLieferanten.map((l, lIdx) => {
                          const cellKeyStr = `${z.id}_${l.id}`;
                          const draft = drafts.get(cellKeyStr);
                          const kistenVal = draft?.kisten ?? "";
                          const kgVal = draft?.kg ?? "";

                          const kisten = kistenVal ? parseFloat(kistenVal) : 0;
                          const kg = kgVal ? parseFloat(kgVal) : 0;
                          const pct = kisten > 0 && kg > 0 ? calcProzent(kisten, kg, l.kistenGewichtKg) : null;
                          const isAbove = pct !== null && pct >= l.sollProzent;
                          const isBelow = pct !== null && pct < l.sollProzent;
                          const isSaving = saving === cellKeyStr;

                          const colKiste = lIdx * 2;
                          const colKg = lIdx * 2 + 1;

                          return (
                            <React.Fragment key={l.id}>
                              {/* Kiste */}
                              <td
                                className="p-0 border-start"
                                style={{ background: isSaving ? "#e8f5e9" : undefined }}
                              >
                                <input
                                  ref={(el) => {
                                    if (el) inputRefs.current.set(cellKey(rowIdx, colKiste), el);
                                  }}
                                  type="text"
                                  autoComplete="off"
                                  className="form-control form-control-sm border-0 text-center rounded-0 bg-transparent"
                                  style={{ height: 28, fontSize: "0.82rem" }}
                                  value={kistenVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDrafts((prev) => {
                                      const next = new Map(prev);
                                      next.set(cellKeyStr, { ...next.get(cellKeyStr)!, kisten: val });
                                      return next;
                                    });
                                  }}
                                  onBlur={() => handleBlur(z.id!, l.id!)}
                                  onKeyDown={(e) => handleKeyDown(e, rowIdx, colKiste)}
                                  onFocus={(e) => { setFocusedRow(rowIdx); e.target.select(); }}
                                  tabIndex={0}
                                />
                              </td>
                              {/* Kg */}
                              <td
                                className="p-0"
                                style={{ background: isSaving ? "#e8f5e9" : undefined }}
                              >
                                <input
                                  ref={(el) => {
                                    if (el) inputRefs.current.set(cellKey(rowIdx, colKg), el);
                                  }}
                                  type="text"
                                  autoComplete="off"
                                  className="form-control form-control-sm border-0 text-center rounded-0 bg-transparent"
                                  style={{ height: 28, fontSize: "0.82rem" }}
                                  value={kgVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDrafts((prev) => {
                                      const next = new Map(prev);
                                      next.set(cellKeyStr, { ...next.get(cellKeyStr)!, kg: val });
                                      return next;
                                    });
                                  }}
                                  onBlur={() => handleBlur(z.id!, l.id!)}
                                  onKeyDown={(e) => handleKeyDown(e, rowIdx, colKg)}
                                  onFocus={(e) => { setFocusedRow(rowIdx); e.target.select(); }}
                                  tabIndex={0}
                                />
                              </td>
                              {/* %-IST (readonly) */}
                              <td
                                className={`text-center fw-bold ${
                                  isAbove ? "text-success" : isBelow ? "text-danger" : "text-muted"
                                }`}
                                style={{
                                  height: 28,
                                  lineHeight: "28px",
                                  fontSize: "0.82rem",
                                  background: isSaving ? "#e8f5e9" : undefined,
                                }}
                              >
                                {pct !== null ? (pct * 100).toFixed(1) + "%" : ""}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        {/* Gesamt Kisten pro Zerleger */}
                        <td className="text-center fw-bold border-start" style={{ height: 28, lineHeight: "28px", fontSize: "0.82rem" }}>
                          {(() => {
                            let sum = 0;
                            for (const l of visibleLieferanten) {
                              const d = drafts.get(`${z.id}_${l.id}`);
                              if (d?.kisten) sum += parseFloat(d.kisten) || 0;
                            }
                            return sum || "";
                          })()}
                        </td>
                      </tr>
                    ))}
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
                      {visibleLieferanten.map((l) => {
                        const s = lieferantSummen[l.id!];
                        return (
                          <React.Fragment key={l.id}>
                            <td className="text-center border-start">{s?.kisten || ""}</td>
                            <td className="text-center">{s?.kg ? s.kg.toFixed(1) : ""}</td>
                            <td className="text-center">
                              {s && s.kisten > 0 ? ((calcProzent(s.kisten, s.kg, l.kistenGewichtKg) ?? 0) * 100).toFixed(1) + "%" : ""}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="text-center border-start">
                        {(() => {
                          let total = 0;
                          for (const l of visibleLieferanten) {
                            total += lieferantSummen[l.id!]?.kisten || 0;
                          }
                          return total || "";
                        })()}
                      </td>
                    </tr>
                    {/* Differenz Kg Zeile */}
                    <tr className="fw-bold" style={{ fontSize: "0.8rem" }}>
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          background: "#f0f0f0",
                          whiteSpace: "nowrap",
                        }}
                      >
                        +/- Kg
                      </td>
                      {visibleLieferanten.map((l) => {
                        const s = lieferantSummen[l.id!];
                        if (!s || s.kisten === 0) {
                          return (
                            <React.Fragment key={l.id}>
                              <td colSpan={3} className="text-center border-start text-muted">-</td>
                            </React.Fragment>
                          );
                        }
                        const sollKg = s.kisten * l.kistenGewichtKg * l.sollProzent;
                        const diff = s.kg - sollKg;
                        return (
                          <React.Fragment key={l.id}>
                            <td
                              colSpan={3}
                              className={`text-center border-start ${diff >= 0 ? "text-success" : "text-danger"}`}
                            >
                              {diff >= 0 ? "+" : ""}{diff.toFixed(1)} kg
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="text-center border-start">
                        {(() => {
                          let totalDiff = 0;
                          let hatDaten = false;
                          for (const l of visibleLieferanten) {
                            const s = lieferantSummen[l.id!];
                            if (s && s.kisten > 0) {
                              hatDaten = true;
                              totalDiff += s.kg - s.kisten * l.kistenGewichtKg * l.sollProzent;
                            }
                          }
                          if (!hatDaten) return "-";
                          return (
                            <span className={totalDiff >= 0 ? "text-success" : "text-danger"}>
                              {totalDiff >= 0 ? "+" : ""}{totalDiff.toFixed(1)}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Zusammenfassung */}
          <div className="card border-0 shadow-sm rounded-4 mt-3">
            <div className="card-header bg-dark text-white rounded-top-4">
              <h6 className="mb-0">Zusammenfassung</h6>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0" style={{ fontSize: "0.82rem" }}>
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 150 }}></th>
                      {visibleLieferanten.map((l) => (
                        <th key={l.id} className="text-center">
                          {l.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="fw-medium">Gesamt Kisten</td>
                      {visibleLieferanten.map((l) => (
                        <td key={l.id} className="text-center">
                          {lieferantSummen[l.id!]?.kisten || 0}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="fw-medium">Gesamt Kg</td>
                      {visibleLieferanten.map((l) => (
                        <td key={l.id} className="text-center">
                          {lieferantSummen[l.id!]?.kg ? lieferantSummen[l.id!].kg.toFixed(1) : 0}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="fw-medium">Prozent (IST)</td>
                      {visibleLieferanten.map((l) => {
                        const s = lieferantSummen[l.id!];
                        const pct = s && s.kisten > 0 ? calcProzent(s.kisten, s.kg, l.kistenGewichtKg) : null;
                        const isAbove = pct !== null && pct >= l.sollProzent;
                        return (
                          <td
                            key={l.id}
                            className={`text-center fw-bold ${pct !== null ? (isAbove ? "text-success" : "text-danger") : ""}`}
                          >
                            {pct !== null ? (pct * 100).toFixed(2) + "%" : "-"}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="table-light">
                      <td className="fw-medium">EK</td>
                      {visibleLieferanten.map((l) => (
                        <td key={l.id} className="text-center">{l.ekProKg.toFixed(2)} €</td>
                      ))}
                    </tr>
                    <tr className="table-light">
                      <td className="fw-medium">Zer.Kosten/Kiste</td>
                      {visibleLieferanten.map((l) => (
                        <td key={l.id} className="text-center">{l.zerlegungskostenProKiste.toFixed(2)} €</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="fw-medium">EK nach Zerlegung</td>
                      {visibleLieferanten.map((l) => {
                        const s = lieferantSummen[l.id!];
                        const ekNZ =
                          s && s.kg > 0
                            ? calcEkNachZerlegung(s.kisten, s.kg, l.ekProKg, l.zerlegungskostenProKiste, l.kistenGewichtKg)
                            : null;
                        return (
                          <td key={l.id} className="text-center">
                            {ekNZ !== null ? ekNZ.toFixed(2) + " €" : "-"}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="fw-medium">Verlust-%</td>
                      {visibleLieferanten.map((l) => {
                        const s = lieferantSummen[l.id!];
                        const pct = s && s.kisten > 0 ? calcProzent(s.kisten, s.kg, l.kistenGewichtKg) : null;
                        const verlust = pct !== null ? l.sollProzent - pct : null;
                        return (
                          <td
                            key={l.id}
                            className={`text-center ${verlust !== null && verlust > 0 ? "text-danger" : ""}`}
                          >
                            {verlust !== null ? (verlust > 0 ? "+" : "") + (verlust * 100).toFixed(2) + "%" : "-"}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="fw-medium">Verlust Kg</td>
                      {visibleLieferanten.map((l) => {
                        const s = lieferantSummen[l.id!];
                        if (!s || s.kisten === 0) return <td key={l.id} className="text-center">-</td>;
                        const sollKg = s.kisten * l.kistenGewichtKg * l.sollProzent;
                        const verlustKg = sollKg - s.kg;
                        return (
                          <td key={l.id} className={`text-center ${verlustKg > 0 ? "text-danger" : "text-success"}`}>
                            {verlustKg.toFixed(1)} kg
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="fw-medium">
                        Verlust €{" "}
                        <small className="text-muted">
                          (VK:{" "}
                          <input
                            type="number"
                            step="0.1"
                            className="border-0 bg-transparent text-end"
                            style={{ width: 50 }}
                            value={vkDurchschnitt}
                            onChange={(e) => setVkDurchschnitt(parseFloat(e.target.value) || 0)}
                          />
                          €)
                        </small>
                      </td>
                      {visibleLieferanten.map((l) => {
                        const s = lieferantSummen[l.id!];
                        if (!s || s.kisten === 0) return <td key={l.id} className="text-center">-</td>;
                        const sollKg = s.kisten * l.kistenGewichtKg * l.sollProzent;
                        const verlustKg = sollKg - s.kg;
                        const verlustEuro = verlustKg * vkDurchschnitt;
                        return (
                          <td key={l.id} className={`text-center ${verlustEuro > 0 ? "text-danger" : "text-success"}`}>
                            {verlustEuro.toFixed(2)} €
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </>
      )}
      </>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`position-fixed bottom-0 end-0 m-3 p-3 rounded-3 text-white ${
            toast.type === "success" ? "bg-success" : "bg-danger"
          }`}
          style={{ zIndex: 9999 }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
