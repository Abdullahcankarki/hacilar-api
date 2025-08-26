import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    getAllReihenfolgeVorlages,
    createReihenfolgeVorlage,
    updateReihenfolgeVorlage,
    deleteReihenfolgeVorlage,
    getAllKunden
} from "../backend/api";
import { KundeResource, ReihenfolgeVorlageResource } from "../Resources";


// ------------------------------------------------------------
// API — Replace import paths with your actual API modules
// ------------------------------------------------------------
// Hint: The functions should conform to these signatures.
// getAllReihenfolgeVorlagen({ q?: string; region?: string; page?: number; limit?: number })
// createReihenfolgeVorlage(data: Omit<ReihenfolgeVorlageResource, "id" | "createdAt" | "updatedAt">)
// updateReihenfolgeVorlage(id: string, data: Partial<ReihenfolgeVorlageResource>)
// deleteReihenfolgeVorlage(id: string)
// getAllKunden({ q?: string; page?: number; limit?: number }): Promise<{ items: KundeResource[], total: number }>

// Normalize helpers: bridge UI (kundenIdsInReihenfolge) ↔ API (kundenReihenfolge)
function idsToKundenReihenfolge(ids: string[]) {
    return (ids || []).map((kundeId, idx) => ({ kundeId, position: idx + 1 }));
}

// ------------------------------------------------------------
// Small utilities
// ------------------------------------------------------------
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function useBodyScrollLock(active: boolean) {
    useEffect(() => {
        const body = document.body;
        if (active) {
            body.classList.add("modal-open");
            const prev = body.style.overflow;
            body.style.overflow = "hidden";
            return () => {
                body.classList.remove("modal-open");
                body.style.overflow = prev;
            };
        }
    }, [active]);
}

// ------------------------------------------------------------
// Toast (Bootstrap-like minimal)
// ------------------------------------------------------------
type ToastState = { type: "success" | "danger" | "info"; msg: string } | null;

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
    if (!toast) return null;
    return (
        <div
            className={
                "toast align-items-center text-bg-" +
                (toast.type === "success" ? "success" : toast.type === "info" ? "info" : "danger") +
                " border-0 position-fixed bottom-0 end-0 m-3 show shadow"
            }
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style={{ zIndex: 1080 }}
        >
            <div className="d-flex">
                <div className="toast-body">{toast.msg}</div>
                <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={onClose} aria-label="Close" />
            </div>
        </div>
    );
}

