// MitarbeiterOverview.tsx – Premium UI (Cartzilla + Bootstrap) with Optimistic Updates & Tag Pills
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MitarbeiterResource, MitarbeiterRolle } from '../Resources';
import { api } from '../backend/api';

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

// ---- Toasts (lightweight) ----
interface Toast { id: number; kind: 'success'|'error'|'info'; text: string }
const Toasts: React.FC<{ list: Toast[]; onClose: (id:number)=>void }> = ({ list, onClose }) => (
  <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1080 }}>
    {list.map(t => (
      <div key={t.id} className={cx('toast show mb-2', t.kind === 'error' && 'border-danger', t.kind === 'success' && 'border-success')}>
        <div className="toast-header">
          <i className={cx('me-2', t.kind==='success'?'ci-check-circle text-success': t.kind==='error'?'ci-close-circle text-danger':'ci-info text-primary')} />
          <strong className="me-auto">{t.kind === 'success' ? 'Erfolg' : t.kind === 'error' ? 'Fehler' : 'Hinweis'}</strong>
          <button className="btn-close" onClick={()=>onClose(t.id)} />
        </div>
        <div className="toast-body">{t.text}</div>
      </div>
    ))}
  </div>
);

// ---- Confirm Modal ----
const ConfirmModal: React.FC<{ title?: string; message: React.ReactNode; onConfirm: () => void; onCancel: () => void; busy?: boolean; confirmText?: string; cancelText?: string; }>
= ({ title = 'Löschen bestätigen', message, onConfirm, onCancel, busy, confirmText = 'Löschen', cancelText = 'Abbrechen' }) => (
  <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: 'rgba(30,33,37,.6)' }}>
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

// ---- Role Pills Selector (chips) ----
const RolePills: React.FC<{ value: MitarbeiterRolle[]; onChange: (next: MitarbeiterRolle[])=>void; options: MitarbeiterRolle[] }>
= ({ value, onChange, options }) => {
  const toggle = (r: MitarbeiterRolle) => {
    const set = new Set(value);
    set.has(r) ? set.delete(r) : set.add(r);
    onChange(Array.from(set));
  };
  return (
    <div className="d-flex flex-wrap gap-2">
      {options.map(r => (
        <button
          key={r}
          type="button"
          onClick={()=>toggle(r)}
          className={cx('btn btn-sm rounded-pill', value.includes(r) ? 'btn-primary' : 'btn-outline-secondary')}
        >{r}</button>
      ))}
    </div>
  );
};

