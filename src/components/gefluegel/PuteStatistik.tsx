import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  getAllGefluegelZerleger,
  getPuteEintraegeRange,
  getPuteConfigs,
} from "../../backend/api";
import {
  GefluegelZerlegerResource,
  PuteEintragResource,
  PuteConfigResource,
  PuteKategorie,
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

const KAT_LABELS: Record<PuteKategorie, string> = {
  pute_fluegel: "Flügel",
  pute_keule: "Keule",
};

export default function PuteStatistik({ mode }: Props) {
  const [zerleger, setZerleger] = useState<GefluegelZerlegerResource[]>([]);
  const [eintraege, setEintraege] = useState<PuteEintragResource[]>([]);
  const [configs, setConfigs] = useState<PuteConfigResource[]>([]);
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
    } else {
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
    }
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
        getPuteEintraegeRange(von, bis),
        getPuteConfigs(),
      ]);
      setZerleger(z);
      setEintraege(e);
      setConfigs(c);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [von, bis]);

  useEffect(() => { loadData(); }, [loadData]);

  const getSoll = (kat: PuteKategorie) =>
    configs.find((c) => c.kategorie === kat)?.sollProzent ?? (kat === "pute_fluegel" ? 0.75 : 0.89);

  // Aggregate per category per zerleger
  const kategorien: PuteKategorie[] = ["pute_fluegel", "pute_keule"];

  const katData = useMemo(() => {
    const result: Record<PuteKategorie, {
      totalMk: number;
      totalOk: number;
      perZerleger: Record<string, { name: string; mk: number; ok: number }>;
      tage: number;
    }> = {
      pute_fluegel: { totalMk: 0, totalOk: 0, perZerleger: {}, tage: 0 },
      pute_keule: { totalMk: 0, totalOk: 0, perZerleger: {}, tage: 0 },
    };

    for (const kat of kategorien) {
      const katEntries = eintraege.filter((e) => e.kategorie === kat);
      const dates = new Set(katEntries.map((e) => e.datum));
      result[kat].tage = dates.size;

      for (const e of katEntries) {
        result[kat].totalMk += e.mitKnochen;
        result[kat].totalOk += e.ohneKnochen;

        if (!result[kat].perZerleger[e.zerlegerId]) {
          result[kat].perZerleger[e.zerlegerId] = { name: e.zerlegerName, mk: 0, ok: 0 };
        }
        result[kat].perZerleger[e.zerlegerId].mk += e.mitKnochen;
        result[kat].perZerleger[e.zerlegerId].ok += e.ohneKnochen;
      }
    }
    return result;
  }, [eintraege]);

  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );

  return (
    <div>
      {/* Navigation */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => navigate(-1)}>
          &laquo;
        </button>
        <span className="fw-semibold">{label}</span>
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => navigate(1)}>
          &raquo;
        </button>
        <button className="btn btn-outline-dark btn-sm rounded-3 ms-2" onClick={() => { setCustomRange(null); setRefDate(new Date()); }}>
          {mode === "woche" ? "Diese Woche" : "Dieser Monat"}
        </button>
        <div className="ms-auto d-flex align-items-center gap-2">
          <DateRangePicker
            von={von}
            bis={bis}
            onChange={(v, b) => setCustomRange({ von: v, bis: b })}
          />
          {isCustom && (
            <button
              className="btn btn-link btn-sm text-decoration-none"
              onClick={() => setCustomRange(null)}
            >
              <i className="bi bi-x-circle me-1" />
              Zeitraum zurücksetzen
            </button>
          )}
        </div>
      </div>

      {eintraege.length === 0 ? (
        <div className="alert alert-info">Keine Einträge im gewählten Zeitraum.</div>
      ) : (
        <>
          {kategorien.map((kat) => {
            const data = katData[kat];
            const soll = getSoll(kat);
            const totalPct = data.totalMk > 0 ? data.totalOk / data.totalMk : 0;
            const zerlegerList = Object.entries(data.perZerleger)
              .sort(([, a], [, b]) => a.name.localeCompare(b.name));

            if (zerlegerList.length === 0) return null;

            return (
              <div className="card border-0 shadow-sm rounded-4 mb-4" key={kat}>
                <div className="card-header bg-dark text-white rounded-top-4 d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">{KAT_LABELS[kat]}</h6>
                  <span className="badge bg-light text-dark">
                    SOLL: {(soll * 100).toFixed(1)}% | Tage: {data.tage}
                  </span>
                </div>
                <div className="card-body p-0">
                  {/* KPI Row */}
                  <div className="row g-0 border-bottom">
                    <div className="col-4 text-center p-3 border-end">
                      <div className="text-muted small">Mit Knochen</div>
                      <div className="fs-5 fw-bold">{data.totalMk.toFixed(1)} kg</div>
                    </div>
                    <div className="col-4 text-center p-3 border-end">
                      <div className="text-muted small">Ohne Knochen</div>
                      <div className="fs-5 fw-bold">{data.totalOk.toFixed(1)} kg</div>
                    </div>
                    <div className="col-4 text-center p-3">
                      <div className="text-muted small">Ausbeute</div>
                      <div className={`fs-5 fw-bold ${totalPct >= soll ? "text-success" : "text-danger"}`}>
                        {(totalPct * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Zerleger Table */}
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.85rem" }}>
                      <thead className="table-light">
                        <tr>
                          <th style={{ minWidth: 120 }}>Zerleger</th>
                          <th className="text-end">Mit Knochen</th>
                          <th className="text-end">Ohne Knochen</th>
                          <th className="text-end">%</th>
                          <th className="text-end">Abw. SOLL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zerlegerList.map(([id, z]) => {
                          const pct = z.mk > 0 ? z.ok / z.mk : 0;
                          const abw = pct - soll;
                          const isGood = pct >= soll;
                          return (
                            <tr key={id}>
                              <td className="fw-medium">{z.name}</td>
                              <td className="text-end">{z.mk.toFixed(1)}</td>
                              <td className="text-end">{z.ok.toFixed(1)}</td>
                              <td className={`text-end fw-bold ${isGood ? "text-success" : "text-danger"}`}>
                                {(pct * 100).toFixed(1)}%
                              </td>
                              <td className={`text-end ${abw >= 0 ? "text-success" : "text-danger"}`}>
                                {abw >= 0 ? "+" : ""}{(abw * 100).toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="table-dark text-white fw-bold">
                        <tr>
                          <td>Gesamt</td>
                          <td className="text-end">{data.totalMk.toFixed(1)}</td>
                          <td className="text-end">{data.totalOk.toFixed(1)}</td>
                          <td className={`text-end ${totalPct >= soll ? "text-success" : "text-danger"}`}>
                            {(totalPct * 100).toFixed(1)}%
                          </td>
                          <td className={`text-end ${totalPct - soll >= 0 ? "text-success" : "text-danger"}`}>
                            {totalPct - soll >= 0 ? "+" : ""}{((totalPct - soll) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
