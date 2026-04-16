import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  getAllGefluegelZerleger,
  getGanzHaehnchenEintraegeRange,
  getGanzHaehnchenConfig,
} from "../../backend/api";
import {
  GanzHaehnchenEintragResource,
  GanzHaehnchenConfigResource,
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

export default function GanzHaehnchenStatistik({ mode }: Props) {
  const [zerleger, setZerleger] = useState<GefluegelZerlegerResource[]>([]);
  const [eintraege, setEintraege] = useState<GanzHaehnchenEintragResource[]>([]);
  const [config, setConfig] = useState<GanzHaehnchenConfigResource>({
    sollBrust: 0.436,
    sollKeule: 0.358,
    sollFluegel: 0.087,
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
        getGanzHaehnchenEintraegeRange(von, bis),
        getGanzHaehnchenConfig(),
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
        .filter((z) => z.aktiv && z.kategorien?.includes("ganz_haehnchen"))
        .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || a.name.localeCompare(b.name)),
    [zerleger]
  );

  const zerlegerSums = useMemo(() => {
    const result: Record<
      string,
      { name: string; kisten: number; gew: number; brust: number; keule: number; fluegel: number }
    > = {};
    for (const z of activeZerleger) {
      result[z.id!] = { name: z.name, kisten: 0, gew: 0, brust: 0, keule: 0, fluegel: 0 };
    }
    for (const e of filteredEintraege) {
      if (!result[e.zerlegerId]) {
        result[e.zerlegerId] = { name: e.zerlegerName, kisten: 0, gew: 0, brust: 0, keule: 0, fluegel: 0 };
      }
      const r = result[e.zerlegerId];
      r.kisten += e.anzahlKisten;
      r.gew += e.gewichtGesamt;
      r.brust += e.brust;
      r.keule += e.keule;
      r.fluegel += e.fluegel;
    }
    return result;
  }, [filteredEintraege, activeZerleger]);

  const totals = useMemo(() => {
    let kisten = 0, gew = 0, brust = 0, keule = 0, fluegel = 0;
    for (const e of filteredEintraege) {
      kisten += e.anzahlKisten;
      gew += e.gewichtGesamt;
      brust += e.brust;
      keule += e.keule;
      fluegel += e.fluegel;
    }
    const dates = new Set(filteredEintraege.map((e) => e.datum));
    return { kisten, gew, brust, keule, fluegel, tage: dates.size };
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

      {/* KPI Cards */}
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
              <div className="text-muted small">Kisten gesamt</div>
              <div className="fs-4 fw-bold">{totals.kisten}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body text-center">
              <div className="text-muted small">Gewicht gesamt</div>
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
          {/* Aggregate row */}
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-dark text-white rounded-top-4">
              <h6 className="mb-0">Gesamt-Ausbeute (SOLL: Brust {(config.sollBrust*100).toFixed(1)}% · Keule {(config.sollKeule*100).toFixed(1)}% · Flügel {(config.sollFluegel*100).toFixed(1)}%)</h6>
            </div>
            <div className="card-body p-0">
              <div className="row g-0">
                {[
                  { label: "Brust", val: totals.brust, soll: config.sollBrust },
                  { label: "Keule", val: totals.keule, soll: config.sollKeule },
                  { label: "Flügel", val: totals.fluegel, soll: config.sollFluegel },
                ].map((item) => {
                  const p = pct(item.val, totals.gew);
                  const isGood = p / 100 >= item.soll;
                  return (
                    <div className="col-md-4 text-center p-3 border-end" key={item.label}>
                      <div className="text-muted small">{item.label}</div>
                      <div className="fs-5 fw-bold">{item.val.toFixed(1)} kg</div>
                      <div className={`fw-bold ${isGood ? "text-success" : "text-danger"}`}>
                        {p.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Per Zerleger */}
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
                      <th className="text-end">Gewicht</th>
                      <th className="text-end">Brust</th>
                      <th className="text-end">% B</th>
                      <th className="text-end">Keule</th>
                      <th className="text-end">% K</th>
                      <th className="text-end">Flügel</th>
                      <th className="text-end">% F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(zerlegerSums)
                      .filter((r) => r.gew > 0)
                      .sort((a, b) => b.gew - a.gew)
                      .map((r) => {
                        const pB = pct(r.brust, r.gew);
                        const pK = pct(r.keule, r.gew);
                        const pF = pct(r.fluegel, r.gew);
                        return (
                          <tr key={r.name}>
                            <td className="fw-medium">{r.name}</td>
                            <td className="text-end">{r.kisten}</td>
                            <td className="text-end">{r.gew.toFixed(1)}</td>
                            <td className="text-end">{r.brust.toFixed(1)}</td>
                            <td className={`text-end fw-bold ${pB / 100 >= config.sollBrust ? "text-success" : "text-danger"}`}>
                              {pB.toFixed(1)}%
                            </td>
                            <td className="text-end">{r.keule.toFixed(1)}</td>
                            <td className={`text-end fw-bold ${pK / 100 >= config.sollKeule ? "text-success" : "text-danger"}`}>
                              {pK.toFixed(1)}%
                            </td>
                            <td className="text-end">{r.fluegel.toFixed(1)}</td>
                            <td className={`text-end fw-bold ${pF / 100 >= config.sollFluegel ? "text-success" : "text-danger"}`}>
                              {pF.toFixed(1)}%
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
                      <td className="text-end">{totals.brust.toFixed(1)}</td>
                      <td className="text-end">{pct(totals.brust, totals.gew).toFixed(1)}%</td>
                      <td className="text-end">{totals.keule.toFixed(1)}</td>
                      <td className="text-end">{pct(totals.keule, totals.gew).toFixed(1)}%</td>
                      <td className="text-end">{totals.fluegel.toFixed(1)}</td>
                      <td className="text-end">{pct(totals.fluegel, totals.gew).toFixed(1)}%</td>
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
