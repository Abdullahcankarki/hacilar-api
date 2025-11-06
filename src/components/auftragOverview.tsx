import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { useNavigate } from "react-router-dom";
import {
    getAllAuftraege,
    getAllMitarbeiter,
    getAllKunden,
    generateBelegeBatchPdfs
} from "../backend/api";
import { AuftragResource, MitarbeiterResource, KundeResource } from "../Resources";
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
            <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap">
                <div>
                    <h2 className="h4 mb-1">Aufträge</h2>
                    <div className="text-muted small">
                        Übersicht &amp; Schnellfilter
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap w-100">
                    <div className="btn-group me-0 me-sm-1 order-1 flex-shrink-0">
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
                    </div>
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
                    <div className="btn-group btn-group-sm order-2 flex-shrink-0 mt-2 mt-lg-0">
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
                    {/* Drucken (Mehrfachauswahl) */}
                    <div className="ms-auto d-flex align-items-center gap-2 mt-2 mt-lg-0">
                        {!selectionMode ? (
                            <button
                                className="btn btn-success"
                                onClick={() => { setSelectionMode(true); clearSelection(); }}
                                title="Mehrere Belege drucken"
                            >
                                <i className="ci-printer me-2" /> Drucken
                            </button>
                        ) : (
                            <>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleBatchPrint}
                                    title="Ausgewählte drucken"
                                >
                                    <i className="ci-download me-2" /> Ausgewählte drucken (Rechnung)
                                </button>
                                <div className="form-check ms-2">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="selectAllFiltered"
                                        checked={selectAllFiltered}
                                        onChange={(e) => {
                                            setSelectAllFiltered(e.target.checked);
                                            if (e.target.checked) {
                                                // When selecting all filtered, clear individual set to avoid confusion
                                                setSelectedIds(new Set());
                                            }
                                        }}
                                    />
                                    <label className="form-check-label" htmlFor="selectAllFiltered">
                                        Alle (gefilterten) auswählen
                                    </label>
                                </div>
                                <button
                                    className="btn btn-outline-secondary"
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
                style={{ width: '420px', maxWidth: '85vw' }}
            >
                <div className="offcanvas-header border-bottom">
                    <h5 className="offcanvas-title" id="auftragFilterDrawerLabel">Filter</h5>
                    <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div className="offcanvas-body">
                    <div className="accordion" id="auftragFilterAccordion">
                        {/* Status */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="headingStatus">
                                <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseStatus" aria-expanded="true" aria-controls="collapseStatus">
                                    Status
                                </button>
                            </h2>
                            <div id="collapseStatus" className="accordion-collapse collapse show" aria-labelledby="headingStatus" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
                                    <div className="d-flex flex-wrap gap-2">
                                        {(["offen", "in Bearbeitung", "abgeschlossen", "storniert"] as Status[]).map((s) => {
                                            const active = statusIn.includes(s);
                                            return (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    className={cls("btn btn-sm", active ? "btn-primary" : "btn-outline-secondary")}
                                                    onClick={() => {
                                                        setPage(1);
                                                        setStatusIn((prev) =>
                                                            active ? prev.filter((x) => x !== s) : [...prev, s]
                                                        );
                                                    }}
                                                >
                                                    {s}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-3">
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

                                    <div className="mt-3">
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

                        {/* Personen */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="headingPeople">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePeople" aria-expanded="false" aria-controls="collapsePeople">
                                    Personen
                                </button>
                            </h2>
                            <div id="collapsePeople" className="accordion-collapse collapse" aria-labelledby="headingPeople" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
                                    <div className="mb-3">
                                        <label className="form-label">Kommissioniert von</label>
                                        <select
                                            className="form-select"
                                            value={kommissioniertVon}
                                            onChange={(e) => { setKommissioniertVon(e.target.value); setPage(1); }}
                                        >
                                            <option value="">Alle</option>
                                            {kommissioniererUsers.map((u) => (
                                                <option key={u.id} value={u.id!}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="form-label">Kontrolliert von</label>
                                        <select
                                            className="form-select"
                                            value={kontrolliertVon}
                                            onChange={(e) => { setKontrolliertVon(e.target.value); setPage(1); }}
                                        >
                                            <option value="">Alle</option>
                                            {kontrolleUsers.map((u) => (
                                                <option key={u.id} value={u.id!}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Kunde */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="headingCustomer">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseCustomer" aria-expanded="false" aria-controls="collapseCustomer">
                                    Kunde
                                </button>
                            </h2>
                            <div id="collapseCustomer" className="accordion-collapse collapse" aria-labelledby="headingCustomer" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
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
                                            control: (base) => ({ ...base, borderColor: '#6c757d', minHeight: 32, height: 32 }),
                                            valueContainer: (base) => ({ ...base, height: 32, padding: '0 8px' }),
                                            input: (base) => ({ ...base, margin: 0, padding: 0 }),
                                            indicatorsContainer: (base) => ({ ...base, height: 32 }),
                                            menu: (base) => ({ ...base, zIndex: 5 })
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Daten */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="headingDates">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseDates" aria-expanded="false" aria-controls="collapseDates">
                                    Daten
                                </button>
                            </h2>
                            <div id="collapseDates" className="accordion-collapse collapse" aria-labelledby="headingDates" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
                                    <div className="mb-3">
                                        <label className="form-label">Lieferdatum von / bis</label>
                                        <div className="d-flex gap-2">
                                            <input type="date" className="form-control" value={lieferVon} onChange={(e) => { setLieferVon(e.target.value); setPage(1); }} />
                                            <input type="date" className="form-control" value={lieferBis} onChange={(e) => { setLieferBis(e.target.value); setPage(1); }} />
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Erstellt von / bis</label>
                                        <div className="d-flex gap-2">
                                            <input type="date" className="form-control" value={createdVon} onChange={(e) => { setCreatedVon(e.target.value); setPage(1); }} />
                                            <input type="date" className="form-control" value={createdBis} onChange={(e) => { setCreatedBis(e.target.value); setPage(1); }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Aktualisiert von / bis</label>
                                        <div className="d-flex gap-2">
                                            <input type="date" className="form-control" value={updatedVon} onChange={(e) => { setUpdatedVon(e.target.value); setPage(1); }} />
                                            <input type="date" className="form-control" value={updatedBis} onChange={(e) => { setUpdatedBis(e.target.value); setPage(1); }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Auftrag */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="headingOrder">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOrder" aria-expanded="false" aria-controls="collapseOrder">
                                    Auftrag
                                </button>
                            </h2>
                            <div id="collapseOrder" className="accordion-collapse collapse" aria-labelledby="headingOrder" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
                                    <div className="mb-3">
                                        <label className="form-label">Auftragsnummer</label>
                                        <input
                                            className="form-control"
                                            placeholder="z. B. 2025-000123"
                                            value={auftragsnummer}
                                            onChange={(e) => { setAuftragsnummer(e.target.value); setPage(1); }}
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Hat Tour</label>
                                        <select
                                            className="form-select"
                                            value={hasTour}
                                            onChange={(e) => { setHasTour(e.target.value as any); setPage(1); }}
                                        >
                                            <option value="">Alle</option>
                                            <option value="true">Ja</option>
                                            <option value="false">Nein</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sortierung */}
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="headingSort">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSort" aria-expanded="false" aria-controls="collapseSort">
                                    Sortierung
                                </button>
                            </h2>
                            <div id="collapseSort" className="accordion-collapse collapse" aria-labelledby="headingSort" data-bs-parent="#auftragFilterAccordion">
                                <div className="accordion-body">
                                    <select
                                        className="form-select"
                                        value={sort}
                                        onChange={(e) => setSort(e.target.value as any)}
                                    >
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

                        {/* Aktive Filter + Aktionen */}
                        <div className="pt-3">
                            <div className="d-flex flex-wrap gap-2 mb-3">
                                {statusIn.map((s) => (
                                    <span key={s} className="badge rounded-pill bg-primary">
                                        {s} <button
                                            type="button"
                                            className="btn-close btn-close-white btn-sm ms-2"
                                            aria-label="Remove"
                                            onClick={() =>
                                                setStatusIn((prev) => prev.filter((x) => x !== s))
                                            }
                                        />
                                    </span>
                                ))}
                                {kommissioniertStatus && (
                                    <span className="badge rounded-pill bg-info">
                                        Kommi: {kommissioniertStatus}
                                        <button
                                            type="button"
                                            className="btn-close btn-close-white btn-sm ms-2"
                                            onClick={() => setKommissioniertStatus("")}
                                        />
                                    </span>
                                )}
                                {kontrolliertStatus && (
                                    <span className="badge rounded-pill bg-success">
                                        Kontrolle: {kontrolliertStatus}
                                        <button
                                            type="button"
                                            className="btn-close btn-close-white btn-sm ms-2"
                                            onClick={() => setKontrolliertStatus("")}
                                        />
                                    </span>
                                )}
                                {hasTour !== "" && (
                                    <span className="badge rounded-pill bg-dark">
                                        Tour: {hasTour === "true" ? "Ja" : "Nein"}
                                        <button
                                            type="button"
                                            className="btn-close btn-close-white btn-sm ms-2"
                                            onClick={() => setHasTour("")}
                                        />
                                    </span>
                                )}
                                {(lieferVon || lieferBis) && (
                                    <span className="badge rounded-pill bg-secondary">
                                        Liefer: {lieferVon || "…"} – {lieferBis || "…"}
                                        <button
                                            type="button"
                                            className="btn-close btn-close-white btn-sm ms-2"
                                            onClick={() => { setLieferVon(""); setLieferBis(""); }}
                                        />
                                    </span>
                                )}
                            </div>
                            <div className="d-flex gap-2">
                                <button className="btn btn-outline-secondary" onClick={clearFilters}>
                                    <i className="ci-close me-2" />
                                    Filter zurücksetzen
                                </button>
                                <button className="btn btn-primary" data-bs-dismiss="offcanvas">
                                    Anwenden
                                </button>
                            </div>
                        </div>
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
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-5">
                                            <div className="spinner-border" role="status" />
                                        </td>
                                    </tr>
                                )}
                                {!loading && error && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-4 text-danger">
                                            {error}
                                        </td>
                                    </tr>
                                )}
                                {!loading && !error && items.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-4 text-muted">
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

            <BestellteArtikelModal
                isOpen={showBestellteModal}
                onClose={() => setShowBestellteModal(false)}
            />
        </div>
    );
}