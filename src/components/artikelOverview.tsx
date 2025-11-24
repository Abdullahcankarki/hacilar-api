import React, { useEffect, useRef, useState } from "react";
import type { ArtikelResource } from "../Resources";
import {
  getAllArtikelClean,
  createArtikel,
  updateArtikel,
  deleteArtikel,
} from "../backend/api";
import { useNavigate } from "react-router-dom";

// ---- Utility: debounce ------------------------------------------------------
function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ---- Toasts (Bootstrap) -----------------------------------------------------
type ToastMsg = { id: number; title?: string; message: string; variant?: "success" | "danger" | "warning" | "info" };

function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const idRef = useRef(1);
  const showToast = (msg: Omit<ToastMsg, 'id'>) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, ...msg }]);
    // auto-hide
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), 4200);
  };
  const removeToast = (id: number) => setToasts((t) => t.filter(x => x.id !== id));
  return { toasts, showToast, removeToast };
}

// ---- Modals -----------------------------------------------------------------

type CreateEditModalProps = {
  mode: "create" | "edit";
  show: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<ArtikelResource>;
};

const emptyArtikel: ArtikelResource = {
  name: "",
  preis: 0,
  artikelNummer: "",
  beschreibung: "",
  kategorie: "",
  gewichtProStueck: undefined,
  gewichtProKarton: undefined,
  gewichtProKiste: undefined,
  bildUrl: "",
  ausverkauft: false,
  erfassungsModus: "GEWICHT",
};

