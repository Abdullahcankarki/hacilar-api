import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  getAllGefluegelZerleger,
  getBrustEintraegeRange,
  getBrustConfig,
} from "../../backend/api";
import {
  BrustEintragResource,
  BrustConfigResource,
  GefluegelZerlegerResource,
} from "../../Resources";
import DateRangePicker from "./DateRangePicker";

type Mode = "woche" | "monat";

interface Props {
  mode: Mode;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getSaturday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day >= 6 ? 0 : -(day + 1);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function getWeekNumber(d: Date): number {
  const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function BrustStatistik({ mode }: Props) {
  const [zerleger, setZerleger] = useState<GefluegelZerlegerResource[]>([]);
  const [eintraege, setEintraege] = useState<BrustEintragResource[]>([]);
  const [config, setConfig] = useState<BrustConfigResource>({
    sollMitHaut: 0.9,
    sollOhneHaut: 0.81,
    sollHaut: 0.09,
  });
  const [loading, setLoading] = useState(true);
  const [refDate, setRefDate] = useState(() => new Date());
  const [customRange, setCustomRange] = useState<{ von: string; bis: string } | null>(null);

  const { von, bis, label, isCustom } = useMemo(() => {
    if (customRange) {
      const vonD = new Date(customRange.von + "T00:00:00");
      const bisD = new Date(customRange.bis + "T00:00:00");
      return {
        von: customRange.von,
        bis: customRange.bis,
        label: `${vonD.toLocaleDateString("de-DE")} – ${bisD.toLocaleDateString("de-DE")}`,
        isCustom: true,
      };
    }
    if (mode === "woche") {
      const saturday = getSaturday(refDate);
      const friday = new Date(saturday);
      friday.setDate(saturday.getDate() + 6);
      const kw = getWeekNumber(saturday);
      return {
        von: formatDate(saturday),
        bis: formatDate(friday),
        label: `KW ${kw} / ${saturday.getFullYear()}  (${saturday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} – ${friday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })})`,
        isCustom: false,
      };
    }
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const monthName = first.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    return {
      von: formatDate(first),
      bis: formatDate(last),
      label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      isCustom: false,
    };
  }, [mode, refDate, customRange]);

  const navigate = useCallback(
    (dir: number) => {
      setCustomRange(null);
      setRefDate((prev) => {
        const d = new Date(prev);
        if (mode === "woche") d.setDate(d.getDate() + dir * 7);
        else d.setMonth(d.getMonth() + dir);
        return d;
      });
    },
    [mode]
  );

  useEffect(() => {
    setRefDate(new Date());
    setCustomRange(null);
  }, [mode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [z, e, c] = await Promise.all([
        getAllGefluegelZerleger(),
        getBrustEintraegeRange(von, bis),
        getBrustConfig(),
      ]);
      setZerleger(z);
      setEintraege(e);
      setConfig(c);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [von, bis]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEintraege = useMemo(() => {
    if (mode !== "woche" || isCustom) return eintraege;
    return eintraege.filter((e) => new Date(e.datum + "T00:00:00").getDay() !== 0);
  }, [eintraege, mode, isCustom]);

  const activeZerleger = useMemo(
    () =>
      zerleger
        .filter((z) => z.aktiv && z.kategorien?.includes("brust"))
        .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || a.name.localeCompare(b.name)),
    [zerleger]
  );

  const zerlegerSums = useMemo(() => {
    const result: Record<
      string,
      { name: string; kisten: number; gew: number; mh: number; oh: number; haut: number }
    > = {};
    for (const z of activeZerleger) {
      result[z.id!] = { name: z.name, kisten: 0, gew: 0, mh: 0, oh: 0, haut: 0 };
    }
    for (const e of filteredEintraege) {
      if (!result[e.zerlegerId]) {
        result[e.zerlegerId] = { name: e.zerlegerName, kisten: 0, gew: 0, mh: 0, oh: 0, haut: 0 };
      }
      const r = result[e.zerlegerId];
      r.kisten += e.anzahlKisten;
      r.gew += e.gewichtMitKnochen;
      r.mh += e.brustMitHaut;
      r.oh += e.brustOhneHaut;
      r.haut += e.haut;
    }
    return result;
  }, [filteredEintraege, activeZerleger]);

  const totals = useMemo(() => {
    let kisten = 0, gew = 0, mh = 0, oh = 0, haut = 0;
    for (const e of filteredEintraege) {
      kisten += e.anzahlKisten;
      gew += e.gewichtMitKnochen;
      mh += e.brustMitHaut;
      oh += e.brustOhneHaut;
      haut += e.haut;
    }
    const dates = new Set(filteredEintraege.map((e) => e.datum));
    return { kisten, gew, mh, oh, haut, tage: dates.size };
  }, [filteredEintraege]);

  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );

  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

  return (
    <div>
      {/* Navigation */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => navigate(-1)}>
          <i className="bi bi-chevron-left" />
        </button>
        <span className="fw-semibold">{label}</span>
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => navigate(1)}>
          <i className="bi bi-chevron-right" />
        </button>
        <button
          className="btn btn-outline-dark btn-sm rounded-3 ms-2"
          onClick={() => {
            setCustomRange(null);
            setRefDate(new Date());
          }}
        >
          {mode === "woche" ? "Diese Woche" : "Dieser Monat"}
        </button>
        <div className="ms-auto">
          <DateRangePicker
            von={von}
            bis={bis}
            onChange={(v, b) => setCustomRange({ von: v, bis: b })}
          />
          {isCustom && (
            <button
              className="btn btn-link btn-sm text-decoration-none ms-2"
              onClick={() => setCustomRange(null)}
            >
              <i className="bi bi-x-circle me-1" />
              Zeitraum zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body text-center">
              <div className="text-muted small">Tage</div>
              <div className="fs-4 fw-bold">{totals.tage}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body text-center">
              <div className="text-muted small">Kisten</div>
              <div className="fs-4 fw-bold">{totals.kisten}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body text-center">
              <div className="text-muted small">Mit Knochen</div>
              <div className="fs-4 fw-bold">{totals.gew.toFixed(1)}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body text-center">
              <div className="text-muted small">Einträge</div>
              <div className="fs-4 fw-bold">{eintraege.length}</div>
            </div>
          </div>
        </div>
      </div>

      {filteredEintraege.length === 0 ? (
        <div className="alert alert-info">Keine Einträge im gewählten Zeitraum.</div>
      ) : (
        <>
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-dark text-white rounded-top-4">
              <h6 className="mb-0">Gesamt-Ausbeute (SOLL: m.Haut {(config.sollMitHaut*100).toFixed(1)}% · o.Haut {(config.sollOhneHaut*100).toFixed(1)}% · Haut {(config.sollHaut*100).toFixed(1)}%)</h6>
            </div>
            <div className="card-body p-0">
              <div className="row g-0">
                {[
                  { label: "Brust m. Haut", val: totals.mh, soll: config.sollMitHaut },
                  { label: "Brust o. Haut", val: totals.oh, soll: config.sollOhneHaut },
                  { label: "Haut", val: totals.haut, soll: config.sollHaut },
                ].map((item) => {
                  const p = pct(item.val, totals.gew);
                  const isGood = p / 100 >= item.soll;
                  return (
                    <div className="col-md-4 text-center p-3 border-end" key={item.label}>
                      <div className="text-muted small">{item.label}</div>
                      <div className="fs-5 fw-bold">{item.val.toFixed(1)} kg</div>
                      <div className={`fw-bold ${item.val > 0 ? (isGood ? "text-success" : "text-danger") : "text-muted"}`}>
                        {item.val > 0 ? p.toFixed(1) + "%" : "–"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-dark text-white rounded-top-4">
              <h6 className="mb-0">Zusammenfassung pro Zerleger</h6>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-bordered table-hover mb-0" style={{ fontSize: "0.82rem" }}>
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 110 }}>Zerleger</th>
                      <th className="text-end">Kisten</th>
                      <th className="text-end">Mit Knochen</th>
                      <th className="text-end">m.Haut</th>
                      <th className="text-end">% m.H</th>
                      <th className="text-end">o.Haut</th>
                      <th className="text-end">% o.H</th>
                      <th className="text-end">Haut</th>
                      <th className="text-end">% Haut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(zerlegerSums)
                      .filter((r) => r.gew > 0)
                      .sort((a, b) => b.gew - a.gew)
                      .map((r) => {
                        const pMh = pct(r.mh, r.gew);
                        const pOh = pct(r.oh, r.gew);
                        const pH = pct(r.haut, r.gew);
                        return (
                          <tr key={r.name}>
                            <td className="fw-medium">{r.name}</td>
                            <td className="text-end">{r.kisten}</td>
                            <td className="text-end">{r.gew.toFixed(1)}</td>
                            <td className="text-end">{r.mh > 0 ? r.mh.toFixed(1) : "–"}</td>
                            <td className={`text-end fw-bold ${r.mh > 0 ? (pMh / 100 >= config.sollMitHaut ? "text-success" : "text-danger") : "text-muted"}`}>
                              {r.mh > 0 ? pMh.toFixed(1) + "%" : "–"}
                            </td>
                            <td className="text-end">{r.oh > 0 ? r.oh.toFixed(1) : "–"}</td>
                            <td className={`text-end fw-bold ${r.oh > 0 ? (pOh / 100 >= config.sollOhneHaut ? "text-success" : "text-danger") : "text-muted"}`}>
                              {r.oh > 0 ? pOh.toFixed(1) + "%" : "–"}
                            </td>
                            <td className="text-end">{r.haut > 0 ? r.haut.toFixed(1) : "–"}</td>
                            <td className={`text-end fw-bold ${r.haut > 0 ? (pH / 100 >= config.sollHaut ? "text-success" : "text-danger") : "text-muted"}`}>
                              {r.haut > 0 ? pH.toFixed(1) + "%" : "–"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot className="table-dark text-white fw-bold">
                    <tr>
                      <td>Gesamt</td>
                      <td className="text-end">{totals.kisten}</td>
                      <td className="text-end">{totals.gew.toFixed(1)}</td>
                      <td className="text-end">{totals.mh > 0 ? totals.mh.toFixed(1) : "–"}</td>
                      <td className="text-end">{totals.mh > 0 ? pct(totals.mh, totals.gew).toFixed(1) + "%" : "–"}</td>
                      <td className="text-end">{totals.oh > 0 ? totals.oh.toFixed(1) : "–"}</td>
                      <td className="text-end">{totals.oh > 0 ? pct(totals.oh, totals.gew).toFixed(1) + "%" : "–"}</td>
                      <td className="text-end">{totals.haut > 0 ? totals.haut.toFixed(1) : "–"}</td>
                      <td className="text-end">{totals.haut > 0 ? pct(totals.haut, totals.gew).toFixed(1) + "%" : "–"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