// ---- Edit Modal (pure form -> returns payload) ----
const EditMitarbeiterModal: React.FC<{
  initial: MitarbeiterResource;
  onCancel: () => void;
  onSubmit: (patch: Partial<MitarbeiterResource>) => void;
  busy?: boolean;
  availableRoles: MitarbeiterRolle[];
}> = ({ initial, onCancel, onSubmit, busy, availableRoles }) => {
  const [form, setForm] = useState<Partial<MitarbeiterResource>>({
    name: initial.name ?? '',
    email: initial.email ?? '',
    telefon: initial.telefon ?? '',
    abteilung: initial.abteilung ?? '',
    aktiv: initial.aktiv ?? true,
    bemerkung: initial.bemerkung ?? '',
    eintrittsdatum: initial.eintrittsdatum ?? '',
    rollen: initial.rollen ?? [],
  });
  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: 'rgba(30,33,37,.6)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">Mitarbeiter bearbeiten</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <form onSubmit={(e)=>{ e.preventDefault(); onSubmit({
              name: form.name?.trim(),
              email: form.email?.trim(),
              telefon: form.telefon?.trim(),
              abteilung: form.abteilung?.trim(),
              aktiv: !!form.aktiv,
              bemerkung: form.bemerkung?.trim(),
              eintrittsdatum: form.eintrittsdatum || undefined,
              rollen: (form.rollen || []) as MitarbeiterRolle[],
            }); }}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Name</label>
                  <input className="form-control" value={form.name || ''} onChange={(e)=>setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">E‑Mail</label>
                  <input type="email" className="form-control" value={form.email || ''} onChange={(e)=>setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Telefon</label>
                  <input className="form-control" value={form.telefon || ''} onChange={(e)=>setForm({ ...form, telefon: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Abteilung</label>
                  <input className="form-control" value={form.abteilung || ''} onChange={(e)=>setForm({ ...form, abteilung: e.target.value })} />
                </div>
                <div className="col-12">
                  <label className="form-label">Rollen</label>
                  <RolePills value={(form.rollen || []) as MitarbeiterRolle[]} onChange={(v)=>setForm({ ...form, rollen: v })} options={availableRoles} />
                </div>
                <div className="col-md-6">
                  <div className="form-check mt-2">
                    <input className="form-check-input" type="checkbox" id="edit-aktiv" checked={!!form.aktiv} onChange={(e)=>setForm({ ...form, aktiv: e.target.checked })} />
                    <label className="form-check-label" htmlFor="edit-aktiv">Aktiv</label>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Eintrittsdatum</label>
                  <input type="date" className="form-control" value={form.eintrittsdatum || ''} onChange={(e)=>setForm({ ...form, eintrittsdatum: e.target.value })} />
                </div>
                <div className="col-12">
                  <label className="form-label">Bemerkung</label>
                  <textarea className="form-control" value={form.bemerkung || ''} onChange={(e)=>setForm({ ...form, bemerkung: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer mt-3">
                <button type="button" className="btn btn-secondary" onClick={onCancel}><i className="ci-close me-2"/>Abbrechen</button>
                <button type="submit" className="btn btn-success" disabled={!!busy}>{busy && <span className="spinner-border spinner-border-sm me-2"/>} Speichern</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const MitarbeiterOverview: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<MitarbeiterResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [cardView, setCardView] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editItem, setEditItem] = useState<MitarbeiterResource | null>(null);
  const [confirmItem, setConfirmItem] = useState<MitarbeiterResource | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (kind: Toast['kind'], text: string) => setToasts((l)=>[...l, { id: Date.now()+Math.random(), kind, text }]);
  const removeToast = (id: number) => setToasts((l)=>l.filter(t=>t.id!==id));

  const availableRoles: MitarbeiterRolle[] = [
    'admin','verkauf','kommissionierung','kontrolle','buchhaltung','wareneingang','lager','fahrer','zerleger','statistik','kunde','support'
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(v =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.abteilung || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const emptyForm: Omit<MitarbeiterResource, 'id'> = { name: '', password: '', rollen: [], email: '', telefon: '', abteilung: '', aktiv: true, bemerkung: '', eintrittsdatum: '' };
  const [form, setForm] = useState<Omit<MitarbeiterResource, 'id'>>(emptyForm);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await api.getAllMitarbeiter();
      setItems(data);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Laden der Mitarbeiter');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ---- Create (Optimistic) ----
  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const temp: MitarbeiterResource = { ...form, id: `temp-${Date.now()}`, rollen: [...form.rollen] } as any;
    setItems(prev => [temp, ...prev]); // optimistic insert
    try {
      const created = await api.createMitarbeiter(form);
      setItems(prev => prev.map(x => x.id === temp.id ? created : x));
      setForm(emptyForm);
      setShowCreate(false);
      addToast('success', 'Mitarbeiter erstellt');
    } catch (err: any) {
      // rollback
      setItems(prev => prev.filter(x => x.id !== temp.id));
      addToast('error', err?.message || 'Erstellen fehlgeschlagen');
    } finally { setCreating(false); }
  };

  // ---- Edit (Optimistic) ----
  const handleEditSubmit = async (patch: Partial<MitarbeiterResource>) => {
    if (!editItem?.id) return;
    const id = editItem.id;
    const before = items.find(x => x.id === id);
    const optimistic: MitarbeiterResource = { ...editItem, ...patch } as MitarbeiterResource;
    setItems(prev => prev.map(x => x.id === id ? optimistic : x));
    setEditItem(null);
    try {
      const saved = await api.updateMitarbeiter(id, patch);
      setItems(prev => prev.map(x => x.id === id ? saved : x));
      addToast('success', 'Änderungen gespeichert');
    } catch (err: any) {
      // rollback
      if (before) setItems(prev => prev.map(x => x.id === id ? before : x));
      addToast('error', err?.message || 'Speichern fehlgeschlagen');
    }
  };

  // ---- Delete (Optimistic) ----
  const requestDelete = (v: MitarbeiterResource) => setConfirmItem(v);
  const doConfirmDelete = async () => {
    if (!confirmItem?.id) return;
    const id = confirmItem.id;
    setConfirmBusy(true);
    const backup = items;
    setItems(prev => prev.filter(x => x.id !== id));
    try {
      await api.deleteMitarbeiter(id);
      addToast('success', 'Mitarbeiter gelöscht');
      setConfirmItem(null);
    } catch (err: any) {
      setItems(backup); // rollback
      addToast('error', err?.message || 'Löschen fehlgeschlagen');
    } finally { setConfirmBusy(false); }
  };

  return (
    <div className="container my-4">
      <Toasts list={toasts} onClose={removeToast} />

      {/* Header */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h2 className="h4 mb-0"><i className="ci-users me-2"/>Mitarbeiter</h2>
            <div className="text-muted small">{items.length} Einträge</div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group" role="group">
              <button className={cx('btn btn-sm', cardView ? 'btn-outline-primary' : 'btn-light')} onClick={()=>setCardView(true)}><i className="ci-grid me-2"/>Karten</button>
              <button className={cx('btn btn-sm', !cardView ? 'btn-outline-primary' : 'btn-light')} onClick={()=>setCardView(false)}><i className="ci-table me-2"/>Tabelle</button>
            </div>
            <button className="btn btn-primary" onClick={()=>setShowCreate(true)}><i className="ci-add-user me-2"/>Neu</button>
          </div>
        </div>
      </div>

      {/* Suche */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-lg-8">
              <label className="form-label">Suche</label>
              <div className="input-group" style={{ minWidth: 540, maxWidth: 780 }}>
                <span className="input-group-text bg-white border-end-0"><i className="ci-search"/></span>
                <input className="form-control border-start-0" placeholder="Name, E‑Mail oder Abteilung…" value={search} onChange={(e)=>setSearch(e.target.value)} />
                {search && <button className="btn btn-outline-secondary" onClick={()=>setSearch('')}>Leeren</button>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <div className="alert alert-danger"><i className="ci-close-circle me-2"/>{error}</div>}

      {/* Content */}
      {loading ? (
        <div className="text-center py-5"><div className="spinner-border"/></div>
      ) : cardView ? (
        <div className="row">
          {filtered.map(v => (
            <div className="col-md-6 col-lg-4 mb-4" key={v.id}>
              <div className="card h-100 shadow-sm" style={{ cursor: 'pointer' }} onClick={()=>navigate(`/mitarbeiter/${v.id}`)}>
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between">
                    <div>
                      <h5 className="card-title mb-1">{v.name}</h5>
                      <div className="text-muted small">{v.abteilung || '—'}</div>
                    </div>
                    <span className={cx('badge', v.aktiv ? 'bg-success' : 'bg-warning text-dark')}>{v.aktiv ? 'Aktiv' : 'Inaktiv'}</span>
                  </div>
                  <div className="mt-3">
                    {(v.rollen || []).length ? (
                      <div className="d-flex flex-wrap gap-1">
                        {v.rollen!.map(r => <span key={r} className="badge rounded-pill bg-secondary">{r}</span>)}
                      </div>
                    ) : <div className="text-muted small">—</div>}
                    <div className="small mt-2">
                      <div className="mb-1"><strong>E‑Mail:</strong> {v.email || '—'}</div>
                      <div className="mb-1"><strong>Telefon:</strong> {v.telefon || '—'}</div>
                      <div className="mb-1"><strong>Eintritt:</strong> {v.eintrittsdatum ? new Date(v.eintrittsdatum).toLocaleDateString('de-DE') : '—'}</div>
                    </div>
                  </div>
                </div>
                <div className="card-footer bg-light d-flex justify-content-end gap-2">
                  <button className="btn btn-sm btn-outline-primary" onClick={(e)=>{ e.stopPropagation(); setEditItem(v); }} title="Bearbeiten"><i className="ci-edit"/></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={(e)=>{ e.stopPropagation(); requestDelete(v); }} title="Löschen"><i className="ci-trash"/></button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-12 text-center text-muted py-5">Keine Mitarbeiter gefunden.</div>}
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Rollen</th>
                  <th>E‑Mail</th>
                  <th>Telefon</th>
                  <th>Abteilung</th>
                  <th>Aktiv</th>
                  <th>Eintritt</th>
                  <th className="text-end" style={{ width: 180 }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} style={{ cursor: 'pointer' }} onClick={()=>navigate(`/mitarbeiter/${v.id}`)}>
                    <td>{v.name}</td>
                    <td>
                      {(v.rollen||[]).length ? (
                        <div className="d-flex flex-wrap gap-1">
                          {v.rollen!.map(r => <span key={r} className="badge rounded-pill bg-secondary">{r}</span>)}
                        </div>
                      ) : '—'}
                    </td>
                    <td>{v.email}</td>
                    <td>{v.telefon}</td>
                    <td>{v.abteilung}</td>
                    <td>{v.aktiv ? 'Ja' : 'Nein'}</td>
                    <td>{v.eintrittsdatum ? new Date(v.eintrittsdatum).toLocaleDateString('de-DE') : '—'}</td>
                    <td className="text-end">
                      <div className="btn-group">
                        <button className="btn btn-sm btn-outline-primary" onClick={(e)=>{ e.stopPropagation(); setEditItem(v); }} title="Bearbeiten"><i className="ci-edit me-1"/>Bearbeiten</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={(e)=>{ e.stopPropagation(); requestDelete(v); }} title="Löschen"><i className="ci-trash me-1"/>Löschen</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-5 text-center text-muted">Keine Mitarbeiter gefunden.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal d-block" style={{ background: 'rgba(30,33,37,.6)' }} tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">Neuen Mitarbeiter erstellen</h5>
                <button type="button" className="btn-close btn-close-white" onClick={()=>setShowCreate(false)} />
              </div>
              <div className="modal-body">
                <form onSubmit={onCreate}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Name</label>
                      <input className="form-control" value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Passwort</label>
                      <input type="password" className="form-control" value={form.password} onChange={(e)=>setForm({ ...form, password: e.target.value })} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">E‑Mail</label>
                      <input type="email" className="form-control" value={form.email} onChange={(e)=>setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Telefon</label>
                      <input className="form-control" value={form.telefon} onChange={(e)=>setForm({ ...form, telefon: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Abteilung</label>
                      <input className="form-control" value={form.abteilung} onChange={(e)=>setForm({ ...form, abteilung: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Eintrittsdatum</label>
                      <input type="date" className="form-control" value={form.eintrittsdatum} onChange={(e)=>setForm({ ...form, eintrittsdatum: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Rollen</label>
                      <RolePills value={form.rollen} onChange={(v)=>setForm({ ...form, rollen: v })} options={availableRoles} />
                    </div>
                    <div className="col-12">
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" id="create-aktiv" checked={form.aktiv} onChange={(e)=>setForm({ ...form, aktiv: e.target.checked })} />
                        <label className="form-check-label" htmlFor="create-aktiv">Aktiv</label>
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Bemerkung</label>
                      <textarea className="form-control" value={form.bemerkung} onChange={(e)=>setForm({ ...form, bemerkung: e.target.value })} />
                    </div>
                  </div>
                  <div className="modal-footer mt-3">
                    <button type="button" className="btn btn-secondary" onClick={()=>setShowCreate(false)}><i className="ci-close me-2"/>Abbrechen</button>
                    <button type="submit" className="btn btn-success" disabled={creating}>{creating && <span className="spinner-border spinner-border-sm me-2"/>} Erstellen</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <EditMitarbeiterModal
          initial={editItem}
          availableRoles={availableRoles}
          onCancel={()=>setEditItem(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Delete Confirm Modal */}
      {confirmItem && (
        <ConfirmModal
          title="Mitarbeiter löschen?"
          message={<>
            Möchtest du den Mitarbeiter <strong>„{confirmItem.name}”</strong> wirklich löschen?
            <div className="text-muted small mt-2">Dieser Vorgang kann nicht rückgängig gemacht werden.</div>
          </>}
          onConfirm={doConfirmDelete}
          onCancel={()=>{ if (!confirmBusy) setConfirmItem(null); }}
          busy={confirmBusy}
          confirmText="Ja, löschen"
        />
      )}
    </div>
  );
};

export default MitarbeiterOverview;