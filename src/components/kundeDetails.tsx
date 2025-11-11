// KundeDetail.tsx – Redesigned (Cartzilla/Bootstrap High-Quality)
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { KundeResource, AuftragResource } from '../Resources';
import { getKundeById, apiFetch, api } from '../backend/api';

// ---------- UI Helpers ----------
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const Badge: React.FC<{ variant?: 'success' | 'warning' | 'secondary' | 'danger' | string; children: React.ReactNode }> = ({ variant = 'secondary', children }) => (
  <span className={cx('badge', `bg-${variant}`)}>{children}</span>
);

const InfoRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="col-md-4">
    <p className="mb-1 text-muted small">{label}</p>
    <p className="mb-0 fw-medium">{value ?? '—'}</p>
  </div>
);


// Confirm Modal (no window.confirm)
const ConfirmModal: React.FC<{
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}> = ({ title = 'Löschen bestätigen', message, confirmText = 'Löschen', cancelText = 'Abbrechen', onConfirm, onCancel, busy }) => (
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

// BulkEdit Kundenpreise Modal
const BulkEditKundenpreiseModal: React.FC<{
  customerId: string;
  preselectedArtikelIds: string[];
  onClose: () => void;
  onDone: () => void; // reload callback
}> = ({ customerId, preselectedArtikelIds, onClose, onDone }) => {
  const [mode, setMode] = useState<'set' | 'add' | 'sub'>('set');
  const [value, setValue] = useState<string>('0');
  const [artikelKategorie, setArtikelKategorie] = useState<string>('');
  const [nummerFrom, setNummerFrom] = useState<string>('');
  const [nummerTo, setNummerTo] = useState<string>('');
  const [useSelected, setUseSelected] = useState<boolean>(preselectedArtikelIds.length > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const doSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const num = Number(value);
    if (Number.isNaN(num)) {
      setError('Bitte eine Zahl für den Wert eingeben.');
      return;
    }

    const selection: any = {};
    if (useSelected && preselectedArtikelIds.length > 0) {
      selection.artikelIds = preselectedArtikelIds;
    }
    if (artikelKategorie.trim()) {
      selection.artikelKategorie = artikelKategorie.trim();
    }
    if (nummerFrom.trim()) selection.artikelNummerFrom = nummerFrom.trim();
    if (nummerTo.trim()) selection.artikelNummerTo = nummerTo.trim();

    if (!selection.artikelIds && !selection.artikelKategorie && !selection.artikelNummerFrom && !selection.artikelNummerTo) {
      setError('Bitte mindestens ein Kriterium wählen: ausgewählte Artikel, Kategorie oder Artikelnummern-Spanne.');
      return;
    }

    try {
      setBusy(true);
      await api.bulkEditKundenpreiseByCustomer(customerId, {
        selection,
        action: { mode, value: num },
      });
      setSuccess('Änderungen gespeichert.');
      onDone();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Fehler bei der Massenbearbeitung');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: 'rgba(30,33,37,.6)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <form className="modal-content" onSubmit={doSubmit}>
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">Kundenpreise · Massenbearbeitung</h5>
              <div className="text-muted small">Setze, addiere oder subtrahiere Aufpreise für eine gezielte Auswahl von Artikeln.</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} disabled={busy} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Aktion & Wert */}
            <div className="mb-4">
              <label className="form-label d-block mb-2">Aktion</label>
              <div className="d-flex flex-wrap gap-3 align-items-center">
                <div className="btn-group" role="group" aria-label="Aktion wählen">
                  <button type="button" className={cx('btn', mode==='set' ? 'btn-primary' : 'btn-outline-primary')} onClick={() => setMode('set')}>Setzen</button>
                  <button type="button" className={cx('btn', mode==='add' ? 'btn-primary' : 'btn-outline-primary')} onClick={() => setMode('add')}>Addieren</button>
                  <button type="button" className={cx('btn', mode==='sub' ? 'btn-primary' : 'btn-outline-primary')} onClick={() => setMode('sub')}>Subtrahieren</button>
                </div>
                <div className="flex-grow-1">
                  <label className="form-label small text-muted mb-1">Wert</label>
                  <div className="input-group">
                    <span className="input-group-text">€</span>
                    <input type="number" step="0.01" className="form-control" value={value} onChange={(e)=>setValue(e.target.value)} placeholder="z. B. 0.10" />
                  </div>
                  <div className="form-text">Beispiel: 0,10 = zehn Cent. Bei Subtrahieren musst du kein Minus angeben.</div>
                </div>
              </div>
            </div>

            <hr className="text-muted" />

            {/* Kriterien */}
            <div className="mb-3 d-flex align-items-center justify-content-between">
              <h6 className="mb-0">Kriterien</h6>
              <span className="badge bg-secondary">Ausgewählt: {preselectedArtikelIds.length}</span>
            </div>

            <div className="row g-3">
              <div className="col-md-12">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="useSelected" checked={useSelected} onChange={(e)=>setUseSelected(e.target.checked)} />
                  <label className="form-check-label" htmlFor="useSelected">Aktuelle Auswahl verwenden ({preselectedArtikelIds.length})</label>
                </div>
                <div className="form-text">Bearbeite nur die im Kundenpreise-Panel ausgewählten Artikel.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Artikel-Kategorie</label>
                <input className="form-control" placeholder="z. B. Rind" value={artikelKategorie} onChange={(e)=>setArtikelKategorie(e.target.value)} />
                <div className="form-text">Filtert strikt nach <code>artikel.kategorie</code>.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Artikelnummern-Bereich</label>
                <div className="input-group">
                  <span className="input-group-text">von</span>
                  <input className="form-control" placeholder="1000" value={nummerFrom} onChange={(e)=>setNummerFrom(e.target.value)} />
                  <span className="input-group-text">bis</span>
                  <input className="form-control" placeholder="1999" value={nummerTo} onChange={(e)=>setNummerTo(e.target.value)} />
                </div>
                <div className="form-text">Optional: Beide Felder kombinierbar oder nur eins davon.</div>
              </div>
            </div>

            <div className="alert alert-light border mt-3 mb-0 py-2">
              <i className="ci-info me-2" /> Mindestens <strong>ein</strong> Kriterium ist erforderlich: Auswahl, Kategorie oder Artikelnummern-Bereich.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Abbrechen</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy && <span className="spinner-border spinner-border-sm me-2" />} Anwenden
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// EditKundeModal component
const EditKundeModal: React.FC<{
  kunde: KundeResource;
  onCancel: () => void;
  onSave: (updatedData: Partial<KundeResource>) => Promise<void>;
}> = ({ kunde, onCancel, onSave }) => {
  const [formData, setFormData] = useState<Partial<KundeResource>>({
    name: kunde.name,
    email: kunde.email,
    telefon: kunde.telefon,
    adresse: kunde.adresse,
    region: kunde.region,
    kategorie: kunde.kategorie,
    emailRechnung: kunde.emailRechnung,
    emailLieferschein: kunde.emailLieferschein,
    emailBuchhaltung: kunde.emailBuchhaltung,
    emailSpedition: kunde.emailSpedition,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(formData);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Speichern');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: 'rgba(30,33,37,.6)' }}>
      <div className="modal-dialog modal-dialog-centered" role="document">
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h5 className="modal-title">Kunde bearbeiten</h5>
            <button type="button" className="btn-close" onClick={onCancel} disabled={busy} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="mb-3">
              <label htmlFor="name" className="form-label">Name</label>
              <input id="name" name="name" className="form-control" value={formData.name || ''} onChange={handleChange} disabled={busy} required />
            </div>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">Email</label>
              <input id="email" name="email" type="email" className="form-control" value={formData.email || ''} onChange={handleChange} disabled={busy} />
            </div>
            <div className="mb-3">
              <label htmlFor="emailRechnung" className="form-label">E-Mail (Rechnung)</label>
              <input id="emailRechnung" name="emailRechnung" type="email" className="form-control" value={formData.emailRechnung || ''} onChange={handleChange} disabled={busy} placeholder="z. B. buchhaltung@kunde.de" />
            </div>
            <div className="mb-3">
              <label htmlFor="emailLieferschein" className="form-label">E-Mail (Lieferschein)</label>
              <input id="emailLieferschein" name="emailLieferschein" type="email" className="form-control" value={formData.emailLieferschein || ''} onChange={handleChange} disabled={busy} placeholder="z. B. logistik@kunde.de" />
            </div>
            <div className="mb-3">
              <label htmlFor="emailBuchhaltung" className="form-label">E-Mail (Buchhaltung)</label>
              <input id="emailBuchhaltung" name="emailBuchhaltung" type="email" className="form-control" value={formData.emailBuchhaltung || ''} onChange={handleChange} disabled={busy} placeholder="z. B. rechnungen@kunde.de" />
            </div>
            <div className="mb-3">
              <label htmlFor="emailSpedition" className="form-label">E-Mail (Spedition)</label>
              <input id="emailSpedition" name="emailSpedition" type="email" className="form-control" value={formData.emailSpedition || ''} onChange={handleChange} disabled={busy} placeholder="z. B. dispo@spedition.de" />
            </div>
            <div className="mb-3">
              <label htmlFor="telefon" className="form-label">Telefon</label>
              <input id="telefon" name="telefon" className="form-control" value={formData.telefon || ''} onChange={handleChange} disabled={busy} />
            </div>
            <div className="mb-3">
              <label htmlFor="adresse" className="form-label">Adresse</label>
              <input id="adresse" name="adresse" className="form-control" value={formData.adresse || ''} onChange={handleChange} disabled={busy} />
            </div>
            <div className="mb-3">
              <label htmlFor="region" className="form-label">Region</label>
              <input id="region" name="region" className="form-control" value={formData.region || ''} onChange={handleChange} disabled={busy} />
            </div>
            <div className="mb-3">
              <label htmlFor="kategorie" className="form-label">Kategorie</label>
              <input id="kategorie" name="kategorie" className="form-control" value={formData.kategorie || ''} onChange={handleChange} disabled={busy} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>Abbrechen</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy && <span className="spinner-border spinner-border-sm me-2" />} Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------- Main Component ----------
const KundeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [kunde, setKunde] = useState<KundeResource | null>(null);
  const [auftraege, setAuftraege] = useState<AuftragResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // UI states
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'prices'>('overview');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Preise (kundenzentrierte Liste)
  type KundenpreisRow = {
    id: string;
    artikel: string;
    artikelNummer?: string;
    artikelName?: string;
    einheit?: string;
    basispreis: number;
    aufpreis: number;
    effektivpreis: number;
  };

  const [preise, setPreise] = useState<KundenpreisRow[]>([]);
  const [preiseLoading, setPreiseLoading] = useState<boolean>(false);
  const [preiseError, setPreiseError] = useState<string>('');
  const [preisQ, setPreisQ] = useState<string>('');
  const [preisIncludeAll, setPreisIncludeAll] = useState<boolean>(false);
  const [preisSort, setPreisSort] = useState<'artikelName' | 'artikelNummer' | 'basispreis' | 'aufpreis' | 'effektivpreis'>('artikelNummer');
  const [preisOrder, setPreisOrder] = useState<'asc' | 'desc'>('asc');
  const [preisPage, setPreisPage] = useState<number>(1);
  const [preisLimit, setPreisLimit] = useState<number>(500);
  const [selectedArtikelIds, setSelectedArtikelIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const loadKundenpreise = async () => {
    if (!id) return;
    try {
      setPreiseLoading(true);
      setPreiseError('');
      const rows = await api.getKundenpreiseByCustomer(id, {
        q: preisQ || undefined,
        sort: preisSort,
        order: preisOrder,
        includeAllArticles: preisIncludeAll,
        page: preisPage,
        limit: preisLimit,
      });
      setPreise(rows);
      setSelectedArtikelIds([]);
    } catch (err: any) {
      setPreiseError(err?.message || 'Fehler beim Laden der Preise');
    } finally {
      setPreiseLoading(false);
    }
  };

  const toggleSelectArtikel = (artikelId: string) => {
    setSelectedArtikelIds((prev) => prev.includes(artikelId) ? prev.filter(id => id !== artikelId) : [...prev, artikelId]);
  };
  const selectAllVisible = () => {
    const ids = preise.map(p => p.artikel);
    setSelectedArtikelIds(ids);
  };
  const clearSelection = () => setSelectedArtikelIds([]);
  useEffect(() => {
    if (activeTab === 'orders') {
      loadKundenpreise();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, preisQ, preisIncludeAll, preisSort, preisOrder, preisPage, preisLimit, id]);

  useEffect(() => {
    setPreisPage(1);
  }, [preisQ, preisIncludeAll, preisSort, preisOrder]);

  useEffect(() => {
    const load = async () => {
      try {
        if (!id) throw new Error('Keine Kunden-ID angegeben.');
        const kundeData = await getKundeById(id);
        setKunde(kundeData);
        const auftraegeData = await apiFetch<AuftragResource[]>(`/api/auftrag/kunden/${id}`);
        setAuftraege(auftraegeData);
      } catch (err: any) {
        setError(err?.message || 'Fehler beim Laden der Daten');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const counts = useMemo(() => ({
    offen: auftraege.filter(a => a.status === 'offen').length,
    ib: auftraege.filter(a => a.status === 'in Bearbeitung').length,
    abgeschlossen: auftraege.filter(a => a.status === 'abgeschlossen').length,
    storniert: auftraege.filter(a => a.status === 'storniert').length,
  }), [auftraege]);

  const grouped = useMemo(() => ({
    offen: auftraege.filter(a => a.status === 'offen'),
    ib: auftraege.filter(a => a.status === 'in Bearbeitung'),
    abgeschlossen: auftraege.filter(a => a.status === 'abgeschlossen'),
    storniert: auftraege.filter(a => a.status === 'storniert'),
  }), [auftraege]);

  const approveToggle = async (approve: boolean) => {
    if (!kunde?.id) return;
    try {
      await api.approveKunde(kunde.id, approve);
      const fresh = await getKundeById(kunde.id);
      setKunde(fresh);
    } catch (err: any) {
      setError(err?.message || 'Aktion fehlgeschlagen');
    }
  };

  const handleDelete = async () => {
    if (!kunde?.id) return;
    setConfirmBusy(true);
    try {
      await api.deleteKunde(kunde.id);
      navigate('/kunden');
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Löschen des Kunden');
    } finally {
      setConfirmBusy(false);
      setConfirmOpen(false);
    }
  };

  const handleSaveEdit = async (updatedData: Partial<KundeResource>) => {
    if (!kunde?.id) return;
    await api.updateKunde(kunde.id, updatedData);
    const fresh = await getKundeById(kunde.id);
    setKunde(fresh);
    setEditOpen(false);
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border" />
        <p className="mt-3 text-muted">Lade Kunden…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="container my-4">
        <div className="alert alert-danger d-flex align-items-start">
          <i className="ci-close-circle fs-4 me-2"></i>
          <div>{error}</div>
        </div>
        <button className="btn btn-outline-secondary" onClick={() => navigate('/kunden')}>
          <i className="ci-arrow-left me-1"></i> Zurück zur Liste
        </button>
      </div>
    );
  }
  if (!kunde) {
    return (
      <div className="container my-4">
        <div className="alert alert-warning">Kein Kunde gefunden.</div>
        <button className="btn btn-outline-secondary" onClick={() => navigate('/kunden')}>
          <i className="ci-arrow-left me-1"></i> Zurück zur Liste
        </button>
      </div>
    );
  }

  // ---------- UI ----------
  return (
    <div className="container my-4">
      {/* Header Card */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                <i className="ci-user fs-4"></i>
              </div>
              <div>
                <h3 className="h5 mb-1">{kunde.name} {kunde.kundenNummer && <span className="text-muted">· #{kunde.kundenNummer}</span>}</h3>
                <div className="d-flex align-items-center gap-2">
                  <Badge variant={kunde.isApproved ? 'success' : 'warning'}>
                    {kunde.isApproved ? 'Genehmigt' : 'Nicht genehmigt'}
                  </Badge>
                  {kunde.region && <Badge variant="secondary">{kunde.region}</Badge>}
                  {kunde.kategorie && <Badge variant="secondary">{kunde.kategorie}</Badge>}
                </div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-outline-secondary" onClick={() => navigate('/kunden')}>
                <i className="ci-arrow-left me-1" /> Zurück
              </button>
              <button
                className="btn btn-outline-primary"
                onClick={() => setEditOpen(true)}
              >
                <i className="ci-edit me-1" /> Bearbeiten
              </button>
              <button
                className={cx('btn', kunde.isApproved ? 'btn-outline-warning' : 'btn-success')}
                onClick={() => approveToggle(!kunde.isApproved)}
                disabled={false}
              >
                <i className={cx(kunde.isApproved ? 'ci-lock' : 'ci-unlock', 'me-1')} />
                {kunde.isApproved ? 'Sperren' : 'Freischalten'}
              </button>
              <button className="btn btn-outline-danger" onClick={() => setConfirmOpen(true)}>
                <i className="ci-trash me-1" /> Löschen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs" role="tablist">
        <li className="nav-item" role="presentation">
          <button className={cx('nav-link', activeTab === 'overview' && 'active')} onClick={() => setActiveTab('overview')}>
            <i className="ci-info me-2" /> Übersicht
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button className={cx('nav-link', activeTab === 'orders' && 'active')} onClick={() => setActiveTab('orders')}>
            <i className="ci-package me-2" /> Aufträge
            <span className="badge bg-secondary ms-2">{auftraege.length}</span>
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button className={cx('nav-link', activeTab === 'prices' && 'active')} onClick={() => setActiveTab('prices')}>
            <i className="ci-cash me-2" /> Preise
          </button>
        </li>
      </ul>

      <div className="tab-content pt-3">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-pane fade show active">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="row g-4">
                  <InfoRow label="Email" value={kunde.email} />
                  <InfoRow label="Telefon" value={kunde.telefon} />
                  <InfoRow label="Adresse" value={kunde.adresse} />
                  <InfoRow label="Lieferzeit" value={kunde.lieferzeit} />
                  <InfoRow label="USt-ID" value={kunde.ustId} />
                  <InfoRow label="Handelsregister-Nr." value={kunde.handelsregisterNr} />
                  <InfoRow label="Ansprechpartner" value={kunde.ansprechpartner} />
                  <InfoRow label="Website" value={kunde.website ? (<a href={kunde.website} target="_blank" rel="noreferrer">{kunde.website}</a>) : '—'} />
                  <InfoRow label="Genehmigt" value={kunde.isApproved ? 'Ja' : 'Nein'} />
                  <InfoRow label="Letzte Änderung" value={kunde.updatedAt ? new Date(kunde.updatedAt).toLocaleString('de-DE') : '—'} />
                  <InfoRow label="Gewerbedatei" value={kunde.gewerbeDateiUrl ? (<a href={kunde.gewerbeDateiUrl} target="_blank" rel="noreferrer">Anzeigen</a>) : '—'} />
                  <InfoRow label="Zusatzdatei" value={kunde.zusatzDateiUrl ? (<a href={kunde.zusatzDateiUrl} target="_blank" rel="noreferrer">Anzeigen</a>) : '—'} />
                  {/* Belegversand-E-Mails */}
                  <div className="col-12">
                    <hr className="text-muted" />
                    <h6 className="text-muted mb-3">Belegversand · E-Mail-Empfänger</h6>
                  </div>
                  <InfoRow label="E-Mail (Rechnung)" value={kunde.emailRechnung || '—'} />
                  <InfoRow label="E-Mail (Lieferschein)" value={kunde.emailLieferschein || '—'} />
                  <InfoRow label="E-Mail (Buchhaltung)" value={kunde.emailBuchhaltung || '—'} />
                  <InfoRow label="E-Mail (Spedition)" value={kunde.emailSpedition || '—'} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="tab-pane fade show active">
                {/* Status Pills */}
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="badge bg-light text-dark border"><i className="ci-clock me-1" /> Offen: {counts.offen}</span>
                  <span className="badge bg-light text-dark border"><i className="ci-gear me-1" /> In Bearbeitung: {counts.ib}</span>
                  <span className="badge bg-light text-dark border"><i className="ci-check me-1" /> Abgeschlossen: {counts.abgeschlossen}</span>
                  <span className="badge bg-light text-dark border"><i className="ci-close-circle me-1" /> Storniert: {counts.storniert}</span>
                </div>

                {auftraege.length === 0 ? (
                  <div className="alert alert-light border">Keine Aufträge vorhanden.</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {auftraege.map((a) => (
                      <Link
                        key={a.id}
                        to={`/auftraege/${a.id}`}
                        className="list-group-item list-group-item-action py-3"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <strong>Auftrag #{a.auftragsnummer}</strong>
                              {a.status === 'offen' && <Badge variant="warning">Offen</Badge>}
                              {a.status === 'in Bearbeitung' && <Badge variant="secondary">In Bearbeitung</Badge>}
                              {a.status === 'abgeschlossen' && <Badge variant="success">Abgeschlossen</Badge>}
                              {a.status === 'storniert' && <Badge variant="danger">Storniert</Badge>}
                            </div>
                            <div className="text-muted small mt-1">
                              Erstellt: {a.createdAt ? new Date(a.createdAt).toLocaleDateString('de-DE') : '—'}
                              {a.lieferdatum && <> · Lieferung: {new Date(a.lieferdatum).toLocaleDateString('de-DE')}</>}
                            </div>
                            <div className="text-muted small d-flex flex-wrap gap-3 mt-1">
                              {a.gewicht != null && <span>Gewicht: {a.gewicht} kg</span>}
                              {a.preis != null && <span>Wert: {a.preis.toFixed(2)} €</span>}
                              {a.bemerkungen && <span className="text-truncate" style={{ maxWidth: 240 }} title={a.bemerkungen}><i className="ci-note me-1" /> Bemerkung</span>}
                            </div>
                          </div>
                          <i className="ci-chevron-right text-muted"></i>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
          </div>
        )}

        {activeTab === 'prices' && (
          <div className="tab-pane fade show active">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="mb-0">Kundenpreise</h6>
                  <button className="btn btn-sm btn-outline-secondary" onClick={loadKundenpreise} disabled={preiseLoading}>
                    {preiseLoading ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="ci-reload me-1" />}
                    Aktualisieren
                  </button>
                </div>
                <div className="row g-2 align-items-end mb-3">
                  <div className="col-md-4">
                    <label className="form-label small text-muted">Suche</label>
                    <input className="form-control" placeholder="Artikel suchen…" value={preisQ} onChange={(e) => setPreisQ(e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <div className="form-check mt-4">
                      <input id="preisIncludeAll2" className="form-check-input" type="checkbox" checked={preisIncludeAll} onChange={(e) => setPreisIncludeAll(e.target.checked)} />
                      <label className="form-check-label" htmlFor="preisIncludeAll2">Alle Artikel anzeigen</label>
                    </div>
                  </div>
                  <div className="col-md-5 d-flex gap-2">
                    <div className="flex-grow-1">
                      <label className="form-label small text-muted">Sortieren nach</label>
                      <select className="form-select" value={preisSort} onChange={(e) => setPreisSort(e.target.value as any)}>
                        <option value="artikelName">Artikelname</option>
                        <option value="artikelNummer">Artikel-Nr.</option>
                        <option value="basispreis">Basispreis</option>
                        <option value="aufpreis">Aufpreis</option>
                        <option value="effektivpreis">Effektivpreis</option>
                      </select>
                    </div>
                    <div style={{ width: 100 }}>
                      <label className="form-label small text-muted">Reihenfolge</label>
                      <select className="form-select" value={preisOrder} onChange={(e) => setPreisOrder(e.target.value as any)}>
                        <option value="asc">Aufsteigend</option>
                        <option value="desc">Absteigend</option>
                      </select>
                    </div>
                    <button className="btn btn-primary align-self-end" onClick={loadKundenpreise} disabled={preiseLoading}>Suchen</button>
                  </div>
                </div>

                {preiseError && <div className="alert alert-danger">{preiseError}</div>}

                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="d-flex align-items-center gap-2">
                      {/* Massenbearbeitung Button */}
                      <button className="btn btn-sm btn-primary" onClick={() => setBulkOpen(true)} disabled={selectedArtikelIds.length === 0 && !preisIncludeAll && !preisQ}>Massenbearbeitung</button>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-outline-secondary" onClick={loadKundenpreise} disabled={preiseLoading}>
                    {preiseLoading ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="ci-reload me-1" />}
                    Aktualisieren
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th style={{width: 36}}>
                          <input className="form-check-input" type="checkbox" onChange={(e)=> e.target.checked ? selectAllVisible() : clearSelection()} />
                        </th>
                        <th>Artikel</th>
                        <th className="text-end">Basis</th>
                        <th className="text-end">Aufpreis</th>
                        <th className="text-end">Effektiv</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preise.map((p) => (
                        <tr key={`${p.id}-${p.artikel}`}>
                          <td>
                            <input className="form-check-input" type="checkbox" checked={selectedArtikelIds.includes(p.artikel)} onChange={() => toggleSelectArtikel(p.artikel)} />
                          </td>
                          <td>
                            <div className="fw-medium">{p.artikelName || p.artikelNummer || 'Artikel'}</div>
                            <div className="text-muted small">{p.artikelNummer} {p.einheit ? `· ${p.einheit}` : ''}</div>
                          </td>
                          <td className="text-end">{p.basispreis.toFixed(2)} €</td>
                          <td className={cx('text-end', p.aufpreis < 0 && 'text-danger')}>{p.aufpreis.toFixed(2)} €</td>
                          <td className="text-end fw-bold">{p.effektivpreis.toFixed(2)} €</td>
                        </tr>
                      ))}
                      {preise.length === 0 && !preiseLoading && (
                        <tr>
                          <td colSpan={5} className="text-muted">Keine Einträge.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="d-flex align-items-center justify-content-between my-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-muted small">Einträge pro Seite</span>
                    <select className="form-select form-select-sm" style={{ width: 90 }} value={preisLimit} onChange={(e) => setPreisLimit(parseInt(e.target.value, 10))}>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </select>
                  </div>
                  <div className="btn-group">
                    <button className="btn btn-sm btn-outline-secondary" disabled={preiseLoading || preisPage === 1} onClick={() => setPreisPage(p => Math.max(1, p - 1))}>Zurück</button>
                    <button className="btn btn-sm btn-outline-secondary" disabled={preiseLoading || preise.length < preisLimit} onClick={() => setPreisPage(p => p + 1)}>Weiter</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {confirmOpen && (
        <ConfirmModal
          title="Kunden löschen?"
          message={<>
            Möchtest du den Kunden <strong>„{kunde.name}”</strong> wirklich löschen?
            <div className="text-muted small mt-2">Dieser Vorgang kann nicht rückgängig gemacht werden.</div>
          </>}
          confirmText="Ja, löschen"
          onConfirm={handleDelete}
          onCancel={() => !confirmBusy && setConfirmOpen(false)}
          busy={confirmBusy}
        />
      )}

      {/* Edit Kunde Modal */}
      {editOpen && kunde && (
        <EditKundeModal
          kunde={kunde}
          onCancel={() => setEditOpen(false)}
          onSave={handleSaveEdit}
        />
      )}

      {/* BulkEdit Kundenpreise Modal */}
      {bulkOpen && id && (
        <BulkEditKundenpreiseModal
          customerId={id}
          preselectedArtikelIds={selectedArtikelIds}
          onClose={() => setBulkOpen(false)}
          onDone={() => loadKundenpreise()}
        />
      )}
    </div>
  );
};

export default KundeDetail;