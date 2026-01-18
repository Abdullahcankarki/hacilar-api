import React, { useState } from "react";
import cx from "classnames";

// Types are imported from the same module(s) TourManager uses.
// Keep these import paths identical to your project structure.
import type { TourResource, TourStopResource } from "@/Resources";

type Fahrzeug = { id: string; name: string; kennzeichen?: string; maxGewichtKg?: number };
type Mitarbeiter = { id: string; name: string; rollen: string[] };
type ReihenfolgeVorlage = { id: string; name: string };

// Reuse helpers from TourManager by passing them in via props (keeps this component independent).
export const TourOverview: React.FC<{
    tours: TourResource[];
    fahrzeuge: Record<string, Fahrzeug>;
    fahrer: Record<string, Mitarbeiter>;
    vorlagen: Record<string, ReihenfolgeVorlage>;
    stopsByTour: Record<string, TourStopResource[]>;
    onOpenStopDetails: (s: TourStopResource) => void;

    // formatting + labeling helpers
    fmtDate: (d: any) => string;
    formatRegion: (r: string, style?: any) => string;
    renderFahrzeugLabel: (f?: Fahrzeug) => string;
    statusBadge: (status: any) => string;
    stopStatusVariant: (status: any) => string;
    stopStatusLabel: (status: any) => string;
}> = ({
    tours,
    fahrzeuge,
    fahrer,
    vorlagen,
    stopsByTour,
    onOpenStopDetails,
    fmtDate,
    formatRegion,
    renderFahrzeugLabel,
    statusBadge,
    stopStatusVariant,
    stopStatusLabel,
}) => {
    const [openTourId, setOpenTourId] = useState<string | null>(null);
    const [hoverKey, setHoverKey] = useState<string | null>(null);

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent d-flex align-items-center justify-content-between">
                <div className="w-100">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                        <div>
                            <div className="fw-semibold">Übersicht</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>Schnellansicht – nur Lesen</div>
                        </div>
                        <span className="badge text-bg-light">Nur Lesen</span>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setOpenTourId(null)}>
                            Alle zuklappen
                        </button>
                    </div>
                </div>
            </div>

            <div className="card-body p-2">
                <div className="accordion" id="tourOverviewAcc">
                    {tours.map((tour) => {
                        const fahrzeugLabel = tour.fahrzeugId ? renderFahrzeugLabel(fahrzeuge[tour.fahrzeugId]) : "";
                        const fahrerName = tour.fahrerId ? fahrer[tour.fahrerId]?.name : undefined;
                        const vorlageName = tour.reihenfolgeVorlageId ? vorlagen[tour.reihenfolgeVorlageId]?.name : undefined;
                        const stops = stopsByTour[tour.id!] ?? [];
                        const belegtes = (() => {
                            const n = Number((tour as any).belegtesGewichtKg);
                            return Number.isFinite(n) ? n : 0;
                        })();
                        const maxKg = typeof (tour as any).maxGewichtKg === "number" && Number.isFinite(Number((tour as any).maxGewichtKg)) ? Number((tour as any).maxGewichtKg) : undefined;
                        const pct = maxKg ? Math.min(100, Math.round((belegtes / Math.max(1, maxKg)) * 100)) : 0;
                        const accId = `ov-${tour.id}`;
                        const headId = `ov-h-${tour.id}`;
                        const isOpen = openTourId === tour.id;

                        const doneStops = stops.filter((s) => stopStatusVariant((s as any).status) === "success").length;
                        const stopPct = stops.length ? Math.round((doneStops / stops.length) * 100) : 0;

                        return (
                            <div
                                className={cx("accordion-item border-0 border-top", (tour as any).overCapacityFlag && "border-start border-4 border-danger")}
                                key={tour.id}
                                style={{ marginBottom: 4 }}
                            >
                                <h2 className="accordion-header" id={headId}>
                                    <button
                                        className={cx(
                                            "accordion-button d-flex align-items-center gap-2 py-2",
                                            !isOpen && "collapsed"
                                        )}
                                        type="button"
                                        onClick={() => setOpenTourId((cur) => (cur === tour.id ? null : (tour.id as string)))}
                                        aria-expanded={isOpen}
                                        aria-controls={accId}
                                    >
                                        <div className="flex-grow-1">
                                            <div className="d-flex flex-wrap align-items-center gap-1">
                                                <span className="fw-semibold">{tour.name || `Tour ${formatRegion(tour.region || "", "capitalized")}`}</span>
                                                {(tour as any).overCapacityFlag && <span className="badge text-bg-danger">Überkapazität</span>}
                                                <span className={`badge text-bg-${statusBadge((tour as any).status)}`}>{String((tour as any).status || "geplant")}</span>
                                                <span className="badge text-bg-light">{fmtDate((tour as any).datum)}</span>
                                                <span className="badge text-bg-light">{formatRegion(tour.region || "", "capitalized")}</span>
                                                <span className="badge text-bg-light">Stopps: {stops.length}</span>
                                                <span className="badge text-bg-light">{belegtes.toFixed(1)} kg</span>
                                            </div>

                                            <div className="text-muted small mt-0 d-flex flex-wrap gap-2">
                                                <span>Fzg: {fahrzeugLabel || "—"}</span>
                                                <span>Fahrer: {fahrerName || "—"}</span>
                                                {maxKg !== undefined ? <span>Max: {maxKg.toFixed(0)} kg</span> : null}
                                                {vorlageName ? <span>Vorlage: {vorlageName}</span> : null}
                                            </div>

                                            {maxKg !== undefined && (
                                                <div className="mt-1 d-flex align-items-center gap-2 flex-wrap">
                                                    <span className="small text-muted">Auslastung</span>
                                                    <div
                                                        className="position-relative"
                                                        style={{ width: 140 }}
                                                        onMouseEnter={() => setHoverKey(`cap-${tour.id}`)}
                                                        onMouseLeave={() => setHoverKey(null)}
                                                    >
                                                        {hoverKey === `cap-${tour.id}` && (
                                                            <div
                                                                className={cx(
                                                                    "position-absolute start-50 translate-middle-x",
                                                                    "px-2 py-1 rounded-1 shadow-sm",
                                                                    pct >= 100 ? "bg-danger text-white" : pct >= 85 ? "bg-warning text-dark" : "bg-success text-white"
                                                                )}
                                                                style={{ top: -8, fontSize: 12, lineHeight: 1.1, whiteSpace: "nowrap", zIndex: 5 }}
                                                            >
                                                                {pct}%
                                                            </div>
                                                        )}

                                                        <div className="progress" style={{ height: 6, width: 140 }}>
                                                            <div
                                                                className={cx(
                                                                    "progress-bar",
                                                                    pct >= 100 ? "bg-danger" : pct >= 85 ? "bg-warning" : "bg-success"
                                                                )}
                                                                role="progressbar"
                                                                style={{ width: `${pct}%` }}
                                                                aria-valuenow={pct}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                            />
                                                        </div>
                                                    </div>
                                                    <span className="small text-muted">({belegtes.toFixed(1)} / {maxKg.toFixed(0)} kg)</span>
                                                </div>
                                            )}

                                            {stops.length > 0 && (
                                                <div className="mt-1 d-flex align-items-center gap-2 flex-wrap">
                                                    <span className="small text-muted">Fortschritt</span>
                                                    <div
                                                        className="position-relative"
                                                        style={{ width: 140 }}
                                                        onMouseEnter={() => setHoverKey(`prog-${tour.id}`)}
                                                        onMouseLeave={() => setHoverKey(null)}
                                                    >
                                                        {hoverKey === `prog-${tour.id}` && (
                                                            <div
                                                                className={cx(
                                                                    "position-absolute start-50 translate-middle-x",
                                                                    "px-2 py-1 rounded-1 shadow-sm",
                                                                    stopPct >= 100 ? "bg-success text-white" : stopPct >= 50 ? "bg-warning text-dark" : "bg-secondary text-white"
                                                                )}
                                                                style={{ top: -8, fontSize: 12, lineHeight: 1.1, whiteSpace: "nowrap", zIndex: 5 }}
                                                            >
                                                                {stopPct}%
                                                            </div>
                                                        )}

                                                        <div className="progress" style={{ height: 6, width: 140 }}>
                                                            <div
                                                                className={cx(
                                                                    "progress-bar",
                                                                    stopPct >= 100 ? "bg-success" : stopPct >= 50 ? "bg-warning" : "bg-secondary"
                                                                )}
                                                                role="progressbar"
                                                                style={{ width: `${stopPct}%` }}
                                                                aria-valuenow={stopPct}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                            />
                                                        </div>
                                                    </div>
                                                    <span className="small text-muted">({doneStops}/{stops.length})</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                </h2>

                                <div
                                    id={accId}
                                    className={cx("accordion-collapse collapse", isOpen && "show")}
                                    aria-labelledby={headId}
                                >
                                    <div className="accordion-body pt-0">
                                        {!stops.length ? (
                                            <div className="text-muted small">Keine Stopps.</div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-sm table-hover align-middle mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: 44 }}>#</th>
                                                            <th>Kunde</th>
                                                            <th style={{ width: 120 }}>Status</th>
                                                            <th style={{ width: 110 }} className="text-end">Gewicht</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {stops
                                                            .slice()
                                                            .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                                                            .map((s) => (
                                                                <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => onOpenStopDetails(s)}>
                                                                    <td>
                                                                        <span className="badge text-bg-light">{(s as any).position}</span>
                                                                    </td>
                                                                    <td>
                                                                        <div className="fw-semibold">{(s as any).kundeName ?? `Kunde #${(s as any).kundeId}`}</div>
                                                                    </td>
                                                                    <td>
                                                                        <span className={`badge text-bg-${stopStatusVariant((s as any).status)}`}>{stopStatusLabel((s as any).status)}</span>
                                                                    </td>
                                                                    <td className="text-end">{Number((s as any).gewichtKg ?? 0).toFixed(1)} kg</td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};