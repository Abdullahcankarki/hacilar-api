// StatsDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  api,
  AuftragsOverviewStats,
  UmsatzByRegion,
  UmsatzByKundenKategorie,
  UmsatzByArtikelKategorie,
  TopArtikelStats,
  KundenRankingItem,
  TourOverviewStats,
  ZerlegeOverviewStats,
} from "@/backend/api";

import {
  Bar,
  Doughnut,
  Pie,
} from "react-chartjs-2";

import "chart.js/auto";
import StatsCompareWidget from "./StatsCompareWidget";

type DatePreset =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "custom";

const formatDate = (d: Date): string => d.toISOString().slice(0, 10);

const getPresetRange = (preset: DatePreset): { from?: string; to?: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d: Date, days: number) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy;
  };

  if (preset === "today") {
    const d = formatDate(today);
    return { from: d, to: d };
  }

  if (preset === "yesterday") {
    const y = addDays(today, -1);
    const d = formatDate(y);
    return { from: d, to: d };
  }

  if (preset === "thisWeek") {
    // Montag bis Sonntag der aktuellen Kalenderwoche
    const jsDay = today.getDay(); // 0 = So, 1 = Mo, ..., 6 = Sa
    const diff = jsDay === 0 ? 6 : jsDay - 1; // Sonntag → 6, Montag → 0, Dienstag → 1, ...
    const monday = addDays(today, -diff);
    const sunday = addDays(monday, 6);
    return {
      from: formatDate(startOfDay(monday)),
      to: formatDate(startOfDay(sunday)),
    };
  }

  if (preset === "lastWeek") {
    // Montag bis Sonntag der vorherigen Kalenderwoche
    const jsDay = today.getDay(); // 0 = So, 1 = Mo, ..., 6 = Sa
    const diff = jsDay === 0 ? 6 : jsDay - 1;
    const mondayThisWeek = addDays(today, -diff);
    const mondayLastWeek = addDays(mondayThisWeek, -7);
    const sundayLastWeek = addDays(mondayLastWeek, 6);
    return {
      from: formatDate(startOfDay(mondayLastWeek)),
      to: formatDate(startOfDay(sundayLastWeek)),
    };
  }

  if (preset === "thisMonth") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0); // letzter Tag des Monats
    return { from: formatDate(first), to: formatDate(last) };
  }

  if (preset === "lastMonth") {
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-basiert
    const firstPrev = new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, 1);
    const lastPrev = new Date(firstPrev.getFullYear(), firstPrev.getMonth() + 1, 0);
    return { from: formatDate(firstPrev), to: formatDate(lastPrev) };
  }

  if (preset === "thisYear") {
    const first = new Date(today.getFullYear(), 0, 1);
    const last = new Date(today.getFullYear(), 11, 31);
    return { from: formatDate(first), to: formatDate(last) };
  }

  if (preset === "lastYear") {
    const year = today.getFullYear() - 1;
    const first = new Date(year, 0, 1);
    const last = new Date(year, 11, 31);
    return { from: formatDate(first), to: formatDate(last) };
  }

  // custom → nichts setzen, Benutzer entscheidet
  return {};
};

const numberFormat = (value: number | undefined | null, digits = 0) =>
  (value ?? 0).toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });


const euroFormat = (value: number | undefined | null) =>
  `${numberFormat(value, 2)} €`;

const capitalizeLabel = (
  value: string | null | undefined,
  fallback: string
): string => {
  const s = (value ?? "").trim();
  if (!s) return fallback;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Pie/Doughnut options helper with percent in tooltip
const buildPieOptionsWithPercent = (
  formatValue?: (value: number) => string
) => {
  return {
    responsive: true,
    maintainAspectRatio: false as const,
    aspectRatio: 1,
    plugins: {
      legend: {
        position: "bottom" as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const dataset = context.dataset;
            const rawData = (dataset.data || []) as (number | null | undefined)[];
            const total = rawData.reduce(
              (sum, v) => sum + (typeof v === "number" ? v : 0),
              0
            );
            const value = typeof context.parsed === "number" ? context.parsed : 0;
            const percent = total > 0 ? (value / total) * 100 : 0;
            const valueLabel = formatValue
              ? formatValue(value)
              : value.toLocaleString("de-DE");
            return `${context.label}: ${valueLabel} (${percent.toFixed(1)} %)`;
          },
        },
      },
    },
  };
};