// ------------------------------------------------------------
// Modal (accessible, Bootstrap-like)
// ------------------------------------------------------------
function Modal({
    show,
    title,
    children,
    footer,
    onClose,
    size = "lg",
}: {
    show: boolean;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    onClose: () => void;
    size?: "sm" | "lg" | "xl";
}) {
    useBodyScrollLock(show);
    if (!show) return null;
    return (
        <>
            <div
                className="modal-backdrop fade show"
                onClick={onClose}
                style={{ zIndex: 1050, position: "fixed", inset: 0 }}
            />
            <div
                className="modal fade show"
                style={{ display: "block", zIndex: 1060, position: "fixed", inset: 0 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className={`modal-dialog modal-${size} modal-dialog-centered modal-dialog-scrollable`}>
                    <div className="modal-content border-0 shadow-lg">
                        <div className="modal-header">
                            <h5 className="modal-title" id="modal-title">{title}</h5>
                            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
                        </div>
                        <div className="modal-body">{children}</div>
                        {footer && <div className="modal-footer bg-light-subtle">{footer}</div>}
                    </div>
                </div>
            </div>
        </>
    );
}

// ------------------------------------------------------------
// Kunden Dual-List with Drag & Drop ordering
// ------------------------------------------------------------
function KundenSelector({
    allKunden,
    selectedIds,
    onChange,
}: {
    allKunden: KundeResource[];
    selectedIds: string[];
    onChange: (next: string[]) => void;
}) {
    const [query, setQuery] = useState("");
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    // derived
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const selectedList = useMemo(() => selectedIds.map((id) => allKunden.find((k) => k.id === id)).filter(Boolean) as KundeResource[], [selectedIds, allKunden]);
    const available = useMemo(() => {
        const q = query.trim().toLowerCase();
        return allKunden
            .filter((k) => !selectedSet.has(k.id) && (!q || k.name.toLowerCase().includes(q)))
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, "de"));
    }, [allKunden, selectedSet, query]);

    const add = (id: string) => {
        if (!selectedSet.has(id)) onChange([...selectedIds, id]);
    };
    const addMany = (ids: string[]) => {
        const merged = [...selectedIds];
        const present = new Set(selectedIds);
        for (const id of ids) if (!present.has(id)) merged.push(id);
        onChange(merged);
    };
    const removeAt = (idx: number) => {
        const next = [...selectedIds];
        next.splice(idx, 1);
        onChange(next);
    };
    const clearAll = () => onChange([]);

    const onDragStart = (idx: number) => setDragIndex(idx);
    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
    const onDrop = (overIndex: number) => {
        if (dragIndex === null) return;
        const from = dragIndex;
        const to = overIndex;
        if (from === to) return;
        const next = [...selectedIds];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setDragIndex(null);
        onChange(next);
    };

    return (
        <div className="row g-3">
            <div className="col-md-6">
                <div className="card h-100 border-0 shadow-sm">
                    <div className="card-header bg-body">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-0">Kunden suchen & hinzufügen</h6>
                                <small className="text-muted">{available.length} verfügbar</small>
                            </div>
                            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => addMany(available.map((k) => k.id))}>
                                <i className="ci-add me-2" /> Alle hinzufügen
                            </button>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="mb-3">
                            <input
                                className="form-control"
                                placeholder="Nach Namen filtern…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                        <div className="list-group" style={{ maxHeight: 360, overflow: "auto" }}>
                            {available.map((k) => (
                                <button
                                    key={k.id}
                                    type="button"
                                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                    onClick={() => add(k.id)}
                                    title="Zur Reihenfolge hinzufügen"
                                >
                                    <span className="text-truncate">{k.name}</span>
                                    <i className="ci-arrow-right" />
                                </button>
                            ))}
                            {available.length === 0 && (
                                <div className="text-center text-muted py-4 small">Keine Kunden gefunden.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="col-md-6">
                <div className="card h-100 border-0 shadow-sm">
                    <div className="card-header bg-body">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-0">Reihenfolge</h6>
                                <small className="text-muted">{selectedIds.length} ausgewählt – per Drag & Drop sortieren</small>
                            </div>
                            <div className="btn-group btn-group-sm">
                                <button className="btn btn-outline-secondary" type="button" onClick={clearAll} disabled={selectedIds.length === 0}>
                                    <i className="ci-close me-1" /> Leeren
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="list-group" style={{ maxHeight: 360, overflow: "auto" }}>
                            {selectedList.map((k, idx) => (
                                <div
                                    key={k.id}
                                    className="list-group-item d-flex align-items-center gap-2"
                                    draggable
                                    onDragStart={() => onDragStart(idx)}
                                    onDragOver={onDragOver}
                                    onDrop={() => onDrop(idx)}
                                    title="Ziehen, um die Position zu ändern"
                                >
                                    <span className="badge bg-secondary-subtle text-secondary-emphasis me-2" style={{ cursor: "grab" }}>≡</span>
                                    <span className="flex-grow-1 text-truncate">{idx + 1}. {k.name}</span>
                                    <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => removeAt(idx)} aria-label="Entfernen">
                                        <i className="ci-trash" />
                                    </button>
                                </div>
                            ))}
                            {selectedList.length === 0 && (
                                <div className="text-center text-muted py-4 small">Noch keine Kunden ausgewählt.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------
// Create / Edit Form
// ------------------------------------------------------------
function VorlageForm({
    allKunden,
    initial,
    onSubmit,
    onCancel,
    submitting,
}: {
    allKunden: KundeResource[];
    initial: Omit<ReihenfolgeVorlageResource, "id" | "createdAt" | "updatedAt">;
    onSubmit: (val: Omit<ReihenfolgeVorlageResource, "id" | "createdAt" | "updatedAt">) => void;
    onCancel: () => void;
    submitting: boolean;
}) {
    const [form, setForm] = useState(() => initial);
    useEffect(() => {
        setForm(initial);
    }, [initial.region, initial.name, (initial.kundenIdsInReihenfolge || []).join(",")]);
    const [touched, setTouched] = useState<{ [K in keyof typeof initial]?: boolean }>({});

    // Eindeutige Regionen aus allen Kunden ableiten (alphabetisch sortiert)
    const regionOptions = useMemo(() => {
        const set = new Set<string>();
        for (const k of allKunden) {
            const r = (k.region || "").trim();
            if (r) set.add(r);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
    }, [allKunden]);

    const errors = useMemo(() => {
        return {
            region: !form.region?.trim() ? "Bitte Region angeben" : undefined,
            name: !form.name?.trim() ? "Bitte Name angeben" : undefined,
            kundenIdsInReihenfolge: !form.kundenIdsInReihenfolge?.length ? "Mindestens einen Kunden auswählen" : undefined,
        } as const;
    }, [form]);

    const isValid = !errors.region && !errors.name && !errors.kundenIdsInReihenfolge;

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                setTouched({ region: true, name: true, kundenIdsInReihenfolge: true } as any);
                if (isValid) onSubmit(form);
            }}
        >
            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label">Region</label>
                    <div className="input-group">
                        <input
                            className={"form-control " + (touched.region && errors.region ? "is-invalid" : "")}
                            placeholder="z. B. Berlin"
                            value={form.region}
                            onChange={(e) => setForm({ ...form, region: e.target.value })}
                            aria-invalid={!!(touched.region && errors.region)}
                        />
                        <select
                            className="form-select"
                            title="Region aus Kunden wählen"
                            value={form.region && regionOptions.includes(form.region) ? form.region : ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                const norm = (s: string) => s.trim().toLowerCase();
                                const filtered = allKunden
                                    .filter(k => norm(k.region || "") === norm(val));
                                const ordered = filtered.sort((a, b) => a.name.localeCompare(b.name, "de"));
                                const ids = ordered.map(k => k.id);
                                setForm(prev => ({ ...prev, region: val, kundenIdsInReihenfolge: ids }));
                            }}
                        >
                            <option value="">– Region wählen –</option>
                            {regionOptions.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                    {touched.region && errors.region && <div className="invalid-feedback d-block">{errors.region}</div>}
                    <div className="form-text">
                        Auswahl rechts füllt automatisch alle Kunden dieser Region (alphabetisch) in die Reihenfolge.
                    </div>
                </div>
                <div className="col-md-6">
                    <label className="form-label">Name</label>
                    <input
                        className={"form-control " + (touched.name && errors.name ? "is-invalid" : "")}
                        placeholder="z. B. Berlin Nord-Ost"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        aria-invalid={!!(touched.name && errors.name)}
                    />
                    {touched.name && errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>
            </div>

            <div className="mt-3">
                <KundenSelector
                    allKunden={allKunden}
                    selectedIds={form.kundenIdsInReihenfolge}
                    onChange={(next) => setForm({ ...form, kundenIdsInReihenfolge: next })}
                />
                {touched.kundenIdsInReihenfolge && errors.kundenIdsInReihenfolge && (
                    <div className="invalid-feedback d-block mt-2">{errors.kundenIdsInReihenfolge}</div>
                )}
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={submitting}>
                    Abbrechen
                </button>
                <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
                    {submitting ? (
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    ) : (
                        <i className="ci-check me-2" />
                    )}
                    Speichern
                </button>
            </div>
        </form>
    );
}

// ------------------------------------------------------------
// Main Overview Component
// ------------------------------------------------------------
export default function ReihenfolgeVorlageOverview() {
    // data states
    const [items, setItems] = useState<ReihenfolgeVorlageResource[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    // filters
    const [q, setQ] = useState("");
    const [regionFilter, setRegionFilter] = useState("");

    // customers
    const [kunden, setKunden] = useState<KundeResource[]>([]);
    const [kundenLoading, setKundenLoading] = useState(true);

    // modals
    const [showCreate, setShowCreate] = useState(false);
    const [editItem, setEditItem] = useState<ReihenfolgeVorlageResource | null>(null);
    const [deleteItem, setDeleteItem] = useState<ReihenfolgeVorlageResource | null>(null);

    // submit loading
    const [submitting, setSubmitting] = useState(false);

    // toast
    const [toast, setToast] = useState<ToastState>(null);

    const emptyInitial = React.useMemo(
        () => ({ region: "", name: "", kundenIdsInReihenfolge: [] as string[] }),
        []
    );

    const load = async () => {
        setLoading(true);
        try {
            const { items: raw, total } = await getAllReihenfolgeVorlages({ q: q || undefined, region: regionFilter || undefined, page: 1, limit: 200 });
            const list = (raw as any[]).map((it) => {
                const ids =
                    it.kundenIdsInReihenfolge ??
                    (Array.isArray(it.kundenReihenfolge)
                        ? [...it.kundenReihenfolge]
                            .sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0))
                            .map((x: any) => x.kundeId)
                        : []);
                return { ...it, kundenIdsInReihenfolge: ids };
            });
            setItems(list as any);
            setTotal(total ?? list.length);
        } catch (err: any) {
            setToast({ type: "danger", msg: err?.message || "Fehler beim Laden" });
        } finally {
            setLoading(false);
        }
    };

    const loadKunden = async () => {
        setKundenLoading(true);
        try {
            const { items } = await getAllKunden({ page: 1, limit: 10000 });
            setKunden(items || []);
        } catch (err: any) {
            setToast({ type: "danger", msg: err?.message || "Kunden konnten nicht geladen werden" });
        } finally {
            setKundenLoading(false);
        }
    };

    useEffect(() => {
        loadKunden();
    }, []);

    useEffect(() => {
        load();
    }, [q, regionFilter]);

    const kundenName = (id: string) => kunden.find((k) => k.id === id)?.name || id;

    // Memoized Region options for filter (from existing Vorlagen)
    const regionOptions = useMemo(() => {
        const set = new Set<string>();
        for (const it of items) {
            const r = (it.region || "").trim();
            if (r) set.add(r);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
    }, [items]);

    // ----------------------------------------------------------
    // Render
    // ----------------------------------------------------------
    return (
        <div className="container py-4">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h2 className="h4 mb-1">Reihenfolge-Vorlagen</h2>
                    <div className="text-muted small">{total} Vorlagen gesamt</div>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-dark rounded-3" onClick={() => setShowCreate(true)} disabled={kundenLoading}>
                        <i className="ci-plus me-2" /> Neue Vorlage
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card shadow-sm border-0 mb-3">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <label className="form-label">Suche (Name)</label>
                            <div className="position-relative">
                                <input
                                    className="form-control"
                                    placeholder="z. B. Berlin Nord-Ost"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Region</label>
                            <select
                                className="form-select"
                                value={regionFilter}
                                onChange={(e) => setRegionFilter(e.target.value)}
                            >
                                <option value="">Alle Regionen</option>
                                {regionOptions.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-5 d-flex align-items-end justify-content-end gap-2">
                            <button className="btn btn-outline-secondary" onClick={() => { setQ(""); setRegionFilter(""); }}>
                                <i className="ci-close me-2" /> Zurücksetzen
                            </button>
                            <button className="btn btn-outline-primary" onClick={load}>
                                <i className="ci-refresh me-2" /> Aktualisieren
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="card shadow-sm border-0">
                <div className="table-responsive">
                    <table className="table align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th style={{ width: 48 }}>#</th>
                                <th>Name</th>
                                <th>Region</th>
                                <th>Positionen</th>
                                <th style={{ width: 160 }} className="text-end">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-5">
                                        <div className="spinner-border" role="status" aria-hidden="true" />
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center text-muted py-5">Keine Vorlagen gefunden.</td>
                                </tr>
                            ) : (
                                items.map((it, idx) => (
                                    <tr key={it.id || idx}>
                                        <td className="text-muted">{idx + 1}</td>
                                        <td>
                                            <div className="fw-medium">{it.name}</div>
                                            <div className="small text-muted">ID: {it.id}</div>
                                        </td>
                                        <td>
                                            <span className="badge bg-secondary-subtle text-secondary-emphasis">{it.region}</span>
                                        </td>
                                        <td>
                                            <div className="d-flex flex-wrap gap-1">
                                                {it.kundenIdsInReihenfolge.slice(0, 6).map((id, pidx) => (
                                                    <span key={id + pidx} className="badge bg-light text-body border">{pidx + 1}. {kundenName(id)}</span>
                                                ))}
                                                {it.kundenIdsInReihenfolge.length > 6 && (
                                                    <span className="badge bg-info-subtle text-info-emphasis">+{it.kundenIdsInReihenfolge.length - 6} weitere</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-end">
                                            <div className="btn-group">
                                                <button className="btn btn-sm btn-outline-primary" onClick={() => setEditItem(it)}>
                                                    <i className="ci-edit me-1" /> Bearbeiten
                                                </button>
                                                <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleteItem(it)}>
                                                    <i className="ci-trash me-1" /> Löschen
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            <Modal
                show={showCreate}
                title="Neue Reihenfolge-Vorlage erstellen"
                onClose={() => setShowCreate(false)}
                size="xl"
                footer={null}
            >
                {kundenLoading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border" role="status" aria-hidden="true" />
                    </div>
                ) : (
                    <VorlageForm
                        allKunden={kunden}
                        initial={emptyInitial}
                        submitting={submitting}
                        onCancel={() => setShowCreate(false)}
                        onSubmit={async (val) => {
                            setSubmitting(true);
                            try {
                                await createReihenfolgeVorlage({
                                    name: val.name,
                                    region: val.region,
                                    kundenIdsInReihenfolge: val.kundenIdsInReihenfolge, // ensure array is present for backend validation
                                    kundenReihenfolge: idsToKundenReihenfolge(val.kundenIdsInReihenfolge),
                                } as any);
                                setShowCreate(false);
                                setToast({ type: "success", msg: "Vorlage erstellt" });
                                await load();
                            } catch (err: any) {
                                setToast({ type: "danger", msg: err?.message || "Erstellung fehlgeschlagen" });
                            } finally {
                                setSubmitting(false);
                            }
                        }}
                    />
                )}
            </Modal>

            {/* Edit Modal */}
            <Modal
                show={!!editItem}
                title={`Vorlage bearbeiten${editItem ? `: ${editItem.name}` : ""}`}
                onClose={() => setEditItem(null)}
                size="xl"
                footer={null}
            >
                {editItem && (
                    kundenLoading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border" role="status" aria-hidden="true" />
                        </div>
                    ) : (
                        <VorlageForm
                            allKunden={kunden}
                            initial={{ region: editItem.region, name: editItem.name, kundenIdsInReihenfolge: editItem.kundenIdsInReihenfolge || [] }}
                            submitting={submitting}
                            onCancel={() => setEditItem(null)}
                            onSubmit={async (val) => {
                                if (!editItem?.id) return;
                                setSubmitting(true);
                                try {
                                    await updateReihenfolgeVorlage(editItem.id, {
                                        name: val.name,
                                        region: val.region,
                                        kundenIdsInReihenfolge: val.kundenIdsInReihenfolge, // ensure array is present for backend validation
                                        kundenReihenfolge: idsToKundenReihenfolge(val.kundenIdsInReihenfolge),
                                    } as any);
                                    setEditItem(null);
                                    setToast({ type: "success", msg: "Vorlage aktualisiert" });
                                    await load();
                                } catch (err: any) {
                                    setToast({ type: "danger", msg: err?.message || "Aktualisierung fehlgeschlagen" });
                                } finally {
                                    setSubmitting(false);
                                }
                            }}
                        />
                    )
                )}
            </Modal>

            {/* Delete Modal */}
            <Modal
                show={!!deleteItem}
                title="Vorlage löschen?"
                onClose={() => setDeleteItem(null)}
                size="sm"
                footer={null}
            >
                {deleteItem && (
                    <div>
                        <p>
                            Soll die Vorlage <strong>{deleteItem.name}</strong> (Region <span className="badge bg-secondary-subtle text-secondary-emphasis">{deleteItem.region}</span>) wirklich gelöscht werden?
                        </p>
                        <div className="d-flex justify-content-end gap-2">
                            <button className="btn btn-outline-secondary" onClick={() => setDeleteItem(null)}>Abbrechen</button>
                            <button
                                className="btn btn-danger"
                                onClick={async () => {
                                    if (!deleteItem?.id) return;
                                    try {
                                        await deleteReihenfolgeVorlage(deleteItem.id);
                                        setDeleteItem(null);
                                        setToast({ type: "success", msg: "Vorlage gelöscht" });
                                        await load();
                                    } catch (err: any) {
                                        setToast({ type: "danger", msg: err?.message || "Löschen fehlgeschlagen" });
                                    }
                                }}
                            >
                                <i className="ci-trash me-2" /> Löschen
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Toast */}
            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
}
