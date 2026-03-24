import React, { useState, useEffect, useCallback, useRef } from "react";
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

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

type CellDraft = { mitKnochen: string; ohneKnochen: string };

function autoSum(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) return trimmed;
  const nums = parts
    .map((s) => Number(s.replace(",", ".")))
    .filter((n) => !isNaN(n));
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
  const tableRef = useRef<HTMLTableElement>(null);

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

      // Sync drafts
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

  const activeZerleger = zerleger
    .filter((z) => z.aktiv && z.kategorien?.includes(kategorie))
    .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || a.name.localeCompare(b.name));

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

      // Update draft with summed values
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
        // Delete entry if both are 0
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

      if (!mk || !ok) return; // Need both fields filled

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

  // Navigate date
  const shiftDate = (days: number) => {
    const d = new Date(datum + "T12:00:00");
    d.setDate(d.getDate() + days);
    setDatum(formatDate(d));
  };

  // Totals
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

      {/* Date Navigation + Controls */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <button className="btn btn-outline-secondary btn-sm" onClick={() => shiftDate(-1)}>
          &laquo;
        </button>
        <input
          type="date"
          className="form-control form-control-sm"
          style={{ maxWidth: 160 }}
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
        />
        <button className="btn btn-outline-secondary btn-sm" onClick={() => shiftDate(1)}>
          &raquo;
        </button>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={() => setDatum(formatDate(new Date()))}
        >
          Heute
        </button>

        <div className="ms-auto d-flex align-items-center gap-2">
          {/* SOLL Config */}
          <span className="badge bg-secondary">
            SOLL: {(sollProzent * 100).toFixed(1)}%
          </span>
          {!editSoll ? (
            <button
              className="btn btn-outline-secondary btn-sm"
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
              <button className="btn btn-success btn-sm" onClick={handleSollSave}>
                OK
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setEditSoll(false)}
              >
                X
              </button>
            </div>
          )}

          <div className="form-check ms-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="hideEmpty"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="hideEmpty">
              Leere ausblenden
            </label>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-responsive">
        <table className="table table-bordered table-sm align-middle" ref={tableRef}>
          <thead className="table-light">
            <tr>
              <th style={{ minWidth: 140 }}>Zerleger</th>
              <th style={{ minWidth: 120 }}>Mit Knochen (kg)</th>
              <th style={{ minWidth: 120 }}>Ohne Knochen (kg)</th>
              <th style={{ minWidth: 80 }}>%</th>
              <th style={{ minWidth: 80 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleZerleger.map((zer) => {
              const draft = drafts.get(zer.id!) || {
                mitKnochen: "",
                ohneKnochen: "",
              };
              const mk = parseFloat(draft.mitKnochen.replace(",", ".")) || 0;
              const ok = parseFloat(draft.ohneKnochen.replace(",", ".")) || 0;
              const pct = mk > 0 ? (ok / mk) * 100 : 0;
              const isSaving = saving.has(zer.id!);
              const hasData = mk > 0 && ok > 0;

              let statusColor = "";
              let statusText = "";
              if (hasData) {
                if (pct / 100 >= sollProzent) {
                  statusColor = "text-success";
                  statusText = "Gut";
                } else {
                  statusColor = "text-danger";
                  statusText = "Unter SOLL";
                }
              }

              return (
                <tr key={zer.id}>
                  <td className="fw-semibold">{zer.name}</td>
                  <td>
                    <input
                      type="text"
                      autoComplete="off"
                      className="form-control form-control-sm"
                      value={draft.mitKnochen}
                      onChange={(e) =>
                        handleChange(zer.id!, "mitKnochen", e.target.value)
                      }
                      onBlur={() => saveCell(zer.id!, zer.name)}
                      disabled={isSaving}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      autoComplete="off"
                      className="form-control form-control-sm"
                      value={draft.ohneKnochen}
                      onChange={(e) =>
                        handleChange(zer.id!, "ohneKnochen", e.target.value)
                      }
                      onBlur={() => saveCell(zer.id!, zer.name)}
                      disabled={isSaving}
                    />
                  </td>
                  <td
                    className={`fw-bold ${statusColor}`}
                    style={{ fontSize: "1.05em" }}
                  >
                    {hasData ? pct.toFixed(1) + "%" : "–"}
                  </td>
                  <td className={statusColor}>
                    {isSaving ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      statusText
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {visibleZerleger.length > 0 && (
            <tfoot className="table-light fw-bold">
              <tr>
                <td>Gesamt</td>
                <td>{totalMk > 0 ? totalMk.toFixed(1) : "–"}</td>
                <td>{totalOk > 0 ? totalOk.toFixed(1) : "–"}</td>
                <td className={totalProzent / 100 >= sollProzent ? "text-success" : "text-danger"}>
                  {totalMk > 0 ? totalProzent.toFixed(1) + "%" : "–"}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {visibleZerleger.length === 0 && (
        <div className="text-muted text-center py-4">
          Keine Zerleger für {KATEGORIE_LABELS[kategorie]} zugewiesen.
          <br />
          Zerleger können in der Zerleger-Verwaltung der Kategorie zugeordnet werden.
        </div>
      )}
    </div>
  );
}
