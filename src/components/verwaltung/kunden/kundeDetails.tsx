// KundeDetail.tsx – Redesigned (Cartzilla/Bootstrap High-Quality)
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Pie, Chart } from 'react-chartjs-2';
import { KundeResource, AuftragResource, ArtikelResource } from '@/Resources';
import { getKundeById, apiFetch, api } from '@/backend/api';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);


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

// --- Dashboard helpers ---
const numberDE = (n: number, digits = 2) => n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatWeekLabel = (iso: string) => {
  const d = new Date(iso);
  // Simple KW display
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
  const week = Math.floor((dayOfYear + ((firstThursday.getDay() + 6) % 7) - 1) / 7) + 1;
  return `${d.getFullYear()} · KW ${week}`;
};

// ---- Chart Color Utilities (Bootstrap-inspired palette)
const HEX = [
  '#0d6efd', // primary
  '#198754', // success
  '#dc3545', // danger
  '#fd7e14', // orange
  '#6f42c1', // purple
  '#20c997', // teal
  '#6610f2', // indigo
  '#0dcaf0', // info
  '#6c757d', // secondary
  '#ffc107', // warning
];
const hexToRgba = (hex: string, a = 0.25) => {
  const m = hex.replace('#', '');
  const bigint = parseInt(m, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};


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
            {success && <div className="alert alert-success">{success}</div>}

            {/* Aktion & Wert */}
            <div className="mb-4">
              <label className="form-label d-block mb-2">Aktion</label>
              <div className="d-flex flex-wrap gap-3 align-items-center">
                <div className="btn-group" role="group" aria-label="Aktion wählen">
                  <button type="button" className={cx('btn', mode === 'set' ? 'btn-primary' : 'btn-outline-primary')} onClick={() => setMode('set')}>Setzen</button>
                  <button type="button" className={cx('btn', mode === 'add' ? 'btn-primary' : 'btn-outline-primary')} onClick={() => setMode('add')}>Addieren</button>
                  <button type="button" className={cx('btn', mode === 'sub' ? 'btn-primary' : 'btn-outline-primary')} onClick={() => setMode('sub')}>Subtrahieren</button>
                </div>
                <div className="flex-grow-1">
                  <label className="form-label small text-muted mb-1">Wert</label>
                  <div className="input-group">
                    <span className="input-group-text">€</span>
                    <input type="number" step="0.01" className="form-control" value={value} onChange={(e) => setValue(e.target.value)} placeholder="z. B. 0.10" />
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
                  <input className="form-check-input" type="checkbox" id="useSelected" checked={useSelected} onChange={(e) => setUseSelected(e.target.checked)} />
                  <label className="form-check-label" htmlFor="useSelected">Aktuelle Auswahl verwenden ({preselectedArtikelIds.length})</label>
                </div>
                <div className="form-text">Bearbeite nur die im Kundenpreise-Panel ausgewählten Artikel.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Artikel-Kategorie</label>
                <input className="form-control" placeholder="z. B. Rind" value={artikelKategorie} onChange={(e) => setArtikelKategorie(e.target.value)} />
                <div className="form-text">Filtert strikt nach <code>artikel.kategorie</code>.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Artikelnummern-Bereich</label>
                <div className="input-group">
                  <span className="input-group-text">von</span>
                  <input className="form-control" placeholder="1000" value={nummerFrom} onChange={(e) => setNummerFrom(e.target.value)} />
                  <span className="input-group-text">bis</span>
                  <input className="form-control" placeholder="1999" value={nummerTo} onChange={(e) => setNummerTo(e.target.value)} />
                </div>
                <div className="form-text">Optional: Beide Felder kombinierbar oder nur eins davon.</div>
              </div>
            </div>

            <div className="alert alert-light border mt-3 mb-0 py-2">
              <i className="ci-info me-2" /> Mindestens <strong>ein</strong> Kriterium ist erforderlich: Auswahl, Kategorie oder Artikelnummern-Bereich.
            </div>
          </div>
          {error && (
            <div className="px-4 pb-2">
              <div className="alert alert-danger mb-0">{error}</div>
            </div>
          )}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  // Stammdaten
  const [name, setName] = useState(kunde.name || '');
  const [kundenNummer, setKundenNummer] = useState(kunde.kundenNummer || '');
  const [email, setEmail] = useState(kunde.email || '');
  const [telefon, setTelefon] = useState(kunde.telefon || '');
  const [region, setRegion] = useState(kunde.region || '');
  const [kategorie, setKategorie] = useState(kunde.kategorie || '');
  const [adresse, setAdresse] = useState(kunde.adresse || '');
  const [land, setLand] = useState(kunde.land || 'Deutschland');

  // Firmendaten
  const [ustId, setUstId] = useState(kunde.ustId || '');
  const [handelsregisterNr, setHandelsregisterNr] = useState(kunde.handelsregisterNr || '');
  const [ansprechpartner, setAnsprechpartner] = useState(kunde.ansprechpartner || '');
  const [website, setWebsite] = useState(kunde.website || '');

  // Lieferzeit (Backend: String, z.B. "08:00–16:00, 12:00–18:00")
  const [lieferzeit, setLieferzeit] = useState<string[]>(
    (kunde.lieferzeit || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  );
  const [lieferStart, setLieferStart] = useState<string>('');
  const [lieferEnde, setLieferEnde] = useState<string>('');

  const timeOptions = [
    '00:00',
    '01:00',
    '02:00',
    '03:00',
    '04:00',
    '05:00',
    '06:00',
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00',
    '23:00',
    '24:00',
  ];

  function addLieferzeitWindow() {
    if (!lieferStart || !lieferEnde) return;

    if (lieferEnde <= lieferStart) {
      setError('Endzeit muss nach der Startzeit liegen');
      return;
    }

    const window = `${lieferStart}–${lieferEnde}`;
    setLieferzeit((prev) => Array.from(new Set([...prev, window])));
    setLieferStart('');
    setLieferEnde('');
  }

  // Workflow E-Mails
  const [emailRechnung, setEmailRechnung] = useState(kunde.emailRechnung || '');
  const [emailLieferschein, setEmailLieferschein] = useState(kunde.emailLieferschein || '');
  const [emailBuchhaltung, setEmailBuchhaltung] = useState(kunde.emailBuchhaltung || '');
  const [emailSpedition, setEmailSpedition] = useState(kunde.emailSpedition || '');

  // Dateien
  const [gewerbeDateiUrl, setGewerbeDateiUrl] = useState(kunde.gewerbeDateiUrl || '');
  const [zusatzDateiUrl, setZusatzDateiUrl] = useState(kunde.zusatzDateiUrl || '');

  // Benachrichtigungen
  const [fehlmengenBenachrichtigung, setFehlmengenBenachrichtigung] = useState(kunde.fehlmengenBenachrichtigung ?? false);

  // Passwort ändern
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  // Inline validation helpers
  const nameInvalid = !name.trim();
  const passwordTooShort = changePassword && password.length > 0 && password.length < 6;
  const passwordMismatch = changePassword && password2.length > 0 && password !== password2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (!name.trim()) throw new Error('Name ist erforderlich');
      if (changePassword) {
        if (password.length < 6) throw new Error('Passwort muss mindestens 6 Zeichen haben');
        if (password !== password2) throw new Error('Passwörter stimmen nicht überein');
      }

      const payload: Partial<KundeResource> & { password?: string } = {
        // Stammdaten
        name: name.trim(),
        kundenNummer: kundenNummer.trim() || undefined,
        email: email.trim() || undefined,
        telefon: telefon.trim() || undefined,
        region: region.trim() || undefined,
        kategorie: kategorie.trim() || undefined,
        adresse: adresse.trim() || undefined,
        land: land || 'Deutschland',

        // Firmendaten
        ustId: ustId.trim() || undefined,
        handelsregisterNr: handelsregisterNr.trim() || undefined,
        ansprechpartner: ansprechpartner.trim() || undefined,
        website: website.trim() || undefined,
        lieferzeit: lieferzeit.length ? lieferzeit.join(', ') : undefined,

        // Workflows
        emailRechnung: emailRechnung.trim() || undefined,
        emailLieferschein: emailLieferschein.trim() || undefined,
        emailBuchhaltung: emailBuchhaltung.trim() || undefined,
        emailSpedition: emailSpedition.trim() || undefined,

        // Dateien
        gewerbeDateiUrl: gewerbeDateiUrl.trim() || undefined,
        zusatzDateiUrl: zusatzDateiUrl.trim() || undefined,

        // Benachrichtigungen
        fehlmengenBenachrichtigung,
      };

      if (changePassword) {
        const p1 = password.trim();
        payload.password = p1;
      }

      await onSave(payload);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Speichern');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: 'rgba(30,33,37,.6)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <div className="d-flex align-items-center gap-2">
              <i className="ci-user fs-4" />
              <div>
                <h5 className="modal-title mb-0">Kunde bearbeiten</h5>
                <div className="small opacity-75">Stammdaten, Lieferzeit und Belegversand-E-Mails verwalten</div>
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onCancel} disabled={busy} />
          </div>

          <div className="modal-body">

            <div className="row g-3">
              {/* Stammdaten */}
              <div className="col-12">
                <div className="card border-0 bg-secondary-subtle">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="fw-semibold"><i className="ci-file me-2" />Stammdaten</div>
                      <span className="badge bg-light text-dark">Pflichtfeld: Name</span>
                    </div>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Name</label>
                        <input
                          className={cx('form-control', nameInvalid && 'is-invalid')}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={busy}
                          required
                        />
                        {nameInvalid && <div className="invalid-feedback">Name ist erforderlich.</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Kundennummer</label>
                        <input className="form-control" value={kundenNummer} onChange={(e) => setKundenNummer(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">E-Mail</label>
                        <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Telefon</label>
                        <input className="form-control" value={telefon} onChange={(e) => setTelefon(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Region</label>
                        <input className="form-control" value={region} onChange={(e) => setRegion(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Kategorie</label>
                        <input className="form-control" value={kategorie} onChange={(e) => setKategorie(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Adresse</label>
                        <input className="form-control" value={adresse} onChange={(e) => setAdresse(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Land</label>
                        <select className="form-select" value={land} onChange={(e) => setLand(e.target.value)} disabled={busy}>
                          <option value="Deutschland">Deutschland</option>
                          <option value="Österreich">Österreich</option>
                          <option value="Schweiz">Schweiz</option>
                          <option value="Niederlande">Niederlande</option>
                          <option value="Belgien">Belgien</option>
                          <option value="Frankreich">Frankreich</option>
                          <option value="Polen">Polen</option>
                          <option value="Tschechien">Tschechien</option>
                          <option value="Dänemark">Dänemark</option>
                          <option value="Luxemburg">Luxemburg</option>
                          <option value="Türkei">Türkei</option>
                        </select>
                        <small className="text-muted">Für Kunden außerhalb Deutschlands wird keine MwSt berechnet.</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Firmendaten */}
              <div className="col-12">
                <div className="card border-0">
                  <div className="card-body p-0">
                    <div className="fw-semibold"><i className="ci-briefcase me-2" />Firmendaten</div>
                    <div className="row g-3 mt-1">
                      <div className="col-md-6">
                        <label className="form-label">USt‑IdNr.</label>
                        <input className="form-control" value={ustId} onChange={(e) => setUstId(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Handelsregister‑Nr.</label>
                        <input className="form-control" value={handelsregisterNr} onChange={(e) => setHandelsregisterNr(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Ansprechpartner</label>
                        <input className="form-control" value={ansprechpartner} onChange={(e) => setAnsprechpartner(e.target.value)} disabled={busy} />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Lieferzeit (Zeitfenster)</label>
                        <div className="row g-2">
                          <div className="col-5">
                            <select
                              className="form-select"
                              value={lieferStart}
                              onChange={(e) => {
                                setLieferStart(e.target.value);
                                setError('');
                              }}
                              disabled={busy}
                            >
                              <option value="">Start</option>
                              {timeOptions.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-5">
                            <select
                              className="form-select"
                              value={lieferEnde}
                              onChange={(e) => {
                                setLieferEnde(e.target.value);
                                setError('');
                              }}
                              disabled={busy}
                            >
                              <option value="">Ende</option>
                              {timeOptions
                                .filter((t) => !lieferStart || t > lieferStart)
                                .map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="col-2 d-grid">
                            <button
                              type="button"
                              className="btn btn-outline-dark"
                              onClick={addLieferzeitWindow}
                              disabled={busy || !lieferStart || !lieferEnde}
                              title="Zeitfenster hinzufügen"
                            >
                              <i className="ci-plus" />
                            </button>
                          </div>
                        </div>

                        {lieferzeit.length > 0 && (
                          <div className="mt-2 d-flex flex-wrap gap-2">
                            {lieferzeit.map((lz) => (
                              <span key={lz} className="badge bg-light text-dark border">
                                {lz}
                                <button
                                  type="button"
                                  className="btn btn-sm p-0 ms-2"
                                  style={{ lineHeight: 1 }}
                                  aria-label="Entfernen"
                                  onClick={() => setLieferzeit((prev) => prev.filter((x) => x !== lz))}
                                  disabled={busy}
                                >
                                  <i className="ci-close" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {lieferzeit.length > 0 && (
                          <div className="mt-2">
                            <button type="button" className="btn btn-link p-0 small" onClick={() => setLieferzeit([])} disabled={busy}>
                              Auswahl löschen
                            </button>
                          </div>
                        )}

                        <div className="form-text">Optional – Start & Ende auswählen und mit + hinzufügen. Mehrere Zeitfenster möglich.</div>
                      </div>

                      <div className="col-12">
                        <label className="form-label">Website</label>
                        <input className="form-control" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={busy} placeholder="https://..." />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workflow E-Mails */}
              <div className="col-12">
                <div className="card border-0">
                  <div className="card-body p-0">
                    <div className="fw-semibold"><i className="ci-mail me-2" />E‑Mail‑Empfänger (Workflows)</div>
                    <div className="row g-3 mt-1">
                      <div className="col-md-6">
                        <label className="form-label">Rechnung</label>
                        <input type="email" className="form-control" value={emailRechnung} onChange={(e) => setEmailRechnung(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Lieferschein</label>
                        <input type="email" className="form-control" value={emailLieferschein} onChange={(e) => setEmailLieferschein(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Buchhaltung</label>
                        <input type="email" className="form-control" value={emailBuchhaltung} onChange={(e) => setEmailBuchhaltung(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Spedition</label>
                        <input type="email" className="form-control" value={emailSpedition} onChange={(e) => setEmailSpedition(e.target.value)} disabled={busy} />
                      </div>
                    </div>
                    <div className="form-text">Optional – falls abweichende Empfänger genutzt werden.</div>
                  </div>
                </div>
              </div>

              {/* Datei-Links */}
              <div className="col-12">
                <div className="card border-0">
                  <div className="card-body p-0">
                    <div className="fw-semibold"><i className="ci-attachment me-2" />Dateien (URLs)</div>
                    <div className="row g-3 mt-1">
                      <div className="col-md-6">
                        <label className="form-label">Gewerbe‑Datei URL</label>
                        <input className="form-control" value={gewerbeDateiUrl} onChange={(e) => setGewerbeDateiUrl(e.target.value)} disabled={busy} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Zusatz‑Datei URL</label>
                        <input className="form-control" value={zusatzDateiUrl} onChange={(e) => setZusatzDateiUrl(e.target.value)} disabled={busy} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Benachrichtigungen */}
              <div className="col-12">
                <div className="card border-0">
                  <div className="card-body p-0">
                    <div className="fw-semibold"><i className="ci-bell me-2" />Benachrichtigungen</div>
                    <div className="mt-3">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="fehlmengenBenachrichtigungSwitchEdit"
                          checked={fehlmengenBenachrichtigung}
                          onChange={(e) => setFehlmengenBenachrichtigung(e.target.checked)}
                          disabled={busy}
                        />
                        <label className="form-check-label" htmlFor="fehlmengenBenachrichtigungSwitchEdit">
                          Fehlmengen-Benachrichtigung aktivieren
                        </label>
                      </div>
                      <div className="form-text">Wenn aktiviert, erhält der Kunde eine E-Mail bei Fehlmengen während der Kommissionierung.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sicherheit */}
              <div className="col-12">
                <div className="card border-0">
                  <div className="card-body p-0">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="fw-semibold"><i className="ci-shield me-2" />Sicherheit</div>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="changePasswordSwitch"
                          checked={changePassword}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setChangePassword(on);
                          }}
                          disabled={busy}
                        />
                        <label className="form-check-label" htmlFor="changePasswordSwitch">Passwort ändern</label>
                      </div>
                    </div>

                    <div className="mt-2 p-3 rounded-3 bg-secondary-subtle">
                      {changePassword ? (
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label">Neues Passwort</label>
                            <input
                              type="password"
                              className={cx('form-control', passwordTooShort && 'is-invalid')}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              autoComplete="new-password"
                              disabled={busy}
                              placeholder="Mindestens 6 Zeichen"
                            />
                            {passwordTooShort && <div className="invalid-feedback">Mindestens 6 Zeichen erforderlich.</div>}
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Passwort wiederholen</label>
                            <input
                              type="password"
                              className={cx('form-control', passwordMismatch && 'is-invalid')}
                              value={password2}
                              onChange={(e) => setPassword2(e.target.value)}
                              autoComplete="new-password"
                              disabled={busy}
                              placeholder="Bitte wiederholen"
                            />
                            {passwordMismatch && <div className="invalid-feedback">Passwörter stimmen nicht überein.</div>}
                          </div>
                          <div className="col-12">
                            <div className="form-text">Das Passwort wird nur geändert, wenn der Schalter aktiviert ist.</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted small">
                          Passwort bleibt unverändert.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="px-4 pb-2">
              <div className="alert alert-danger mb-0">{error}</div>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy && <span className="spinner-border spinner-border-sm me-2" />} Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Bestimmte Artikel Modal (Kunde -> erlaubte Artikel verwalten)
const BestimmteArtikelModal: React.FC<{
  kundeId: string;
  initialSelected: string[];
  onClose: () => void;
  onSaved: () => void; // reload kunde callback
}> = ({ kundeId, initialSelected, onClose, onSaved }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    Array.from(new Set((initialSelected || []).filter(Boolean)))
  );
  const [q, setQ] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [items, setItems] = useState<ArtikelResource[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pages, setPages] = useState<number>(1);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Artikel laden (server-side Suche, limit standard 500, sort by kategorie)
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setError('');

        const res = await api.getAllArtikelClean({
          page,
          limit: 500,
          name: q.trim() || undefined,
          sortBy: 'kategorie',
          sortDir: 'asc',
        } as any);

        if (!active) return;

        const list = Array.isArray((res as any)?.items)
          ? (res as any).items
          : Array.isArray(res)
            ? (res as any)
            : [];

        const p = Number((res as any)?.pages || 1);

        setItems(list);
        setPages(Number.isFinite(p) && p > 0 ? p : 1);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Fehler beim Laden der Artikel');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  const add = (id?: string) => {
    if (!id) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const remove = (id?: string) => {
    if (!id) return;
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const clearAll = () => setSelectedIds([]);

  const save = async () => {
    try {
      setBusy(true);
      setError('');
      await api.setBestimmteArtikel(kundeId, selectedIds);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Speichern');
    } finally {
      setBusy(false);
    }
  };

  // Versuche für Selected-Liste Namen/Nummern aus aktuell geladenen Items zu nutzen
  const selectedDetails = useMemo(() => {
    const map = new Map<string, ArtikelResource>();
    for (const a of items) {
      if (a?.id) map.set(a.id, a);
    }
    return selectedIds.map((id) => map.get(id));
  }, [items, selectedIds]);

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: 'rgba(30,33,37,.6)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">Bestimmte Artikel</h5>
              <div className="text-muted small">
                Lege fest, welche Artikel dieser Kunde sehen/bestellen darf. Wenn leer: alle Artikel erlaubt.
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} disabled={busy} />
          </div>

          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3">
              {/* Selected */}
              <div className="col-md-5">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-semibold">
                    <i className="ci-check-circle me-2" />
                    Ausgewählt
                    <span className="badge bg-secondary ms-2">{selectedIds.length}</span>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearAll} disabled={busy || selectedIds.length === 0}>
                    Auswahl löschen
                  </button>
                </div>

                <div className="border rounded p-2 bg-light" style={{ maxHeight: 520, overflow: 'auto' }}>
                  {selectedIds.length === 0 ? (
                    <div className="text-muted small p-2">Keine Einschränkung gesetzt – der Kunde sieht alle Artikel.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {selectedIds.map((id) => {
                        const a = selectedDetails.find((x: any) => x?.id === id) as any;
                        const title = a?.name || a?.artikelNummer || id;
                        const sub = [a?.kategorie, a?.artikelNummer].filter(Boolean).join(' · ');
                        return (
                          <li key={id} className="list-group-item d-flex align-items-center justify-content-between py-2">
                            <div className="me-2">
                              <div className="fw-medium">{title}</div>
                              {sub && <div className="text-muted small">{sub}</div>}
                            </div>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(id)} disabled={busy}>
                              <i className="ci-close me-1" /> Entfernen
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="form-text mt-2">
                  Tipp: Lasse die Auswahl leer, um <strong>keine Einschränkung</strong> zu setzen.
                </div>
              </div>

              {/* Search / All Articles */}
              <div className="col-md-7">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-semibold">
                    <i className="ci-search me-2" />
                    Alle Artikel
                    <span className="text-muted small ms-2">
                      ({items.length} gefunden)
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <div className="input-group input-group-sm" style={{ width: 360 }}>
                      <span className="input-group-text"><i className="ci-search" /></span>
                      <input
                        className="form-control"
                        placeholder="Suchen nach Name oder Nummer…"
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setPage(1); }}
                        disabled={busy}
                      />
                      {q && (
                        <button className="btn btn-outline-secondary" type="button" onClick={() => { setQ(''); setPage(1); }} disabled={busy}>
                          <i className="ci-close" />
                        </button>
                      )}
                    </div>
                    {loading && <span className="spinner-border spinner-border-sm" />}
                  </div>
                </div>

                <div className="border rounded p-2" style={{ maxHeight: 520, overflow: 'auto' }}>
                  {items.length === 0 && !loading ? (
                    <div className="text-muted small p-2">Keine Artikel gefunden.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {items.map((a) => {
                        const id = a.id || '';
                        const already = !!id && selectedSet.has(id);
                        const title = (a as any).name || (a as any).artikelNummer || '—';
                        const sub = [(a as any).kategorie, (a as any).artikelNummer].filter(Boolean).join(' · ');
                        return (
                          <li key={id || title} className="list-group-item d-flex align-items-center justify-content-between py-2">
                            <div className="me-2">
                              <div className="fw-medium">{title}</div>
                              {sub && <div className="text-muted small">{sub}</div>}
                            </div>
                            <button
                              type="button"
                              className={cx('btn btn-sm', already ? 'btn-outline-secondary' : 'btn-outline-primary')}
                              onClick={() => add(id)}
                              disabled={busy || already || !id}
                            >
                              {already ? (<><i className="ci-check me-1" /> Hinzugefügt</>) : (<><i className="ci-plus me-1" /> Hinzufügen</>)}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Pagination */}
                <div className="d-flex align-items-center justify-content-between mt-2">
                  <div className="text-muted small">Seite {page} / {pages}</div>
                  <div className="btn-group">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={busy || page <= 1}>
                      <i className="ci-arrow-left" />
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={busy || page >= pages}>
                      <i className="ci-arrow-right" />
                    </button>
                  </div>
                </div>

                <div className="alert alert-light border mt-3 mb-0 py-2">
                  <i className="ci-info me-2" />
                  Suche ist serverseitig. Standardmäßig werden bis zu <strong>500</strong> Artikel pro Seite geladen (Sortierung nach Kategorie).
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
              Abbrechen
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy && <span className="spinner-border spinner-border-sm me-2" />} Speichern
            </button>
          </div>
        </div>
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
  const [activeTab, setActiveTab] = useState<'overview' | 'dashboard' | 'orders' | 'prices'>('overview');
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
  const [preisQDraft, setPreisQDraft] = useState<string>('');
  const [preisQ, setPreisQ] = useState<string>(''); // applied
  const [preisIncludeAll, setPreisIncludeAll] = useState<boolean>(false);
  const [preisSort, setPreisSort] = useState<'artikelName' | 'artikelNummer' | 'basispreis' | 'aufpreis' | 'effektivpreis'>('artikelNummer');
  const [preisOrder, setPreisOrder] = useState<'asc' | 'desc'>('asc');
  const [preisPage, setPreisPage] = useState<number>(1);
  const [preisLimit, setPreisLimit] = useState<number>(500);
  const [selectedArtikelIds, setSelectedArtikelIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bestimmteOpen, setBestimmteOpen] = useState(false);

  const loadKundenpreise = async () => {
    if (!id) return;
    try {
      setPreiseLoading(true);
      setPreiseError('');
      const useBestimmte = !!(kunde?.bestimmteArtikel && kunde.bestimmteArtikel.length > 0);

      const rows = useBestimmte
        ? await api.getKundenpreiseByCustomerBestimmteArtikel(id, {
          q: preisQ || undefined,
          sort: preisSort,
          order: preisOrder,
          page: preisPage,
          limit: preisLimit,
        })
        : await api.getKundenpreiseByCustomer(id, {
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

  const applyPreisSearch = async () => {
  setPreisPage(1);
  const applied = preisQDraft.trim();
  setPreisQ(applied);
  await loadKundenpreise();
};

const clearPreisSearch = async () => {
  setPreisQDraft('');
  setPreisQ('');
  setPreisPage(1);
  await loadKundenpreise();
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
    if (activeTab === 'prices') {
      loadKundenpreise();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, preisSort, preisOrder, preisPage, preisLimit, preisIncludeAll, id, kunde?.bestimmteArtikel?.length]);

  useEffect(() => {
    setPreisPage(1);
  }, [preisIncludeAll, preisSort, preisOrder]);

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

  // ---- Dashboard (Kunde Analytics) ----
  type KundeAnalytics = {
    totals: { totalMenge: number; totalUmsatz: number; bestellzeilen: number; artikelCount: number; avgPreisGewichtet: number | null; minPreis: number | null; maxPreis: number | null; };
    byArtikel: Array<{ artikelId: string; artikelName?: string; artikelNummer?: string; menge: number; umsatz: number; avgPreisGewichtet: number | null; minPreis: number | null; maxPreis: number | null; bestellzeilen: number; }>;
    priceExactByDate: Array<{ date: string; preis: number; count: number }>;
    timeline: Array<{ date: string; menge: number; umsatz: number }>;
    fulfillment: { bestelltMenge: number; rausMenge: number; differenz: number; rate: number | null; positionen: number; };
    fulfillmentTimeline: Array<{ date: string; bestelltMenge: number; rausMenge: number; differenz: number }>;
  };
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('week');
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string>('');
  const [analytics, setAnalytics] = useState<KundeAnalytics | null>(null);

  const loadAnalytics = async () => {
    if (!id) return;
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const data = await api.getKundeAnalyticsApi(id, {
        from: from || undefined,
        to: to || undefined,
        granularity,
        topArticlesLimit: 20,
        recentOrdersLimit: 50,
        priceHistogramBuckets: 10,
      });
      setAnalytics(data);
    } catch (err: any) {
      setAnalyticsError(err?.message || 'Fehler beim Laden der Analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, from, to, granularity, id]);

  // ---- Chart builders ----
  const buildTimelineChart = (rows: Array<{ date: string; menge: number; umsatz: number }>, g: 'day' | 'week' | 'month') => {
    const labels = rows.map(r => g === 'week' ? formatWeekLabel(r.date) : new Date(r.date).toLocaleDateString('de-DE'));
    const menge = rows.map(r => Number(r.menge || 0));
    const umsatz = rows.map(r => Number(r.umsatz || 0));
    return {
      data: {
        labels,
        datasets: [
          {
            type: 'bar' as const,
            label: 'Menge (kg)',
            data: menge,
            borderWidth: 1,
            borderRadius: 4,
            order: 2,
            backgroundColor: hexToRgba(HEX[0], 0.25),
            borderColor: HEX[0],
          },
          {
            type: 'line' as const,
            label: 'Umsatz (€)',
            data: umsatz,
            borderWidth: 2,
            tension: 0.25,
            order: 1,
            borderColor: HEX[1],
            pointBackgroundColor: HEX[1],
            pointBorderColor: HEX[1],
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
        scales: { y: { beginAtZero: true } }
      }
    };
  };

  const buildFulfillmentTimelineChart = (rows: Array<{ date: string; bestelltMenge: number; rausMenge: number }>, g: 'day' | 'week' | 'month') => {
    const labels = rows.map(r => g === 'week' ? formatWeekLabel(r.date) : new Date(r.date).toLocaleDateString('de-DE'));
    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Bestellt (kg)',
            data: rows.map(r => Number(r.bestelltMenge || 0)),
            borderWidth: 1,
            borderRadius: 4,
            backgroundColor: hexToRgba(HEX[2], 0.25),
            borderColor: HEX[2],
          },
          {
            label: 'Raus (kg)',
            data: rows.map(r => Number(r.rausMenge || 0)),
            borderWidth: 1,
            borderRadius: 4,
            backgroundColor: hexToRgba(HEX[3], 0.25),
            borderColor: HEX[3],
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const } }, scales: { y: { beginAtZero: true } } }
    };
  };

  const buildTopArticlesPieChart = (rows: Array<{ artikelName?: string; artikelNummer?: string; menge: number }>) => {
    const top = rows.slice(0, 10);
    const labels = top.map(r => r.artikelName || r.artikelNummer || '—');
    const data = top.map(r => Number(r.menge || 0));
    const bg = labels.map((_, i) => hexToRgba(HEX[i % HEX.length], 0.6));
    const bd = labels.map((_, i) => HEX[i % HEX.length]);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Menge (kg)',
          data,
          backgroundColor: bg,
          borderColor: bd,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom' as const,
            onClick: (_e: any, item: any, legend: any) => {
              // Toggle individual pie slice visibility (Chart.js v3/v4)
              const chart = legend.chart;
              const index = item.index;
              const meta = chart.getDatasetMeta(0);
              const segment = meta.data?.[index];
              if (segment) {
                segment.hidden = !segment.hidden;
                chart.update();
              }
            },
            labels: {
              generateLabels: (chart) => {
                const ds: any = chart.data.datasets[0] || {};
                const data: number[] = (ds.data || []) as number[];
                const labels = chart.data.labels || [];
                const total = data.reduce((a, b) => a + (Number(b) || 0), 0);
                const bgs: string[] = (ds.backgroundColor || []) as string[];
                const bds: string[] = (ds.borderColor || []) as string[];
                const meta = chart.getDatasetMeta(0);
                return labels.map((label: any, i: number) => {
                  const value = Number(data[i] || 0);
                  const pct = total ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                  const hidden = !!(meta?.data?.[i] && (meta.data[i] as any).hidden);
                  return {
                    text: `${label} (${pct})`,
                    fillStyle: bgs[i % bgs.length],
                    strokeStyle: bds[i % bds.length],
                    lineWidth: 1,
                    hidden,
                    datasetIndex: 0,
                    index: i
                  };
                });
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.parsed;
                const total = (ctx.chart.data.datasets[0].data as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
                const pct = total ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                return `${ctx.label}: ${value.toLocaleString('de-DE')} kg (${pct})`;
              }
            }
          }
        }
      }
    };
  };

  const buildPriceExactByDateChart = (rows: Array<{ date: string; preis: number; count: number }>, g: 'day' | 'week' | 'month') => {
    const labels = rows.map(r => g === 'week' ? formatWeekLabel(r.date) : new Date(r.date).toLocaleDateString('de-DE'));
    const data = rows.map(r => Number(r.preis || 0));
    return {
      data: { labels, datasets: [{ label: 'Preis (€)', data, borderWidth: 1, borderRadius: 4, backgroundColor: hexToRgba(HEX[4], 0.35), borderColor: HEX[4] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const } }, scales: { y: { beginAtZero: true } } }
    };
  };

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
          <button className={cx('nav-link', activeTab === 'dashboard' && 'active')} onClick={() => setActiveTab('dashboard')}>
            <i className="ci-analytics me-2" /> Dashboard
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
        {activeTab === 'dashboard' && (
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="mb-0"><i className="ci-analytics me-2" />Kunden-Dashboard</h6>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-secondary" onClick={loadAnalytics} disabled={analyticsLoading}>
                    {analyticsLoading ? <span className="spinner-border spinner-border-sm me-2" /> : <div></div>}
                    Aktualisieren
                  </button>
                </div>
              </div>

              {/* Filterleiste */}
              <div className="row g-3 align-items-end mb-3">
                <div className="col-md-3">
                  <label className="form-label small text-muted"><i className="ci-calendar me-2" />Von</label>
                  <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted"><i className="ci-calendar me-2" />Bis</label>
                  <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted"><i className="ci-trending-up me-2" />Granularität</label>
                  <select className="form-select" value={granularity} onChange={(e) => setGranularity(e.target.value as any)}>
                    <option value="day">Tag</option>
                    <option value="week">Woche</option>
                    <option value="month">Monat</option>
                  </select>
                </div>
              </div>

              {/* Quick Date Range Presets */}
              <div className="mb-3 d-flex flex-wrap gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  const d = new Date(); setFrom(d.toISOString().slice(0, 10)); setTo(d.toISOString().slice(0, 10));
                }}>Heute</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 1); setFrom(d.toISOString().slice(0, 10)); setTo(d.toISOString().slice(0, 10));
                }}>Gestern</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  const now = new Date();
                  const monday = new Date(now); const day = now.getDay() || 7;
                  monday.setDate(now.getDate() - day + 1);
                  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
                  setFrom(monday.toISOString().slice(0, 10)); setTo(sunday.toISOString().slice(0, 10));
                }}>Diese Woche</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  const now = new Date();
                  const monday = new Date(now); const day = now.getDay() || 7;
                  monday.setDate(now.getDate() - day - 6);
                  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
                  setFrom(monday.toISOString().slice(0, 10)); setTo(sunday.toISOString().slice(0, 10));
                }}>Letzte Woche</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  setFrom(first.toISOString().slice(0, 10)); setTo(last.toISOString().slice(0, 10));
                }}>Diesen Monat</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const last = new Date(now.getFullYear(), now.getMonth(), 0);
                  setFrom(first.toISOString().slice(0, 10)); setTo(last.toISOString().slice(0, 10));
                }}>Letzten Monat</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), 0, 1);
                  const last = new Date(now.getFullYear(), 11, 31);
                  setFrom(first.toISOString().slice(0, 10)); setTo(last.toISOString().slice(0, 10));
                }}>Dieses Jahr</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear() - 1, 0, 1);
                  const last = new Date(now.getFullYear() - 1, 11, 31);
                  setFrom(first.toISOString().slice(0, 10)); setTo(last.toISOString().slice(0, 10));
                }}>Letztes Jahr</button>
              </div>

              {analyticsError && <div className="alert alert-danger">{analyticsError}</div>}

              {analyticsLoading ? (
                <div className="d-flex flex-column align-items-center justify-content-center py-5 my-3 border rounded bg-light">
                  <span className="spinner-border mb-3" style={{ width: '3rem', height: '3rem' }} />
                  <div className="fw-medium text-muted">Analytics werden geladen…</div>
                </div>
              ) : analytics ? (
                <>
                  {/* KPI-Zeile */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-3">
                      <div className="p-3 border rounded bg-light h-100">
                        <div className="text-muted small">Menge gesamt</div>
                        <div className="h5 mb-0">{(analytics.totals?.totalMenge ?? 0).toLocaleString('de-DE')} kg</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 border rounded bg-light h-100">
                        <div className="text-muted small">Umsatz gesamt</div>
                        <div className="h5 mb-0">{(analytics.totals?.totalUmsatz ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 border rounded bg-light h-100">
                        <div className="text-muted small">Ø-Preis</div>
                        <div className="h5 mb-0">{(analytics.totals?.avgPreisGewichtet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 border rounded bg-light h-100">
                        <div className="text-muted small">Artikelanzahl</div>
                        <div className="h5 mb-0">{analytics.totals?.artikelCount ?? 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Zeitverlauf (Chart rechts von Tabelle) */}
                  <div className="mb-4">
                    <h6 className="mb-2">Zeitverlauf</h6>
                    <div className="row g-3 align-items-stretch">
                      <div className="col-md-7">
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Periode</th>
                                <th className="text-end">Menge</th>
                                <th className="text-end">Umsatz</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analytics.timeline?.map((t: any, i: number) => (
                                <tr key={i}>
                                  <td>
                                    {granularity === 'week'
                                      ? formatWeekLabel(t.date)
                                      : new Date(t.date).toLocaleDateString('de-DE')}
                                  </td>
                                  <td className="text-end">{t.menge?.toLocaleString('de-DE')}</td>
                                  <td className="text-end">{t.umsatz?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                                </tr>
                              ))}
                              {(!analytics.timeline || analytics.timeline.length === 0) && (
                                <tr><td colSpan={3} className="text-muted">Keine Daten im Zeitraum.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="col-md-5">
                        <div className="card border-0 h-100">
                          <div className="card-body">
                            <div style={{ height: 240 }}>
                              {(() => {
                                const cfg = buildTimelineChart(analytics.timeline || [], granularity);
                                // Mixed chart (bar + line) must use the generic <Chart> component
                                return <Chart type="bar" data={cfg.data as any} options={cfg.options} />;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Erfüllung: Bestellt vs. Raus (Chart rechts von Tabelle) */}
                  <div className="mb-4">
                    <h6 className="mb-2"><i className="ci-check-circle me-2" />Erfüllung (Bestellt vs. Raus)</h6>
                    <div className="row g-3 align-items-stretch">
                      <div className="col-md-7">
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Periode</th>
                                <th className="text-end">Bestellt (kg)</th>
                                <th className="text-end">Raus (kg)</th>
                                <th className="text-end">Differenz</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(analytics.fulfillmentTimeline || []).map((r: any, idx: number) => (
                                <tr key={idx}>
                                  <td>{granularity === 'week' ? formatWeekLabel(r.date) : new Date(r.date).toLocaleDateString('de-DE')}</td>
                                  <td className="text-end">{Number(r.bestelltMenge ?? 0).toLocaleString('de-DE')}</td>
                                  <td className="text-end">{Number(r.rausMenge ?? 0).toLocaleString('de-DE')}</td>
                                  <td className={cx('text-end', Number(r.differenz ?? 0) < 0 && 'text-danger')}>
                                    {Number(r.differenz ?? 0).toLocaleString('de-DE')}
                                  </td>
                                </tr>
                              ))}
                              {(!analytics.fulfillmentTimeline || analytics.fulfillmentTimeline.length === 0) && (
                                <tr><td colSpan={4} className="text-muted">Keine Daten (nur Positionen mit Nettogewicht werden berücksichtigt).</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {/* Totals row */}
                        {analytics.fulfillment && (
                          <div className="mt-2 text-muted small">
                            <span className="me-3"><strong>Summe bestellt:</strong> {Number(analytics.fulfillment.bestelltMenge ?? 0).toLocaleString('de-DE')} kg</span>
                            <span className="me-3"><strong>Summe raus:</strong> {Number(analytics.fulfillment.rausMenge ?? 0).toLocaleString('de-DE')} kg</span>
                            <span className={cx(Number(analytics.fulfillment.differenz ?? 0) < 0 && 'text-danger')}>
                              <strong>Diff:</strong> {Number(analytics.fulfillment.differenz ?? 0).toLocaleString('de-DE')} kg
                            </span>
                            {analytics.fulfillment.rate != null && (
                              <span className="ms-3"><strong>Erfüllungsquote:</strong> {(Number(analytics.fulfillment.rate) * 100).toFixed(1)}%</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="col-md-5">
                        <div className="card border-0 h-100">
                          <div className="card-body">
                            <div style={{ height: 260 }}>
                              {(() => {
                                const cfg = buildFulfillmentTimelineChart(analytics.fulfillmentTimeline || [], granularity);
                                return <Bar data={cfg.data} options={cfg.options} />;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top-Artikel (Pie rechts von Tabelle) */}
                  <div className="mb-4">
                    <h6 className="mb-2"><i className="ci-cube me-2" />Top-Artikel (Menge)</h6>
                    <div className="row g-3 align-items-stretch">
                      <div className="col-md-7">
                        <div className="table-responsive">
                          <table className="table table-sm align-middle">
                            <thead>
                              <tr>
                                <th>Artikel</th>
                                <th className="text-end">Menge</th>
                                <th className="text-end">Umsatz</th>
                                <th className="text-end">Ø-Preis (gew.)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analytics.byArtikel?.map((a: any) => (
                                <tr key={a.artikelId}>
                                  <td>
                                    <div className="fw-medium">{a.artikelName || a.artikelNummer || '—'}</div>
                                    <div className="text-muted small">{a.artikelNummer}</div>
                                  </td>
                                  <td className="text-end">{Number(a.menge ?? 0).toLocaleString('de-DE')}</td>
                                  <td className="text-end">{Number(a.umsatz ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                                  <td className="text-end">{a.avgPreisGewichtet != null ? Number(a.avgPreisGewichtet).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} {a.avgPreisGewichtet != null && '€'}</td>
                                </tr>
                              ))}
                              {(!analytics.byArtikel || analytics.byArtikel.length === 0) && (
                                <tr><td colSpan={4} className="text-muted">Keine Artikel im Zeitraum.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="col-md-5">
                        <div className="card border-0 h-100">
                          <div className="card-body">
                            <div style={{ height: 260 }}>
                              {(() => {
                                const cfg = buildTopArticlesPieChart(analytics.byArtikel || []);
                                return <Pie data={cfg.data} options={cfg.options} />;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preis × Zeitraum (exakt) */}
                  <div className="mt-4">
                    <h6 className="mb-2"><i className="ci-timeline me-2" />Preis × Zeitraum (exakt)</h6>
                    <div className="row g-3 align-items-stretch">
                      <div className="col-md-7">
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Periode</th>
                                <th className="text-end">Preis (€)</th>
                                <th className="text-end">Anzahl</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(analytics.priceExactByDate || []).map((r: any, idx: number) => (
                                <tr key={idx}>
                                  <td>{granularity === 'week' ? formatWeekLabel(r.date) : new Date(r.date).toLocaleDateString('de-DE')}</td>
                                  <td className="text-end">{(Number(r.preis) || 0).toFixed(2)}</td>
                                  <td className="text-end">{r.count}</td>
                                </tr>
                              ))}
                              {(!analytics.priceExactByDate || analytics.priceExactByDate.length === 0) && (
                                <tr><td colSpan={3} className="text-muted">Keine Daten.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="col-md-5">
                        <div className="card border-0 h-100">
                          <div className="card-body">
                            <div style={{ height: 260 }}>
                              {(() => {
                                const cfg = buildPriceExactByDateChart(analytics.priceExactByDate || [], granularity);
                                return <Bar data={cfg.data} options={cfg.options} />;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-muted">Keine Daten.</div>
              )}
            </div>
          </div>
        )}
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-pane fade show active">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="row g-4">
                  <InfoRow label="Email" value={kunde.email} />
                  <InfoRow label="Telefon" value={kunde.telefon} />
                  <InfoRow label="Adresse" value={kunde.adresse} />
                  <InfoRow label="Land" value={kunde.land || 'Deutschland'} />
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
                  {/* Bestimmte Artikel */}
                  <div className="col-12">
                    <hr className="text-muted" />
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <h6 className="text-muted mb-0">Bestimmte Artikel</h6>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setBestimmteOpen(true)}>
                        <i className="ci-edit me-1" /> Bearbeiten
                      </button>
                    </div>
                    <div className="text-muted small mt-2">
                      {kunde.bestimmteArtikel && kunde.bestimmteArtikel.length > 0
                        ? `${kunde.bestimmteArtikel.length} Artikel ausgewählt`
                        : 'Keine Einschränkung – alle Artikel erlaubt.'}
                    </div>
                  </div>
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
                    <input className="form-control" placeholder="Artikel suchen…" value={preisQDraft} onChange={(e) => setPreisQDraft(e.target.value)} />
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
                        <th style={{ width: 36 }}>
                          <input className="form-check-input" type="checkbox" onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()} />
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

      {bestimmteOpen && kunde?.id && (
        <BestimmteArtikelModal
          kundeId={kunde.id}
          initialSelected={kunde.bestimmteArtikel || []}
          onClose={() => setBestimmteOpen(false)}
          onSaved={async () => {
            const fresh = await getKundeById(kunde.id!);
            setKunde(fresh);
          }}
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