const StatsDashboard: React.FC = () => {
  const [preset, setPreset] = useState<DatePreset>("thisMonth");
  const [from, setFrom] = useState<string | undefined>(
    getPresetRange("thisMonth").from
  );
  const [to, setTo] = useState<string | undefined>(
    getPresetRange("thisMonth").to
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [auftragsOverview, setAuftragsOverview] =
    useState<AuftragsOverviewStats | null>(null);
  const [umsatzRegion, setUmsatzRegion] = useState<UmsatzByRegion[]>([]);
  const [umsatzKundenKategorie, setUmsatzKundenKategorie] =
    useState<UmsatzByKundenKategorie[]>([]);
  const [umsatzArtikelKategorie, setUmsatzArtikelKategorie] =
    useState<UmsatzByArtikelKategorie[]>([]);
  const [topArtikel, setTopArtikel] = useState<TopArtikelStats[]>([]);
  const [kundenRanking, setKundenRanking] = useState<KundenRankingItem[]>([]);
  const [tourOverview, setTourOverview] = useState<TourOverviewStats | null>(
    null
  );
  const [zerlegeOverview, setZerlegeOverview] =
    useState<ZerlegeOverviewStats | null>(null);

  const activeRange = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
    }),
    [from, to]
  );

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    if (p === "custom") return;
    const r = getPresetRange(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const paramsBase = {
        from: activeRange.from,
        to: activeRange.to,
      };

      const [
        auftragRes,
        regionRes,
        kundenKatRes,
        artikelKatRes,
        topArtikelRes,
        kundenRankingRes,
        tourOverviewRes,
        zerlegeOverviewRes,
      ] = await Promise.all([
        api.getStatsAuftragsOverview(paramsBase),
        api.getStatsUmsatzByRegion(paramsBase),
        api.getStatsUmsatzByKundenKategorie(paramsBase),
        api.getStatsUmsatzByArtikelKategorie(paramsBase),
        api.getStatsTopArtikel({ ...paramsBase, limit: 10 }),
        api.getStatsKundenRanking({ ...paramsBase, limit: 10 }),
        api.getStatsTourOverview(paramsBase),
        api.getStatsZerlegeOverview(paramsBase),
      ]);

      setAuftragsOverview(auftragRes);
      setUmsatzRegion(regionRes || []);
      setUmsatzKundenKategorie(kundenKatRes || []);
      setUmsatzArtikelKategorie(artikelKatRes || []);
      setTopArtikel(topArtikelRes || []);
      setKundenRanking(kundenRankingRes || []);
      setTourOverview(tourOverviewRes);
      setZerlegeOverview(zerlegeOverviewRes);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Fehler beim Laden der Statistiken");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRange.from, activeRange.to]);

  // -------------------------- Chart-Daten vorbereiten --------------------------

  const statusChartData = useMemo(() => {
    if (!auftragsOverview) return null;
    const labels = ["offen", "in Bearbeitung", "abgeschlossen", "storniert"];
    const data = labels.map((l) => auftragsOverview.statusCounts[l as keyof typeof auftragsOverview.statusCounts] || 0);
    return {
      labels,
      datasets: [
        {
          label: "Anzahl Aufträge",
          data,
          backgroundColor: [
            "#0d6efd",
            "#ffc107",
            "#198754",
            "#dc3545",
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [auftragsOverview]);

  const regionChartData = useMemo(() => {
    if (!umsatzRegion.length) return null;
    const labels = umsatzRegion.map((r) =>
      capitalizeLabel(r.region, "Unbekannt")
    );
    const data = umsatzRegion.map((r) => r.umsatz);
    return {
      labels,
      datasets: [
        {
          label: "Umsatz",
          data,
          backgroundColor: [
            "#4e79a7",
            "#f28e2b",
            "#e15759",
            "#76b7b2",
            "#59a14f",
            "#edc949",
            "#af7aa1",
            "#ff9da7",
          ],
        },
      ],
    };
  }, [umsatzRegion]);

  const kundenKategorieChartData = useMemo(() => {
    if (!umsatzKundenKategorie.length) return null;
    const labels = umsatzKundenKategorie.map((k) => k.kategorie || "Unbekannt");
    const data = umsatzKundenKategorie.map((k) => k.umsatz);
    return {
      labels,
      datasets: [
        {
          label: "Umsatz",
          data,
          backgroundColor: [
            "#003f5c",
            "#58508d",
            "#bc5090",
            "#ff6361",
            "#ffa600",
            "#7a5195",
          ],
        },
      ],
    };
  }, [umsatzKundenKategorie]);

  const artikelKategorieChartData = useMemo(() => {
    if (!umsatzArtikelKategorie.length) return null;
    const labels = umsatzArtikelKategorie.map((k) => k.kategorie || "Unbekannt");
    const data = umsatzArtikelKategorie.map((k) => k.nettoGewichtKg);
    return {
      labels,
      datasets: [
        {
          label: "Netto-Gewicht (kg)",
          data,
          backgroundColor: [
            "#2f4b7c",
            "#665191",
            "#a05195",
            "#d45087",
            "#f95d6a",
            "#ff7c43",
          ],
        },
      ],
    };
  }, [umsatzArtikelKategorie]);

  const tourRegionChartData = useMemo(() => {
    if (!tourOverview || !tourOverview.tourenByRegion.length) return null;
    const labels = tourOverview.tourenByRegion.map((t) =>
      capitalizeLabel(t.region, "Unbekannt")
    );
    const data = tourOverview.tourenByRegion.map((t) => t.gewichtKg);
    return {
      labels,
      datasets: [
        {
          label: "Gewicht pro Region (kg)",
          data,
          backgroundColor: "#17a2b8",
          borderRadius: 6,
        },
      ],
    };
  }, [tourOverview]);

  const tourFahrerChartData = useMemo(() => {
    if (!tourOverview || !tourOverview.tourenByFahrer.length) return null;
    const labels = tourOverview.tourenByFahrer.map(
      (f) => f.fahrerName || "Unbekannter Fahrer"
    );
    const data = tourOverview.tourenByFahrer.map((f) => f.count);
    return {
      labels,
      datasets: [
        {
          label: "Touren pro Fahrer",
          data,
          backgroundColor: "#ff6f61",
          borderRadius: 6,
        },
      ],
    };
  }, [tourOverview]);

  // ---------------------------------------------------------------------------

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="mb-4">
        <div>
          <h2 className="h3 mb-1 d-flex align-items-center">
            <i className="ci-bar-chart me-2" /> {/* Cartzilla Icon, falls vorhanden */}
            Statistik-Übersicht
          </h2>
          <p className="text-muted mb-0">
            Überblick über Umsatz, Gewicht, Kunden, Artikel, Touren und Zerlegung.
          </p>
        </div>
        {/* Datum & Presets */}
        <div className="mt-3 d-flex justify-content-center">
          <div className="card shadow-sm border-0">
            <div className="card-body py-2 px-3">
              <div className="d-flex flex-column align-items-center gap-2">
                {/* Erste Zeile: Presets */}
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="btn-group btn-group-sm flex-wrap" role="group">
                    <button
                      type="button"
                      className={`btn btn-outline-secondary ${
                        preset === "today" ? "active" : ""
                      }`}
                      onClick={() => applyPreset("today")}
                    >
                      Heute
                    </button>
                    <button
                      type="button"
                      className={`btn btn-outline-secondary ${
                        preset === "yesterday" ? "active" : ""
                      }`}
                      onClick={() => applyPreset("yesterday")}
                    >
                      Gestern
                    </button>
                    <button
                      type="button"
                      className={`btn btn-outline-secondary ${
                        preset === "thisWeek" ? "active" : ""
                      }`}
                      onClick={() => applyPreset("thisWeek")}
                    >
                      Woche
                    </button>
                    <button
                      type="button"
                      className={`btn btn-outline-secondary ${
                        preset === "lastWeek" ? "active" : ""
                      }`}
                      onClick={() => applyPreset("lastWeek")}
                    >
                      Letzte Woche
                    </button>
                    <button
                      type="button"
                      className={`btn btn-outline-secondary ${
                        preset === "thisMonth" ? "active" : ""
                      }`}
                      onClick={() => applyPreset("thisMonth")}
                    >
                      Dieser Monat
                    </button>
                    <button
                      type="button"
                      className={`btn btn-outline-secondary ${
                        preset === "lastMonth" ? "active" : ""
                      }`}
                      onClick={() => applyPreset("lastMonth")}
                    >
                      Letzter Monat
                    </button>
                    <button
                      type="button"
                      className={`btn btn-outline-secondary ${
                        preset === "thisYear" ? "active" : ""
                      }`}
                      onClick={() => applyPreset("thisYear")}
                    >
                      Dieses Jahr
                    </button>
                    <button
                      type="button"
                      className={`btn btn-outline-secondary ${
                        preset === "lastYear" ? "active" : ""
                      }`}
                      onClick={() => applyPreset("lastYear")}
                    >
                      Letztes Jahr
                    </button>
                  </div>
                </div>

                {/* Zweite Zeile: Datum & Aktionen */}
                <div className="d-flex flex-wrap align-items-center justify-content-center gap-2">
                  <div className="d-flex align-items-center gap-1">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={from || ""}
                      onChange={(e) => {
                        setPreset("custom");
                        setFrom(e.target.value || undefined);
                      }}
                    />
                    <span className="mx-1">–</span>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={to || ""}
                      onChange={(e) => {
                        setPreset("custom");
                        setTo(e.target.value || undefined);
                      }}
                    />
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      data-bs-toggle="modal"
                      data-bs-target="#stats-compare-modal"
                    >
                      <i className="ci-compare me-1" />
                      Vergleich
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={loadStats}
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <>
                          <i className="ci-restore fs-sm me-1" />
                          Aktualisieren
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fehler */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center">
          <i className="ci-close-circle me-2" />
          <div>{error}</div>
        </div>
      )}

      {/* Lade-Overlay */}
      {loading && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
             style={{ background: "rgba(255,255,255,0.7)", zIndex: 1050 }}>
          <div className="text-center">
            <div className="spinner-border mb-2" />
            <div className="fw-semibold">Statistiken werden geladen…</div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase fs-xs mb-1">
                Gesamt-Umsatz
              </div>
              <div className="d-flex align-items-center justify-content-between">
                <div className="h4 mb-0">
                  {euroFormat(auftragsOverview?.totalUmsatz)}
                </div>
                <span className="badge bg-primary-subtle text-primary">
                  €
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase fs-xs mb-1">
                Netto-Gewicht
              </div>
              <div className="d-flex align-items-center justify-content-between">
                <div className="h4 mb-0">
                  {numberFormat(auftragsOverview?.totalNettoGewichtKg, 1)} kg
                </div>
                <span className="badge bg-success-subtle text-success">
                  kg
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase fs-xs mb-1">
                Aufträge
              </div>
              <div className="d-flex align-items-center justify-content-between">
                <div className="h4 mb-0">
                  {numberFormat(auftragsOverview?.totalAuftraege)}
                </div>
                <span className="badge bg-info-subtle text-info">
                  <i className="ci-clipboard" />
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase fs-xs mb-1">
                Tour-Gewicht
              </div>
              <div className="d-flex align-items-center justify-content-between">
                <div className="h4 mb-0">
                  {numberFormat(tourOverview?.totalGewichtKg, 1)} kg
                </div>
                <span className="badge bg-warning-subtle text-warning">
                  LKW
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status + Umsatz nach Region */}
      <div className="row g-3 mb-4">
        <div className="col-lg-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-transparent border-0 pb-0">
              <h6 className="card-title mb-0 d-flex align-items-center">
                <i className="ci-pie-chart me-2" />
                Auftragsstatus
              </h6>
            </div>
            <div className="card-body">
              {statusChartData ? (
                <div style={{ maxWidth: 260, height: 260, margin: "0 auto" }}>
                  <Doughnut
                    data={statusChartData}
                    options={buildPieOptionsWithPercent()}
                  />
                </div>
              ) : (
                <div className="text-muted text-center py-4">
                  Keine Daten im Zeitraum.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-transparent border-0 pb-0 d-flex justify-content-between align-items-center">
              <h6 className="card-title mb-0 d-flex align-items-center">
                <i className="ci-trending-up me-2" />
                Umsatz nach Region
              </h6>
            </div>
            <div className="card-body">
              {regionChartData ? (
                <div style={{ maxWidth: 260, height: 260, margin: "0 auto" }}>
                  <Pie
                    data={regionChartData}
                    options={buildPieOptionsWithPercent((v) =>
                      `${v.toLocaleString("de-DE")} €`
                    )}
                  />
                </div>
              ) : (
                <div className="text-muted text-center py-4">
                  Keine Daten im Zeitraum.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Kundenkategorie + Artikelkategorie */}
      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-transparent border-0 pb-0">
              <h6 className="card-title mb-0">Umsatz nach Kundenkategorie</h6>
            </div>
            <div className="card-body">
              {kundenKategorieChartData ? (
                <div style={{ maxWidth: 260, height: 260, margin: "0 auto" }}>
                  <Pie
                    data={kundenKategorieChartData}
                    options={buildPieOptionsWithPercent((v) =>
                      `${v.toLocaleString("de-DE")} €`
                    )}
                  />
                </div>
              ) : (
                <div className="text-muted text-center py-4">
                  Keine Daten im Zeitraum.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-transparent border-0 pb-0">
              <h6 className="card-title mb-0">
                Gewicht nach Artikelkategorie
              </h6>
            </div>
            <div className="card-body">
              {artikelKategorieChartData ? (
                <div style={{ maxWidth: 260, height: 260, margin: "0 auto" }}>
                  <Pie
                    data={artikelKategorieChartData}
                    options={buildPieOptionsWithPercent((v) =>
                      `${v.toLocaleString("de-DE")} kg`
                    )}
                  />
                </div>
              ) : (
                <div className="text-muted text-center py-4">
                  Keine Daten im Zeitraum.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* Top-Artikel & Top-Kunden */}
      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-transparent border-0 pb-0 d-flex justify-content-between align-items-center">
              <h6 className="card-title mb-0">Top 10 Artikel (Umsatz)</h6>
            </div>
            <div className="card-body p-0">
              {topArtikel.length ? (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: "45%" }}>Artikel</th>
                        <th className="text-end">Umsatz</th>
                        <th className="text-end">Gewicht (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topArtikel.map((a) => (
                        <tr key={a.artikelId}>
                          <td>
                            <div className="fw-semibold">
                              {a.artikelName || a.artikelNummer}
                            </div>
                            <small className="text-muted">
                              {a.kategorie || "ohne Kategorie"}
                            </small>
                          </td>
                          <td className="text-end">
                            {euroFormat(a.umsatz)}
                          </td>
                          <td className="text-end">
                            {numberFormat(a.nettoGewichtKg, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-muted text-center py-4">
                  Keine Daten im Zeitraum.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-transparent border-0 pb-0 d-flex justify-content-between align-items-center">
              <h6 className="card-title mb-0">Top 10 Kunden (Umsatz)</h6>
            </div>
            <div className="card-body p-0">
              {kundenRanking.length ? (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: "45%" }}>Kunde</th>
                        <th className="text-end">Umsatz</th>
                        <th className="text-end">Gewicht (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kundenRanking.map((k) => (
                        <tr key={k.kundeId}>
                          <td>
                            <div className="fw-semibold">{k.name}</div>
                            <small className="text-muted">
                              {k.kategorie || "ohne Kategorie"} ·{" "}
                              {capitalizeLabel(k.region, "Ohne Region")}
                            </small>
                          </td>
                          <td className="text-end">
                            {euroFormat(k.umsatz)}
                          </td>
                          <td className="text-end">
                            {numberFormat(k.nettoGewichtKg, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-muted text-center py-4">
                  Keine Daten im Zeitraum.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tour-Detail + Zerlege */}
      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-transparent border-0 pb-0 d-flex justify-content-between align-items-center">
              <h6 className="card-title mb-0">Tour-Performance</h6>
              {tourOverview && (
                <div className="text-muted fs-sm">
                  {tourOverview.totalTouren} Touren ·{" "}
                  {tourOverview.totalStops} Stops
                </div>
              )}
            </div>
            <div className="card-body">
              <ul className="nav nav-tabs nav-tabs-sm mb-3" role="tablist">
                <li className="nav-item">
                  <button
                    className="nav-link active"
                    id="tour-region-tab"
                    data-bs-toggle="tab"
                    data-bs-target="#tour-region-pane"
                    type="button"
                    role="tab"
                  >
                    Regionen
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className="nav-link"
                    id="tour-fahrer-tab"
                    data-bs-toggle="tab"
                    data-bs-target="#tour-fahrer-pane"
                    type="button"
                    role="tab"
                  >
                    Fahrer
                  </button>
                </li>
              </ul>
              <div className="tab-content">
                <div
                  className="tab-pane fade show active"
                  id="tour-region-pane"
                  role="tabpanel"
                  aria-labelledby="tour-region-tab"
                >
                  {tourRegionChartData ? (
                    <div style={{ height: 260 }}>
                      <Bar
                        data={tourRegionChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            y: { beginAtZero: true },
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-muted text-center py-4">
                      Keine Touren im Zeitraum.
                    </div>
                  )}
                </div>
                <div
                  className="tab-pane fade"
                  id="tour-fahrer-pane"
                  role="tabpanel"
                  aria-labelledby="tour-fahrer-tab"
                >
                  {tourFahrerChartData ? (
                    <div style={{ height: 260 }}>
                      <Bar
                        data={tourFahrerChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true } },
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-muted text-center py-4">
                      Keine Touren im Zeitraum.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Zerlege-Overview */}
        <div className="col-lg-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-transparent border-0 pb-0">
              <h6 className="card-title mb-0 d-flex align-items-center">
                <i className="ci-cut me-2" />
                Zerlegeaufträge
              </h6>
            </div>
            <div className="card-body">
              {zerlegeOverview ? (
                <div className="row text-center g-2">
                  <div className="col-4">
                    <div className="text-muted fs-xs text-uppercase mb-1">
                      Gesamt
                    </div>
                    <div className="h5 mb-0">
                      {numberFormat(zerlegeOverview.totalZerlegeAuftraege)}
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="text-muted fs-xs text-uppercase mb-1">
                      Offen
                    </div>
                    <div className="h5 mb-0 text-warning">
                      {numberFormat(zerlegeOverview.offeneZerlegeAuftraege)}
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="text-muted fs-xs text-uppercase mb-1">
                      Erledigt
                    </div>
                    <div className="h5 mb-0 text-success">
                      {numberFormat(zerlegeOverview.erledigteZerlegeAuftraege)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted text-center py-4">
                  Keine Zerlegeaufträge im Zeitraum.
                </div>
              )}
              <p className="mt-3 mb-0 text-muted fs-sm">
                Zeigt nur, ob Zerlegeaufträge im Zeitraum erstellt wurden
                (unabhängig von Auftragsstatus).
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Vergleichs-Modal */}
      <div
        className="modal fade"
        id="stats-compare-modal"
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                KPI-Zeitvergleich
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <StatsCompareWidget />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;