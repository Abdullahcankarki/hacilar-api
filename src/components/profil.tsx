import React, { useEffect, useState } from 'react';
import { useAuth } from '../providers/Authcontext';
import { useNavigate } from 'react-router-dom';
import { KundeResource, MitarbeiterResource } from '../Resources';
import {
  getAuftragByCutomerId,
  getKundeById,
  getMitarbeiterById,
  updateKunde,
  updateMitarbeiter,
  getCustomerStopsToday
} from '../backend/api';

const Profil: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<KundeResource | MitarbeiterResource | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingKontakt, setIsEditingKontakt] = useState(false);
  const [kontaktForm, setKontaktForm] = useState<{ email?: string; telefon?: string }>({});
  const [newPassword, setNewPassword] = useState('');
  const [auftraege, setAuftraege] = useState<any[]>([]);
  const [sortField, setSortField] = useState<'lieferdatum' | 'preis' | 'anzahl' | 'status' | 'auftragsnummer' | 'createdAt'>('lieferdatum');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'profil' | 'auftraege'>('profil');
  const [etaLoading, setEtaLoading] = useState<boolean>(false);
  const [etaLabelHeute, setEtaLabelHeute] = useState<string | null>(null);
  const etaReqIdRef = React.useRef(0);

  const formatEtaLabel = (fromIso?: string, toIso?: string) => {
    if (!fromIso || !toIso) return null;
    const now = Date.now();
    const fromMs = new Date(fromIso).getTime();
    const toMs = new Date(toIso).getTime();
    let minMin = Math.max(0, Math.round((fromMs - now) / 60000));
    let maxMin = Math.max(minMin + 15, Math.round((toMs - now) / 60000));
    const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);
    minMin = round5(minMin);
    maxMin = round5(maxMin);
    const fromLocal = new Date(fromMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const toLocal = new Date(toMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${fromLocal}–${toLocal} Uhr`;
  };
  const isKunde = user?.role?.includes('kunde') && !user?.role?.includes('admin');

  const isSameDay = (d?: string | Date) => {
    if (!d) return false;
    const dt = new Date(d);
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };

  useEffect(() => {
    if (!user?.id) return;
    const fetch = async () => {
      try {
        const kunde = await getKundeById(user.id);
        setUserData(kunde);
        setFormData(kunde);
        setKontaktForm({ email: kunde.email, telefon: kunde.telefon });
        const auftraege = await getAuftragByCutomerId(user.id)
        setAuftraege(auftraege);

        // Nur ETA laden, wenn es mind. einen Auftrag mit Lieferdatum HEUTE gibt
        const hasToday = Array.isArray(auftraege) && auftraege.some((a) => isSameDay(a.lieferdatum));
        if (!hasToday) {
          setEtaLoading(false);
          setEtaLabelHeute(null);
        } else {
          // ETA für heutigen Tour-Stop des Kunden laden
          setEtaLoading(true);
          setEtaLabelHeute(null);
          const reqId = ++etaReqIdRef.current;
          try {
            const stops = await getCustomerStopsToday(kunde.id);
            if (reqId === etaReqIdRef.current) {
              const first = Array.isArray(stops) ? stops[0] : undefined;
              if (first && first.etaFromUtc && first.etaToUtc) {
                setEtaLabelHeute(formatEtaLabel(first.etaFromUtc, first.etaToUtc));
              } else {
                setEtaLabelHeute('—');
              }
              setEtaLoading(false);
            }
          } catch (e) {
            if (reqId === etaReqIdRef.current) {
              console.error('ETA (heute) laden fehlgeschlagen', e);
              setEtaLabelHeute('—');
              setEtaLoading(false);
            }
          }
        }
      } catch {
        const verk = await getMitarbeiterById(user.id);
        setUserData(verk);
        setFormData(verk);
        setKontaktForm({ email: verk.email, telefon: verk.telefon });
      }
    };
    fetch();
  }, [user]);
  // Handler für Kontaktformular
  const handleKontaktChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setKontaktForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleKontaktEdit = () => {
    setKontaktForm({
      email: (userData as KundeResource).email,
      telefon: (userData as KundeResource).telefon,
    });
    setIsEditingKontakt(true);
  };

  const handleKontaktSave = async () => {
    if (!user?.id) return;
    const updated = { ...userData, ...kontaktForm };
    await updateKunde(user.id, updated);
    setUserData(updated);
    setFormData(updated);
    setIsEditingKontakt(false);
  };

  const handleKontaktCancel = () => {
    setKontaktForm({
      email: (userData as KundeResource).email,
      telefon: (userData as KundeResource).telefon,
    });
    setIsEditingKontakt(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (isKunde) await updateKunde(user.id, formData);
    else await updateMitarbeiter(user.id, formData);
    setUserData(formData);
    setIsEditing(false);
  };

  if (!userData) return <div className="container py-5">Profil wird geladen...</div>;

  // Statusfarben für Aufträge
  const statusBadge = (status: string) => {
    // Farben nach Status
    if (!status || status.toLowerCase() === 'offen') return 'bg-warning text-dark';
    if (status.toLowerCase() === 'abgeschlossen') return 'bg-success';
    if (status.toLowerCase() === 'storniert') return 'bg-danger';
    return 'bg-secondary';
  };

  return (
    <main className="page-wrapper">
      <div className="container py-5">
        <div className="row">
          {/* Sidebar */}
          <aside className="col-lg-3 mb-4 mb-lg-0">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="d-flex justify-content-center align-items-center bg-light border rounded-circle" style={{ width: '3.5rem', height: '3.5rem' }}>
                    <i className="ci-user text-muted fs-4"></i>
                  </div>
                  <div className="min-w-0 ps-3">
                    <h5 className="h6 mb-1">{userData.name}</h5>
                    {isKunde && <span className="text-muted small">{(userData as KundeResource).email}</span>}
                  </div>
                </div>
                <nav className="list-group list-group-flush">
                  <a
                    className={`list-group-item list-group-item-action d-flex align-items-center${activeTab === 'profil' ? ' active' : ''}`}
                    href="#!"
                    onClick={() => { setActiveTab('profil'); setEtaLabelHeute(null); setEtaLoading(false); etaReqIdRef.current++; }}
                  >
                    <i className="ci-user fs-base opacity-75 me-2"></i>
                    Persönliche Daten
                  </a>
                  {isKunde && (
                    <a
                      className={`list-group-item list-group-item-action d-flex align-items-center${activeTab === 'auftraege' ? ' active' : ''}`}
                      href="#!"
                      onClick={async () => { setActiveTab('auftraege'); /* optional: could re-trigger ETA */ }}
                    >
                      <i className="ci-file fs-base opacity-75 me-2"></i>
                      Aufträge
                    </a>
                  )}
                  <a className="list-group-item list-group-item-action d-flex align-items-center" href="#!" onClick={logout}>
                    <i className="ci-log-out fs-base opacity-75 me-2"></i>
                    Logout
                  </a>
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="col-lg-9">
            {activeTab === 'profil' && (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body">
                    <h2 className="h5 mb-3 pb-2 border-bottom">Basisdaten</h2>
                    <div className="d-flex gap-2 justify-content-end mb-3">
                      <button
                        type="button"
                        className={`btn btn-outline-primary${isEditing ? ' active' : ''}`}
                        onClick={() => setIsEditing(!isEditing)}
                      >
                        {isEditing ? 'Schließen' : 'Bearbeiten'}
                      </button>
                    </div>
                    {!isEditing && (
                      <ul className="list-unstyled fs-sm m-0">
                        <li><strong>Name:</strong> {userData.name}</li>
                        {isKunde && (
                          <>
                            <li><strong>Adresse:</strong> {(userData as KundeResource).adresse}</li>
                            <li><strong>USt-Id:</strong> {(userData as KundeResource).ustId}</li>
                            <li><strong>Handelsregister-Nr:</strong> {(userData as KundeResource).handelsregisterNr}</li>
                            <li><strong>Ansprechpartner:</strong> {(userData as KundeResource).ansprechpartner}</li>
                            <li><strong>Website:</strong> {(userData as KundeResource).website}</li>
                            <li><strong>Gewerbe-Datei:</strong> <a href={(userData as KundeResource).gewerbeDateiUrl} target="_blank" rel="noopener noreferrer">Download</a></li>
                            <li><strong>Zusatz-Datei:</strong> <a href={(userData as KundeResource).zusatzDateiUrl} target="_blank" rel="noopener noreferrer">Download</a></li>
                          </>
                        )}
                        {!isKunde && (
                          <>
                            <li><strong>E-Mail:</strong> {(userData as MitarbeiterResource).email}</li>
                            <li><strong>Telefon:</strong> {(userData as MitarbeiterResource).telefon}</li>
                            <li><strong>Abteilung:</strong> {(userData as MitarbeiterResource).abteilung}</li>
                            <li><strong>Status:</strong> {(userData as MitarbeiterResource).aktiv ?
                              <span className="badge bg-success ms-1">Aktiv</span> : <span className="badge bg-secondary ms-1">nicht aktiv</span>}
                            </li>
                            <li><strong>Eintrittsdatum:</strong> {(userData as MitarbeiterResource).eintrittsdatum}</li>
                            <li><strong>Rollen:</strong> {(userData as MitarbeiterResource).rollen?.join(', ')}</li>
                            <li><strong>Bemerkung:</strong> {(userData as MitarbeiterResource).bemerkung}</li>
                          </>
                        )}
                      </ul>
                    )}
                    {isEditing && (
                      <form className="row">
                        <div className="col-sm-12 mb-3">
                          <label className="form-label">Name</label>
                          <input name="name" className="form-control" value={formData.name || ''} onChange={handleChange} />
                        </div>
                        {isKunde && (
                          <>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Adresse</label>
                              <textarea name="adresse" className="form-control" value={formData.adresse || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">USt-Id</label>
                              <input name="ustId" className="form-control" value={formData.ustId || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Handelsregister-Nr</label>
                              <input name="handelsregisterNr" className="form-control" value={formData.handelsregisterNr || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Ansprechpartner</label>
                              <input name="ansprechpartner" className="form-control" value={formData.ansprechpartner || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Website</label>
                              <input name="website" className="form-control" value={formData.website || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Gewerbe-Datei URL</label>
                              <input name="gewerbeDateiUrl" className="form-control" value={formData.gewerbeDateiUrl || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Zusatz-Datei URL</label>
                              <input name="zusatzDateiUrl" className="form-control" value={formData.zusatzDateiUrl || ''} onChange={handleChange} />
                            </div>
                          </>
                        )}
                        {!isKunde && (
                          <>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">E-Mail</label>
                              <input name="email" type="email" className="form-control" value={formData.email || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Telefon</label>
                              <input name="telefon" className="form-control" value={formData.telefon || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Abteilung</label>
                              <input name="abteilung" className="form-control" value={formData.abteilung || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Eintrittsdatum</label>
                              <input name="eintrittsdatum" type="date" className="form-control" value={formData.eintrittsdatum || ''} onChange={handleChange} />
                            </div>
                            <div className="col-sm-12 mb-3 form-check">
                              <input className="form-check-input" type="checkbox" name="aktiv" id="aktiv" checked={formData.aktiv || false} onChange={(e) => setFormData((prev: any) => ({ ...prev, aktiv: e.target.checked }))} />
                              <label className="form-check-label" htmlFor="aktiv">Aktiv</label>
                            </div>
                            <div className="col-sm-12 mb-3">
                              <label className="form-label">Bemerkung</label>
                              <textarea name="bemerkung" className="form-control" value={formData.bemerkung || ''} onChange={handleChange} />
                            </div>
                          </>
                        )}
                        <div className="col-12 d-flex gap-2 justify-content-end pt-2">
                          <button type="button" className="btn btn-outline-primary" onClick={handleSave}>Änderungen speichern</button>
                          <button type="button" className="btn btn-outline-secondary" onClick={() => setIsEditing(false)}>Abbrechen</button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>

                {isKunde && (
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body">
                      <h3 className="h6 mb-3 pb-2 border-bottom">Kontakt</h3>
                      {!isEditingKontakt ? (
                        <>
                          <ul className="list-unstyled fs-sm m-0 mb-3">
                            <li><strong>E-Mail:</strong> {(userData as KundeResource).email}</li>
                            <li><strong>Telefon:</strong> {(userData as KundeResource).telefon}</li>
                          </ul>
                          <div className="d-flex gap-2 justify-content-end">
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              onClick={handleKontaktEdit}
                            >
                              Bearbeiten
                            </button>
                          </div>
                        </>
                      ) : (
                        <form className="row mb-3">
                          <div className="col-sm-12 mb-3">
                            <label className="form-label">E-Mail</label>
                            <input
                              name="email"
                              type="email"
                              className="form-control"
                              value={kontaktForm.email || ''}
                              onChange={handleKontaktChange}
                            />
                          </div>
                          <div className="col-sm-12 mb-3">
                            <label className="form-label">Telefon</label>
                            <input
                              name="telefon"
                              className="form-control"
                              value={kontaktForm.telefon || ''}
                              onChange={handleKontaktChange}
                            />
                          </div>
                          <div className="col-12 d-flex gap-2 justify-content-end pt-2">
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              onClick={handleKontaktSave}
                            >
                              Speichern
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={handleKontaktCancel}
                            >
                              Abbrechen
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                )}

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body">
                    <h3 className="h6 mb-3 pb-2 border-bottom">Passwort ändern</h3>
                    <form>
                      <div className="mb-3">
                        <label className="form-label">Neues Passwort</label>
                        <input
                          type="password"
                          className="form-control"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Neues Passwort"
                        />
                      </div>
                      <div className="d-flex gap-2 justify-content-end">
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          onClick={async () => {
                            if (newPassword.length < 6) return alert("Passwort zu kurz");
                            const updated = { ...formData, password: newPassword };
                            if (isKunde) await updateKunde(user!.id, updated);
                            else await updateMitarbeiter(user!.id, updated);
                            setNewPassword('');
                            alert("Passwort geändert.");
                          }}
                        >
                          Passwort aktualisieren
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body">
                    <h3 className="h6 mb-3 pb-2 border-bottom text-danger">Konto löschen</h3>
                    <p className="fs-sm">
                      Wenn du dein Konto löschen möchtest, wende dich bitte an den Support. Dieser Vorgang ist nicht automatisch möglich.
                    </p>
                    <div className="d-flex gap-2 justify-content-end">
                      <button
                        className="btn btn-danger"
                        type="button"
                        onClick={() => alert("Bitte kontaktiere den Administrator zur Kontolöschung.")}
                      >
                        Konto löschen
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
            {activeTab === 'auftraege' && isKunde && (
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                  <h2 className="h5 mb-3 pb-2 border-bottom">Meine letzten Aufträge</h2>
                  <div className="table-responsive">
                    {/* Sortier-Handler */}
                    {(() => {
                      // Sortier-Handler für Aufträge
                      var sortedAuftraege = [...auftraege].sort((a, b) => {
                        let aValue: any, bValue: any;
                        switch (sortField) {
                          case 'lieferdatum':
                            aValue = a.lieferdatum ? new Date(a.lieferdatum).getTime() : 0;
                            bValue = b.lieferdatum ? new Date(b.lieferdatum).getTime() : 0;
                            break;
                          case 'preis':
                            aValue = a.preis || 0;
                            bValue = b.preis || 0;
                            break;
                          case 'anzahl':
                            aValue = a.artikelPosition?.length || 0;
                            bValue = b.artikelPosition?.length || 0;
                            break;
                          case 'status':
                            aValue = a.status || '';
                            bValue = b.status || '';
                            break;
                          case 'auftragsnummer':
                            aValue = a.id?.slice(-6).toUpperCase() || '';
                            bValue = b.id?.slice(-6).toUpperCase() || '';
                            break;
                          case 'createdAt':
                            aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            break;
                          default:
                            return 0;
                        }
                        if (typeof aValue === 'string') {
                          return sortDirection === 'asc'
                            ? aValue.localeCompare(bValue)
                            : bValue.localeCompare(aValue);
                        }
                        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                      });
                      return (
                        <table className="table table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th
                                className="text-center"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSortField('auftragsnummer');
                                  setSortDirection(sortField === 'auftragsnummer' && sortDirection === 'asc' ? 'desc' : 'asc');
                                }}
                              >
                                Auftragsnummer {sortField === 'auftragsnummer' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                              </th>
                              <th
                                className="text-center d-none d-md-table-cell"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSortField('createdAt');
                                  setSortDirection(sortField === 'createdAt' && sortDirection === 'asc' ? 'desc' : 'asc');
                                }}
                              >
                                Bestellt am {sortField === 'createdAt' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                              </th>
                              <th
                                className="text-center"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSortField('lieferdatum');
                                  setSortDirection(sortField === 'lieferdatum' && sortDirection === 'asc' ? 'desc' : 'asc');
                                }}
                              >
                                Lieferdatum {sortField === 'lieferdatum' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                              </th>
                              <th
                                className="text-center d-none d-md-table-cell"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSortField('anzahl');
                                  setSortDirection(sortField === 'anzahl' && sortDirection === 'asc' ? 'desc' : 'asc');
                                }}
                              >
                                Artikel {sortField === 'anzahl' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                              </th>
                              <th
                                className="text-center d-none d-md-table-cell"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSortField('preis');
                                  setSortDirection(sortField === 'preis' && sortDirection === 'asc' ? 'desc' : 'asc');
                                }}
                              >
                                Gesamtpreis {sortField === 'preis' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                              </th>
                              <th
                                className="text-center d-none d-md-table-cell"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSortField('status');
                                  setSortDirection(sortField === 'status' && sortDirection === 'asc' ? 'desc' : 'asc');
                                }}
                              >
                                Status {sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                              </th>
                              <th className="text-center">Ankunft</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedAuftraege.map((auftrag) => (
                              <tr
                                key={auftrag.id}
                                onClick={() => navigate(`/auftraege/${auftrag.id}`)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td className="fw-medium text-center">{auftrag.auftragsnummer}</td>
                                <td className="text-center d-none d-md-table-cell">{auftrag.createdAt ? new Date(auftrag.createdAt).toLocaleDateString() : '-'}</td>
                                <td className="text-center">{auftrag.lieferdatum ? new Date(auftrag.lieferdatum).toLocaleDateString() : '-'}</td>
                                <td className="text-center d-none d-md-table-cell">{auftrag.artikelPosition?.length || 0}</td>
                                <td className="text-center d-none d-md-table-cell">{auftrag.preis?.toFixed(2) || '0.00'} €</td>
                                <td className="text-center d-none d-md-table-cell">
                                  <span className={`badge ${statusBadge(auftrag.status)}`}>{auftrag.status || 'offen'}</span>
                                </td>
                                <td className="text-center">
                                  {isSameDay(auftrag.lieferdatum) ? (
                                    etaLoading ? (
                                      <div className="progress" style={{ height: 6 }}>
                                        <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: '100%' }} />
                                      </div>
                                    ) : (
                                      <span className="small text-nowrap">{etaLabelHeute ?? '—'}</span>
                                    )
                                  ) : (
                                    <span className="small text-nowrap">{auftrag.lieferdatum ? new Date(auftrag.lieferdatum).toLocaleDateString() : '—'}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </main>
  );
};

export default Profil;