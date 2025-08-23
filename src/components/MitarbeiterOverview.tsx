
import React, { useCallback, useEffect, useMemo, useState } from "react";


// --- API-Funktionen: bitte in Ihrem Projekt korrekt bereitstellen ---
// Tipp: Diese Signaturen beibehalten, damit die Komponente drop-in funktioniert.
import { getAllMitarbeiter, createMitarbeiter, updateMitarbeiter, deleteMitarbeiter } from "../backend/api";
import { MitarbeiterResource, MitarbeiterRolle } from "../Resources";

//---------------------------------
// Hilfsfunktionen & Mappings
//---------------------------------
const pillClass = (filled = false) =>
    `badge rounded-pill ${filled ? "text-bg-dark" : "bg-light text-dark"} border`;

const roleToLabel: Record<MitarbeiterRolle, string> = {
    admin: "Admin",
    verkauf: "Verkauf",
    kommissionierung: "Kommissionierung",
    kontrolle: "Kontrolle",
    buchhaltung: "Buchhaltung",
    wareneingang: "Wareneingang",
    lager: "Lager",
    fahrer: "Fahrer",
    zerleger: "Zerleger",
    statistik: "Statistik",
    kunde: "Kunde",
    support: "Support",
};

// --- Toast (einfach, einzelner State) ---
type AppToast = { type: "success" | "error"; msg: string };

function ToastMessage({
    toast,
    onClose,
}: {
    toast: AppToast | null;
    onClose: () => void;
}) {
    if (!toast) return null;
    return (
        <div
            className={
                "toast align-items-center text-bg-" +
                (toast.type === "success" ? "success" : "danger") +
                " border-0 position-fixed bottom-0 end-0 m-3 show"
            }
            role="alert"
        >
            <div className="d-flex">
                <div className="toast-body">{toast.msg}</div>
                <button
                    type="button"
                    className="btn-close btn-close-white me-2 m-auto"
                    onClick={onClose}
                />
            </div>
        </div>
    );
}


function initialsOf(name?: string) {
    if (!name) return "?";
    const parts = name.split(/\s+/).filter(Boolean);
    const two = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
    return two.toUpperCase();
}

function formatISODate(iso?: string) {
    if (!iso) return "–";
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "–";
        return d.toLocaleDateString();
    } catch {
        return "–";
    }
}

//---------------------------------
// Bootstrap-Modal Helpers (sauberer Scroll-Reset)
//---------------------------------

const modalMap = new Map<string, any>();

function getModalInstance(el: HTMLElement) {
    // @ts-ignore
    const ModalCtor = window?.bootstrap?.Modal;
    if (ModalCtor) {
        // @ts-ignore
        const getOrCreate = window.bootstrap.Modal.getOrCreateInstance;
        // @ts-ignore
        return getOrCreate ? window.bootstrap.Modal.getOrCreateInstance(el) : new window.bootstrap.Modal(el);
    }
    return null;
}

function showModal(id: string) {
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el) return;
    const inst = getModalInstance(el);
    if (inst) {
        inst.show();
        modalMap.set(id, inst);
        return;
    }
    // Fallback (ohne Bootstrap JS)
    el.classList.add("show");
    el.style.display = "block";
    el.removeAttribute("aria-hidden");
    document.body.classList.add("modal-open");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop fade show";
    backdrop.setAttribute("data-fallback", "true");
    document.body.appendChild(backdrop);
    modalMap.set(id, { __fallback: true, el });
}

function dismissModal(id: string) {
    const cached = modalMap.get(id);
    const el = document.getElementById(id) as HTMLElement | null;

    // 1) Bootstrap-Instanz
    if (cached && cached.hide) {
        cached.hide();
        return;
    }
    const inst = el ? getModalInstance(el) : null;
    if (inst) {
        inst.hide();
        return;
    }

    // 2) Fallback aufräumen
    if (el) {
        el.classList.remove("show");
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("padding-right");
    document.querySelectorAll(".modal-backdrop").forEach((n) => {
        if ((n as HTMLElement).getAttribute("data-fallback") === "true") n.remove();
    });
    modalMap.delete(id);
}

function bindHiddenCleanup(ids: string[]) {
    const off: Array<() => void> = [];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const onHidden = () => {
            document.body.classList.remove("modal-open");
            document.body.style.removeProperty("padding-right");
            document.querySelectorAll(".modal-backdrop").forEach((n) => {
                if ((n as HTMLElement).getAttribute("data-fallback") === "true") n.remove();
            });
            modalMap.delete(id);
        };
        el.addEventListener("hidden.bs.modal", onHidden as any);
        off.push(() => el.removeEventListener("hidden.bs.modal", onHidden as any));
    });
    return () => off.forEach((fn) => fn());
}

