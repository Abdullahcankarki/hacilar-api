// BestellteArtikelModal.tsx
import React, { useMemo, useState } from "react";
import {
    getBestellteArtikelAggregiertApi,
    BestellteArtikelAggRow,
} from "../../../backend/api";

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

const STATUS_OPTS = ["offen", "in Bearbeitung", "abgeschlossen", "storniert"] as const;

export default function BestellteArtikelModal({ isOpen, onClose }: Props) {
    const [lieferdatumVon, setLieferdatumVon] = useState<string>("");
    const [lieferdatumBis, setLieferdatumBis] = useState<string>("");
    const [kundenKategorie, setKundenKategorie] = useState<string>("");
    const [kundenRegion, setKundenRegion] = useState<string>("");
    const [artikelNr, setArtikelNr] = useState<string>("");
    const [artikelName, setArtikelName] = useState<string>("");
    const [statusIn, setStatusIn] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<BestellteArtikelAggRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [debug, setDebug] = useState<boolean>(false);

    const [sortKey, setSortKey] = useState<"artikelName" | "artikelNummer" | "mengeSum" | "einheit">("mengeSum");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const canSearch = useMemo(() => !loading, [loading]);

    const toggleStatus = (s: string) => {
        setStatusIn(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const search = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getBestellteArtikelAggregiertApi({
                lieferdatumVon: lieferdatumVon || undefined,
                lieferdatumBis: lieferdatumBis || undefined,
                kundenKategorie: kundenKategorie || undefined,
                kundenRegion: kundenRegion || undefined,
                artikelNr: artikelNr || undefined,
                artikelName: artikelName || undefined,
                statusIn: statusIn.length ? (statusIn as any) : undefined,
                groupBy: "artikel",
                debug,
            });
            setRows(data);
        } catch (e: any) {
            setError(e?.message || "Fehler beim Laden");
        } finally {
            setLoading(false);
        }
    };

    const resetFilters = () => {
        setLieferdatumVon("");
        setLieferdatumBis("");
        setKundenKategorie("");
        setKundenRegion("");
        setArtikelNr("");
        setArtikelName("");
        setStatusIn([]);
        setRows([]);
        setError(null);
        setDebug(false);
    };

    const exportCsv = () => {
        const header = ["artikelId", "artikelName", "artikelNummer", "mengeSum", "einheit"];
        const lines = [header.join(";")];
        for (const r of rows) {
            lines.push([
                r.artikelId ?? "",
                r.artikelName ?? "",
                r.artikelNummer ?? "",
                String(r.mengeSum ?? ""),
                r.einheit ?? "",
            ].map(v => (String(v).includes(";") ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(";"));
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `bestellte_artikel_artikel_${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const startOfWeek = (d: Date) => {
        const x = new Date(d);
        const day = x.getDay(); // 0=Sun,1=Mon,...  we want Monday as start
        const diff = (day === 0 ? -6 : 1 - day);
        return addDays(x, diff);
    };
    const endOfWeek = (d: Date) => addDays(startOfWeek(d), 6);
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
    const endOfYear = (d: Date) => new Date(d.getFullYear(), 11, 31);
    const setPreset = (key: string) => {
        const now = new Date();
        let from: Date | undefined;
        let to: Date | undefined;
        switch (key) {
            case "heute":
                from = now; to = now; break;
            case "morgen":
                from = addDays(now, 1); to = addDays(now, 1); break;
            case "gestern":
                from = addDays(now, -1); to = addDays(now, -1); break;
            case "dieseWoche":
                from = startOfWeek(now); to = endOfWeek(now); break;
            case "letzteWoche":
                from = addDays(startOfWeek(now), -7); to = addDays(endOfWeek(now), -7); break;
            case "dieserMonat":
                from = startOfMonth(now); to = endOfMonth(now); break;
            case "letzterMonat": {
                const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                from = startOfMonth(prev); to = endOfMonth(prev); break;
            }
            case "diesesJahr":
                from = startOfYear(now); to = endOfYear(now); break;
            case "letztesJahr": {
                const prev = new Date(now.getFullYear() - 1, 0, 1);
                from = startOfYear(prev); to = endOfYear(prev); break;
            }
            case "alles":
            default:
                setLieferdatumVon(""); setLieferdatumBis(""); return;
        }
        setLieferdatumVon(fmt(from!));
        setLieferdatumBis(fmt(to!));
    };

    const sortedRows = useMemo(() => {
        const data = [...rows];
        const key = sortKey;
        data.sort((a, b) => {
            const av = (a as any)[key] ?? "";
            const bv = (b as any)[key] ?? "";
            if (typeof av === "number" && typeof bv === "number") {
                return sortDir === "asc" ? av - bv : bv - av;
            }
            const as = String(av).toLocaleLowerCase();
            const bs = String(bv).toLocaleLowerCase();
            const cmp = as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" });
            return sortDir === "asc" ? cmp : -cmp;
        });
        return data;
    }, [rows, sortKey, sortDir]);

    const onSort = (key: "artikelName" | "artikelNummer" | "mengeSum" | "einheit") => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir(key === "mengeSum" ? "desc" : "asc");
        }
    };
    const sortIndicator = (key: string) => sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop show cz-backdrop" />
            <div
                className="modal d-block cz-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="bestellteArtikelModalLabel"
                tabIndex={-1}
                onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            >
                <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                    <div className="modal-content cz-card">
                        <div className="modal-header">
                            <h5 id="bestellteArtikelModalLabel" className="modal-title">Bestellte Artikel – Aggregation</h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
                        </div>

                        <div className="modal-body">
                            <div className="d-flex flex-wrap gap-2 mb-3">
                                <span className="text-muted align-self-center">Zeitraum:</span>
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset("heute")}>Heute</button>
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset("morgen")}>Morgen</button>
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset("gestern")}>Gestern</button>
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset("dieseWoche")}>Diese Woche</button>
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset("letzteWoche")}>Letzte Woche</button>
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset("dieserMonat")}>Dieser Monat</button>
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset("letzterMonat")}>Letzter Monat</button>
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset("diesesJahr")}>Dieses Jahr</button>
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset("letztesJahr")}>Letztes Jahr</button>
                                <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setPreset("alles")}>Alles</button>
                            </div>

                            {/* Filter Row 1 */}
                            <div className="row g-2 mb-2">
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Lieferdatum von</label>
                                    <input type="date" className="form-control" value={lieferdatumVon} onChange={e => setLieferdatumVon(e.target.value)} />
                                </div>
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Lieferdatum bis</label>
                                    <input type="date" className="form-control" value={lieferdatumBis} onChange={e => setLieferdatumBis(e.target.value)} />
                                </div>
                            </div>

                            {/* Filter Row 2 */}
                            <div className="row g-2 mb-3">
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Kunden-Kategorie</label>
                                    <input className="form-control" value={kundenKategorie} onChange={e => setKundenKategorie(e.target.value)} placeholder="contains…" />
                                </div>
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Region</label>
                                    <input className="form-control" value={kundenRegion} onChange={e => setKundenRegion(e.target.value)} placeholder="contains…" />
                                </div>
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Artikel-Nr.</label>
                                    <input className="form-control" value={artikelNr} onChange={e => setArtikelNr(e.target.value)} placeholder="contains…" />
                                </div>
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Artikel (Name)</label>
                                    <input className="form-control" value={artikelName} onChange={e => setArtikelName(e.target.value)} placeholder="contains…" />
                                </div>
                            </div>

                            {/* Status Chips */}
                            <div className="mb-3">
                                <div className="form-text mb-1">Status (optional):</div>
                                <div className="d-flex flex-wrap gap-2">
                                    {STATUS_OPTS.map(s => (
                                        <div className="form-check form-check-inline" key={s}>
                                            <input className="form-check-input" type="checkbox" id={`status-${s}`} checked={statusIn.includes(s)} onChange={() => toggleStatus(s)} />
                                            <label className="form-check-label" htmlFor={`status-${s}`}>{s}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="d-flex gap-2 mb-2">
                                <button className="btn btn-primary cz-btn-primary" disabled={!canSearch} onClick={search}>
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Lade…
                                        </>
                                    ) : "Suchen"}
                                </button>
                                <button className="btn btn-outline-secondary cz-btn-secondary" disabled={!rows.length} onClick={exportCsv}>
                                    Als CSV exportieren
                                </button>
                                <button className="btn btn-outline-danger ms-auto" type="button" onClick={resetFilters}>
                                    Zurücksetzen
                                </button>
                                {/* <div className="form-check form-switch ms-2">
                                    <input className="form-check-input" type="checkbox" id="debugSwitch" checked={debug} onChange={e => setDebug(e.target.checked)} />
                                    <label className="form-check-label" htmlFor="debugSwitch">Debug-Log</label>
                                </div> */}
                                <span className="badge bg-secondary align-self-center ms-2">
                                    Ergebnisse: {rows.length}
                                </span>
                            </div>

                            {error && <div className="alert alert-danger py-2">{error}</div>}

                            {/* Results */}
                            <div className="table-responsive border rounded">
                                <table className="table table-sm table-hover align-middle mb-0">
                                    <thead className="table-light sticky-top">
                                        <tr>
                                            <th role="button" onClick={() => onSort("artikelName")}>Artikel{sortIndicator("artikelName")}</th>
                                            <th role="button" onClick={() => onSort("artikelNummer")}>Artikel-Nr{sortIndicator("artikelNummer")}</th>
                                            <th className="text-end" role="button" onClick={() => onSort("mengeSum")}>Menge Σ{sortIndicator("mengeSum")}</th>
                                            <th role="button" onClick={() => onSort("einheit")}>Einheit{sortIndicator("einheit")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedRows.map((r, idx) => (
                                            <tr key={idx}>
                                                <td>{r.artikelName ?? r.artikelId}</td>
                                                <td>{r.artikelNummer ?? "-"}</td>
                                                <td className="text-end">{r.mengeSum}</td>
                                                <td>{r.einheit ?? "-"}</td>
                                            </tr>
                                        ))}
                                        {!rows.length && !loading && (
                                            <tr>
                                                <td colSpan={4} className="text-muted py-3">Keine Daten</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>Schließen</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}