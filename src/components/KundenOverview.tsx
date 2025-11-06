// frontend/src/components/KundenOverview.tsx
import React, { useEffect, useMemo, useState } from "react";
import { KundeResource } from "../Resources";
import { getAllKunden, deleteKunde, updateKunde, approveKunde, createKunde } from "../backend/api";
import { useNavigate } from "react-router-dom";

type FetchState = "idle" | "loading" | "success" | "error";
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

/* ---------------------- Confirm Modal ---------------------- */
const ConfirmModal: React.FC<{
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}> = ({ title = "Löschen bestätigen", message, confirmText = "Löschen", cancelText = "Abbrechen", onConfirm, onCancel, busy }) => (
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
          <button className="btn btn-outline-secondary" onClick={onCancel} disabled={!!busy}>{cancelText}</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={!!busy}>
            {busy && <span className="spinner-border spinner-border-sm me-2" />} {confirmText}
          </button>
        </div>
      </div>
    </div>
  </div>
);

const CreateKundeModal: React.FC<{
  onCancel: () => void;
  onSaved: (created: KundeResource) => void;
}> = ({ onCancel, onSaved }) => {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [kundenNummer, setKundenNummer] = useState("");
  const [region, setRegion] = useState("");
  const [telefon, setTelefon] = useState("");
  const [adresse, setAdresse] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const payload: Partial<KundeResource> = {
        name: name.trim(),
        email: email.trim(),
        kundenNummer: kundenNummer.trim() || undefined,
        region: region.trim() || undefined,
        telefon: telefon.trim() || undefined,
        adresse: adresse.trim() || undefined,
        kategorie: kategorie.trim() || undefined,
      };
      const created = await createKunde(payload as any);
      onSaved(created);
    } catch (err: any) {
      setError(err?.message || "Erstellung fehlgeschlagen");
    } finally { setBusy(false); }
  }

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(30,33,37,.6)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">Neuen Kunden anlegen</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onCancel} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger"><i className="ci-close-circle me-2" />{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Name</label>
                  <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Kundennummer</label>
                  <input className="form-control" value={kundenNummer} onChange={(e) => setKundenNummer(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">E‑Mail</label>
                  <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Telefon</label>
                  <input className="form-control" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Region</label>
                  <input className="form-control" value={region} onChange={(e) => setRegion(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Adresse</label>
                  <input className="form-control" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Kategorie</label>
                  <input className="form-control" value={kategorie} onChange={(e) => setKategorie(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer mt-3">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
                <button type="submit" className="btn btn-success" disabled={busy}>
                  {busy && <span className="spinner-border spinner-border-sm me-2" />} Anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};


const EditKundeModal: React.FC<{
  initial: KundeResource;
  onCancel: () => void;
  onSaved: (updated: KundeResource) => void;
}> = ({ initial, onCancel, onSaved }) => {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initial.name || "");
  const [email, setEmail] = useState(initial.email || "");
  const [kundenNummer, setKundenNummer] = useState(initial.kundenNummer || "");
  const [region, setRegion] = useState(initial.region || "");
  const [telefon, setTelefon] = useState(initial.telefon || "");
  const [adresse, setAdresse] = useState(initial.adresse || "");
  const [error, setError] = useState<string>("");
  const [kategorie, setKategorie] = useState(initial.kategorie || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const payload: Partial<KundeResource> = {
        name: name.trim(),
        email: email.trim(),
        kundenNummer: kundenNummer.trim(),
        region: region.trim(),
        telefon: telefon.trim(),
        adresse: adresse.trim(),
        kategorie: kategorie.trim(),
      };
      const updated = await updateKunde(initial.id!, payload);
      onSaved(updated);
    } catch (err: any) {
      setError(err?.message || "Aktualisierung fehlgeschlagen");
    } finally { setBusy(false); }
  }

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(30,33,37,.6)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">Kunde bearbeiten</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onCancel} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger"><i className="ci-close-circle me-2" />{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Name</label>
                  <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Kundennummer</label>
                  <input className="form-control" value={kundenNummer} onChange={(e) => setKundenNummer(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">E‑Mail</label>
                  <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Telefon</label>
                  <input className="form-control" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Region</label>
                  <input className="form-control" value={region} onChange={(e) => setRegion(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Adresse</label>
                  <input className="form-control" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Kategorie</label>
                  <input className="form-control" value={kategorie} onChange={(e) => setKategorie(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer mt-3">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
                <button type="submit" className="btn btn-success" disabled={busy}>
                  {busy && <span className="spinner-border spinner-border-sm me-2" />} Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------------- Hauptkomponente ---------------------- */
const KundenOverview: React.FC = () => {
  const navigate = useNavigate();
  // Daten
  const [items, setItems] = useState<KundeResource[]>([]);
  const [total, setTotal] = useState(0);

  // UI-State
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string>("");

  // Filter & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search, 350);
  const [region, setRegion] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [isApproved, setIsApproved] = useState<"all" | "1" | "0">("all");
  const [sortBy, setSortBy] = useState<string>("-createdAt");

  // Delete-Confirm
  const [confirmItem, setConfirmItem] = useState<KundeResource | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Edit-Modal
  const [editItem, setEditItem] = useState<KundeResource | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2700);
  };

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function load() {
    setState("loading"); setError("");
    try {
      const resp = await getAllKunden({
        page, limit,
        search: dSearch || undefined,
        region: region.trim() || undefined,
        kategorie: kategorie.trim() || undefined,
        isApproved: isApproved === "all" ? undefined : isApproved === "1",
        sortBy,
      });
      setItems(resp.items);
      setTotal(resp.total);
      setState("success");
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Laden");
      setState("error");
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [dSearch, region, kategorie, isApproved, page, limit, sortBy]);

  /* ----------- Delete Flow ----------- */
  function requestDelete(item: KundeResource) {
    setConfirmItem(item);
  }
  async function doConfirmDelete() {
    if (!confirmItem?.id) return;
    setConfirmBusy(true);
    try {
      await deleteKunde(confirmItem.id);
      setConfirmItem(null);
      showToast("success", "Kunde gelöscht");
      // Optimistisch aktualisieren
      setItems(prev => prev.filter(x => x.id !== confirmItem.id));
      setTotal(t => Math.max(0, t - 1));
    } catch (e: any) {
      showToast("error", e?.message ?? "Löschen fehlgeschlagen");
    } finally {
      setConfirmBusy(false);
    }
  }

  /* ----------- UI Helpers ----------- */
  const emptyState = state === "success" && items.length === 0;
  const loadingState = state === "loading";

  // Regionsliste aus Items (für Filter)
  const regionOptions = useMemo(() => {
    const s = new Set<string>();
    items.forEach((k) => k.region && s.add(k.region));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const kategorieOptions = useMemo(() => {
    const s = new Set<string>();
    items.forEach((k) => k.kategorie && s.add(k.kategorie));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="h4 mb-1">Kunden</h2>
          <div className="text-muted small">
            {state === "loading" ? "Lade Kunden…" : `${total} Einträge gesamt`}
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-dark rounded-3" onClick={() => setCreateOpen(true)}>
            <i className="ci-plus me-2" /> Kunde erstellen
          </button>
        </div>
      </div>


      {/* Filters (Cartzilla/Bootstrap form row) */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Suche</label>
              <div className="position-relative">
                <input
                  className="form-control"
                  placeholder="z. B. Müller, 10023, Gastro…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                <span className="position-absolute top-50 end-0 translate-middle-y pe-3 text-muted">
                  <i className="ci-search" />
                </span>
              </div>
            </div>

            <div className="col-md-2">
              <label className="form-label">Region</label>
              <select
                className="form-select"
                value={region}
                onChange={(e) => { setRegion(e.target.value); setPage(1); }}
              >
                <option value="">Alle Regionen</option>
                {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label">Kategorie</label>
              <select
                className="form-select"
                value={kategorie}
                onChange={(e) => { setKategorie(e.target.value); setPage(1); }}
              >
                <option value="">Alle Kategorien</option>
                {kategorieOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={isApproved}
                onChange={(e) => { setIsApproved(e.target.value as any); setPage(1); }}
              >
                <option value="all">Alle</option>
                <option value="1">Freigeschaltet</option>
                <option value="0">Gesperrt</option>
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label">Sortierung</label>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                title="Sortierung"
              >
                <option value="-createdAt">Neueste zuerst</option>
                <option value="createdAt">Älteste zuerst</option>
                <option value="name">Name A–Z</option>
                <option value="-name">Name Z–A</option>
                <option value="region">Region A–Z</option>
                <option value="-region">Region Z–A</option>
                <option value="kategorie">Kategorie A–Z</option>
                <option value="-kategorie">Kategorie Z–A</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table/Card */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Name</th>
                <th>E‑Mail</th>
                <th>Kundennr.</th>
                <th>Region</th>
                <th>Kategorie</th>
                <th>Status</th>
                <th style={{ width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {loadingState && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={7}>
                    <div className="placeholder-glow py-3">
                      <span className="placeholder col-12" style={{ height: 18, display: "block" }}></span>
                    </div>
                  </td>
                </tr>
              ))}
              {state === "error" && (
                <tr>
                  <td colSpan={7} className="py-5">
                    <div className="alert alert-danger mb-0">
                      <i className="ci-close-circle me-2" />
                      {error || "Fehler beim Laden"}
                    </div>
                  </td>
                </tr>
              )}
              {emptyState && (
                <tr>
                  <td colSpan={7} className="py-5 text-center text-muted">
                    Keine Kunden gefunden.
                  </td>
                </tr>
              )}
              {state === "success" && items.map(k => (
                <tr key={k.id} onClick={() => navigate(`/kunden/${k.id}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="ratio ratio-1x1 bg-secondary-subtle rounded-circle" style={{ width: 28 }}>
                      <i className="ci-user text-secondary d-flex align-items-center justify-content-center" />
                    </div>
                  </td>
                  <td className="fw-semibold">{k.name || "—"}</td>
                  <td>{k.email || <span className="text-muted">—</span>}</td>
                  <td>{k.kundenNummer || <span className="text-muted">—</span>}</td>
                  <td>{k.region || <span className="text-muted">—</span>}</td>
                  <td>{k.kategorie || <span className="text-muted">—</span>}</td>
                  <td>
                    {k.isApproved
                      ? <span className="badge bg-success">freigeschaltet</span>
                      : <span className="badge bg-secondary">gesperrt</span>}
                  </td>
                  <td className="text-end">
                    <div className="btn-group">
                      <button className="btn btn-sm btn-outline-primary" title="Bearbeiten" onClick={(e) => { e.stopPropagation(); setEditItem(k); }}>
                        <i className="ci-edit me-1" /> Bearbeiten
                      </button>
                      <button
                        className={"btn btn-sm " + (k.isApproved ? "btn-outline-warning" : "btn-outline-success")}
                        title={k.isApproved ? "Sperren" : "Freischalten"}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const updated = await approveKunde(k.id!, !k.isApproved);
                            setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
                            showToast("success", updated.isApproved ? "Kunde freigeschaltet" : "Kunde gesperrt");
                          } catch (err: any) {
                            showToast("error", err?.message || "Aktion fehlgeschlagen");
                          }
                        }}
                      >
                        <i className={k.isApproved ? "ci-lock me-1" : "ci-unlock me-1"} /> {k.isApproved ? "Sperren" : "Freischalten"}
                      </button>
                      <button className="btn btn-sm btn-outline-danger" title="Löschen" onClick={(e) => { e.stopPropagation(); requestDelete(k); }}>
                        <i className="ci-trash me-1" /> Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="card-footer d-flex align-items-center justify-content-between">
          <small className="text-muted">Seite {page} / {pages} — {total.toLocaleString()} Einträge</small>
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group">
              <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <i className="ci-arrow-left me-1" /> Zurück
              </button>
              <button className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                Weiter <i className="ci-arrow-right ms-1" />
              </button>
            </div>
            <select className="form-select form-select-sm" style={{ width: 140 }} value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}>
              {[10, 12, 24, 48, 100].map(n => <option key={n} value={n}>{n}/Seite</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {
        confirmItem && (
          <ConfirmModal
            title="Kunde löschen?"
            message={<>
              Möchtest du <strong>„{confirmItem.name || confirmItem.email || confirmItem.kundenNummer}”</strong> wirklich löschen?
              <div className="text-muted small mt-2">Dieser Vorgang kann nicht rückgängig gemacht werden.</div>
            </>}
            confirmText="Ja, löschen"
            onConfirm={doConfirmDelete}
            onCancel={() => { if (!confirmBusy) setConfirmItem(null); }}
            busy={confirmBusy}
          />
        )
      }

      {
        editItem && (
          <EditKundeModal
            initial={editItem}
            onCancel={() => setEditItem(null)}
            onSaved={(upd) => {
              setItems(prev => prev.map(x => x.id === upd.id ? upd : x));
              setEditItem(null);
              showToast("success", "Kunde aktualisiert");
            }}
          />
        )
      }

      {
        createOpen && (
          <CreateKundeModal
            onCancel={() => setCreateOpen(false)}
            onSaved={(created) => {
              setItems(prev => [created, ...prev]);   // oben einfügen
              setTotal(t => t + 1);
              setCreateOpen(false);
              showToast("success", "Kunde erstellt");
            }}
          />
        )
      }

      {/* Toast */}
      {
        toast && (
          <div className={cx(
            "toast align-items-center text-bg-" + (toast.type === "success" ? "success" : "danger"),
            "border-0 position-fixed bottom-0 end-0 m-3 show"
          )} role="alert">
            <div className="d-flex">
              <div className="toast-body">{toast.msg}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} />
            </div>
          </div>
        )
      }
    </div >
  );
};

export default KundenOverview;