//---------------------------------
// Reusable Modal-Wrapper
//---------------------------------

function BsModal({ id, title, children, onClose }: { id: string; title: string; children: React.ReactNode; onClose?: () => void }) {
    return (
        <div className="modal fade" id={id} tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content shadow-lg border-0 rounded-4">
                    <div className="modal-header border-0">
                        <h5 className="modal-title fw-semibold">{title}</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={onClose} />
                    </div>
                    <div className="modal-body pt-0">{children}</div>
                </div>
            </div>
        </div>
    );
}

//---------------------------------
// Mitarbeiter-Formular
//---------------------------------

function MitarbeiterForm({ value, onSubmit, submitting }: { value: MitarbeiterResource; onSubmit: (val: MitarbeiterResource) => void; submitting?: boolean }) {
    const [form, setForm] = useState<MitarbeiterResource>(value);
    const [pwEdit, setPwEdit] = useState<boolean>(!value.id);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});


    useEffect(() => {
        setForm(value);
        setPwEdit(!value.id); // beim Edit standardmäßig aus, beim Create an
    }, [value]);

    const toggleRole = (r: MitarbeiterRolle) => {
        setForm((prev) => ({
            ...prev,
            rollen: prev.rollen.includes(r) ? prev.rollen.filter((x) => x !== r) : [...prev.rollen, r],
        }));
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!form.name?.trim()) newErrors.name = "Name ist erforderlich";
        if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) newErrors.email = "Ungültige E-Mail-Adresse";
        if (form.telefon && form.telefon.length < 5) newErrors.telefon = "Telefonnummer zu kurz";
        if (form.rollen.length === 0) newErrors.rollen = "Mindestens eine Rolle wählen";
        if (form.password && form.password.length < 6) newErrors.password = "Passwort muss mindestens 6 Zeichen haben";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        onSubmit(form);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label">Name *</label>
                    <input
                        className={`form-control form-control-lg rounded-3 ${errors.name ? "is-invalid" : ""}`}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                    />
                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>
                <div className="col-md-6">
                    <label className="form-label">E-Mail</label>
                    <input
                        type="email"
                        className={`form-control rounded-3 ${errors.email ? "is-invalid" : ""}`}
                        value={form.email ?? ""}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                </div>
                <div className="col-md-6">
                    <label className="form-label">Telefon</label>
                    <input
                        className={`form-control rounded-3 ${errors.telefon ? "is-invalid" : ""}`}
                        value={form.telefon ?? ""}
                        onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                    />
                    {errors.telefon && <div className="invalid-feedback">{errors.telefon}</div>}
                </div>
                <div className="col-md-6">
                    <label className="form-label">Abteilung</label>
                    <input
                        className="form-control rounded-3"
                        value={form.abteilung ?? ""}
                        onChange={(e) => setForm({ ...form, abteilung: e.target.value })}
                    />
                </div>
                <div className="col-md-6">
                    <label className="form-label">Eintrittsdatum</label>
                    <input
                        type="date"
                        className="form-control rounded-3"
                        value={form.eintrittsdatum ?? ""}
                        onChange={(e) => setForm({ ...form, eintrittsdatum: e.target.value })}
                    />
                </div>
                <div className="col-md-6">
                    <label className="form-label">Aktiv</label>
                    <div className="form-check form-switch mt-2">
                        <input className="form-check-input" type="checkbox" checked={!!form.aktiv} onChange={(e) => setForm({ ...form, aktiv: e.target.checked })} />
                        <label className="form-check-label">Nutzer ist aktiv</label>
                    </div>
                </div>
                <div className="col-12">
                    <label className="form-label">Rollen *</label>
                    {errors.rollen && <div className="text-danger small mb-1">{errors.rollen}</div>}
                    <div className="d-flex flex-wrap gap-2">
                        {(Object.keys(roleToLabel) as MitarbeiterRolle[]).map((r) => (
                            <button
                                type="button"
                                key={r}
                                onClick={() => toggleRole(r)}
                                className={`btn btn-sm rounded-pill border ${form.rollen.includes(r) ? "btn-dark" : "btn-outline-secondary bg-light"}`}
                            >
                                {roleToLabel[r]}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="col-12">
                    <label className="form-label">Bemerkung</label>
                    <textarea className="form-control rounded-3" rows={3} value={form.bemerkung ?? ""} onChange={(e) => setForm({ ...form, bemerkung: e.target.value })} />
                </div>
                <div className="col-12">
                    <label className="form-label">Passwort {value.id ? "(optional)" : "*"}</label>
                    {pwEdit ? (
                        <div className="row g-3">
                            <div className="input-group">
                                <input
                                    data-field="password"
                                    type={showPassword ? "text" : "password"}
                                    className={`form-control rounded-start-3 ${errors.password ? "is-invalid" : ""}`}
                                    placeholder="Neues Passwort (leer lassen = nicht ändern)"
                                    value={form.password ?? ""}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    aria-invalid={!!errors.password}
                                />
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary rounded-end-3"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                                    title={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                                >
                                    <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                                </button>
                            </div>
                            {errors.password && <div className="invalid-feedback d-block">{errors.password}</div>}
                        </div>
                    ) : (
                        <div className="input-group">
                            <input
                                data-field="password"
                                type={showPassword ? "text" : "password"}
                                className={`form-control rounded-start-3 ${errors.password ? "is-invalid" : ""}`}
                                placeholder="(optional)"
                                value={form.password ?? ""}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                aria-invalid={!!errors.password}
                            />
                            <button
                                type="button"
                                className="btn btn-outline-secondary rounded-end-3"
                                onClick={() => setShowPassword((prev) => !prev)}
                                aria-label={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                                title={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                            >
                                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                            </button>
                            {errors.password && <div className="invalid-feedback d-block">{errors.password}</div>}
                        </div>
                    )}
                </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => dismissModal(value.id ? "modalEdit" : "modalCreate")}>
                    Abbrechen
                </button>
                <button type="submit" className="btn btn-dark rounded-3" disabled={submitting}>
                    {submitting ? "Speichere…" : value.id ? "Änderungen speichern" : "Anlegen"}
                </button>
            </div>
        </form>
    );
}

//---------------------------------
// Hauptkomponente
//---------------------------------

export default function MitarbeiterOverview() {
    const [items, setItems] = useState<MitarbeiterResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search / Filter / Sort
    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<MitarbeiterRolle | "">("");
    const [onlyActive, setOnlyActive] = useState(false);

    // Modals state
    const [editing, setEditing] = useState<MitarbeiterResource | null>(null);
    const [creating, setCreating] = useState<MitarbeiterResource | null>(null);
    const [deleting, setDeleting] = useState<MitarbeiterResource | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Toasts
    // Toast State (ein Toast zur Zeit)
    const [toast, setToast] = useState<AppToast | null>(null);
    const showToast = useCallback((type: "success" | "error", msg: string) => {
        setToast({ type, msg });
        window.setTimeout(() => setToast(null), 4000);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const data = await getAllMitarbeiter();
                setItems(data);
            } catch (e: any) {
                setError(e?.message ?? "Laden fehlgeschlagen");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        // Modal-Cleanup nur einmal binden (nach erstem Render, sobald DOM da ist)
        return bindHiddenCleanup(["modalCreate", "modalEdit", "modalDelete"]);
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items
            .filter((m) => (onlyActive ? m.aktiv : true))
            .filter((m) => (roleFilter ? m.rollen.includes(roleFilter) : true))
            .filter((m) =>
                q
                    ? [m.name, m.email, m.telefon, m.abteilung, m.bemerkung]
                        .filter(Boolean)
                        .some((v) => String(v).toLowerCase().includes(q))
                    : true
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [items, query, roleFilter, onlyActive]);

    // ---- Actions ----
    const openCreate = () => setCreating({ name: "", rollen: [], aktiv: true });
    const openEdit = (m: MitarbeiterResource) => setEditing(m);
    const openDelete = (m: MitarbeiterResource) => setDeleting(m);

    const handleCreate = async (val: MitarbeiterResource) => {
        setSubmitting(true);
        try {
            const saved = await createMitarbeiter(val);
            setItems((prev) => [saved, ...prev]);
            dismissModal("modalCreate");
            setTimeout(() => setCreating(null), 0);
            showToast("success", "Mitarbeiter angelegt");
        } catch (e: any) {
            showToast("error", e?.message ?? "Anlegen fehlgeschlagen");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async (val: MitarbeiterResource) => {
        if (!val.id) return;
        setSubmitting(true);
        try {
            const payload: Partial<MitarbeiterResource> = { ...val };
            if (!payload.password) delete (payload as any).password;
            const saved = await updateMitarbeiter(val.id, payload);
            setItems((prev) => prev.map((x) => (x.id === val.id ? { ...x, ...saved } : x)));
            dismissModal("modalEdit");
            setTimeout(() => setEditing(null), 0);
            showToast("success", "Änderungen gespeichert");
        } catch (e: any) {
            showToast("error", e?.message ?? "Speichern fehlgeschlagen");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleting?.id) return;
        const id = deleting.id;
        setSubmitting(true);
        try {
            await deleteMitarbeiter(id);
            setItems((prev) => prev.filter((x) => x.id !== id));
            dismissModal("modalDelete");
            setTimeout(() => setDeleting(null), 0);
            showToast("success", "Mitarbeiter gelöscht");
        } catch (e: any) {
            showToast("error", e?.message ?? "Löschen fehlgeschlagen");
        } finally {
            setSubmitting(false);
        }
    };

    // Modals anzeigen, wenn State gesetzt wird
    useEffect(() => {
        if (creating) showModal("modalCreate");
    }, [creating]);
    useEffect(() => {
        if (editing) showModal("modalEdit");
    }, [editing]);
    useEffect(() => {
        if (deleting) showModal("modalDelete");
    }, [deleting]);

    return (
        <div className="container py-4">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h2 className="h4 mb-1 fw-bold">Mitarbeiter</h2>
                    <p className="text-secondary mb-0">Verwalten Sie Nutzer, Rollen und Berechtigungen.</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-dark rounded-3" onClick={openCreate}>
                        <i className="bi bi-plus-lg me-2" /> Neuer Mitarbeiter
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card border-0 shadow-sm rounded-4 mb-3">
                <div className="card-body">
                    <div className="row g-2 align-items-center">
                        <div className="col-md-6">
                            <div className="input-group input-group-lg">
                                <span className="input-group-text bg-light border-0">
                                    <i className="bi bi-search" />
                                </span>
                                <input
                                    className="form-control border-0"
                                    placeholder="Suche nach Name, E-Mail, Abteilung…"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <select className="form-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
                                <option value="">Alle Rollen</option>
                                {(Object.keys(roleToLabel) as MitarbeiterRolle[]).map((r) => (
                                    <option key={r} value={r}>
                                        {roleToLabel[r]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-3 d-flex align-items-center justify-content-md-end">
                            <div className="form-check form-switch">
                                <input className="form-check-input" type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
                                <label className="form-check-label">nur Aktive</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border" role="status" />
                    <div className="mt-2 text-secondary">Lade Mitarbeiter…</div>
                </div>
            ) : error ? (
                <div className="alert alert-danger rounded-3">{error}</div>
            ) : filtered.length === 0 ? (
                <div className="alert alert-light border rounded-3 d-flex align-items-center justify-content-between">
                    <span>Keine Einträge gefunden.</span>
                    <button className="btn btn-sm btn-dark" onClick={openCreate}>
                        Neuen Mitarbeiter anlegen
                    </button>
                </div>
            ) : (
                <div className="row g-3">
                    {filtered.map((m) => (
                        <div className="col-12 col-md-6 col-xl-4" key={m.id ?? m.name}>
                            <div className="card h-100 border-0 shadow-sm rounded-4">
                                <div className="card-body">
                                    <div className="d-flex align-items-center gap-3 mb-3">
                                        <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{ width: 52, height: 52 }}>
                                            <span className="fw-bold">{initialsOf(m.name)}</span>
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className="d-flex align-items-center gap-2">
                                                <h6 className="mb-0">{m.name}</h6>
                                                {m.aktiv ? <span className={`${pillClass(true)} ms-1`}>Aktiv</span> : <span className={`${pillClass()} ms-1`}>Inaktiv</span>}
                                            </div>
                                            <div className="text-secondary small mt-1">
                                                {m.email ? (
                                                    <span className="me-2">
                                                        <i className="bi bi-envelope me-1" />
                                                        {m.email}
                                                    </span>
                                                ) : null}
                                                {m.telefon ? (
                                                    <span>
                                                        <i className="bi bi-telephone me-1" />
                                                        {m.telefon}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                        {m.rollen.map((r) => (
                                            <span key={r} className={pillClass()}>
                                                {roleToLabel[r]}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="row small text-secondary mb-3">
                                        <div className="col-6">
                                            <div className="text-uppercase opacity-75">Abteilung</div>
                                            <div className="fw-medium text-dark">{m.abteilung || "–"}</div>
                                        </div>
                                        <div className="col-6">
                                            <div className="text-uppercase opacity-75">Eintritt</div>
                                            <div className="fw-medium text-dark">{formatISODate(m.eintrittsdatum)}</div>
                                        </div>
                                    </div>

                                    {m.bemerkung && <div className="border rounded-3 p-2 bg-light small mb-3">{m.bemerkung}</div>}

                                    <div className="d-flex justify-content-end gap-2">
                                        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => openEdit(m)}>
                                            <i className="bi bi-pencil-square me-1" /> Bearbeiten
                                        </button>
                                        <button className="btn btn-outline-danger btn-sm rounded-3" onClick={() => openDelete(m)}>
                                            <i className="bi bi-trash me-1" /> Löschen
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CREATE MODAL */}
            <BsModal id="modalCreate" title="Neuen Mitarbeiter anlegen" onClose={() => setCreating(null)}>
                {creating && <MitarbeiterForm value={creating} onSubmit={handleCreate} submitting={submitting} />}
            </BsModal>

            {/* EDIT MODAL */}
            <BsModal id="modalEdit" title="Mitarbeiter bearbeiten" onClose={() => setEditing(null)}>
                {editing && <MitarbeiterForm value={editing} onSubmit={handleUpdate} submitting={submitting} />}
            </BsModal>

            {/* DELETE CONFIRM MODAL */}
            <div className="modal fade" id="modalDelete" tabIndex={-1} aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content shadow-lg border-0 rounded-4">
                        <div className="modal-header border-0">
                            <h5 className="modal-title fw-semibold">Löschen bestätigen</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={() => setDeleting(null)} />
                        </div>
                        <div className="modal-body pt-0">
                            <p className="mb-0">
                                Möchten Sie <strong>{deleting?.name}</strong> dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                            </p>
                        </div>
                        <div className="modal-footer border-0">
                            <button
                                type="button"
                                className="btn btn-outline-secondary rounded-3"
                                onClick={() => {
                                    dismissModal("modalDelete");
                                    setTimeout(() => setDeleting(null), 0);
                                }}
                            >
                                Abbrechen
                            </button>
                            <button type="button" className="btn btn-danger rounded-3" disabled={submitting} onClick={handleDelete}>
                                {submitting ? "Lösche…" : "Ja, löschen"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast Viewport */}
            <ToastMessage toast={toast} onClose={() => setToast(null)} />

        </div>
    );
}

/*
=============================================
Einbindung & Design Hinweise
---------------------------------------------
1) CSS/JS
   - Bootstrap 5 (CSS + JS) und Bootstrap Icons laden.
   - Cartzilla-Design: Typografie / Spacing ist kompatibel; für 1:1 Optik zusätzlich Cartzilla CSS laden.

2) API-Integration
   - Ersetzen Sie die API-Importe oben durch die echten Projektpfade:
       import { getAllMitarbeiter, createMitarbeiter, updateMitarbeiter, deleteMitarbeiter } from "@/api/mitarbeiter";

3) Scroll-Lock/Grauer Screen Fix
   - Modals werden über Bootstrap-Instanzen oder einen klaren Fallback geöffnet/geschlossen.
   - Cleanup via `hidden.bs.modal` (siehe bindHiddenCleanup) entfernt Backdrops & Body-Styles zuverlässig.

4) UX
   - Toaster unten rechts (success/error/info) statt alert().
   - Nach Create/Update/Delete: zuerst Modal schließen, dann State resetten (setTimeout 0) → Events können sauber feuern.

5) Erweiterungen (optional)
   - Pagination, Server-Suche, CSV/PDF-Export, Massenaktionen.
   - Rollen/Abteilungen als Master-Daten mit Typeahead.
=============================================
*/