function CreateEditModal({ mode, show, onClose, onSaved, initial }: CreateEditModalProps) {
  const [form, setForm] = useState<ArtikelResource>({ ...emptyArtikel, ...(initial as any) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});

  useEffect(() => {
    if (show) {
      setForm({ ...emptyArtikel, ...(initial as any) });
      setError(null);
      setTouched({});
    }
  }, [show, initial]);

  const title = mode === "create" ? "Neuen Artikel erstellen" : `Artikel bearbeiten (#${initial?.artikelNummer ?? ""})`;

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as any;
    setTouched((t) => ({ ...t, [name]: true }));
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "preis" || name.startsWith("gewichtPro") ? Number(value) : value,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        await createArtikel({
          name: form.name,
          preis: Number(form.preis),
          artikelNummer: form.artikelNummer,
          kategorie: form.kategorie,
          gewichtProStueck: form.gewichtProStueck || undefined,
          gewichtProKarton: form.gewichtProKarton || undefined,
          gewichtProKiste: form.gewichtProKiste || undefined,
          beschreibung: form.beschreibung,
          bildUrl: form.bildUrl,
          ausverkauft: !!form.ausverkauft,
          erfassungsModus: form.erfassungsModus,
        });
      } else if (form.id) {
        await updateArtikel(form.id, {
          name: form.name,
          preis: Number(form.preis),
          artikelNummer: form.artikelNummer,
          kategorie: form.kategorie,
          gewichtProStueck: form.gewichtProStueck || undefined,
          gewichtProKarton: form.gewichtProKarton || undefined,
          gewichtProKiste: form.gewichtProKiste || undefined,
          beschreibung: form.beschreibung,
          bildUrl: form.bildUrl,
          ausverkauft: !!form.ausverkauft,
          erfassungsModus: form.erfassungsModus,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`modal fade ${show ? "show d-block" : ""}`} tabIndex={-1} role="dialog" aria-modal={show}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <form onSubmit={onSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger d-flex align-items-start" role="alert">
                  <i className="ci-warning me-2 mt-1"></i>
                  <div>
                    <div className="fw-semibold">Speichern fehlgeschlagen</div>
                    <div className="small">{error}</div>
                  </div>
                </div>
              )}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Name*</label>
                  <input className={`form-control ${touched.name && !form.name ? 'is-invalid' : ''}`} name="name" value={form.name} onChange={onChange} required />
                  <div className="invalid-feedback">Bitte einen Namen angeben.</div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Artikel-Nr.*</label>
                  <input className={`form-control ${touched.artikelNummer && !form.artikelNummer ? 'is-invalid' : ''}`} name="artikelNummer" value={form.artikelNummer} onChange={onChange} required />
                  <div className="invalid-feedback">Bitte eine Artikelnummer angeben.</div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Preis (€)*</label>
                  <input type="number" step="0.01" className={`form-control ${touched.preis && (form.preis === undefined || form.preis === null) ? 'is-invalid' : ''}`} name="preis" value={form.preis} onChange={onChange} required />
                  <div className="invalid-feedback">Bitte einen Preis angeben.</div>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Kategorie</label>
                  <input className="form-control" name="kategorie" value={form.kategorie || ""} onChange={onChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Erfassungsmodus</label>
                  <select className="form-select" name="erfassungsModus" value={form.erfassungsModus || "GEWICHT"} onChange={onChange}>
                    <option value="GEWICHT">GEWICHT</option>
                    <option value="KARTON">KARTON</option>
                    <option value="STÜCK">STÜCK</option>
                  </select>
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="ausverkauftCheck" name="ausverkauft" checked={!!form.ausverkauft} onChange={onChange} />
                    <label className="form-check-label" htmlFor="ausverkauftCheck">Ausverkauft</label>
                  </div>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Gewicht pro Stück (kg)</label>
                  <input type="number" step="0.001" className="form-control" name="gewichtProStueck" value={form.gewichtProStueck ?? ""} onChange={onChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Gewicht pro Karton (kg)</label>
                  <input type="number" step="0.001" className="form-control" name="gewichtProKarton" value={form.gewichtProKarton ?? ""} onChange={onChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Gewicht pro Kiste (kg)</label>
                  <input type="number" step="0.001" className="form-control" name="gewichtProKiste" value={form.gewichtProKiste ?? ""} onChange={onChange} />
                </div>

                <div className="col-12">
                  <label className="form-label">Bild-URL</label>
                  <input className="form-control" name="bildUrl" value={form.bildUrl || ""} onChange={onChange} placeholder="https://…" />
                </div>

                <div className="col-12">
                  <label className="form-label">Beschreibung</label>
                  <textarea className="form-control" name="beschreibung" rows={3} value={form.beschreibung || ""} onChange={onChange} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Abbrechen</button>
              <button type="submit" className="btn btn-secondary" disabled={saving}>
                {saving ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

type DeleteModalProps = {
  show: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  item?: ArtikelResource | null;
  busy?: boolean;
  error?: string | null;
};

function DeleteModal({ show, onClose, onConfirm, item, busy, error }: DeleteModalProps) {
  return (
    <div className={`modal fade ${show ? "show d-block" : ""}`} tabIndex={-1} role="dialog" aria-modal={show}>
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Artikel löschen</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger mb-3">{error}</div>}
            <p className="mb-0">
              Soll der Artikel <strong>{item?.name}</strong> (#{item?.artikelNummer}) wirklich gelöscht werden?
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Abbrechen</button>
            <button type="button" className="btn btn-danger" onClick={() => onConfirm()} disabled={busy}>
              {busy ? "Löschen…" : "Löschen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ---------------------------------------------------------

const PAGE_LIMIT = 24; // 12/24 for grid density with ~300 items

export default function ArtikelOverviewAdmin() {
  const { toasts, showToast, removeToast } = useToasts();
  // Query state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_LIMIT);
  const [sortOption, setSortOption] = useState<'nameAsc' | 'nameDesc' | 'preisAsc' | 'preisDesc' | 'kategorieAsc'>('nameAsc');
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [name, setName] = useState("");
  const [kategorie, setKategorie] = useState<string>("");
  const [ausverkauft, setAusverkauft] = useState<undefined | boolean>(undefined);
  const [erfassungsModus, setErfassungsModus] = useState<string>("");

  const debouncedName = useDebouncedValue(name, 400);

  // Data state
  const [items, setItems] = useState<ArtikelResource[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<ArtikelResource | null>(null);
  const [delItem, setDelItem] = useState<ArtikelResource | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllArtikelClean({
        page,
        limit,
        name: debouncedName || undefined,
        kategorie: kategorie || undefined,
        ausverkauft,
        erfassungsModus: erfassungsModus || undefined,
        // Sortierung an Backend übergeben
        sortBy:
          sortOption === "preisAsc" || sortOption === "preisDesc"
            ? "preis"
            : sortOption === "kategorieAsc"
            ? "kategorie"
            : "name",
        sortDir:
          sortOption === "nameDesc" || sortOption === "preisDesc"
            ? "desc"
            : "asc",
      });
      setItems(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err: any) {
      setError(err?.message || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, debouncedName, kategorie, ausverkauft, erfassungsModus, sortOption]);

  // Reset page when filters change (except page/limit)
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedName, kategorie, ausverkauft, erfassungsModus, sortOption]);

  const onCreateSaved = () => { showToast({ variant: 'success', title: 'Artikel', message: 'Artikel erstellt.' }); fetchData(); };
  const onEditSaved = () => { showToast({ variant: 'success', title: 'Artikel', message: 'Artikel aktualisiert.' }); fetchData(); };

  const onDeleteConfirm = async () => {
    if (!delItem?.id) return;
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      await deleteArtikel(delItem.id);
      setDelItem(null);
      showToast({ variant: 'success', title: 'Artikel', message: 'Artikel gelöscht.' });
      fetchData();
    } catch (err: any) {
      setDeleteErr(err?.message || "Fehler beim Löschen");
      showToast({ variant: 'danger', title: 'Fehler', message: 'Löschen fehlgeschlagen.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  // Derived
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  function buildPageWindow(current: number, total: number): (number | '…')[] {
    if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
    const window: (number | '…')[] = [];
    const push = (v: number | '…') => { if (window[window.length - 1] !== v) window.push(v); };
    const start = Math.max(2, current - 2);
    const end = Math.min(total - 1, current + 2);
    push(1);
    if (start > 2) push('…');
    for (let p = start; p <= end; p++) push(p);
    if (end < total - 1) push('…');
    push(total);
    return window;
  }

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="h4 mb-1">Artikelverwaltung</h2>
          <div className="text-muted small">{total} Artikel gesamt</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="btn-group" role="group" aria-label="Ansicht wechseln">
            <button
              type="button"
              className={`btn btn-sm btn-outline-secondary ${viewMode === "grid" ? "active" : ""}`}
              title="Kachel-Ansicht"
              onClick={() => setViewMode("grid")}
            >
              <i className="ci-view-grid me-1" /> Kacheln
            </button>
            <button
              type="button"
              className={`btn btn-sm btn-outline-secondary ${viewMode === "table" ? "active" : ""}`}
              title="Tabellen-Ansicht"
              onClick={() => setViewMode("table")}
            >
              <i className="ci-view-list me-1" /> Tabelle
            </button>
          </div>
          <button className="btn btn-dark rounded-3" onClick={() => setShowCreate(true)}>
            <i className="ci-plus me-2" /> Artikel erstellen
          </button>
        </div>
      </div>

      {/* Filters (Cartzilla/Bootstrap form row) */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Suche (Name)</label>
              <div className="position-relative">
                <input
                  className="form-control"
                  placeholder="z.B. Filet"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <span className="position-absolute top-50 end-0 translate-middle-y pe-3 text-muted">
                  <i className="ci-search" />
                </span>
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label">Kategorie</label>
              <input
                className="form-control"
                value={kategorie}
                onChange={(e) => setKategorie(e.target.value)}
                placeholder="z.B. Rind"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Erfassungsmodus</label>
              <select className="form-select" value={erfassungsModus} onChange={(e) => setErfassungsModus(e.target.value)}>
                <option value="">Alle</option>
                <option value="GEWICHT">GEWICHT</option>
                <option value="KARTON">KARTON</option>
                <option value="STÜCK">STÜCK</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Verfügbarkeit</label>
              <select
                className="form-select"
                value={String(ausverkauft)}
                onChange={(e) => setAusverkauft(e.target.value === "undefined" ? undefined : e.target.value === "true")}
              >
                <option value="undefined">Alle</option>
                <option value="false">Verfügbar</option>
                <option value="true">Ausverkauft</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Meta / pagination header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-2">
        <div className="text-muted small mb-2 mb-md-0">
          {total > 0 ? (
            <>Zeige <strong>{from}</strong>–<strong>{to}</strong> von <strong>{total}</strong></>
          ) : (
            <>Keine Ergebnisse</>
          )}
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap justify-content-end">
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small mb-0">Sortierung</label>
            <select
              className="form-select form-select-sm"
              style={{ minWidth: 170 }}
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
            >
              <option value="nameAsc">Name A–Z</option>
              <option value="nameDesc">Name Z–A</option>
              <option value="preisAsc">Preis aufsteigend</option>
              <option value="preisDesc">Preis absteigend</option>
              <option value="kategorieAsc">Kategorie A–Z</option>
            </select>
          </div>
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small mb-0">Pro Seite</label>
            <select
              className="form-select form-select-sm"
              style={{ width: 90 }}
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
              <option value={1000}>1000</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      {loading ? (
        <div className="row g-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div className="col-6 col-md-4 col-lg-3" key={i}>
              <div className="card placeholder-wave border-0 shadow-sm" style={{ minHeight: 280 }}>
                <div className="ratio ratio-4x3 placeholder" />
                <div className="card-body">
                  <div className="placeholder col-7 mb-2" />
                  <div className="placeholder col-4 mb-2" />
                  <div className="placeholder col-9" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "grid" ? (
        <div className="row g-3">
          {items.map((a) => (
            <div className="col-6 col-md-4 col-lg-3" key={a.id}>
              <div className="card product-card border-0 shadow-sm h-100">
                <div className="position-relative">
                  {a.ausverkauft && (
                    <span className="badge bg-warning position-absolute m-2">Ausverkauft</span>
                  )}
                  <div className="ratio ratio-4x3 bg-light">
                    {a.bildUrl ? (
                      <img src={a.bildUrl} alt={a.name} className="rounded" style={{ objectFit: "cover" }} />
                    ) : (
                      <img src={"https://cartzilla-html.createx.studio/assets/img/shop/grocery/10.png"} alt={a.name} className="rounded" style={{ objectFit: "cover" }} />
                    )}
                  </div>
                </div>
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <h3 className="product-title h6 mb-0 text-truncate" title={a.name}>{a.name}</h3>
                    <div className="text-primary fw-semibold">{a.preis.toFixed(2)} €</div>
                  </div>
                  <div className="text-muted small mb-2">#{a.artikelNummer} • {a.kategorie || "—"} • {a.erfassungsModus || "GEWICHT"}</div>
                  <div className="mt-auto d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/artikel/${a.id}`)} title="Details">
                      Details
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditItem(a)} title="Bearbeiten">
                      <i className="ci-edit me-1"/>
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => setDelItem(a)} title="Löschen">
                      <i className="ci-trash"/>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 60 }}></th>
                    <th>Artikel</th>
                    <th>Artikel-Nr.</th>
                    <th>Kategorie</th>
                    <th>Erfassungsmodus</th>
                    <th className="text-end">Preis (€)</th>
                    <th>Verfügbarkeit</th>
                    <th className="text-end">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="ratio ratio-1x1 bg-light rounded" style={{ width: 48 }}>
                          {a.bildUrl ? (
                            <img src={a.bildUrl} alt={a.name} className="rounded" style={{ objectFit: "cover" }} />
                          ) : (
                            <img src={"https://cartzilla-html.createx.studio/assets/img/shop/grocery/10.png"} alt={a.name} className="rounded" style={{ objectFit: "cover" }} />
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="fw-semibold text-truncate" title={a.name}>{a.name}</div>
                        <div className="text-muted small">#{a.artikelNummer}</div>
                      </td>
                      <td>{a.artikelNummer}</td>
                      <td>{a.kategorie || "—"}</td>
                      <td>{a.erfassungsModus || "GEWICHT"}</td>
                      <td className="text-end">{a.preis.toFixed(2)} €</td>
                      <td>
                        {a.ausverkauft ? (
                          <span className="badge bg-warning">Ausverkauft</span>
                        ) : (
                          <span className="badge bg-success">Verfügbar</span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm" role="group">
                          <button className="btn btn-outline-secondary" onClick={() => navigate(`/artikel/${a.id}`)} title="Details">
                            <i className="ci-eye" />
                          </button>
                          <button className="btn btn-outline-secondary" onClick={() => setEditItem(a)} title="Bearbeiten">
                            <i className="ci-edit" />
                          </button>
                          <button className="btn btn-outline-danger" onClick={() => setDelItem(a)} title="Löschen">
                            <i className="ci-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        Keine Artikel im aktuellen Filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <nav className="d-flex justify-content-center mt-4" aria-label="Pagination">
          <ul className="pagination">
            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))}>Zurück</button>
            </li>
            {buildPageWindow(page, pages).map((p, idx) =>
              p === '…' ? (
                <li key={`ellipsis-${idx}`} className="page-item disabled"><span className="page-link">…</span></li>
              ) : (
                <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                  <button className="page-link" onClick={() => setPage(p as number)}>{p}</button>
                </li>
              )
            )}
            <li className={`page-item ${page === pages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage((p) => Math.min(pages, p + 1))}>Weiter</button>
            </li>
          </ul>
        </nav>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateEditModal mode="create" show={showCreate} onClose={() => setShowCreate(false)} onSaved={onCreateSaved} />
      )}
      {editItem && (
        <CreateEditModal mode="edit" show={!!editItem} onClose={() => setEditItem(null)} onSaved={onEditSaved} initial={editItem} />
      )}
      {delItem && (
        <DeleteModal show={!!delItem} onClose={() => setDelItem(null)} onConfirm={onDeleteConfirm} item={delItem} busy={deleteBusy} error={deleteErr} />
      )}
      {/* Toasts */}
      <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 1080 }}>
        {toasts.map(t => (
          <div key={t.id} className={`toast show align-items-center text-bg-${t.variant ?? 'info'} border-0 mb-2`} role="alert">
            <div className="d-flex">
              <div className="toast-body">
                {t.title && <strong className="me-2">{t.title}</strong>}{t.message}
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => removeToast(t.id)}></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
