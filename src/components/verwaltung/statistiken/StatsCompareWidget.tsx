import React, { useState, useEffect } from "react";
import {
    api,
    AuftragsOverviewStats,
    UmsatzByRegion,
    UmsatzByKundenKategorie,
    UmsatzByArtikelKategorie,
} from "@/backend/api";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type DateRange = { from?: string; to?: string };

type CompareResponse<T> = {
    rangeA: T;
    rangeB: T;
};

type KpiKey =
    | "auftrag"
    | "region"
    | "kundenKategorie"
    | "artikelKategorie";

const euro = (v?: number) =>
    (v ?? 0).toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
    });

const num = (v?: number, digits = 1) =>
    (v ?? 0).toLocaleString("de-DE", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
    });

const calcDelta = (current?: number, previous?: number) => {
    const a = current ?? 0;
    const b = previous ?? 0;
    const diff = a - b;
    if (b === 0) {
        return { diff, percent: null as number | null };
    }
    return { diff, percent: (diff / b) * 100 };
};

interface StatsCompareWidgetProps {
    defaultKpi?: KpiKey;
    className?: string;
}

const StatsCompareWidget: React.FC<StatsCompareWidgetProps> = ({
    defaultKpi = "auftrag",
    className = "",
}) => {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [kpi, setKpi] = useState<KpiKey>(defaultKpi);

    const [rangeA, setRangeA] = useState<DateRange>({
        from: todayStr,
        to: todayStr,
    });
    const [rangeB, setRangeB] = useState<DateRange>({
        from: todayStr,
        to: todayStr,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [resultAuftrag, setResultAuftrag] =
        useState<CompareResponse<AuftragsOverviewStats> | null>(null);
    const [resultRegion, setResultRegion] =
        useState<CompareResponse<UmsatzByRegion[]> | null>(null);
    const [resultKundenKat, setResultKundenKat] =
        useState<CompareResponse<UmsatzByKundenKategorie[]> | null>(null);
    const [resultArtikelKat, setResultArtikelKat] =
        useState<CompareResponse<UmsatzByArtikelKategorie[]> | null>(null);

    const resetAllResults = () => {
        setResultAuftrag(null);
        setResultRegion(null);
        setResultKundenKat(null);
        setResultArtikelKat(null);
    };

    const handleLoad = async () => {
        setLoading(true);
        setError(null);
        resetAllResults();

        try {
            if (!rangeA.from || !rangeA.to || !rangeB.from || !rangeB.to) {
                throw new Error("Bitte beide Zeiträume vollständig (von/bis) auswählen.");
            }

            if (kpi === "auftrag") {
                const res = (await api.getStatsCompare(
                    "auftrag",
                    rangeA,
                    rangeB
                )) as CompareResponse<AuftragsOverviewStats>;
                setResultAuftrag(res);
            } else if (kpi === "region") {
                const res = (await api.getStatsCompare(
                    "region",
                    rangeA,
                    rangeB
                )) as CompareResponse<UmsatzByRegion[]>;
                setResultRegion(res);
            } else if (kpi === "kundenKategorie") {
                const res = (await api.getStatsCompare(
                    "kundenKategorie",
                    rangeA,
                    rangeB
                )) as CompareResponse<UmsatzByKundenKategorie[]>;
                setResultKundenKat(res);
            } else if (kpi === "artikelKategorie") {
                const res = (await api.getStatsCompare(
                    "artikelKategorie",
                    rangeA,
                    rangeB
                )) as CompareResponse<UmsatzByArtikelKategorie[]>;
                setResultArtikelKat(res);
            }
        } catch (err: any) {
            console.error(err);
            setError(err?.message || "Fehler beim Laden des Vergleichs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const hasFullRanges =
            !!rangeA.from &&
            !!rangeA.to &&
            !!rangeB.from &&
            !!rangeB.to;

        if (!hasFullRanges) return;

        // automatisch neu laden, wenn KPI oder Zeiträume geändert werden
        handleLoad();
        // Hinweis: handleLoad ist stabil genug, um hier verwendet zu werden.
        // Wenn ein Linter warnt, kann man es zur Dependency-Liste hinzufügen oder mit einem eslint-disable Kommentar arbeiten.
    }, [kpi, rangeA.from, rangeA.to, rangeB.from, rangeB.to]);

    // ---------- Chart-Builder für die verschiedenen KPIs ----------

    const buildAuftragChartData = () => {
        if (!resultAuftrag) return null;
        const { rangeA: A, rangeB: B } = resultAuftrag;

        const umsatzData = {
            labels: ["Umsatz"],
            datasets: [
                {
                    label: "Zeitraum A",
                    data: [A.totalUmsatz ?? 0],
                    backgroundColor: "rgba(13, 110, 253, 0.8)", // primary
                    borderRadius: 6,
                },
                {
                    label: "Zeitraum B",
                    data: [B.totalUmsatz ?? 0],
                    backgroundColor: "rgba(220, 53, 69, 0.8)", // danger
                    borderRadius: 6,
                },
            ],
        };

        const gewichtData = {
            labels: ["Netto-Gewicht (kg)"],
            datasets: [
                {
                    label: "Zeitraum A",
                    data: [A.totalNettoGewichtKg ?? 0],
                    backgroundColor: "rgba(13, 110, 253, 0.8)", // primary
                    borderRadius: 6,
                },
                {
                    label: "Zeitraum B",
                    data: [B.totalNettoGewichtKg ?? 0],
                    backgroundColor: "rgba(220, 53, 69, 0.8)", // danger
                    borderRadius: 6,
                },
            ],
        };

        const auftraegeData = {
            labels: ["Aufträge"],
            datasets: [
                {
                    label: "Zeitraum A",
                    data: [A.totalAuftraege ?? 0],
                    backgroundColor: "rgba(13, 110, 253, 0.8)", // primary
                    borderRadius: 6,
                },
                {
                    label: "Zeitraum B",
                    data: [B.totalAuftraege ?? 0],
                    backgroundColor: "rgba(220, 53, 69, 0.8)", // danger
                    borderRadius: 6,
                },
            ],
        };

        return {
            umsatz: umsatzData,
            gewicht: gewichtData,
            auftraege: auftraegeData,
        };
    };

    const buildRegionChartData = () => {
        if (!resultRegion) return null;
        const { rangeA: A, rangeB: B } = resultRegion;

        const labelSet = new Set<string>();
        A.forEach((r) => labelSet.add(r.region || "Unbekannt"));
        B.forEach((r) => labelSet.add(r.region || "Unbekannt"));

        const labels = Array.from(labelSet);

        const mapA = new Map<string, UmsatzByRegion>();
        const mapB = new Map<string, UmsatzByRegion>();
        A.forEach((r) => mapA.set(r.region || "Unbekannt", r));
        B.forEach((r) => mapB.set(r.region || "Unbekannt", r));

        const dataA = labels.map((l) => mapA.get(l)?.umsatz ?? 0);
        const dataB = labels.map((l) => mapB.get(l)?.umsatz ?? 0);

        return {
            labels,
            datasets: [
                {
                    label: "Zeitraum A",
                    data: dataA,
                    backgroundColor: "rgba(25, 135, 84, 0.8)", // success
                    borderRadius: 6,
                },
                {
                    label: "Zeitraum B",
                    data: dataB,
                    backgroundColor: "rgba(255, 193, 7, 0.8)", // warning
                    borderRadius: 6,
                },
            ],
        };
    };

    const buildKundenKategorieChartData = () => {
        if (!resultKundenKat) return null;
        const { rangeA: A, rangeB: B } = resultKundenKat;

        const labelSet = new Set<string>();
        A.forEach((k) => labelSet.add(k.kategorie || "Unbekannt"));
        B.forEach((k) => labelSet.add(k.kategorie || "Unbekannt"));

        const labels = Array.from(labelSet);

        const mapA = new Map<string, UmsatzByKundenKategorie>();
        const mapB = new Map<string, UmsatzByKundenKategorie>();
        A.forEach((k) => mapA.set(k.kategorie || "Unbekannt", k));
        B.forEach((k) => mapB.set(k.kategorie || "Unbekannt", k));

        const dataA = labels.map((l) => mapA.get(l)?.umsatz ?? 0);
        const dataB = labels.map((l) => mapB.get(l)?.umsatz ?? 0);

        return {
            labels,
            datasets: [
                {
                    label: "Zeitraum A",
                    data: dataA,
                    backgroundColor: "rgba(102, 16, 242, 0.8)", // purple
                    borderRadius: 6,
                },
                {
                    label: "Zeitraum B",
                    data: dataB,
                    backgroundColor: "rgba(13, 202, 240, 0.8)", // info
                    borderRadius: 6,
                },
            ],
        };
    };

    const buildArtikelKategorieChartData = () => {
        if (!resultArtikelKat) return null;
        const { rangeA: A, rangeB: B } = resultArtikelKat;

        const labelSet = new Set<string>();
        A.forEach((k) => labelSet.add(k.kategorie || "Unbekannt"));
        B.forEach((k) => labelSet.add(k.kategorie || "Unbekannt"));

        const labels = Array.from(labelSet);

        const mapA = new Map<string, UmsatzByArtikelKategorie>();
        const mapB = new Map<string, UmsatzByArtikelKategorie>();
        A.forEach((k) => mapA.set(k.kategorie || "Unbekannt", k));
        B.forEach((k) => mapB.set(k.kategorie || "Unbekannt", k));

        const dataA = labels.map((l) => mapA.get(l)?.nettoGewichtKg ?? 0);
        const dataB = labels.map((l) => mapB.get(l)?.nettoGewichtKg ?? 0);

        return {
            labels,
            datasets: [
                {
                    label: "Zeitraum A",
                    data: dataA,
                    backgroundColor: "rgba(249, 93, 106, 0.8)", // fancy pink
                    borderRadius: 6,
                },
                {
                    label: "Zeitraum B",
                    data: dataB,
                    backgroundColor: "rgba(255, 124, 67, 0.8)", // orange
                    borderRadius: 6,
                },
            ],
        };
    };

    const chartOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
            },
            tooltip: {
                callbacks: {
                    label: (ctx: any) => {
                        const label = ctx.dataset.label || "";
                        const value = ctx.parsed.y ?? ctx.parsed;
                        if (kpi === "auftrag") {
                            if (ctx.label === "Umsatz") return `${label}: ${euro(value)}`;
                            if (ctx.label === "Netto-Gewicht (kg)")
                                return `${label}: ${num(value, 1)} kg`;
                            if (ctx.label === "Aufträge")
                                return `${label}: ${num(value, 0)} Aufträge`;
                        }
                        if (kpi === "region" || kpi === "kundenKategorie") {
                            return `${label}: ${euro(value)}`;
                        }
                        if (kpi === "artikelKategorie") {
                            return `${label}: ${num(value, 1)} kg`;
                        }
                        return `${label}: ${value}`;
                    },
                },
            },
        },
        scales: {
            x: {
                ticks: { autoSkip: true, maxRotation: 45, minRotation: 0 },
            },
            y: {
                beginAtZero: true,
            },
        },
    };

    // ---------- Summary Badges (oben rechts) für Auftrags-KPI ----------

    const renderAuftragSummary = () => {
        if (!resultAuftrag) return null;
        const { rangeA: A, rangeB: B } = resultAuftrag;

        const deltaUmsatz = calcDelta(A.totalUmsatz, B.totalUmsatz);
        const deltaGewicht = calcDelta(
            A.totalNettoGewichtKg,
            B.totalNettoGewichtKg
        );
        const deltaAuftraege = calcDelta(A.totalAuftraege, B.totalAuftraege);

        const renderDelta = (d: { diff: number; percent: number | null }) => {
            if (d.percent === null) return "–";
            const sign = d.percent > 0 ? "+" : "";
            return `${sign}${d.percent.toFixed(1)} %`;
        };

        return (
            <div className="d-flex flex-wrap gap-2 justify-content-end">
                <span className="badge bg-light text-dark border">
                    Umsatz Δ {renderDelta(deltaUmsatz)}
                </span>
                <span className="badge bg-light text-dark border">
                    Gewicht Δ {renderDelta(deltaGewicht)}
                </span>
                <span className="badge bg-light text-dark border">
                    Aufträge Δ {renderDelta(deltaAuftraege)}
                </span>
            </div>
        );
    };

    // ---------- Haupt-Render ----------

    let chartData: any = null;
    if (kpi === "auftrag") chartData = buildAuftragChartData();
    if (kpi === "region") chartData = buildRegionChartData();
    if (kpi === "kundenKategorie") chartData = buildKundenKategorieChartData();
    if (kpi === "artikelKategorie")
        chartData = buildArtikelKategorieChartData();

    const applyPreset = (preset: string) => {
        const today = new Date();
        const fmt = (d: Date) => d.toISOString().slice(0, 10);

        if (preset === "todayVsYesterday") {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            setRangeA({
                from: fmt(today),
                to: fmt(today),
            });
            setRangeB({
                from: fmt(yesterday),
                to: fmt(yesterday),
            });
        } else if (preset === "thisWeekVsLastWeek") {
            const d = new Date(today);
            const day = d.getDay() || 7; // Montag = 1, Sonntag = 7
            const thisWeekStart = new Date(d);
            thisWeekStart.setDate(d.getDate() - (day - 1));
            const thisWeekEnd = today;

            const lastWeekEnd = new Date(thisWeekStart);
            lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
            const lastWeekStart = new Date(lastWeekEnd);
            lastWeekStart.setDate(lastWeekEnd.getDate() - 6);

            setRangeA({
                from: fmt(thisWeekStart),
                to: fmt(thisWeekEnd),
            });
            setRangeB({
                from: fmt(lastWeekStart),
                to: fmt(lastWeekEnd),
            });
        } else if (preset === "thisMonthVsLastMonth") {
            const year = today.getFullYear();
            const month = today.getMonth();

            const thisMonthStart = new Date(year, month, 1);
            const thisMonthEnd = today; // bis heute

            const lastMonthEnd = new Date(year, month, 0); // letzter Tag Vormonat
            const lastMonthStart = new Date(year, month - 1, 1);

            setRangeA({
                from: fmt(thisMonthStart),
                to: fmt(thisMonthEnd),
            });
            setRangeB({
                from: fmt(lastMonthStart),
                to: fmt(lastMonthEnd),
            });
        } else if (preset === "thisYearVsLastYear") {
            const year = today.getFullYear();

            const thisYearStart = new Date(year, 0, 1);
            const thisYearEnd = today; // bis heute

            const lastYearStart = new Date(year - 1, 0, 1);
            const lastYearEnd = new Date(year - 1, 11, 31);

            setRangeA({
                from: fmt(thisYearStart),
                to: fmt(thisYearEnd),
            });
            setRangeB({
                from: fmt(lastYearStart),
                to: fmt(lastYearEnd),
            });
        }
        resetAllResults();
    };
    return (
        <div className={`card shadow-sm border-0 ${className}`}>
            <div className="card-header bg-white border-0 pb-0">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <div>
                        <h5 className="card-title mb-1">
                            Zeitraum-Vergleich{" "}
                            <span className="badge bg-primary-subtle text-primary align-middle ms-1">
                                KPI
                            </span>
                        </h5>
                        <p className="text-muted small mb-0">
                            Vergleiche zwei Zeiträume für Umsatz, Gewicht oder Kategorien.
                        </p>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <select
                            className="form-select form-select-sm"
                            value={kpi}
                            onChange={(e) => {
                                setKpi(e.target.value as KpiKey);
                                resetAllResults();
                            }}
                        >
                            <option value="auftrag">Auftrags-Overview (Umsatz / Gewicht / Anzahl)</option>
                            <option value="region">Umsatz nach Region</option>
                            <option value="kundenKategorie">Umsatz nach Kundenkategorie</option>
                            <option value="artikelKategorie">Gewicht nach Artikelkategorie</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="card-body pt-3">
                {/* Vergleichs-Presets für beide Zeiträume */}
                <div className="mb-3">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="text-muted small me-2">
                            Schnellvergleich:
                        </span>
                        <div className="btn-group btn-group-sm flex-wrap" role="group">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => applyPreset("todayVsYesterday")}
                            >
                                Heute vs Gestern
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => applyPreset("thisWeekVsLastWeek")}
                            >
                                Diese Woche vs letzte Woche
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => applyPreset("thisMonthVsLastMonth")}
                            >
                                Dieser Monat vs letzter Monat
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => applyPreset("thisYearVsLastYear")}
                            >
                                Dieses Jahr vs letztes Jahr
                            </button>
                        </div>
                    </div>
                </div>

                {/* Zeiträume */}
                <div className="row g-3 mb-3">
                    <div className="col-md-6">
                        <div className="border rounded-3 p-3 h-100">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="badge bg-primary-soft text-primary fw-semibold">
                                    Zeitraum A
                                </span>
                                <span className="text-muted small">Referenz (aktuell)</span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={rangeA.from || ""}
                                    onChange={(e) =>
                                        setRangeA((prev) => ({ ...prev, from: e.target.value }))
                                    }
                                />
                                <span>–</span>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={rangeA.to || ""}
                                    onChange={(e) =>
                                        setRangeA((prev) => ({ ...prev, to: e.target.value }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="border rounded-3 p-3 h-100">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="badge bg-danger-soft text-danger fw-semibold">
                                    Zeitraum B
                                </span>
                                <span className="text-muted small">Vergleich</span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={rangeB.from || ""}
                                    onChange={(e) =>
                                        setRangeB((prev) => ({ ...prev, from: e.target.value }))
                                    }
                                />
                                <span>–</span>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={rangeB.to || ""}
                                    onChange={(e) =>
                                        setRangeB((prev) => ({ ...prev, to: e.target.value }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions + Summary */}
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                    <div className="d-flex align-items-center gap-2">
                        {loading && (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm"
                                    role="status"
                                    aria-hidden="true"
                                ></span>
                                <span className="small text-muted">
                                    Daten werden geladen...
                                </span>
                            </>
                        )}
                        {!loading && (
                            <span className="small text-muted">
                                Änderungen an KPI oder Zeiträumen laden den Vergleich automatisch.
                            </span>
                        )}
                        {error && (
                            <span className="text-danger small ms-2">
                                <i className="ci-close-circle me-1"></i>
                                {error}
                            </span>
                        )}
                    </div>
                    {kpi === "auftrag" && renderAuftragSummary()}
                </div>

                {/* Chart */}
                <div
                    className="bg-light rounded-3 p-3"
                    style={{ minHeight: 260, position: "relative" }}
                >
                    {kpi === "auftrag" ? (
                        chartData ? (
                            <div className="row g-3">
                                <div className="col-md-4">
                                    <div className="bg-white rounded-3 p-2 h-100">
                                        <div className="small text-muted mb-1">
                                            Umsatz
                                        </div>
                                        <div style={{ height: 220 }}>
                                            <Bar data={chartData.umsatz} options={chartOptions} />
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="bg-white rounded-3 p-2 h-100">
                                        <div className="small text-muted mb-1">
                                            Netto-Gewicht (kg)
                                        </div>
                                        <div style={{ height: 220 }}>
                                            <Bar data={chartData.gewicht} options={chartOptions} />
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="bg-white rounded-3 p-2 h-100">
                                        <div className="small text-muted mb-1">
                                            Anzahl Aufträge
                                        </div>
                                        <div style={{ height: 220 }}>
                                            <Bar data={chartData.auftraege} options={chartOptions} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="d-flex flex-column align-items-center justify-content-center text-muted h-100">
                                <i className="ci-bar-chart-alt fs-3 mb-2"></i>
                                <span className="small">
                                    Bitte KPI & Zeiträume wählen.
                                </span>
                            </div>
                        )
                    ) : chartData ? (
                        <div style={{ height: 260 }}>
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    ) : (
                        <div className="d-flex flex-column align-items-center justify-content-center text-muted h-100">
                            <i className="ci-bar-chart-alt fs-3 mb-2"></i>
                            <span className="small">
                                Bitte KPI & Zeiträume wählen.
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatsCompareWidget;