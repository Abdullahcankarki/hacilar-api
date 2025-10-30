import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Offcanvas, Dropdown } from "bootstrap";
import {
    api,
    type ChargeViewResponse,
    type BestandUebersichtResponse,
    // Charges
    createChargeApi,
    updateChargeApi,
    deleteChargeApi,
    getAllArtikel,
    muellChargeApi,
    umbuchenChargeApi,
    mergeChargeApi,
    listCharges,
    addManuellerZugangApi,
} from "../backend/api";

/**
 * InventoryDashboard (BestandsKomponente)
 * Design: Bootstrap 5 + Cartzilla (Icons ci-*)
 * Voraussetzung: Bootstrap & Cartzilla CSS/JS global eingebunden.
 */
export default function InventoryDashboard() {
    /* ------------------------------- UI State ------------------------------- */
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Warnungen Summary
    const [summary, setSummary] = useState<{
        mhd: { total: number; critical: number };
        ueberreserviert: { total: number };
        tkMismatch: { total: number };
    } | null>(null);

    // Filter
    const [q, setQ] = useState("");
    const [lagerbereich, setLagerbereich] = useState<"" | "TK" | "NON_TK">("");
    const [kritisch, setKritisch] = useState(false);
    const [thresholdDays, setThresholdDays] = useState<number>(5);
    const [datum, setDatum] = useState<string>(""); // YYYY-MM-DD (Zeitreise optional)
    const [artikelId, setArtikelId] = useState<string>("");
    const [chargeId, setChargeId] = useState<string>("");

    // Übersicht
    const [data, setData] = useState<BestandUebersichtResponse>({
        items: [],
        page: 1,
        limit: 50,
        total: 0,
    });
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);

    // Offcanvas Charge-Detail
    const [activeChargeId, setActiveChargeId] = useState<string | null>(null);
    const [chargeView, setChargeView] = useState<ChargeViewResponse | null>(null);
    const [chargeLoading, setChargeLoading] = useState(false);

    // Historie (rechte Spalte)
    const [histLoading, setHistLoading] = useState(false);
    const [hist, setHist] = useState<{
        items: any[];
        total: number;
        page: number;
        limit: number;
    }>({ items: [], total: 0, page: 1, limit: 25 });
    const [histFrom, setHistFrom] = useState<string>("");
    const [histTo, setHistTo] = useState<string>("");

    // Reservierungen (optional – Badge/Popover)
    const [resLoading] = useState(false);
    const [res] = useState<{ items: any[]; total: number; page: number; limit: number }>({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
    });

    // Bootstrap Offcanvas Ref
    const offcanvasRef = useRef<HTMLDivElement | null>(null);
    // Filter Offcanvas (links)
    const filterOffcanvasRef = useRef<HTMLDivElement | null>(null);

    // Modals: Create / Edit / Delete
    const [saving, setSaving] = useState(false);
    const createModalRef = useRef<HTMLDivElement | null>(null);
    const editModalRef = useRef<HTMLDivElement | null>(null);
    const deleteModalRef = useRef<HTMLDivElement | null>(null);

    // Modal: Manueller Zugang
    const manuellerZugangModalRef = useRef<HTMLDivElement | null>(null);
    const [manZugangForm, setManZugangForm] = useState<{
        artikelId: string;
        menge: string;
        lagerbereich: "TK" | "NON_TK";
        modus: "EXISTING" | "NEW";
        zielChargeId?: string;
        newMhd?: string;
        newSchlachtDatum?: string;
        newLieferantId?: string;
        notiz?: string;
    }>({ artikelId: "", menge: "", lagerbereich: "NON_TK", modus: "EXISTING" });

    const [formCharge, setFormCharge] = useState<{
        id?: string;
        artikelId: string;
        mhd: string; // YYYY-MM-DD
        isTK: boolean;
        schlachtDatum?: string;
        lieferantId?: string;
    }>({ artikelId: "", mhd: "", isTK: false });

    // --- Zusätzliche Modale: Müll / Umbuchen / Zusammenführen ---
    const muellModalRef = useRef<HTMLDivElement | null>(null);
    const umbuchenModalRef = useRef<HTMLDivElement | null>(null);
    const mergeModalRef = useRef<HTMLDivElement | null>(null);

    const [muellForm, setMuellForm] = useState<{ chargeId?: string; menge: string; lagerbereich: "TK"|"NON_TK"; grund: "MHD_ABGELAUFEN"|"BESCHAEDIGT"|"VERDERB"|"RUECKWEISUNG_KUNDE"|"SONSTIGES"; notiz?: string }>({ menge: "", lagerbereich: "NON_TK", grund: "SONSTIGES" });

    const [umbuchenForm, setUmbuchenForm] = useState<{ sourceChargeId?: string; artikelId?: string; menge: string; zielArt: "EXISTING"|"NEW"; zielChargeId?: string; zielLagerbereich: "TK"|"NON_TK"; newMhd?: string; newIsTK?: boolean; newSchlachtDatum?: string; notiz?: string }>({ menge: "", zielArt: "EXISTING", zielLagerbereich: "NON_TK" });

    const [mergeForm, setMergeForm] = useState<{ sourceChargeId?: string; artikelId?: string; zielChargeId?: string; menge?: string; zielLagerbereich: "TK"|"NON_TK"; notiz?: string }>({ zielLagerbereich: "NON_TK" });

    // Ziel-Charges für Umbuchen/Zusammenführen (gleicher Artikel)
    const [zielCharges, setZielCharges] = useState<Array<{ id: string; label: string; lagerbereich: "TK"|"NON_TK"; mhd?: string }>>([]);
    const [zielChargesLoading, setZielChargesLoading] = useState(false);

    async function loadZielCharges(artikelIdForList?: string) {
        if (!artikelIdForList) { setZielCharges([]); return; }
        try {
            setZielChargesLoading(true);
            const resp = await listCharges({ artikelId: artikelIdForList, limit: 200 });
            const items = (resp?.items ?? []).map((c: any) => {
                const id: string = String(c.id || c.chargeId || c._id || "");
                const lb: "TK" | "NON_TK" = c.isTK ? "TK" : "NON_TK";
                const mhd: string | undefined = c.mhd ? String(c.mhd).slice(0, 10) : undefined;
                const short = id ? id.slice(0, 8) : "";
                return {
                    id,
                    label: `${mhd ?? 'ohne MHD'} · ${lb} · ${short}`,
                    lagerbereich: lb,
                    mhd,
                };
            }).filter((x: any) => !!x.id);
            setZielCharges(items);
        } catch (e) {
            console.error(e);
        } finally {
            setZielChargesLoading(false);
        }
    }

    // Artikel-Options für Selektoren
    const [artikelOptions, setArtikelOptions] = useState<Array<{ id: string; name: string; nummer?: string }>>([]);
    const [artikelLoading, setArtikelLoading] = useState(false);

    async function loadArtikelOptions() {
        try {
            setArtikelLoading(true);
            const result: any = await getAllArtikel();
            const items: any[] = Array.isArray(result) ? result : (result?.items ?? []);
            const mapped = items.map((a: any) => ({
                id: a.id || a._id || a.artikelId || a._id?.toString?.(),
                name: a.name || a.artikelName || "(ohne Name)",
                nummer: a.artikelNummer || a.nummer || a.artikelnummer,
            })).filter((x: any) => !!x.id);
            setArtikelOptions(mapped);
        } catch (e) {
            console.error(e);
        } finally {
            setArtikelLoading(false);
        }
    }

    /* ------------------------------ Data Loading ----------------------------- */
    async function loadSummary() {
        try {
            const s = await api.getWarnungenSummaryApi({ thresholdDays });
            setSummary(s);
        } catch (e: any) {
            console.error(e);
        }
    }

    async function loadUebersicht() {
        setLoading(true);
        setError(null);
        try {
            const resp = await api.getBestandUebersichtApi({
                q: q.trim() || undefined,
                lagerbereich: lagerbereich || undefined,
                kritisch: kritisch || undefined,
                thresholdDays: kritisch ? thresholdDays : undefined,
                datum: datum || undefined,
                artikelId: artikelId || undefined,
                chargeId: chargeId || undefined,
                page,
                limit,
            });
            setData(resp);
        } catch (e: any) {
            setError(e?.message || "Fehler beim Laden der Übersicht");
        } finally {
            setLoading(false);
        }
    }

    async function loadHistorie() {
        setHistLoading(true);
        try {
            const resp = await api.listHistorie({
                from: histFrom || undefined,
                to: histTo || undefined,
                page: hist.page,
                limit: hist.limit,
                q: q || undefined,
            });
            setHist(resp as any);
        } catch (e) {
            console.error(e);
        } finally {
            setHistLoading(false);
        }
    }

    async function openChargeView(id: string) {
        setActiveChargeId(id);
        setChargeLoading(true);
        try {
            const resp = await api.getBestandChargeViewApi(id);
            setChargeView(resp);
            // open offcanvas
            if (offcanvasRef.current) {
                Offcanvas.getOrCreateInstance(offcanvasRef.current).show();
            }
        } catch (e: any) {
            setError(e?.message || "Charge-Ansicht konnte nicht geladen werden");
        } finally {
            setChargeLoading(false);
        }
    }

    async function exportHistorieCsv() {
        try {
            const blob = await api.exportHistorieCsv({
                from: histFrom || undefined,
                to: histTo || undefined,
                q: q || undefined,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bewegungen_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            setError(e?.message || "Export fehlgeschlagen");
        }
    }

    useEffect(() => {
        loadSummary();
    }, [thresholdDays]);

    useEffect(() => {
        loadUebersicht();
    }, [q, lagerbereich, kritisch, thresholdDays, datum, artikelId, chargeId, page, limit]);

    useEffect(() => {
        loadHistorie();
    }, [histFrom, histTo, hist.page, hist.limit, q]);

    useEffect(() => {
        loadArtikelOptions();
    }, []);

    /* --------------------------------- Render -------------------------------- */
    const totalPages = useMemo(
        () => Math.max(1, Math.ceil((data.total || 0) / (data.limit || 50))),
        [data]
    );
    const histTotalPages = useMemo(
        () => Math.max(1, Math.ceil((hist.total || 0) / (hist.limit || 25))),
        [hist]
    );

    return (
        <div className="container py-4">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h2 className="h3 mb-0">Bestands-Dashboard</h2>
                    <small className="text-muted">
                        Schnellüberblick über Verfügbarkeit, kritische MHDs und Reservierungen
                    </small>
                </div>
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-outline-secondary"
                        onClick={() => {
                            if (filterOffcanvasRef.current) {
                                Offcanvas.getOrCreateInstance(filterOffcanvasRef.current).show();
                            }
                        }}
                    >
                        <i className="ci-filter me-1" /> Filter
                    </button>
                    <button
                        className="btn btn-outline-primary"
                        onClick={() => {
                            setManZugangForm({ artikelId: "", menge: "", lagerbereich: "NON_TK", modus: "EXISTING" });
                            setZielCharges([]);
                            if (manuellerZugangModalRef.current) {
                                Modal.getOrCreateInstance(manuellerZugangModalRef.current).show();
                            }
                        }}
                    >
                        <i className="ci-upload me-1" /> Manueller Zugang
                    </button>
                    <button className="btn btn-outline-secondary" onClick={loadUebersicht}>
                        <i className="ci-reload me-1" /> Aktualisieren
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                    <div className="card h-100 shadow-sm">
                        <div className="card-body d-flex align-items-center justify-content-between">
                            <div>
                                <div className="fs-sm text-muted">MHD-Warnungen (gesamt)</div>
                                <div className="h4 mb-0">{summary?.mhd.total ?? "–"}</div>
                            </div>
                            <span
                                className="badge bg-danger-subtle text-danger"
                                title="kritisch (abgelaufen/kurz vor Ablauf)"
                            >
                                {summary?.mhd.critical ?? 0} kritisch
                            </span>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-4">
                    <div className="card h-100 shadow-sm">
                        <div className="card-body d-flex align-items-center justify-content-between">
                            <div>
                                <div className="fs-sm text-muted">Überreserviert (Artikel)</div>
                                <div className="h4 mb-0">{summary?.ueberreserviert.total ?? "–"}</div>
                            </div>
                            <i className="ci-alert-circle fs-3 text-warning" />
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-4">
                    <div className="card h-100 shadow-sm">
                        <div className="card-body d-flex align-items-center justify-content-between">
                            <div>
                                <div className="fs-sm text-muted">TK-Mismatch (Fälle)</div>
                                <div className="h4 mb-0">{summary?.tkMismatch.total ?? "–"}</div>
                            </div>
                            <i className="ci-snow fs-3 text-info" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Offcanvas ist jetzt links; Karte entfernt */}

            {/* Filter Offcanvas (links) */}
            <div
                className="offcanvas offcanvas-start"
                tabIndex={-1}
                id="offcanvasFilter"
                ref={filterOffcanvasRef}
                style={{ zIndex: 3000 }}
            >
                <div className="offcanvas-header">
                    <h5 className="offcanvas-title">Filter & Suche</h5>
                    <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div className="offcanvas-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12">
                            <label className="form-label">Suche</label>
                            <input
                                className="form-control"
                                placeholder="Artikel / Charge / Notiz …"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        <div className="col-6">
                            <label className="form-label">Lagerbereich</label>
                            <select
                                className="form-select"
                                value={lagerbereich}
                                onChange={(e) => setLagerbereich(e.target.value as any)}
                            >
                                <option value="">Alle</option>
                                <option value="NON_TK">Nicht TK</option>
                                <option value="TK">TK</option>
                            </select>
                        </div>
                        <div className="col-6">
                            <label className="form-label">Zeitreise (Datum)</label>
                            <input
                                type="date"
                                className="form-control"
                                value={datum}
                                onChange={(e) => setDatum(e.target.value)}
                            />
                        </div>
                        <div className="col-6">
                            <label className="form-label">Kritisch (MHD)</label>
                            <div className="form-check form-switch pt-1">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={kritisch}
                                    onChange={(e) => setKritisch(e.target.checked)}
                                />
                                <label className="form-check-label">Nur kritische anzeigen</label>
                            </div>
                        </div>
                        <div className="col-6">
                            <label className="form-label">Tage bis MHD</label>
                            <input
                                type="number"
                                className="form-control"
                                min={1}
                                max={365}
                                disabled={!kritisch}
                                value={thresholdDays}
                                onChange={(e) => setThresholdDays(Number(e.target.value))}
                            />
                        </div>
                        <div className="col-12">
                            <label className="form-label">Artikel</label>
                            <select
                                className="form-select"
                                value={artikelId}
                                onChange={(e) => setArtikelId(e.target.value)}
                            >
                                <option value="">Alle Artikel</option>
                                {artikelOptions.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.nummer ? `${a.nummer} — ${a.name}` : a.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12">
                            <label className="form-label">Charge-ID</label>
                            <input
                                className="form-control"
                                placeholder="optional"
                                value={chargeId}
                                onChange={(e) => setChargeId(e.target.value)}
                            />
                        </div>
                        <div className="col-12">
                            <label className="form-label">Einträge pro Seite</label>
                            <select
                                className="form-select"
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className="col-12 d-flex gap-2 mt-2">
                            <button
                                className="btn btn-primary flex-grow-1"
                                onClick={async () => {
                                    await loadUebersicht();
                                    if (filterOffcanvasRef.current) {
                                        Offcanvas.getOrCreateInstance(filterOffcanvasRef.current).hide();
                                    }
                                }}
                                disabled={loading}
                            >
                                <i className="ci-search me-1" /> Anwenden
                            </button>
                            <button
                                className="btn btn-outline-secondary"
                                onClick={() => {
                                    setQ("");
                                    setLagerbereich("");
                                    setKritisch(false);
                                    setDatum("");
                                    setArtikelId("");
                                    setChargeId("");
                                    setPage(1);
                                }}
                            >
                                Zurücksetzen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Grid: Übersicht & Historie */}
            <div className="row g-4">
                <div className="col-12 col-xl-8">
                    <div className="card shadow-sm">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <h6 className="mb-0">Bestandsübersicht</h6>
                            <span className="text-muted small">{data.total} Einträge</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Artikel</th>
                                        <th className="text-nowrap">Charge / MHD</th>
                                        <th className="text-center">Bereich</th>
                                        <th className="text-end">Verfügbar (kg)</th>
                                        <th className="text-end">Reserviert (kg)</th>
                                        <th className="text-end">Unterwegs (kg)</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-5">
                                                <div className="spinner-border" role="status" />
                                                <div className="mt-2 small text-muted">Laden…</div>
                                            </td>
                                        </tr>
                                    ) : data.items.length ? (
                                        data.items.map((row: any) => (
                                            <tr
                                                key={`${row.artikelId}-${row.chargeId}-${row.lagerbereich}`}
                                                className={row.warnMhd ? "table-warning" : ""}
                                            >
                                                <td>
                                                    <div className="fw-semibold">
                                                        {row.artikelName || row.artikelId}
                                                    </div>
                                                    {row.artikelNummer && (
                                                        <div className="text-muted small">
                                                            {row.artikelNummer}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="badge bg-secondary-subtle text-secondary">
                                                            {row.chargeId?.slice(0, 8)}
                                                        </span>
                                                        {row.mhd && (
                                                            <span className="badge bg-info-subtle text-info">
                                                                MHD {formatDate(row.mhd)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <span
                                                        className={`badge ${row.lagerbereich === "TK"
                                                            ? "bg-primary-subtle text-primary"
                                                            : "bg-success-subtle text-success"
                                                            }`}
                                                    >
                                                        {row.lagerbereich}
                                                    </span>
                                                </td>
                                                <td className="text-end">{fmt(row.verfuegbar)}</td>
                                                <td className="text-end">{fmt(row.reserviert)}</td>
                                                <td className="text-end">{fmt(row.unterwegs)}</td>
                                                <td className="text-end">
                                                    <div className="btn-group dropdown">
                                                        <button
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => openChargeView(row.chargeId)}
                                                        >
                                                            Details
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary dropdown-toggle dropdown-toggle-split"
                                                            data-bs-toggle="dropdown"
                                                            data-bs-boundary="viewport"
                                                            data-bs-offset="0,8"
                                                            aria-expanded="false"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                const btn = e.currentTarget as HTMLButtonElement;
                                                                Dropdown.getOrCreateInstance(btn).toggle();
                                                            }}
                                                        >
                                                            <span className="visually-hidden">Toggle Dropdown</span>
                                                        </button>
                                                        <ul className="dropdown-menu dropdown-menu-end" style={{ zIndex: 9999 }}>
                                                            <li>
                                                                <button
                                                                    className="dropdown-item"
                                                                    onClick={() => {
                                                                        setFormCharge({
                                                                            id: row.chargeId,
                                                                            artikelId: row.artikelId,
                                                                            mhd: (row.mhd || "").slice(0, 10),
                                                                            isTK: row.lagerbereich === "TK",
                                                                            schlachtDatum: row.schlachtDatum ? String(row.schlachtDatum).slice(0, 10) : undefined,
                                                                            lieferantId: row.lieferantId,
                                                                        });
                                                                        if (editModalRef.current) {
                                                                            Modal.getOrCreateInstance(editModalRef.current).show();
                                                                        }
                                                                    }}
                                                                >
                                                                    Bearbeiten
                                                                </button>
                                                            </li>
                                                            <li>
                                                                <button
                                                                    className="dropdown-item text-danger"
                                                                    onClick={() => {
                                                                        setFormCharge({
                                                                            id: row.chargeId,
                                                                            artikelId: row.artikelId,
                                                                            mhd: (row.mhd || "").slice(0, 10),
                                                                            isTK: row.lagerbereich === "TK",
                                                                        });
                                                                        if (deleteModalRef.current) {
                                                                            Modal.getOrCreateInstance(deleteModalRef.current).show();
                                                                        }
                                                                    }}
                                                                >
                                                                    Löschen…
                                                                </button>
                                                            </li>
                                                            <li><hr className="dropdown-divider" /></li>
                                                            <li>
                                                                <button
                                                                    className="dropdown-item"
                                                                    onClick={() => {
                                                                        setMuellForm({ chargeId: row.chargeId, menge: "", lagerbereich: row.lagerbereich, grund: "SONSTIGES" });
                                                                        if (muellModalRef.current) Modal.getOrCreateInstance(muellModalRef.current).show();
                                                                    }}
                                                                >Müll buchen…</button>
                                                            </li>
                                                            <li>
                                                                <button
                                                                    className="dropdown-item"
                                                                    onClick={async () => {
                                                                        setUmbuchenForm({ sourceChargeId: row.chargeId, artikelId: row.artikelId, menge: "", zielArt: "EXISTING", zielChargeId: undefined, zielLagerbereich: row.lagerbereich, notiz: "" });
                                                                        await loadZielCharges(row.artikelId);
                                                                        if (umbuchenModalRef.current) Modal.getOrCreateInstance(umbuchenModalRef.current).show();
                                                                    }}
                                                                >Umbuchen…</button>
                                                            </li>
                                                            <li>
                                                                <button
                                                                    className="dropdown-item"
                                                                    onClick={async () => {
                                                                        setMergeForm({ sourceChargeId: row.chargeId, artikelId: row.artikelId, zielChargeId: undefined, zielLagerbereich: row.lagerbereich, menge: "", notiz: "" });
                                                                        await loadZielCharges(row.artikelId);
                                                                        if (mergeModalRef.current) Modal.getOrCreateInstance(mergeModalRef.current).show();
                                                                    }}
                                                                >Zusammenführen…</button>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="text-center py-5 text-muted">
                                                Keine Einträge gefunden
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        <div className="card-footer d-flex align-items-center justify-content-between">
                            <div className="text-muted small">
                                Seite {page} / {totalPages}
                            </div>
                            <div className="btn-group">
                                <button
                                    className="btn btn-outline-secondary"
                                    disabled={page <= 1}
                                    onClick={() => setPage(1)}
                                >
                                    &laquo;
                                </button>
                                <button
                                    className="btn btn-outline-secondary"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Zurück
                                </button>
                                <button
                                    className="btn btn-outline-secondary"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    Weiter
                                </button>
                                <button
                                    className="btn btn-outline-secondary"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(totalPages)}
                                >
                                    &raquo;
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Historie */}
                <div className="col-12 col-xl-4">
                    <div className="card shadow-sm h-100">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <h6 className="mb-0">Historie</h6>
                            <div className="d-flex align-items-center gap-2">
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={histFrom}
                                    onChange={(e) => setHistFrom(e.target.value)}
                                />
                                <span className="text-muted small">bis</span>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={histTo}
                                    onChange={(e) => setHistTo(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="card-body p-0">
                            {histLoading ? (
                                <div className="d-flex align-items-center justify-content-center py-5">
                                    <div className="spinner-border" />
                                </div>
                            ) : (
                                <div
                                    className="list-group list-group-flush small"
                                    style={{ maxHeight: 460, overflowY: "auto" }}
                                >
                                    {hist.items.map((b: any) => (
                                        <div key={b.id} className="list-group-item">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div>
                                                    <div className="fw-semibold">{b.typ}</div>
                                                    <div className="text-muted">
                                                        {formatDateTime(b.timestamp)} · {b.artikelName || b.artikelId}
                                                    </div>
                                                </div>
                                                <div className="text-end">
                                                    <div
                                                        className={`badge ${b.menge < 0
                                                            ? "bg-danger-subtle text-danger"
                                                            : "bg-success-subtle text-success"
                                                            }`}
                                                    >
                                                        {fmt(b.menge)} kg
                                                    </div>
                                                    {b.lagerbereich && (
                                                        <div className="small text-muted">{b.lagerbereich}</div>
                                                    )}
                                                </div>
                                            </div>
                                            {b.notiz && <div className="mt-1 text-muted">{b.notiz}</div>}
                                        </div>
                                    ))}
                                    {!hist.items.length && (
                                        <div className="text-center text-muted py-4">
                                            Keine Bewegungen
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="card-footer d-flex align-items-center justify-content-between">
                            <div className="text-muted small">
                                Seite {hist.page} / {histTotalPages}
                            </div>
                            <div className="btn-group">
                                <button
                                    className="btn btn-outline-secondary btn-sm"
                                    disabled={hist.page <= 1}
                                    onClick={() => setHist((h) => ({ ...h, page: 1 }))}
                                >
                                    &laquo;
                                </button>
                                <button
                                    className="btn btn-outline-secondary btn-sm"
                                    disabled={hist.page <= 1}
                                    onClick={() =>
                                        setHist((h) => ({ ...h, page: Math.max(1, h.page - 1) }))
                                    }
                                >
                                    Zurück
                                </button>
                                <button
                                    className="btn btn-outline-secondary btn-sm"
                                    disabled={hist.page >= histTotalPages}
                                    onClick={() =>
                                        setHist((h) => ({ ...h, page: Math.min(histTotalPages, h.page + 1) }))
                                    }
                                >
                                    Weiter
                                </button>
                                <button
                                    className="btn btn-outline-secondary btn-sm"
                                    disabled={hist.page >= histTotalPages}
                                    onClick={() => setHist((h) => ({ ...h, page: histTotalPages }))}
                                >
                                    &raquo;
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charge Offcanvas */}
            <div
                className="offcanvas offcanvas-end"
                tabIndex={-1}
                id="offcanvasCharge"
                ref={offcanvasRef}
                style={{ zIndex: 3000 }}
            >
                <div className="offcanvas-header">
                    <h5 className="offcanvas-title">Charge {activeChargeId?.slice(0, 8)}</h5>
                    <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div className="offcanvas-body">
                    {chargeLoading ? (
                        <div className="d-flex align-items-center justify-content-center py-5">
                            <div className="spinner-border" />
                        </div>
                    ) : chargeView ? (
                        <>
                            {chargeView.charge ? (
                                <div className="mb-4">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div>
                                            <div className="fw-semibold">
                                                {chargeView.charge?.artikelName || chargeView.charge?.artikelId}
                                            </div>
                                            <div className="text-muted small">
                                                MHD: {chargeView.charge?.mhd ? formatDate(chargeView.charge.mhd) : "–"} ·{" "}
                                                {chargeView.charge?.isTK ? "TK" : "Nicht TK"}
                                            </div>
                                        </div>
                                        {chargeView.charge?.artikelNummer && (
                                            <span className="badge bg-secondary-subtle text-secondary">
                                                {chargeView.charge?.artikelNummer}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="alert alert-warning">Keine Chargen-Stammdaten gefunden.</div>
                            )}

                            <div className="mb-4">
                                <h6 className="mb-2">Reservierungen</h6>
                                <div className="list-group list-group-flush small">
                                    {chargeView.reservierungen?.length ? (
                                        chargeView.reservierungen.map((r: any) => (
                                            <div
                                                key={r.id}
                                                className="list-group-item d-flex align-items-center justify-content-between"
                                            >
                                                <div>
                                                    <div className="fw-semibold">{r.kundeName || r.auftragId}</div>
                                                    <div className="text-muted">Lieferdatum {r.lieferDatum}</div>
                                                </div>
                                                <div className="badge bg-warning-subtle text-warning">{fmt(r.menge)} kg</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-muted">Keine Reservierungen</div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h6 className="mb-2">Bewegungen</h6>
                                <div className="list-group list-group-flush small" style={{ maxHeight: 240, overflowY: "auto" }}>
                                    {chargeView.bewegungen?.length ? (
                                        chargeView.bewegungen.map((b: any) => (
                                            <div
                                                key={b.id}
                                                className="list-group-item d-flex align-items-center justify-content-between"
                                            >
                                                <div>
                                                    <div className="fw-semibold">{b.typ}</div>
                                                    <div className="text-muted">{formatDateTime(b.timestamp)} · {b.notiz || "—"}</div>
                                                </div>
                                                <div
                                                    className={`badge ${b.menge < 0 ? "bg-danger-subtle text-danger" : "bg-success-subtle text-success"
                                                        }`}
                                                >
                                                    {fmt(b.menge)} kg
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-muted">Keine Bewegungen</div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-muted">Keine Daten.</div>
                    )}
                </div>
            </div>

            {/* Create Charge Modal */}
            <div className="modal fade" tabIndex={-1} ref={createModalRef}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Neue Charge anlegen</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                        </div>
                        <div className="modal-body">
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="form-label">Artikel *</label>
                                    <select
                                        className="form-select"
                                        value={formCharge.artikelId}
                                        onChange={(e) => setFormCharge((v) => ({ ...v, artikelId: e.target.value }))}
                                    >
                                        <option value="" disabled>{artikelLoading ? "Lade Artikel…" : "Bitte wählen"}</option>
                                        {artikelOptions.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.nummer ? `${a.nummer} — ${a.name}` : a.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-6">
                                    <label className="form-label">MHD *</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={formCharge.mhd}
                                        onChange={(e) => setFormCharge((v) => ({ ...v, mhd: e.target.value }))}
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Schlacht-Datum</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={formCharge.schlachtDatum || ""}
                                        onChange={(e) =>
                                            setFormCharge((v) => ({ ...v, schlachtDatum: e.target.value || undefined }))
                                        }
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Bereich *</label>
                                    <select
                                        className="form-select"
                                        value={formCharge.isTK ? "TK" : "NON_TK"}
                                        onChange={(e) => setFormCharge((v) => ({ ...v, isTK: e.target.value === "TK" }))}
                                    >
                                        <option value="NON_TK">Nicht TK</option>
                                        <option value="TK">TK</option>
                                    </select>
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Lieferant-ID</label>
                                    <input
                                        className="form-control"
                                        value={formCharge.lieferantId || ""}
                                        onChange={(e) =>
                                            setFormCharge((v) => ({ ...v, lieferantId: e.target.value || undefined }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                                Abbrechen
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={saving || !formCharge.artikelId || !formCharge.mhd}
                                onClick={async () => {
                                    try {
                                        setSaving(true);
                                        await createChargeApi({
                                            artikelId: formCharge.artikelId,
                                            mhd: formCharge.mhd,
                                            isTK: !!formCharge.isTK,
                                            schlachtDatum: formCharge.schlachtDatum,
                                            lieferantId: formCharge.lieferantId,
                                        });
                                        // Close
                                        if (createModalRef.current) {
                                            Modal.getOrCreateInstance(createModalRef.current).hide();
                                        }
                                        await loadUebersicht();
                                    } catch (e: any) {
                                        setError(e?.message || "Anlegen fehlgeschlagen");
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Anlegen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Charge Modal */}
            <div className="modal fade" tabIndex={-1} ref={editModalRef}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Charge bearbeiten</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                        </div>
                        <div className="modal-body">
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="form-label">Artikel</label>
                                    <select
                                        className="form-select"
                                        value={formCharge.artikelId}
                                        onChange={(e) => setFormCharge((v) => ({ ...v, artikelId: e.target.value }))}
                                    >
                                        <option value="" disabled>{artikelLoading ? "Lade Artikel…" : "Bitte wählen"}</option>
                                        {artikelOptions.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.nummer ? `${a.nummer} — ${a.name}` : a.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-6">
                                    <label className="form-label">MHD</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={formCharge.mhd}
                                        onChange={(e) => setFormCharge((v) => ({ ...v, mhd: e.target.value }))}
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Schlacht-Datum</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={formCharge.schlachtDatum || ""}
                                        onChange={(e) =>
                                            setFormCharge((v) => ({ ...v, schlachtDatum: e.target.value || undefined }))
                                        }
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Bereich</label>
                                    <select
                                        className="form-select"
                                        value={formCharge.isTK ? "TK" : "NON_TK"}
                                        onChange={(e) => setFormCharge((v) => ({ ...v, isTK: e.target.value === "TK" }))}
                                    >
                                        <option value="NON_TK">Nicht TK</option>
                                        <option value="TK">TK</option>
                                    </select>
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Lieferant-ID</label>
                                    <input
                                        className="form-control"
                                        value={formCharge.lieferantId || ""}
                                        onChange={(e) =>
                                            setFormCharge((v) => ({ ...v, lieferantId: e.target.value || undefined }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                                Abbrechen
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={saving || !formCharge.id}
                                onClick={async () => {
                                    try {
                                        if (!formCharge.id) return;
                                        setSaving(true);
                                        await updateChargeApi(formCharge.id, {
                                            mhd: formCharge.mhd,
                                            isTK: !!formCharge.isTK,
                                            schlachtDatum: formCharge.schlachtDatum,
                                            lieferantId: formCharge.lieferantId,
                                            artikelId: formCharge.artikelId,
                                        });
                                        if (editModalRef.current) {
                                            Modal.getOrCreateInstance(editModalRef.current).hide();
                                        }
                                        await loadUebersicht();
                                    } catch (e: any) {
                                        setError(e?.message || "Speichern fehlgeschlagen");
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Charge Modal */}
            <div className="modal fade" tabIndex={-1} ref={deleteModalRef}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Charge löschen</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                        </div>
                        <div className="modal-body">
                            <p>Diese Aktion kann nicht rückgängig gemacht werden. Fortfahren?</p>
                            <div className="alert alert-warning small">
                                Stelle sicher, dass keine Bestände/Reservierungen mehr an dieser Charge hängen.
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                                Abbrechen
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                disabled={saving || !formCharge.id}
                                onClick={async () => {
                                    try {
                                        if (!formCharge.id) return;
                                        setSaving(true);
                                        await api.deleteBestandChargeKomplettApi(formCharge.id);
                                        if (deleteModalRef.current) {
                                            Modal.getOrCreateInstance(deleteModalRef.current).hide();
                                        }
                                        await loadUebersicht();
                                    } catch (e: any) {
                                        setError(e?.message || "Löschen fehlgeschlagen");
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Löschen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Müll buchen Modal */}
            <div className="modal fade" tabIndex={-1} ref={muellModalRef}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Müll buchen</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                        </div>
                        <div className="modal-body">
                            <div className="row g-3">
                                <div className="col-6">
                                    <label className="form-label">Menge (kg) *</label>
                                    <input className="form-control" value={muellForm.menge} onChange={(e) => setMuellForm(v => ({ ...v, menge: e.target.value }))} />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Bereich</label>
                                    <select className="form-select" value={muellForm.lagerbereich} onChange={(e) => setMuellForm(v => ({ ...v, lagerbereich: e.target.value as any }))}>
                                        <option value="NON_TK">Nicht TK</option>
                                        <option value="TK">TK</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Grund</label>
                                    <select className="form-select" value={muellForm.grund} onChange={(e) => setMuellForm(v => ({ ...v, grund: e.target.value as any }))}>
                                        <option value="SONSTIGES">Sonstiges</option>
                                        <option value="MHD_ABGELAUFEN">MHD abgelaufen</option>
                                        <option value="BESCHAEDIGT">Beschädigt</option>
                                        <option value="VERDERB">Verderb</option>
                                        <option value="RUECKWEISUNG_KUNDE">Rückweisung (Kunde)</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Notiz</label>
                                    <textarea className="form-control" rows={2} value={muellForm.notiz || ""} onChange={(e) => setMuellForm(v => ({ ...v, notiz: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" className="btn btn-danger" disabled={saving || !muellForm.chargeId || !muellForm.menge} onClick={async () => {
                                try {
                                    if (!muellForm.chargeId) return;
                                    setSaving(true);
                                    await muellChargeApi(muellForm.chargeId, {
                                        menge: Number(muellForm.menge),
                                        lagerbereich: muellForm.lagerbereich,
                                        grund: muellForm.grund,
                                        notiz: muellForm.notiz?.trim() || undefined,
                                    });
                                    if (muellModalRef.current) Modal.getOrCreateInstance(muellModalRef.current).hide();
                                    await loadUebersicht();
                                    await loadHistorie();
                                } catch (e: any) {
                                    setError(e?.message || 'Müll-Buchung fehlgeschlagen');
                                } finally { setSaving(false); }
                            }}>Buchen</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Umbuchen Modal */}
            <div className="modal fade" tabIndex={-1} ref={umbuchenModalRef}>
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Umbuchen</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                        </div>
                        <div className="modal-body">
                            <div className="row g-3">
                                <div className="col-4">
                                    <label className="form-label">Menge (kg) *</label>
                                    <input className="form-control" value={umbuchenForm.menge} onChange={(e) => setUmbuchenForm(v => ({ ...v, menge: e.target.value }))} />
                                </div>
                                <div className="col-4">
                                    <label className="form-label">Ziel-Art *</label>
                                    <select className="form-select" value={umbuchenForm.zielArt} onChange={(e) => setUmbuchenForm(v => ({ ...v, zielArt: e.target.value as any }))}>
                                        <option value="EXISTING">Bestehende Charge</option>
                                        <option value="NEW">Neue Charge</option>
                                    </select>
                                </div>
                                <div className="col-4">
                                    <label className="form-label">Ziel-Bereich *</label>
                                    <select className="form-select" value={umbuchenForm.zielLagerbereich} onChange={(e) => setUmbuchenForm(v => ({ ...v, zielLagerbereich: e.target.value as any }))}>
                                        <option value="NON_TK">Nicht TK</option>
                                        <option value="TK">TK</option>
                                    </select>
                                </div>

                                {umbuchenForm.zielArt === 'EXISTING' ? (
                                    <div className="col-12">
                                        <label className="form-label">Ziel-Charge *</label>
                                        <select className="form-select" value={umbuchenForm.zielChargeId || ''} onChange={(e) => setUmbuchenForm(v => ({ ...v, zielChargeId: e.target.value }))}>
                                            <option value="" disabled>{zielChargesLoading ? 'Lade Charges…' : 'Bitte wählen'}</option>
                                            {zielCharges.filter(z => z.id !== umbuchenForm.sourceChargeId).map(z => (
                                                <option key={z.id} value={z.id}>{z.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <>
                                        <div className="col-6">
                                            <label className="form-label">Neues MHD *</label>
                                            <input type="date" className="form-control" value={umbuchenForm.newMhd || ''} onChange={(e) => setUmbuchenForm(v => ({ ...v, newMhd: e.target.value }))} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label">Neuer Bereich *</label>
                                            <select className="form-select" value={umbuchenForm.newIsTK ? 'TK' : 'NON_TK'} onChange={(e) => setUmbuchenForm(v => ({ ...v, newIsTK: e.target.value === 'TK' }))}>
                                                <option value="NON_TK">Nicht TK</option>
                                                <option value="TK">TK</option>
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label">Schlacht-Datum</label>
                                            <input type="date" className="form-control" value={umbuchenForm.newSchlachtDatum || ''} onChange={(e) => setUmbuchenForm(v => ({ ...v, newSchlachtDatum: e.target.value || undefined }))} />
                                        </div>
                                    </>
                                )}

                                <div className="col-12">
                                    <label className="form-label">Notiz</label>
                                    <textarea className="form-control" rows={2} value={umbuchenForm.notiz || ''} onChange={(e) => setUmbuchenForm(v => ({ ...v, notiz: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" className="btn btn-primary" disabled={saving || !umbuchenForm.sourceChargeId || !umbuchenForm.menge || (umbuchenForm.zielArt === 'EXISTING' && !umbuchenForm.zielChargeId) || (umbuchenForm.zielArt === 'NEW' && (!umbuchenForm.newMhd || typeof umbuchenForm.newIsTK === 'undefined'))} onClick={async () => {
                                try {
                                    if (!umbuchenForm.sourceChargeId) return;
                                    setSaving(true);
                                    await umbuchenChargeApi(umbuchenForm.sourceChargeId, {
                                        menge: Number(umbuchenForm.menge),
                                        notiz: umbuchenForm.notiz?.trim() || undefined,
                                        nach: umbuchenForm.zielArt === 'EXISTING'
                                            ? { chargeId: umbuchenForm.zielChargeId!, lagerbereich: umbuchenForm.zielLagerbereich }
                                            : { lagerbereich: umbuchenForm.zielLagerbereich, newCharge: { mhd: umbuchenForm.newMhd!, isTK: !!umbuchenForm.newIsTK, schlachtDatum: umbuchenForm.newSchlachtDatum || undefined } },
                                    });
                                    if (umbuchenModalRef.current) Modal.getOrCreateInstance(umbuchenModalRef.current).hide();
                                    await loadUebersicht();
                                    await loadHistorie();
                                } catch (e: any) { setError(e?.message || 'Umbuchung fehlgeschlagen'); } finally { setSaving(false); }
                            }}>Umbuchen</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Zusammenführen Modal */}
            <div className="modal fade" tabIndex={-1} ref={mergeModalRef}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Charges zusammenführen</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                        </div>
                        <div className="modal-body">
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="form-label">Ziel-Charge *</label>
                                    <select className="form-select" value={mergeForm.zielChargeId || ''} onChange={(e) => setMergeForm(v => ({ ...v, zielChargeId: e.target.value }))}>
                                        <option value="" disabled>{zielChargesLoading ? 'Lade Charges…' : 'Bitte wählen'}</option>
                                        {zielCharges.filter(z => z.id !== mergeForm.sourceChargeId).map(z => (
                                            <option key={z.id} value={z.id}>{z.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Teilmenge (kg)</label>
                                    <input className="form-control" placeholder="leer = alles" value={mergeForm.menge || ''} onChange={(e) => setMergeForm(v => ({ ...v, menge: e.target.value }))} />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Ziel-Bereich *</label>
                                    <select className="form-select" value={mergeForm.zielLagerbereich} onChange={(e) => setMergeForm(v => ({ ...v, zielLagerbereich: e.target.value as any }))}>
                                        <option value="NON_TK">Nicht TK</option>
                                        <option value="TK">TK</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Notiz</label>
                                    <textarea className="form-control" rows={2} value={mergeForm.notiz || ''} onChange={(e) => setMergeForm(v => ({ ...v, notiz: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" className="btn btn-primary" disabled={saving || !mergeForm.sourceChargeId || !mergeForm.zielChargeId} onClick={async () => {
                                try {
                                    if (!mergeForm.sourceChargeId || !mergeForm.zielChargeId) return;
                                    setSaving(true);
                                    await mergeChargeApi(mergeForm.sourceChargeId, {
                                        zielChargeId: mergeForm.zielChargeId,
                                        menge: mergeForm.menge ? Number(mergeForm.menge) : undefined,
                                        zielLagerbereich: mergeForm.zielLagerbereich,
                                        notiz: mergeForm.notiz?.trim() || undefined,
                                    });
                                    if (mergeModalRef.current) Modal.getOrCreateInstance(mergeModalRef.current).hide();
                                    await loadUebersicht();
                                    await loadHistorie();
                                } catch (e: any) { setError(e?.message || 'Zusammenführen fehlgeschlagen'); } finally { setSaving(false); }
                            }}>Zusammenführen</button>
                        </div>
                    </div>
                </div>
            </div>
            {/* Manueller Zugang Modal */}
            <div className="modal fade" tabIndex={-1} ref={manuellerZugangModalRef}>
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Manueller Zugang</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                        </div>
                        <div className="modal-body">
                            <div className="row g-3">
                                <div className="col-12 col-md-6">
                                    <label className="form-label">Artikel *</label>
                                    <select
                                        className="form-select"
                                        value={manZugangForm.artikelId}
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            setManZugangForm(v => ({ ...v, artikelId: val, zielChargeId: undefined }));
                                            await loadZielCharges(val);
                                        }}
                                    >
                                        <option value="" disabled>{artikelLoading ? "Lade Artikel…" : "Bitte wählen"}</option>
                                        {artikelOptions.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.nummer ? `${a.nummer} — ${a.name}` : a.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-6 col-md-3">
                                    <label className="form-label">Menge (kg) *</label>
                                    <input
                                        className="form-control"
                                        value={manZugangForm.menge}
                                        onChange={(e) => setManZugangForm(v => ({ ...v, menge: e.target.value }))}
                                    />
                                </div>
                                <div className="col-6 col-md-3">
                                    <label className="form-label">Bereich *</label>
                                    <select
                                        className="form-select"
                                        value={manZugangForm.lagerbereich}
                                        onChange={(e) => setManZugangForm(v => ({ ...v, lagerbereich: e.target.value as any }))}
                                    >
                                        <option value="NON_TK">Nicht TK</option>
                                        <option value="TK">TK</option>
                                    </select>
                                </div>

                                <div className="col-12 col-md-4">
                                    <label className="form-label">Modus *</label>
                                    <select
                                        className="form-select"
                                        value={manZugangForm.modus}
                                        onChange={(e) => setManZugangForm(v => ({ ...v, modus: e.target.value as any }))}
                                    >
                                        <option value="EXISTING">Zu bestehender Charge</option>
                                        <option value="NEW">Neue Charge anlegen</option>
                                    </select>
                                </div>

                                {manZugangForm.modus === 'EXISTING' ? (
                                    <div className="col-12 col-md-8">
                                        <label className="form-label">Ziel-Charge *</label>
                                        <select
                                            className="form-select"
                                            value={manZugangForm.zielChargeId || ''}
                                            onChange={(e) => setManZugangForm(v => ({ ...v, zielChargeId: e.target.value }))}
                                            disabled={!manZugangForm.artikelId}
                                        >
                                            <option value="" disabled>{!manZugangForm.artikelId ? 'Bitte zuerst Artikel wählen' : (zielChargesLoading ? 'Lade Charges…' : 'Bitte wählen')}</option>
                                            {zielCharges.map(z => (
                                                <option key={z.id} value={z.id}>{z.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <>
                                        <div className="col-6 col-md-4">
                                            <label className="form-label">MHD *</label>
                                            <input type="date" className="form-control" value={manZugangForm.newMhd || ''} onChange={(e) => setManZugangForm(v => ({ ...v, newMhd: e.target.value }))} />
                                        </div>
                                        <div className="col-6 col-md-4">
                                            <label className="form-label">Schlacht-Datum</label>
                                            <input type="date" className="form-control" value={manZugangForm.newSchlachtDatum || ''} onChange={(e) => setManZugangForm(v => ({ ...v, newSchlachtDatum: e.target.value || undefined }))} />
                                        </div>
                                        <div className="col-12 col-md-4">
                                            <label className="form-label">Lieferant-ID</label>
                                            <input className="form-control" value={manZugangForm.newLieferantId || ''} onChange={(e) => setManZugangForm(v => ({ ...v, newLieferantId: e.target.value || undefined }))} />
                                        </div>
                                    </>
                                )}

                                <div className="col-12">
                                    <label className="form-label">Notiz</label>
                                    <textarea className="form-control" rows={2} value={manZugangForm.notiz || ''} onChange={(e) => setManZugangForm(v => ({ ...v, notiz: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={
                                    saving ||
                                    !manZugangForm.artikelId ||
                                    !manZugangForm.menge ||
                                    (manZugangForm.modus === 'EXISTING' && !manZugangForm.zielChargeId) ||
                                    (manZugangForm.modus === 'NEW' && !manZugangForm.newMhd)
                                }
                                onClick={async () => {
                                    try {
                                        setSaving(true);
                                        const payload: any = {
                                            artikelId: manZugangForm.artikelId,
                                            menge: Number(manZugangForm.menge),
                                            lagerbereich: manZugangForm.lagerbereich,
                                            notiz: manZugangForm.notiz?.trim() || undefined,
                                        };
                                        if (manZugangForm.modus === 'EXISTING') {
                                            payload.chargeId = manZugangForm.zielChargeId;
                                        } else {
                                            payload.createNewCharge = {
                                                mhd: manZugangForm.newMhd!,
                                                isTK: manZugangForm.lagerbereich === 'TK',
                                                schlachtDatum: manZugangForm.newSchlachtDatum || undefined,
                                                lieferantId: manZugangForm.newLieferantId || undefined,
                                            };
                                        }
                                        await addManuellerZugangApi(payload);
                                        if (manuellerZugangModalRef.current) {
                                            Modal.getOrCreateInstance(manuellerZugangModalRef.current).hide();
                                        }
                                        await loadUebersicht();
                                        await loadHistorie();
                                    } catch (e: any) {
                                        setError(e?.message || 'Manueller Zugang fehlgeschlagen');
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Buchen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fehler Toast */}
            {error && (
                <div
                    className="toast-container position-fixed bottom-0 end-0 p-3"
                    style={{ zIndex: 1080 }}
                >
                    <div className="toast show align-items-center text-bg-danger border-0">
                        <div className="d-flex">
                            <div className="toast-body">{error}</div>
                            <button
                                type="button"
                                className="btn-close btn-close-white me-2 m-auto"
                                onClick={() => setError(null)}
                            ></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* --------------------------------- Helpers -------------------------------- */
function fmt(n: any) {
    const v = Number(n ?? 0);
    if (!isFinite(v)) return "–";
    return v.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function formatDate(iso?: string) {
    if (!iso) return "–";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
}
function formatDateTime(iso?: string) {
    if (!iso) return "–";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
}