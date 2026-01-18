import React, { useMemo } from "react";
import { AuftragResource, TourResource } from "@/Resources";

type Props = {
    tours: TourResource[];
    auftraege: AuftragResource[];

    // Optional callbacks
    onOpenAuftrag?: (a: AuftragResource) => void;
};

const safeTourName = (t: TourResource) => {
    const region = String((t as any).region || "").trim();
    return region ? `Tour ${region}` : `Tour ${String(t.id || "").slice(-6)}`;
};

const kommiBadgeClass = (s?: AuftragResource["kommissioniertStatus"]) => {
    if (s === "fertig") return "bg-success";
    if (s === "gestartet") return "bg-secondary";
    return "bg-light text-dark border";
};

const AuftragBoardTableView: React.FC<Props> = ({ tours, auftraege, onOpenAuftrag }) => {
    // TourId -> Aufträge
    const ordersByTour = useMemo(() => {
        const map: Record<string, AuftragResource[]> = {};
        for (const a of auftraege || []) {
            const tid = String(a.tourId || "");
            if (!tid) continue;
            (map[tid] ||= []).push(a);
        }
        // optional: Sortierung in der Tour (z.B. nach Lieferdatum / Auftragsnummer)
        for (const tid of Object.keys(map)) {
            map[tid].sort((x, y) => String(x.auftragsnummer || "").localeCompare(String(y.auftragsnummer || "")));
        }
        return map;
    }, [auftraege]);

    // Touren nur zeigen, die Aufträge haben (oder alle – je nach Wunsch)
    const visibleTours = useMemo(() => {
        const tourList = tours || [];
        return tourList
            .slice()
            .sort((a, b) => String(a.datum || "").localeCompare(String(b.datum || "")));
    }, [tours]);

    return (
        <div className="card border-0 shadow-sm">
            <div className="p-2">
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-semibold" style={{ fontSize: 13 }}>Aufträge nach Tour</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                        {auftraege?.length || 0} Aufträge
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0 table-hover">
                        <thead className="table-light">
                            <tr>
                                <th style={{ width: 220 }}>Tour</th>
                                <th>Aufträge</th>
                            </tr>
                        </thead>

                        <tbody>
                            {visibleTours.map((t) => {
                                const tid = String(t.id || "");
                                const list = ordersByTour[tid] || [];

                                return (
                                    <tr key={tid}>
                                        <td className="fw-semibold" style={{ fontSize: 12, verticalAlign: "top" }}>
                                            {safeTourName(t)}
                                            {t.datum ? (
                                                <div className="text-muted" style={{ fontSize: 11 }}>
                                                    {new Date(t.datum).toLocaleDateString("de-DE")}
                                                </div>
                                            ) : null}
                                        </td>

                                        <td>
                                            {list.length ? (
                                                <div className="table-responsive">
                                                    <table className="table table-sm align-middle mb-0 table-hover">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th style={{ width: 120 }}>Auftrag</th>
                                                                <th>Kunde</th>
                                                                <th style={{ width: 120 }}>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {list.map((a) => (
                                                                <tr
                                                                    key={String(a.id)}
                                                                    style={{ cursor: onOpenAuftrag ? "pointer" : "default" }}
                                                                    onClick={() => onOpenAuftrag?.(a)}
                                                                >
                                                                    <td className="fw-semibold" style={{ fontSize: 12 }}>
                                                                        {a.auftragsnummer || a.id || "—"}
                                                                    </td>
                                                                    <td style={{ fontSize: 12 }}>
                                                                        {a.kundeName || a.kunde || "—"}
                                                                    </td>
                                                                    <td>
                                                                        <span className={`badge ${kommiBadgeClass(a.kommissioniertStatus)}`}>
                                                                            {a.kommissioniertStatus || "offen"}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <span className="text-muted" style={{ fontSize: 12 }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {!visibleTours.length && (
                                <tr>
                                    <td colSpan={2} className="text-center text-muted py-4">
                                        Keine Touren vorhanden.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuftragBoardTableView;