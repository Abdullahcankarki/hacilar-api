import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { useNavigate } from "react-router-dom";
import {
    getAllAuftraege,
    getAllMitarbeiter,
    getAllKunden,
    generateBelegeBatchPdfs,
    deleteAuftrag,
    deleteMultipleAuftraege,
} from "../../../backend/api";
import { AuftragResource, MitarbeiterResource, KundeResource } from "../../../Resources";
import BestellteArtikelModal from "./bestellteArtikelModal";

/** Small helpers */
const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");
const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("de-DE") : "—";

type Status = "offen" | "in Bearbeitung" | "abgeschlossen" | "storniert";
type KomStatus = "offen" | "gestartet" | "fertig";
type KontrollStatus = "offen" | "in Kontrolle" | "geprüft";

const STATUS_BADGE: Record<Status, string> = {
    offen: "bg-secondary",
    "in Bearbeitung": "bg-warning",
    abgeschlossen: "bg-success",
    storniert: "bg-dark",
};

const K_STATUS_BADGE: Record<KomStatus, string> = {
    offen: "bg-secondary",
    gestartet: "bg-info",
    fertig: "bg-success",
};

const KO_STATUS_BADGE: Record<KontrollStatus, string> = {
    offen: "bg-secondary",
    "in Kontrolle": "bg-info",
    geprüft: "bg-success",
};

const DEFAULT_LIMIT = 50;

export default function AuftraegeOverview() {
    const navigate = useNavigate();

    // Data
    const [items, setItems] = useState<AuftragResource[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState<number | undefined>(DEFAULT_LIMIT); // undefined => ALL

    // Filters
    const [statusIn, setStatusIn] = useState<Status[]>([]);
    const [kommissioniertStatus, setKommissioniertStatus] = useState<KomStatus | "">("");
    const [kontrolliertStatus, setKontrolliertStatus] = useState<KontrollStatus | "">("");
    const [kunde, setKunde] = useState(""); // id
    const [hasTour, setHasTour] = useState<"" | "true" | "false">("");
    const [lieferVon, setLieferVon] = useState("");
    const [lieferBis, setLieferBis] = useState("");
    const [createdVon, setCreatedVon] = useState("");
    const [createdBis, setCreatedBis] = useState("");
    const [sort, setSort] = useState<
        | "createdAtDesc" | "createdAtAsc"
        | "updatedAtDesc" | "updatedAtAsc"
        | "lieferdatumAsc" | "lieferdatumDesc"
        | "auftragsnummerAsc" | "auftragsnummerDesc"
    >("createdAtDesc");

    // Kontrolle-/Kommissionierer-Auswahl
    const [mitarbeiter, setMitarbeiter] = useState<MitarbeiterResource[]>([]);
    const [kommissioniertVon, setKommissioniertVon] = useState("");
    const [kontrolliertVon, setKontrolliertVon] = useState("");

    // Kunden-Auswahl
    const [kunden, setKunden] = useState<KundeResource[]>([]);
    const [ausgewaehlterKunde, setAusgewaehlterKunde] = useState<string>('');

    const [showBestellteModal, setShowBestellteModal] = useState(false);
    // halte den API-Filter `kunde` in sync mit der gespeicherten Auswahl
    useEffect(() => {
        if (ausgewaehlterKunde) {
            setKunde(ausgewaehlterKunde);
        }
    }, [ausgewaehlterKunde]);

    // Zusätzliche Parameter
    const [auftragsnummer, setAuftragsnummer] = useState("");
    const [updatedVon, setUpdatedVon] = useState("");
    const [updatedBis, setUpdatedBis] = useState("");

    // Drucken (Mehrfachauswahl)
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectAllFiltered, setSelectAllFiltered] = useState(false);

    const isSelected = (id?: string) => !!(id && selectedIds.has(id));
    const toggleSelect = (id?: string) => {
        if (!id) return;
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const clearSelection = () => {
        setSelectedIds(new Set());
        setSelectAllFiltered(false);
    };

    // Delete (Confirm Modal)
    const [showDelete, setShowDelete] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteErr, setDeleteErr] = useState<string | null>(null);

    const openDelete = (id?: string) => {
        if (!id) return;
        setDeleteErr(null);
        setDeleteId(id);
        setShowDelete(true);
    };

    const closeDelete = () => {
        setShowDelete(false);
        setDeleteBusy(false);
        setDeleteErr(null);
        setDeleteId(null);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        setDeleteBusy(true);
        setDeleteErr(null);
        try {
            await deleteAuftrag(deleteId);
            // optimistic remove
            setItems((prev) => prev.filter((x) => x.id !== deleteId));
            // reset selection if needed
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(deleteId);
                return next;
            });
            // refetch in background for consistency
            setReloadKey((k) => k + 1);
            closeDelete();
        } catch (e: any) {
            setDeleteErr(e?.message || "Fehler beim Löschen");
        } finally {
            setDeleteBusy(false);
        }
    };

    // Multiple Delete (Confirm Modal)
    const [showMultipleDelete, setShowMultipleDelete] = useState(false);
    const [multipleDeleteBusy, setMultipleDeleteBusy] = useState(false);
    const [multipleDeleteErr, setMultipleDeleteErr] = useState<string | null>(null);

    const openMultipleDelete = () => {
        const ids = selectAllFiltered
            ? items.map(i => i.id!).filter(Boolean)
            : Array.from(selectedIds);
        if (ids.length === 0) {
            alert("Bitte mindestens einen Auftrag auswählen.");
            return;
        }
        setMultipleDeleteErr(null);
        setShowMultipleDelete(true);
    };

    const closeMultipleDelete = () => {
        setShowMultipleDelete(false);
        setMultipleDeleteBusy(false);
        setMultipleDeleteErr(null);
    };

    const confirmMultipleDelete = async () => {
        const ids = selectAllFiltered
            ? items.map(i => i.id!).filter(Boolean)
            : Array.from(selectedIds);
        if (ids.length === 0) return;

        setMultipleDeleteBusy(true);
        setMultipleDeleteErr(null);
        try {
            await deleteMultipleAuftraege(ids);
            // optimistic remove
            setItems((prev) => prev.filter((x) => !ids.includes(x.id!)));
            // clear selection
            clearSelection();
            setSelectionMode(false);
            // refetch in background for consistency
            setReloadKey((k) => k + 1);
            closeMultipleDelete();
        } catch (e: any) {
            setMultipleDeleteErr(e?.message || "Fehler beim Löschen");
        } finally {
            setMultipleDeleteBusy(false);
        }
    };

    const handleBatchPrint = async () => {
        try {
            const ids = selectAllFiltered
                ? items.map(i => i.id!).filter(Boolean)
                : Array.from(selectedIds);
            if (!ids.length) {
                alert("Bitte mindestens einen Auftrag auswählen.");
                return;
            }
            const files = await generateBelegeBatchPdfs(ids, 'rechnung');
            for (const f of files) {
                const url = URL.createObjectURL(f.blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = f.filename || "beleg.pdf";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            }
            // nach Erfolg Auswahl zurücksetzen (optional)
            clearSelection();
            setSelectionMode(false);
        } catch (e: any) {
            alert(e?.message || "Fehler beim Batch-Druck");
        }
    };


    // Load Mitarbeiter (für „nur Kontrolle-User“ Filter)
    useEffect(() => {
        (async () => {
            try {
                const data: any = await getAllMitarbeiter();
                const list: any[] = Array.isArray(data) ? data : (data?.items || []);
                setMitarbeiter(list as MitarbeiterResource[]);
            } catch {
                // still usable without this list
                setMitarbeiter([]);
            }
        })();
    }, []);

    // Load Kunden (für Select)
    useEffect(() => {
        (async () => {
            try {
                const list = await getAllKunden();
                setKunden(list.items || []);
            } catch {
                setKunden([]);
            }
        })();
    }, []);

    const kundenAlphabetisch = useMemo(() => {
        return [...kunden].sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));
    }, [kunden]);


    // robust roles extraction
    const extractRoles = (m: any): string[] => {
        const r = (m?.role ?? m?.roles ?? m?.rollen);
        const arr = Array.isArray(r) ? r : [r];
        return arr.filter(Boolean).map((x: any) => String(x).toLowerCase());
    };

    const kontrolleUsers = useMemo(
        () => (mitarbeiter || []).filter((m: any) => extractRoles(m).includes("kontrolle")),
        [mitarbeiter]
    );

    const kommissioniererUsers = useMemo(
        () => (mitarbeiter || []).filter((m: any) => extractRoles(m).includes("kommissionierung")),
        [mitarbeiter]
    );

    // Fetch
    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const params: any = {
                    page,
                    sort,
                };

                // limit: nur setzen, wenn wir paginieren wollen
                if (typeof limit === "number") params.limit = limit;

                if (statusIn.length) params.statusIn = statusIn;
                if (kommissioniertStatus) params.kommissioniertStatus = kommissioniertStatus;
                if (kontrolliertStatus) params.kontrolliertStatus = kontrolliertStatus;
                if (kunde) params.kunde = kunde;
                if (lieferVon) params.lieferdatumVon = lieferVon;
                if (lieferBis) params.lieferdatumBis = lieferBis;
                if (auftragsnummer) params.auftragsnummer = auftragsnummer;
                if (createdVon) params.createdVon = createdVon;
                if (createdBis) params.createdBis = createdBis;
                if (updatedVon) params.updatedVon = updatedVon;
                if (updatedBis) params.updatedBis = updatedBis;
                if (kommissioniertVon) params.kommissioniertVon = kommissioniertVon;
                if (kontrolliertVon) params.kontrolliertVon = kontrolliertVon;
                if (hasTour === "true") params.hasTour = true;
                if (hasTour === "false") params.hasTour = false;

                const data = await getAllAuftraege(params);
                setItems(data);
            } catch (e: any) {
                setError(e?.message || "Fehler beim Laden");
            } finally {
                setLoading(false);
            }
        })();
    }, [
        page,
        limit,
        statusIn,
        kommissioniertStatus,
        kontrolliertStatus,
        kunde,
        hasTour,
        lieferVon,
        lieferBis,
        createdVon,
        createdBis,
        kommissioniertVon,
        kontrolliertVon,
        sort,
        reloadKey,
    ]);

    const clearFilters = () => {
        setStatusIn([]);
        setKommissioniertStatus("");
        setKontrolliertStatus("");
        setKunde("");
        setHasTour("");
        setLieferVon("");
        setLieferBis("");
        setCreatedVon("");
        setCreatedBis("");
        setKommissioniertVon("");
        setKontrolliertVon("");
        setSort("createdAtDesc");
        setPage(1);
        setAuftragsnummer("");
        setCreatedVon("");
        setCreatedBis("");
        setUpdatedVon("");
        setUpdatedBis("");
    };

    const handleRowClick = (id?: string) => {
        if (!id) return;
        navigate(`/auftraege/${id}`);
    };

    return (
        <div className="container py-3 py-lg-4">
            {/* Header */}
            <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                        <h2 className="h4 mb-1">Aufträge</h2>
                        <div className="text-muted small">
                            Übersicht &amp; Schnellfilter
                        </div>
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    {/* Left Group - Filter & Create */}
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <button
                            className="btn btn-outline-primary d-flex align-items-center"
                            type="button"
                            data-bs-toggle="offcanvas"
                            data-bs-target="#auftragFilterDrawer"
                            aria-controls="auftragFilterDrawer"
                            title="Filter öffnen"
                        >
                            <i className="ci-filter me-2" /> Filter
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary d-flex align-items-center"
                            title="Schnellerfassung"
                            aria-label="Schnellerfassung öffnen"
                            onClick={() => navigate('/auftrag-schnell')}
                        >
                            <i className="ci-plus me-2" />
                            Schnellerfassung
                        </button>
                        <button
                            type="button"
                            className="btn btn-dark d-flex align-items-center"
                            title="Bestellte Artikel anzeigen"
                            aria-label="Bestellte Artikel anzeigen"
                            onClick={() => setShowBestellteModal(true)}
                        >
                            <i className="ci-check-square me-2" />
                            Bestellte Artikel
                        </button>
                    </div>

                    {/* Right Group - Pagination & Multi-Select */}
                    <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
                        {/* Pagination Limits */}
                        <div className="btn-group btn-group-sm">
                            <button
                                className={cls("btn btn-outline-secondary", limit === undefined && "active")}
                                title="Alle laden"
                                onClick={() => { setLimit(undefined); setPage(1); }}
                            >
                                Alle
                            </button>
                            {[25, 50, 100].map((n) => (
                                <button
                                    key={n}
                                    className={cls("btn btn-outline-secondary", limit === n && "active")}
                                    onClick={() => { setLimit(n); setPage(1); }}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>

                        {/* Multi-Select Mode */}
                        {!selectionMode ? (
                            <button
                                className="btn btn-success d-flex align-items-center"
                                onClick={() => { setSelectionMode(true); clearSelection(); }}
                                title="Mehrfachauswahl aktivieren"
                            >
                                <i className="ci-check-square me-2" /> Mehrfachauswahl
                            </button>
                        ) : (
                            <>
                                <button
                                    className="btn btn-primary d-flex align-items-center"
                                    onClick={handleBatchPrint}
                                    title="Ausgewählte drucken"
                                >
                                    <i className="ci-download me-2" /> Drucken
                                </button>
                                <button
                                    className="btn btn-danger d-flex align-items-center"
                                    onClick={openMultipleDelete}
                                    title="Ausgewählte löschen"
                                >
                                    <i className="ci-trash me-2" /> Löschen
                                </button>
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="selectAllFiltered"
                                        checked={selectAllFiltered}
                                        onChange={(e) => {
                                            setSelectAllFiltered(e.target.checked);
                                            if (e.target.checked) {
                                                setSelectedIds(new Set());
                                            }
                                        }}
                                    />
                                    <label className="form-check-label" htmlFor="selectAllFiltered">
                                        Alle auswählen
                                    </label>
                                </div>
                                <button
                                    className="btn btn-outline-secondary d-flex align-items-center"
                                    onClick={() => { setSelectionMode(false); clearSelection(); }}
                                >
                                    Abbrechen
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Offcanvas (links, über gesamten Bildschirm) */}
            <div
                className="offcanvas offcanvas-start"
                tabIndex={-1}
                id="auftragFilterDrawer"
                aria-labelledby="auftragFilterDrawerLabel"
                style={{ width: '420px', maxWidth: '85vw', zIndex: '3000' }}
            >
                <div className="offcanvas-header border-bottom">
                    <h5 className="offcanvas-title" id="auftragFilterDrawerLabel">Filter</h5>
                    <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div className="offcanvas-body">
                    {/* === LIEFERDATUM (immer offen) === */}
                    <div className="mb-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <h6 className="mb-0">Lieferdatum</h6>
                            {(lieferVon || lieferBis) && (
                                <button
                                    className="btn btn-sm btn-link text-decoration-none"
                                    onClick={() => { setLieferVon(""); setLieferBis(""); setPage(1); }}
                                >
                                    Zurücksetzen
                                </button>
                            )}
                        </div>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { const d=new Date(); const s=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; setLieferVon(s); setLieferBis(s); setPage(1); }}>Heute</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { const d=new Date(); d.setDate(d.getDate()-1); const s=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; setLieferVon(s); setLieferBis(s); setPage(1); }}>Gestern</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { const now=new Date(); const day=now.getDay()||7; const monday=new Date(now.getTime()); monday.setDate(now.getDate()-day+1); const sunday=new Date(monday.getTime()); sunday.setDate(monday.getDate()+6); const from=`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`; const to=`${sunday.getFullYear()}-${String(sunday.getMonth()+1).padStart(2,'0')}-${String(sunday.getDate()).padStart(2,'0')}`; setLieferVon(from); setLieferBis(to); setPage(1); }}>Diese Woche</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { const now=new Date(); const day=now.getDay()||7; const lastMonday=new Date(now.getTime()); lastMonday.setDate(now.getDate()-day-6); const lastSunday=new Date(lastMonday.getTime()); lastSunday.setDate(lastMonday.getDate()+6); const from=`${lastMonday.getFullYear()}-${String(lastMonday.getMonth()+1).padStart(2,'0')}-${String(lastMonday.getDate()).padStart(2,'0')}`; const to=`${lastSunday.getFullYear()}-${String(lastSunday.getMonth()+1).padStart(2,'0')}-${String(lastSunday.getDate()).padStart(2,'0')}`; setLieferVon(from); setLieferBis(to); setPage(1); }}>Letzte Woche</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { const now=new Date(); const first=new Date(now.getFullYear(), now.getMonth(), 1); const last=new Date(now.getFullYear(), now.getMonth()+1, 0); const from=`${first.getFullYear()}-${String(first.getMonth()+1).padStart(2,'0')}-${String(first.getDate()).padStart(2,'0')}`; const to=`${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`; setLieferVon(from); setLieferBis(to); setPage(1); }}>Diesen Monat</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { const now=new Date(); const first=new Date(now.getFullYear(), now.getMonth()-1, 1); const last=new Date(now.getFullYear(), now.getMonth(), 0); const from=`${first.getFullYear()}-${String(first.getMonth()+1).padStart(2,'0')}-${String(first.getDate()).padStart(2,'0')}`; const to=`${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`; setLieferVon(from); setLieferBis(to); setPage(1); }}>Letzten Monat</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { const now=new Date(); const first=new Date(now.getFullYear(),0,1); const last=new Date(now.getFullYear(),11,31); const from=`${first.getFullYear()}-${String(first.getMonth()+1).padStart(2,'0')}-${String(first.getDate()).padStart(2,'0')}`; const to=`${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`; setLieferVon(from); setLieferBis(to); setPage(1); }}>Dieses Jahr</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { const now=new Date(); const first=new Date(now.getFullYear()-1,0,1); const last=new Date(now.getFullYear()-1,11,31); const from=`${first.getFullYear()}-${String(first.getMonth()+1).padStart(2,'0')}-${String(first.getDate()).padStart(2,'0')}`; const to=`${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`; setLieferVon(from); setLieferBis(to); setPage(1); }}>Letztes Jahr</button>
                        </div>
                        <div className="d-flex gap-2">
                            <input type="date" className="form-control" value={lieferVon} onChange={(e) => { setLieferVon(e.target.value); setPage(1); }} />
                            <input type="date" className="form-control" value={lieferBis} onChange={(e) => { setLieferBis(e.target.value); setPage(1); }} />
                        </div>
                    </div>

                    {/* === REST MIT ZUKLAPPEN (Accordion) === */}
                    <div className="accordion" id="auftragFilterAccordion">
                        {/* Status */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="afh-status">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#afc-status" aria-expanded="false" aria-controls="afc-status">
                                    Status & Bearbeitung
                                </button>
                            </h2>
                            <div id="afc-status" className="accordion-collapse collapse" aria-labelledby="afh-status" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <h6 className="mb-0">Status</h6>
                                        {statusIn.length > 0 && (
                                            <button className="btn btn-sm btn-link text-decoration-none" onClick={() => { setStatusIn([]); setPage(1); }}>
                                                Zurücksetzen
                                            </button>
                                        )}
                                    </div>
                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                        {(["offen", "in Bearbeitung", "abgeschlossen", "storniert"] as Status[]).map((s) => {
                                            const active = statusIn.includes(s);
                                            return (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    className={cls("btn btn-sm", active ? "btn-primary" : "btn-outline-secondary")}
                                                    onClick={() => {
                                                        setPage(1);
                                                        setStatusIn((prev) => active ? prev.filter((x) => x !== s) : [...prev, s]);
                                                    }}
                                                >
                                                    {s}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="row g-2">
                                        <div className="col-6">
                                            <label className="form-label">Kommissioniert-Status</label>
                                            <select
                                                className="form-select"
                                                value={kommissioniertStatus}
                                                onChange={(e) => { setKommissioniertStatus(e.target.value as KomStatus | ""); setPage(1); }}
                                            >
                                                <option value="">Alle</option>
                                                <option value="offen">offen</option>
                                                <option value="gestartet">gestartet</option>
                                                <option value="fertig">fertig</option>
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label">Kontroll-Status</label>
                                            <select
                                                className="form-select"
                                                value={kontrolliertStatus}
                                                onChange={(e) => { setKontrolliertStatus(e.target.value as KontrollStatus | ""); setPage(1); }}
                                            >
                                                <option value="">Alle</option>
                                                <option value="offen">offen</option>
                                                <option value="geprüft">geprüft</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Kunde */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="afh-kunde">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#afc-kunde" aria-expanded="false" aria-controls="afc-kunde">
                                    Kunde
                                </button>
                            </h2>
                            <div id="afc-kunde" className="accordion-collapse collapse" aria-labelledby="afh-kunde" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <h6 className="mb-0">Kunde wählen</h6>
                                        {(ausgewaehlterKunde || kunde) && (
                                            <button className="btn btn-sm btn-link text-decoration-none" onClick={() => { setAusgewaehlterKunde(''); setKunde(''); setPage(1); }}>
                                                Zurücksetzen
                                            </button>
                                        )}
                                    </div>
                                    <Select
                                        options={kundenAlphabetisch.map(k => ({ value: k.id!, label: k.name || '' }))}
                                        value={(() => {
                                            const match = kundenAlphabetisch.find(k => k.id === (ausgewaehlterKunde || kunde));
                                            return match ? { value: match.id!, label: match.name || '' } : null;
                                        })()}
                                        onChange={(selected: any) => {
                                            if (selected && selected.value) {
                                                setAusgewaehlterKunde(selected.value);
                                                setKunde(selected.value);
                                                setPage(1);
                                            } else {
                                                setAusgewaehlterKunde('');
                                                setKunde('');
                                                setPage(1);
                                            }
                                        }}
                                        placeholder="Kunde wählen…"
                                        isClearable
                                        styles={{
                                            container: (base) => ({ ...base, width: '100%' }),
                                            control: (base) => ({ ...base, borderColor: '#6c757d', minHeight: 36, height: 36 }),
                                            valueContainer: (base) => ({ ...base, height: 36, padding: '0 8px' }),
                                            input: (base) => ({ ...base, margin: 0, padding: 0 }),
                                            indicatorsContainer: (base) => ({ ...base, height: 36 }),
                                            menu: (base) => ({ ...base, zIndex: 5 })
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Personen */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="afh-personen">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#afc-personen" aria-expanded="false" aria-controls="afc-personen">
                                    Personen
                                </button>
                            </h2>
                            <div id="afc-personen" className="accordion-collapse collapse" aria-labelledby="afh-personen" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
                                    <div className="row g-2">
                                        <div className="col-6">
                                            <label className="form-label">Kommissioniert von</label>
                                            <select className="form-select" value={kommissioniertVon} onChange={(e) => { setKommissioniertVon(e.target.value); setPage(1); }}>
                                                <option value="">Alle</option>
                                                {kommissioniererUsers.map((u) => (
                                                    <option key={u.id} value={u.id!}>{u.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label">Kontrolliert von</label>
                                            <select className="form-select" value={kontrolliertVon} onChange={(e) => { setKontrolliertVon(e.target.value); setPage(1); }}>
                                                <option value="">Alle</option>
                                                {kontrolleUsers.map((u) => (
                                                    <option key={u.id} value={u.id!}>{u.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Auftrag & Sonstiges */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="afh-auftrag">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#afc-auftrag" aria-expanded="false" aria-controls="afc-auftrag">
                                    Auftrag & Sonstiges
                                </button>
                            </h2>
                            <div id="afc-auftrag" className="accordion-collapse collapse" aria-labelledby="afh-auftrag" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
                                    <div className="mb-2">
                                        <label className="form-label">Auftragsnummer</label>
                                        <input className="form-control" placeholder="z. B. 2025-000123" value={auftragsnummer} onChange={(e) => { setAuftragsnummer(e.target.value); setPage(1); }} />
                                    </div>
                                    <div className="mb-2">
                                        <label className="form-label">Hat Tour</label>
                                        <select className="form-select" value={hasTour} onChange={(e) => { setHasTour(e.target.value as any); setPage(1); }}>
                                            <option value="">Alle</option>
                                            <option value="true">Ja</option>
                                            <option value="false">Nein</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Sortierung</label>
                                        <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                                            <option value="createdAtDesc">Neueste zuerst</option>
                                            <option value="createdAtAsc">Älteste zuerst</option>
                                            <option value="updatedAtDesc">Zuletzt aktualisiert</option>
                                            <option value="updatedAtAsc">Früh aktualisiert</option>
                                            <option value="lieferdatumAsc">Lieferdatum ↑</option>
                                            <option value="lieferdatumDesc">Lieferdatum ↓</option>
                                            <option value="auftragsnummerAsc">Auftragsnr. A→Z</option>
                                            <option value="auftragsnummerDesc">Auftragsnr. Z→A</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Aktionen */}
                    <div className="border-top pt-3 d-flex gap-2 mt-3">
                        <button className="btn btn-outline-secondary" onClick={clearFilters}>
                            <i className="ci-close me-2" /> Zurücksetzen
                        </button>
                        <button className="btn btn-primary" data-bs-dismiss="offcanvas">
                            Anwenden
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="card shadow-sm border-0">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                                <tr>
                                    {selectionMode && <th style={{ width: 36 }}>
                                        {!selectAllFiltered && (
                                            <input
                                                type="checkbox"
                                                aria-label="Alle sichtbaren auswählen"
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        const next = new Set(selectedIds);
                                                        for (const a of items) if (a.id) next.add(a.id);
                                                        setSelectedIds(next);
                                                    } else {
                                                        clearSelection();
                                                    }
                                                }}
                                                checked={selectAllFiltered ? true : items.every(a => a.id && selectedIds.has(a.id))}
                                            />
                                        )}
                                    </th>}
                                    <th style={{ width: 120 }}>Auftragsnr.</th>
                                    <th>Kunde</th>
                                    <th style={{ width: 140 }}>Lieferdatum</th>
                                    <th style={{ width: 140 }}>Status</th>
                                    <th style={{ width: 140 }}>Kommissioniert</th>
                                    <th style={{ width: 140 }}>Kontrolle</th>
                                    <th style={{ width: 140 }} className="text-end">Gewicht</th>
                                    <th style={{ width: 140 }} className="text-end">Preis</th>
                                    <th style={{ width: 56 }} className="text-end"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan={10} className="text-center py-5">
                                            <div className="spinner-border" role="status" />
                                        </td>
                                    </tr>
                                )}
                                {!loading && error && (
                                    <tr>
                                        <td colSpan={10} className="text-center py-4 text-danger">
                                            {error}
                                        </td>
                                    </tr>
                                )}
                                {!loading && !error && items.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="text-center py-4 text-muted">
                                            Keine Aufträge gefunden.
                                        </td>
                                    </tr>
                                )}
                                {!loading && !error && items.map((a) => (
                                    <tr
                                        key={a.id}
                                        role="button"
                                        onClick={() => selectionMode ? toggleSelect(a.id) : handleRowClick(a.id)}
                                        className={cls("cursor-pointer", selectionMode && isSelected(a.id) && "table-active")}
                                    >
                                        {selectionMode && (
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected(a.id) || selectAllFiltered}
                                                    onChange={() => toggleSelect(a.id)}
                                                />
                                            </td>
                                        )}
                                        <td className="fw-semibold">{a.auftragsnummer || "—"}</td>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                <div className="flex-grow-1">
                                                    <div className="fw-medium">{a.kundeName || "—"}</div>
                                                </div>
                                                {a.gesamtPaletten ? (
                                                    <span className="badge bg-white text-secondary border border-secondary ms-2">
                                                        {a.gesamtPaletten} Pal.
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>
                                        <td>{formatDate(a.lieferdatum)}</td>
                                        <td>
                                            <span className={cls("badge", STATUS_BADGE[(a.status as Status) || "offen"])}>
                                                {a.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <span className={cls("badge", K_STATUS_BADGE[(a.kommissioniertStatus as KomStatus) || "offen"])}>
                                                    {a.kommissioniertStatus || "—"}
                                                </span>
                                                <span className="text-muted small">{a.kommissioniertVonName || ""}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <span className={cls("badge", KO_STATUS_BADGE[(a.kontrolliertStatus as KontrollStatus) || "offen"])}>
                                                    {a.kontrolliertStatus || "—"}
                                                </span>
                                                <span className="text-muted small">{a.kontrolliertVonName || ""}</span>
                                            </div>
                                        </td>
                                        <td className="text-end">{typeof a.gewicht === "number" ? `${a.gewicht.toLocaleString("de-DE")} kg` : "—"}</td>
                                        <td className="text-end">{typeof a.preis === "number" ? `${a.preis.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}` : "—"}</td>
                                        <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger"
                                                title="Auftrag löschen"
                                                aria-label="Auftrag löschen"
                                                onClick={() => openDelete(a.id)}
                                                disabled={selectionMode}
                                            >
                                                <i className="ci-trash" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer / Pagination */}
                <div className="card-footer d-flex align-items-center justify-content-between">
                    <div className="text-muted small">
                        {limit ? `Seite ${page}` : `Alle Ergebnisse`}
                    </div>
                    {limit && (
                        <div className="btn-group">
                            <button
                                className="btn btn-outline-secondary"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                <i className="ci-arrow-left me-2" /> Zurück
                            </button>
                            <button
                                className="btn btn-outline-secondary"
                                disabled={loading || items.length < limit}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Weiter <i className="ci-arrow-right ms-2" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showDelete && (
                <div
                    className="modal d-block"
                    tabIndex={-1}
                    role="dialog"
                    style={{ background: 'rgba(30,33,37,.6)', zIndex: 4000 }}
                >
                    <div className="modal-dialog modal-dialog-centered" role="document">
                        <div className="modal-content">
                            <div className="modal-header">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="ci-trash fs-4 text-danger" />
                                    <div>
                                        <h5 className="modal-title mb-0">Auftrag löschen</h5>
                                        <div className="small text-muted">Diese Aktion kann nicht rückgängig gemacht werden.</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={closeDelete}
                                    disabled={deleteBusy}
                                    aria-label="Close"
                                />
                            </div>
                            <div className="modal-body">
                                {deleteErr && (
                                    <div className="alert alert-danger mb-0">{deleteErr}</div>
                                )}
                                {!deleteErr && (
                                    <div>
                                        Möchtest du diesen Auftrag wirklich löschen?
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={closeDelete}
                                    disabled={deleteBusy}
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={confirmDelete}
                                    disabled={deleteBusy}
                                >
                                    {deleteBusy && <span className="spinner-border spinner-border-sm me-2" />}
                                    Löschen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showMultipleDelete && (
                <div
                    className="modal d-block"
                    tabIndex={-1}
                    role="dialog"
                    style={{ background: 'rgba(30,33,37,.6)', zIndex: 4000 }}
                >
                    <div className="modal-dialog modal-dialog-centered" role="document">
                        <div className="modal-content">
                            <div className="modal-header">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="ci-trash fs-4 text-danger" />
                                    <div>
                                        <h5 className="modal-title mb-0">Mehrere Aufträge löschen</h5>
                                        <div className="small text-muted">Diese Aktion kann nicht rückgängig gemacht werden.</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={closeMultipleDelete}
                                    disabled={multipleDeleteBusy}
                                    aria-label="Close"
                                />
                            </div>
                            <div className="modal-body">
                                {multipleDeleteErr && (
                                    <div className="alert alert-danger mb-0">{multipleDeleteErr}</div>
                                )}
                                {!multipleDeleteErr && (
                                    <div>
                                        <p className="mb-2">
                                            Möchtest du wirklich <strong>
                                                {selectAllFiltered
                                                    ? items.length
                                                    : selectedIds.size
                                                } Auftrag{(selectAllFiltered ? items.length : selectedIds.size) === 1 ? '' : 'e'}
                                            </strong> löschen?
                                        </p>
                                        <div className="alert alert-warning mb-0">
                                            <i className="ci-info-circle me-2"></i>
                                            Dies wird alle zugehörigen Artikel-Positionen, Zerlegeaufträge und TourStops ebenfalls löschen.
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={closeMultipleDelete}
                                    disabled={multipleDeleteBusy}
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={confirmMultipleDelete}
                                    disabled={multipleDeleteBusy}
                                >
                                    {multipleDeleteBusy && <span className="spinner-border spinner-border-sm me-2" />}
                                    {(selectAllFiltered ? items.length : selectedIds.size)} Auftrag{(selectAllFiltered ? items.length : selectedIds.size) === 1 ? '' : 'e'} löschen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <BestellteArtikelModal
                isOpen={showBestellteModal}
                onClose={() => setShowBestellteModal(false)}
            />
        </div>
    );
}