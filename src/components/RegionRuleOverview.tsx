// frontend/src/components/RegionRuleOverview.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
    getAllRegionRules,
    createRegionRule,
    updateRegionRule,
    deleteRegionRule,
} from "../backend/api";

export type RegionRuleResource = {
    id?: string;
    region: string;
    allowedWeekdays: number[];  // 1=Mo ... 7=So
    orderCutoff?: string;       // "HH:mm"
    exceptionDates?: string[];  // "YYYY-MM-DD"
    isActive: boolean;
};

type FetchState = "idle" | "loading" | "success" | "error";
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");
const WEEKDAY_SHORT: Record<number, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };
const WEEKDAY_LONG: Record<number, string> = { 1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag", 7: "Sonntag" };
const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function useDebounced<T>(value: T, delay = 350) {
    const [v, setV] = useState(value);
    useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
    return v;
}

/* =========================== Form Modal (Create/Edit) =========================== */

const RuleFormModal: React.FC<{
    mode: "create" | "edit";
    initial?: Partial<RegionRuleResource>;
    onCancel: () => void;
    onSaved: (saved: RegionRuleResource) => void;
}> = ({ mode, initial, onCancel, onSaved }) => {
    const isEdit = mode === "edit";
    const [region, setRegion] = useState(initial?.region ?? "");
    const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);
    const [allowedWeekdays, setAllowedWeekdays] = useState<number[]>(
        initial?.allowedWeekdays?.length ? [...(initial!.allowedWeekdays!)] : []
    );
    const [conflictHint, setConflictHint] = useState<string | null>(null);
    const [orderCutoff, setOrderCutoff] = useState<string>(initial?.orderCutoff ?? "");
    const [exceptions, setExceptions] = useState<string[]>(initial?.exceptionDates ?? []);
    const [chipInput, setChipInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function hasActiveConflict(regionName: string, currentId?: string) {
      const norm = (regionName || "").trim().toLowerCase();
      if (!norm) return false;
      try {
        // Hole eine kleine Menge aktiver Regeln und filtere clientseitig exakt nach Region
        const res = await getAllRegionRules({ q: regionName.trim(), active: true, page: 1, limit: 100 });
        const items = Array.isArray((res as any)?.items) ? (res as any).items as RegionRuleResource[] : [];
        return items.some((x) => (
          x && x.isActive === true &&
          typeof x.region === "string" && x.region.trim().toLowerCase() === norm &&
          x.id !== currentId
        ));
      } catch {
        // Bei API-Fehlern keine harte Blockade verursachen
        return false;
      }
    }

    function toggleWeekday(n: number) {
        setAllowedWeekdays(prev =>
            prev.includes(n) ? prev.filter(x => x !== n).sort((a, b) => a - b) : [...prev, n].sort((a, b) => a - b)
        );
    }

    function addException(raw: string) {
        const s = raw.trim();
        if (!s) return;
        if (!isYmd(s)) { setError("Ausnahmedatum muss ISO „YYYY-MM-DD“ sein."); return; }
        setError(null);
        setExceptions(prev => Array.from(new Set([...prev, s])));
        setChipInput("");
    }
    function onChipKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addException(chipInput);
        }
    }
    function onChipBlur() {
        if (chipInput.trim()) addException(chipInput);
    }
    function removeException(val: string) {
        setExceptions(prev => prev.filter(x => x !== val));
    }

    function validate(): string[] {
        const errs: string[] = [];
        if (!region.trim()) errs.push("Region ist erforderlich.");
        if (!allowedWeekdays.length) errs.push("Mindestens ein Wochentag auswählen.");
        // orderCutoff kommt aus <input type=\"time\"> und ist valide/leer
        if (chipInput.trim() && !isYmd(chipInput.trim())) errs.push("Unerfasster Ausnahmetag ist ungültig.");
        return errs;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const errs = validate();
        if (errs.length) { setError(errs.join(" ")); return; }
        setBusy(true);
        try {
            const payload: Omit<RegionRuleResource, "id"> = {
                region: region.trim(),
                allowedWeekdays: allowedWeekdays.slice().sort((a, b) => a - b),
                orderCutoff: orderCutoff || undefined, // „time“ liefert „HH:mm“ oder leeren String
                exceptionDates: exceptions,
                isActive,
            };
            const saved = isEdit && initial?.id
                ? await updateRegionRule(initial.id, payload)
                : await createRegionRule(payload);
            onSaved(saved);
        } catch (err: any) {
            setError(err?.message || "Unbekannter Fehler.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(30,33,37,.6)" }}>
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">{isEdit ? "Region‑Regel bearbeiten" : "Neue Region‑Regel"}</h5>
                        <button type="button" className="btn-close" onClick={onCancel} />
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger"><i className="ci-close-circle me-2" />{error}</div>}

                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label">Region *</label>
                                    <input
                                        className="form-control"
                                        value={region}
                                        onChange={(e) => { setRegion(e.target.value); setConflictHint(null); }}
                                        onBlur={async () => {
                                            if (!region.trim()) return;
                                            const c = await hasActiveConflict(region, isEdit ? initial?.id : undefined);
                                            setConflictHint(c ? "Achtung: Es existiert bereits eine aktive Regel für diese Region." : null);
                                        }}
                                    />
                                    {conflictHint && <div className="text-warning small mt-1">{conflictHint}</div>}
                                </div>

                                <div className="col-md-3">
                                    <label className="form-label">Bestell‑Cutoff</label>
                                    <input
                                        type="time"
                                        className="form-control"
                                        value={orderCutoff}
                                        onChange={(e) => setOrderCutoff(e.target.value)}
                                    />
                                    <div className="form-text">Format „HH:mm“, z. B. 14:00</div>
                                </div>

                                <div className="col-md-3">
                                    <label className="form-label">Status</label>
                                    <select className="form-select" value={isActive ? "1" : "0"} onChange={e => setIsActive(e.target.value === "1")}>
                                        <option value="1">Aktiv</option>
                                        <option value="0">Inaktiv</option>
                                    </select>
                                </div>

                                <div className="col-12">
                                    <label className="form-label d-block">Erlaubte Wochentage *</label>
                                    <div className="d-flex flex-wrap gap-2">
                                        {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                            <button
                                                key={n}
                                                type="button"
                                                className={cx("btn btn-sm", allowedWeekdays.includes(n) ? "btn-primary" : "btn-outline-secondary")}
                                                onClick={() => toggleWeekday(n)}
                                                title={WEEKDAY_LONG[n]}
                                            >
                                                {WEEKDAY_SHORT[n]}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="form-text">
                                        {allowedWeekdays.length
                                            ? allowedWeekdays.sort((a, b) => a - b).map(n => WEEKDAY_LONG[n]).join(", ")
                                            : "Bitte mindestens einen Tag wählen."}
                                    </div>
                                </div>

                                <div className="col-12">
                                    <label className="form-label">Ausnahmedaten</label>
                                    <div className="form-control" style={{ minHeight: 46 }}>
                                        <div className="d-flex flex-wrap gap-2">
                                            {exceptions.map(val => (
                                                <span key={val} className="badge bg-secondary-subtle text-secondary">
                                                    {val}
                                                    <button type="button" className="btn-close btn-close-white ms-2" aria-label="Remove" onClick={() => removeException(val)} />
                                                </span>
                                            ))}
                                            <input
                                                className="border-0 flex-grow-1"
                                                style={{ minWidth: 140, outline: "none" }}
                                                placeholder="YYYY‑MM‑DD"
                                                value={chipInput}
                                                onChange={(e) => setChipInput(e.target.value)}
                                                onKeyDown={onChipKeyDown}
                                                onBlur={onChipBlur}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-text">Enter/Komma fügt hinzu. Format „YYYY‑MM‑DD“.</div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>Abbrechen</button>
                            <button type="submit" className="btn btn-primary" disabled={busy}>
                                {busy && <span className="spinner-border spinner-border-sm me-2" />}
                                {isEdit ? "Speichern" : "Anlegen"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};


const ConfirmModal: React.FC<{
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}> = ({ title = "Löschen bestätigen", message, confirmText = "Löschen", cancelText = "Abbrechen", onConfirm, onCancel, busy }) => {
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
              <i className="ci-trash fs-4 me-3 text-danger"></i>
              <div>{message}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={!!busy}>{cancelText}</button>
            <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={!!busy}>
              {busy && <span className="spinner-border spinner-border-sm me-2" />} {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================================== Übersicht ================================== */

const RegionRuleOverview: React.FC = () => {
    const [items, setItems] = useState<RegionRuleResource[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(12);
    const [q, setQ] = useState("");
    const dQ = useDebounced(q, 350);
    const [region, setRegion] = useState("");
    const [active, setActive] = useState<"all" | "1" | "0">("all");
    const [state, setState] = useState<FetchState>("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [editRule, setEditRule] = useState<RegionRuleResource | null>(null);

    const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const [prefillForCreate, setPrefillForCreate] = useState<Partial<RegionRuleResource> | null>(null);
    const showToast = (type: "success" | "error", msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 2800); };
    const [confirmRule, setConfirmRule] = useState<RegionRuleResource | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    async function load() {
        setState("loading"); setErrorMsg("");
        try {
            const resp = await getAllRegionRules({
                q: dQ || undefined,
                region: region.trim() || undefined,
                active: active === "all" ? undefined : active === "1",
                page, limit,
            });
            if (!resp || !Array.isArray(resp.items)) throw new Error("Ungültige Serverantwort");
            setItems(resp.items);
            setTotal(typeof resp.total === "number" ? resp.total : resp.items.length);
            setState("success");
        } catch (e: any) {
            setErrorMsg(e?.message ?? "Fehler beim Laden");
            setState("error");
        }
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [dQ, region, active, page, limit]);

    const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

    function onSaved(saved: RegionRuleResource) {
        setShowCreate(false); setEditRule(null); setPrefillForCreate(null);
        setItems(prev => {
            const i = prev.findIndex(x => x.id === saved.id);
            if (i >= 0) { const clone = [...prev]; clone[i] = saved; return clone; }
            return [saved, ...prev].slice(0, limit);
        });
        load();
        showToast("success", "Regel gespeichert");
    }

    function requestDelete(item: RegionRuleResource) {
      if (!item?.id) return;
      setConfirmRule(item);
    }

    async function doConfirmDelete() {
      if (!confirmRule?.id) return;
      setConfirmBusy(true);
      try {
        await deleteRegionRule(confirmRule.id);
        setItems(prev => prev.filter(x => x.id !== confirmRule.id));
        setTotal(t => Math.max(0, t - 1));
        setConfirmRule(null);
        showToast("success", "Regel gelöscht");
      } catch (e: any) {
        showToast("error", e?.message ?? "Löschen fehlgeschlagen");
      } finally {
        setConfirmBusy(false);
      }
    }

    // Regions aus Items (Filteroptionen)
    const allRegions = useMemo(() => {
        const set = new Set<string>(); items.forEach(i => set.add(i.region));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [items]);

    return (
        <div className="container py-4">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h2 className="h4 mb-0">Region‑Regeln</h2>
                    <div className="text-muted small">{state === "loading" ? "Lade…" : `${total} Einträge`}</div>
                </div>
                <button
                    className="btn btn-dark rounded-3"
                    onClick={() => { setPrefillForCreate(null); setShowCreate(true); }}
                >
                    <i className="ci-plus me-2" /> Neue Regel
                </button>
            </div>

            {/* Filter */}
            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                    <div className="row g-2 align-items-end">
                        <div className="col-md-5">
                            <label className="form-label">Suche</label>
                            <div className="input-group">
                                <span className="input-group-text"><i className="ci-search" /></span>
                                <input className="form-control" placeholder="Region, Wochentage, Cutoff…"
                                    value={q}
                                    onChange={(e) => { setQ(e.target.value); setPage(1); }} />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Region</label>
                            <select className="form-select" value={region}
                                onChange={(e) => { setRegion(e.target.value); setPage(1); }}>
                                <option value="">Alle</option>
                                {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={active}
                                onChange={(e) => { setActive(e.target.value as any); setPage(1); }}>
                                <option value="all">Alle</option>
                                <option value="1">Aktiv</option>
                                <option value="0">Inaktiv</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">Pro Seite</label>
                            <select className="form-select" value={limit}
                                onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}>
                                {[6, 12, 24, 48].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error */}
            {state === "error" && (
                <div className="alert alert-danger"><i className="ci-close-circle me-2" />{errorMsg || "Fehler beim Laden"}</div>
            )}

            {/* Tabelle */}
            <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                    <table className="table align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Region</th>
                                <th>Wochentage</th>
                                <th>Cutoff</th>
                                <th>Ausnahmen</th>
                                <th>Status</th>
                                <th style={{ width: 220 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {state === "loading" && (
                                <tr><td colSpan={6} className="py-5 text-center"><div className="spinner-border" /></td></tr>
                            )}
                            {state === "success" && items.length === 0 && (
                                <tr><td colSpan={6} className="py-5 text-center text-muted">Keine Regeln gefunden.</td></tr>
                            )}
                            {state === "success" && items.map(r => (
                                <tr key={r.id}>
                                    <td className="fw-semibold">{r.region}</td>
                                    <td>
                                        <div className="d-flex flex-wrap gap-1">
                                            {r.allowedWeekdays?.length ? r.allowedWeekdays.sort((a, b) => a - b).map(n => (
                                                <span key={n} className="badge bg-secondary-subtle text-secondary" title={WEEKDAY_LONG[n]}>
                                                    {WEEKDAY_SHORT[n]}
                                                </span>
                                            )) : <span className="text-muted">—</span>}
                                        </div>
                                    </td>
                                    <td>{r.orderCutoff || <span className="text-muted">—</span>}</td>
                                    <td className="text-truncate" style={{ maxWidth: 280 }}>
                                        {r.exceptionDates?.length
                                            ? r.exceptionDates.slice(0, 5).join(", ") + (r.exceptionDates.length > 5 ? ` +${r.exceptionDates.length - 5}` : "")
                                            : <span className="text-muted">—</span>}
                                    </td>
                                    <td>{r.isActive ? <span className="badge bg-success">aktiv</span> : <span className="badge bg-secondary">inaktiv</span>}</td>
                                    <td className="text-end">
                                        {/* ...innerhalb der Actions-Zelle (td className="text-end") */}
                                        <div className="btn-group">
                                            <button className="btn btn-sm btn-outline-primary" onClick={() => setEditRule(r)}>
                                                <i className="ci-edit me-1" /> Bearbeiten
                                            </button>
                                            <button
                                                className="btn btn-sm btn-outline-success"
                                                onClick={() => {
                                                    // Create-Modal mit vorbefüllten Werten öffnen:
                                                    setEditRule(null);            // sicherstellen, dass wir im Create-Modus sind
                                                    setShowCreate(true);
                                                    setPrefillForCreate({
                                                        region: r.region,
                                                        allowedWeekdays: [...(r.allowedWeekdays ?? [])],
                                                        orderCutoff: r.orderCutoff,
                                                        exceptionDates: [...(r.exceptionDates ?? [])],
                                                        isActive: r.isActive, // du kannst hier auch immer true setzen, wenn gewünscht
                                                    });
                                                }}
                                                title="Regel duplizieren"
                                            >
                                                <i className="ci-copy me-1" /> Duplizieren
                                            </button>
                                            <button className="btn btn-sm btn-outline-danger" onClick={() => requestDelete(r)}>
                                                <i className="ci-trash me-1" /> Löschen
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pages > 1 && (
                    <div className="card-footer d-flex align-items-center justify-content-between">
                        <small className="text-muted">Seite {page} / {pages} — {total.toLocaleString()} Einträge</small>
                        <div className="btn-group">
                            <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                                <i className="ci-arrow-left me-1" /> Zurück
                            </button>
                            <button className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                                Weiter <i className="ci-arrow-right ms-1" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCreate && (
                <RuleFormModal
                    mode="create"
                    initial={prefillForCreate || undefined}
                    onCancel={() => { setShowCreate(false); setPrefillForCreate(null); }}
                    onSaved={onSaved}
                />
            )}
            {editRule && <RuleFormModal mode="edit" initial={editRule} onCancel={() => setEditRule(null)} onSaved={onSaved} />}

            {/* Confirm Delete Modal */}
            {confirmRule && (
              <ConfirmModal
                title="Regel löschen?"
                message={
                  <>
                    Möchtest du die Regel für <strong>„{confirmRule.region}”</strong> wirklich löschen?
                    <div className="text-muted small mt-2">Dieser Vorgang kann nicht rückgängig gemacht werden.</div>
                  </>
                }
                confirmText="Ja, löschen"
                onConfirm={doConfirmDelete}
                onCancel={() => { if (!confirmBusy) setConfirmRule(null); }}
                busy={confirmBusy}
              />
            )}

            {/* Toast */}
            {toast && (
                <div className={cx(
                    "toast align-items-center text-bg-" + (toast.type === "success" ? "success" : "danger"),
                    "border-0 position-fixed bottom-0 end-0 m-3 show"
                )} role="alert">
                    <div className="d-flex">
                        <div className="toast-body">{toast.msg}</div>
                        <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegionRuleOverview;