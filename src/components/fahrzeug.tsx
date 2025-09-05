import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { FahrzeugResource } from "../Resources";
import { getAllFahrzeuge, createFahrzeug, updateFahrzeug, deleteFahrzeug } from "../backend/api";

type ListResponse = {
    items: FahrzeugResource[];
    total: number;
    page: number;
    limit: number;
};

type FetchState = "idle" | "loading" | "success" | "error";

const initialForm: FahrzeugResource = {
    kennzeichen: "",
    name: "",
    maxGewichtKg: 0,
    aktiv: true,
    regionen: [],
    samsaraVehicleId: "",
    bemerkung: "",
};

function cx(...classes: (string | false | undefined)[]) {
    return classes.filter(Boolean).join(" ");
}

const ConfirmModal: React.FC<{
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}> = ({
  title = "Löschen bestätigen",
  message,
  confirmText = "Löschen",
  cancelText = "Abbrechen",
  onConfirm,
  onCancel,
  busy,
}) => {
  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(30,33,37,.6)" }}>
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <div className="d-flex align-items-start">
              <i className="ci-trash fs-4 me-3 text-danger" />
              <div>{message}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={!!busy}>
              {cancelText}
            </button>
            <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={!!busy}>
              {busy && <span className="spinner-border spinner-border-sm me-2" />} {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function FahrzeugUebersicht() {
    const navigate = useNavigate();
    const [items, setItems] = useState<FahrzeugResource[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(12);
    const [q, setQ] = useState("");
    const [region, setRegion] = useState("");
    const [onlyActive, setOnlyActive] = useState<boolean>(true);
    const [state, setState] = useState<FetchState>("idle");
    const [errorMsg, setErrorMsg] = useState<string>("");

    // Modal State
    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [form, setForm] = useState<FahrzeugResource>(initialForm);
    const [saving, setSaving] = useState(false);

    const [confirmItem, setConfirmItem] = useState<FahrzeugResource | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    // Toaster
    const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    function showToast(type: "success" | "error", msg: string) {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    }

    // Load data
    async function load() {
        setState("loading");
        setErrorMsg("");
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (region) params.set("region", region);
        if (onlyActive) params.set("aktiv", "true");
        params.set("page", String(page));
        params.set("limit", String(limit));

        try {
            const data = await getAllFahrzeuge(params) as ListResponse; // ← { items, total, page, limit }
            if (!data || !Array.isArray(data.items)) throw new Error("Backend lieferte kein gültiges Ergebnis");
            setItems(data.items);
            setTotal(typeof data.total === "number" ? data.total : data.items.length);
            // Optional: Wenn du die Server-Paginierung zurückspiegeln willst, kannst du das hier tun:
            // setPage(data.page ?? page);
            // setLimit(data.limit ?? limit);
            setState("success");
        } catch (e: any) {
            setErrorMsg(e?.message ?? "Fehler beim Laden");
            setState("error");
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit, q, region, onlyActive]);

    // Pagination calc
    const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

    // Handlers
    function openCreate() {
        setForm({ ...initialForm });
        setShowCreate(true);
    }

    function openEdit(item: FahrzeugResource) {
        setForm({
            id: item.id,
            kennzeichen: item.kennzeichen ?? "",
            name: item.name ?? "",
            maxGewichtKg: item.maxGewichtKg ?? 0,
            aktiv: !!item.aktiv,
            regionen: item.regionen ?? [],
            samsaraVehicleId: item.samsaraVehicleId ?? "",
            bemerkung: item.bemerkung ?? "",
        });
        setShowEdit(true);
    }

    function closeModals() {
        setShowCreate(false);
        setShowEdit(false);
        setForm({ ...initialForm });
    }

    // Form helpers
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    function validateForm(f: FahrzeugResource): boolean {
        const errs: Record<string, string> = {};
        if (!f.kennzeichen?.trim()) errs.kennzeichen = "Kennzeichen ist erforderlich";
        if (f.maxGewichtKg == null || isNaN(Number(f.maxGewichtKg)) || Number(f.maxGewichtKg) < 0) {
            errs.maxGewichtKg = "Max. Gewicht muss ≥ 0 sein";
        }
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function submitCreate() {
        if (!validateForm(form)) return;
        setSaving(true);
        try {
            await createFahrzeug({
                kennzeichen: form.kennzeichen,
                name: form.name,
                maxGewichtKg: Number(form.maxGewichtKg),
                aktiv: !!form.aktiv,
                regionen: form.regionen,
                samsaraVehicleId: form.samsaraVehicleId,
                bemerkung: form.bemerkung,
            });
            showToast("success", "Fahrzeug angelegt");
            closeModals();
            setPage(1);
            load();
        } catch (e: any) {
            showToast("error", e?.message ?? "Fehler beim Anlegen");
        } finally {
            setSaving(false);
        }
    }

    async function submitEdit() {
        if (!validateForm(form)) return;
        if (!form.id) return;
        setSaving(true);
        try {
            await updateFahrzeug(form.id, {
                kennzeichen: form.kennzeichen,
                name: form.name,
                maxGewichtKg: Number(form.maxGewichtKg),
                aktiv: !!form.aktiv,
                regionen: form.regionen,
                samsaraVehicleId: form.samsaraVehicleId,
                bemerkung: form.bemerkung,
            });
            showToast("success", "Fahrzeug aktualisiert");
            closeModals();
            load();
        } catch (e: any) {
            showToast("error", e?.message ?? "Fehler beim Speichern");
        } finally {
            setSaving(false);
        }
    }

    async function toggleAktiv(item: FahrzeugResource) {
        try {
            await updateFahrzeug(item.id!, { aktiv: !item.aktiv });
            setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, aktiv: !item.aktiv } : x)));
            showToast("success", `Fahrzeug ${!item.aktiv ? "aktiviert" : "deaktiviert"}`);
        } catch {
            showToast("error", "Aktiv-Status konnte nicht geändert werden");
        }
    }

    function requestDelete(item: FahrzeugResource) {
        if (!item.id) return;
        setConfirmItem(item);
    }

    async function doConfirmDelete() {
        if (!confirmItem?.id) return;
        setConfirmBusy(true);
        try {
            await deleteFahrzeug(confirmItem.id);
            showToast("success", "Fahrzeug gelöscht");
            setItems((prev) => prev.filter((x) => x.id !== confirmItem.id));
            setTotal((t) => Math.max(0, t - 1));
            setConfirmItem(null);
        } catch (e: any) {
            showToast("error", e?.message ?? "Löschen fehlgeschlagen");
        } finally {
            setConfirmBusy(false);
        }
    }

    // Regions aus Items für Filter
    const allRegions = useMemo(() => {
        const set = new Set<string>();
        items.forEach((i) => (i.regionen ?? []).forEach((r) => set.add(r)));
        return Array.from(set).sort();
    }, [items]);

    return (
        <div className="container py-4">
            {/* Header */}
            <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
                <div>
                    <h2 className="h4 mb-0">Fahrzeug-Übersicht</h2>
                    <div className="text-muted small">
                        {state === "loading" ? "Lade Fahrzeuge…" : `${total} Fahrzeuge gefunden`}
                    </div>
                </div>
                <div className="d-flex gap-2">
                    <div className="form-check form-switch align-self-center">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="onlyActive"
                            checked={onlyActive}
                            onChange={(e) => setOnlyActive(e.currentTarget.checked)}
                        />
                        <label className="form-check-label" htmlFor="onlyActive">
                            nur aktive
                        </label>
                    </div>
                    <button className="btn btn-outline-primary rounded-3" onClick={() => navigate('/fleet')}>
                        <i className="ci-navigation me-2" /> Live-Map
                    </button>
                    <button className="btn btn-dark rounded-3" onClick={openCreate}>
                        <i className="ci-plus me-2" /> Neues Fahrzeug
                    </button>
                </div>
            </div>

            {/* Filter Row */}
            <div className="row g-2 mb-3">
                <div className="col-12 col-md-6">
                    <div className="input-group">
                        <span className="input-group-text">
                            <i className="ci-search" />
                        </span>
                        <input
                            className="form-control"
                            placeholder="Suche Kennzeichen, Name, Bemerkung…"
                            value={q}
                            onChange={(e) => {
                                setQ(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </div>
                <div className="col-12 col-md-3">
                    <select
                        className="form-select"
                        value={region}
                        onChange={(e) => {
                            setRegion(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">Alle Regionen</option>
                        {allRegions.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-6 col-md-2">
                    <select
                        className="form-select"
                        value={limit}
                        onChange={(e) => {
                            setLimit(parseInt(e.target.value, 10));
                            setPage(1);
                        }}
                    >
                        {[6, 12, 24, 48].map((n) => (
                            <option key={n} value={n}>
                                {n} / Seite
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Error */}
            {state === "error" && (
                <div className="alert alert-danger">
                    <i className="ci-close-circle me-2" />
                    {errorMsg || "Fehler beim Laden"}
                </div>
            )}

            {/* Grid */}
            <div className="row g-3">
                {items.map((item) => (
                    <div key={item.id} className="col-12 col-sm-6 col-lg-4">
                        <div className={cx("card h-100 shadow-sm", !item.aktiv && "border-warning")}>
                            <div className="card-body d-flex flex-column">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <h5 className="card-title mb-0">
                                        {item.kennzeichen}
                                        {!item.aktiv && <span className="badge bg-warning ms-2">inaktiv</span>}
                                    </h5>
                                    <div className="btn-group">
                                        <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(item)} title="Bearbeiten">
                                            <i className="ci-edit" />
                                        </button>
                                        <button className="btn btn-sm btn-outline-danger" onClick={() => requestDelete(item)} title="Löschen">
                                            <i className="ci-trash" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-2 text-muted small">{item.name || "—"}</div>

                                <div className="d-flex flex-wrap gap-2 mb-3">
                                    <span className="badge bg-info-subtle text-info">
                                        max: {item.maxGewichtKg?.toLocaleString()} kg
                                    </span>
                                    {(item.regionen ?? []).slice(0, 5).map((r) => (
                                        <span key={r} className="badge bg-secondary-subtle text-secondary">
                                            {r}
                                        </span>
                                    ))}
                                    {(item.regionen?.length ?? 0) > 5 && (
                                        <span className="badge bg-secondary-subtle text-secondary">
                                            +{(item.regionen!.length - 5)} mehr
                                        </span>
                                    )}
                                </div>

                                {item.bemerkung && (
                                    <p className="text-muted small flex-grow-1">{item.bemerkung}</p>
                                )}

                                <div className="d-flex align-items-center justify-content-between mt-auto">
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id={`active-${item.id}`}
                                            checked={item.aktiv}
                                            onChange={() => toggleAktiv(item)}
                                        />
                                        <label className="form-check-label" htmlFor={`active-${item.id}`}>
                                            aktiv
                                        </label>
                                    </div>
                                    <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(item)}>
                                        Details
                                    </button>
                                </div>
                            </div>
                            <div className="card-footer d-flex justify-content-between small text-muted">
                                <span>
                                    <i className="ci-time me-1" />
                                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}
                                </span>
                                <span>
                                    {item.samsaraVehicleId ? (
                                        <span className="text-truncate" title={`Samsara: ${item.samsaraVehicleId}`}>
                                            Samsara: {item.samsaraVehicleId}
                                        </span>
                                    ) : (
                                        <span className="text-muted">kein Samsara</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {state === "success" && items.length === 0 && (
                    <div className="col-12">
                        <div className="text-center text-muted py-5">
                            <i className="ci-truck fs-1 d-block mb-3" />
                            Keine Fahrzeuge gefunden.
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <nav className="d-flex justify-content-center mt-4">
                    <ul className="pagination">
                        <li className={cx("page-item", page === 1 && "disabled")}>
                            <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                Zurück
                            </button>
                        </li>
                        {Array.from({ length: pages }).slice(0, 7).map((_, idx) => {
                            const p = idx + 1;
                            return (
                                <li key={p} className={cx("page-item", p === page && "active")}>
                                    <button className="page-link" onClick={() => setPage(p)}>
                                        {p}
                                    </button>
                                </li>
                            );
                        })}
                        <li className={cx("page-item", page === pages && "disabled")}>
                            <button className="page-link" onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                                Weiter
                            </button>
                        </li>
                    </ul>
                </nav>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="modal d-block" tabIndex={-1} role="dialog">
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Neues Fahrzeug</h5>
                                <button type="button" className="btn-close" onClick={closeModals} />
                            </div>
                            <div className="modal-body">
                                <FahrzeugForm
                                    form={form}
                                    setForm={setForm}
                                    formErrors={formErrors}
                                    setFormErrors={setFormErrors}
                                />
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-light" onClick={closeModals} disabled={saving}>
                                    Abbrechen
                                </button>
                                <button className="btn btn-primary" onClick={submitCreate} disabled={saving}>
                                    {saving ? "Speichern…" : "Anlegen"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEdit && (
                <div className="modal d-block" tabIndex={-1} role="dialog">
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Fahrzeug bearbeiten</h5>
                                <button type="button" className="btn-close" onClick={closeModals} />
                            </div>
                            <div className="modal-body">
                                <FahrzeugForm
                                    form={form}
                                    setForm={setForm}
                                    formErrors={formErrors}
                                    setFormErrors={setFormErrors}
                                />
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-light" onClick={closeModals} disabled={saving}>
                                    Abbrechen
                                </button>
                                <button className="btn btn-primary" onClick={submitEdit} disabled={saving}>
                                    {saving ? "Speichern…" : "Speichern"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {confirmItem && (
                <ConfirmModal
                    title="Fahrzeug löschen?"
                    message={
                        <>
                            Möchtest du das Fahrzeug <strong>„{confirmItem.kennzeichen}”</strong> wirklich löschen?
                            <div className="text-muted small mt-2">Dieser Vorgang kann nicht rückgängig gemacht werden.</div>
                        </>
                    }
                    confirmText="Ja, löschen"
                    onConfirm={doConfirmDelete}
                    onCancel={() => { if (!confirmBusy) setConfirmItem(null); }}
                    busy={confirmBusy}
                />
            )}

            {/* Toast */}
            {toast && (
                <div
                    className={cx(
                        "toast align-items-center text-bg-" + (toast.type === "success" ? "success" : "danger"),
                        "border-0 position-fixed bottom-0 end-0 m-3 show"
                    )}
                    role="alert"
                >
                    <div className="d-flex">
                        <div className="toast-body">{toast.msg}</div>
                        <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} />
                    </div>
                </div>
            )}
        </div>
    );
}

/* ----------------------- Unterkomponente: Form ----------------------- */

function FahrzeugForm({
    form,
    setForm,
    formErrors,
    setFormErrors,
}: {
    form: FahrzeugResource;
    setForm: React.Dispatch<React.SetStateAction<FahrzeugResource>>;
    formErrors: Record<string, string>;
    setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
    const [regionInput, setRegionInput] = useState<string>((form.regionen ?? []).join(", "));

    useEffect(() => {
        // Sync in → out, wenn Form wechselt
        setRegionInput((form.regionen ?? []).join(", "));
    }, [form.id]);

    function onRegionsBlur() {
        const regions = regionInput
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        setForm((f) => ({ ...f, regionen: regions }));
    }

    return (
        <form onSubmit={(e) => e.preventDefault()}>
            <div className="row g-3">
                <div className="col-md-4">
                    <label className="form-label">Kennzeichen *</label>
                    <input
                        className={cx("form-control", formErrors.kennzeichen && "is-invalid")}
                        placeholder="B-AB 1234"
                        value={form.kennzeichen}
                        onChange={(e) => {
                            setForm({ ...form, kennzeichen: e.target.value.toUpperCase() });
                            setFormErrors((fe) => ({ ...fe, kennzeichen: "" }));
                        }}
                    />
                    {formErrors.kennzeichen && <div className="invalid-feedback">{formErrors.kennzeichen}</div>}
                </div>
                <div className="col-md-4">
                    <label className="form-label">Name</label>
                    <input
                        className="form-control"
                        placeholder="z. B. 7.5t Sprinter"
                        value={form.name ?? ""}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                </div>
                <div className="col-md-4">
                    <label className="form-label">Max. Gewicht (kg) *</label>
                    <input
                        type="number"
                        min={0}
                        className={cx("form-control", formErrors.maxGewichtKg && "is-invalid")}
                        value={form.maxGewichtKg ?? 0}
                        onChange={(e) => {
                            setForm({ ...form, maxGewichtKg: Number(e.target.value) });
                            setFormErrors((fe) => ({ ...fe, maxGewichtKg: "" }));
                        }}
                    />
                    {formErrors.maxGewichtKg && <div className="invalid-feedback">{formErrors.maxGewichtKg}</div>}
                </div>

                <div className="col-md-6">
                    <label className="form-label">Regionen (kommagetrennt)</label>
                    <input
                        className="form-control"
                        placeholder="Berlin, Potsdam"
                        value={regionInput}
                        onChange={(e) => setRegionInput(e.target.value)}
                        onBlur={onRegionsBlur}
                    />
                    <div className="form-text">Optionale Einsatzgebiete, z. B. “Berlin, Potsdam”.</div>
                </div>

                <div className="col-md-6">
                    <label className="form-label">Samsara Vehicle ID</label>
                    <input
                        className="form-control"
                        placeholder="optional"
                        value={form.samsaraVehicleId ?? ""}
                        onChange={(e) => setForm({ ...form, samsaraVehicleId: e.target.value })}
                    />
                </div>

                <div className="col-12">
                    <label className="form-label">Bemerkung</label>
                    <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Notizen, spezielle Hinweise…"
                        value={form.bemerkung ?? ""}
                        onChange={(e) => setForm({ ...form, bemerkung: e.target.value })}
                    />
                </div>

                <div className="col-12 d-flex align-items-center">
                    <div className="form-check form-switch">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="aktivSwitch"
                            checked={!!form.aktiv}
                            onChange={(e) => setForm({ ...form, aktiv: e.currentTarget.checked })}
                        />
                        <label className="form-check-label" htmlFor="aktivSwitch">
                            aktiv
                        </label>
                    </div>
                </div>
            </div>
        </form>
    );
}
