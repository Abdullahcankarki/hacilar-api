import React, { useEffect, useState } from 'react';
import { useAuth } from '../providers/Authcontext';
import { KundeResource, MitarbeiterResource } from '../Resources';
import {
  getKundeById,
  getMitarbeiterById,
  updateKunde,
  updateMitarbeiter,
} from '../backend/api';

const Profil: React.FC = () => {
  const { user, logout } = useAuth();
  const [userData, setUserData] = useState<KundeResource | MitarbeiterResource | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const isKunde = 'kundenNummer' in (userData || {});

  useEffect(() => {
    if (!user?.id) return;
    const fetch = async () => {
      try {
        const kunde = await getKundeById(user.id);
        setUserData(kunde);
        setFormData(kunde);
      } catch {
        const verk = await getMitarbeiterById(user.id);
        setUserData(verk);
        setFormData(verk);
      }
    };
    fetch();
  }, [user]);

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

  return (
    <main className="content-wrapper">
      <div className="container py-5 mt-n2 mt-sm-0">
        <div className="row pt-md-2 pt-lg-3 pb-sm-2 pb-md-3 pb-lg-4 pb-xl-5">

          {/* Sidebar */}
          <aside className="col-lg-3">
            <div className="offcanvas-lg offcanvas-start pe-lg-0 pe-xl-4" id="accountSidebar">
              <div className="offcanvas-header d-lg-block py-3 p-lg-0">
                <div className="d-flex align-items-center">
                  <div className="h5 d-flex justify-content-center align-items-center flex-shrink-0 text-primary bg-primary-subtle rounded-circle mb-0" style={{ width: '3rem', height: '3rem' }}>
                    {userData.name![0]}
                  </div>
                  <div className="min-w-0 ps-3">
                    <h5 className="h6 mb-1">{userData.name}</h5>
                    {isKunde && <span className="text-muted small">{(userData as KundeResource).email}</span>}
                  </div>
                </div>
                <button type="button" className="btn-close d-lg-none" data-bs-dismiss="offcanvas" aria-label="Close"></button>
              </div>
              <div className="offcanvas-body d-block pt-2 pt-lg-4 pb-lg-0">
                <nav className="list-group list-group-borderless">
                  <a className="list-group-item list-group-item-action d-flex align-items-center active" href="#!">
                    <i className="ci-user fs-base opacity-75 me-2"></i>
                    Personal info
                  </a>
                  <a className="list-group-item list-group-item-action d-flex align-items-center" href="#!" onClick={logout}>
                    <i className="ci-log-out fs-base opacity-75 me-2"></i>
                    Logout
                  </a>
                </nav>
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className="col-lg-9">
            <div className="ps-lg-3 ps-xl-0">
              <h1 className="h2 mb-1 mb-sm-2">Personal Info</h1>

              {/* Basisdaten */}
              <div className="border-bottom py-4">
                <div className="nav d-flex justify-content-between align-items-center pb-1 mb-3">
                  <h2 className="h6 mb-0">Basisdaten</h2>
                  <a className="nav-link text-decoration-underline p-0" href="#!" onClick={() => setIsEditing(!isEditing)}>
                    {isEditing ? 'Schließen' : 'Bearbeiten'}
                  </a>
                </div>
                {!isEditing && (
                  <ul className="list-unstyled fs-sm m-0">
                    <li><strong>Name:</strong> {userData.name}</li>
                    {isKunde && <>
                      <li><strong>Adresse:</strong> {(userData as KundeResource).adresse}</li>
                      <li><strong>USt-Id:</strong> {(userData as KundeResource).ustId}</li>
                      <li><strong>Handelsregister-Nr:</strong> {(userData as KundeResource).handelsregisterNr}</li>
                      <li><strong>Ansprechpartner:</strong> {(userData as KundeResource).ansprechpartner}</li>
                      <li><strong>Website:</strong> {(userData as KundeResource).website}</li>
                      <li><strong>Gewerbe-Datei:</strong> <a href={(userData as KundeResource).gewerbeDateiUrl} target="_blank" rel="noopener noreferrer">Download</a></li>
                      <li><strong>Zusatz-Datei:</strong> <a href={(userData as KundeResource).zusatzDateiUrl} target="_blank" rel="noopener noreferrer">Download</a></li>
                    </>}
                    {!isKunde && <>
                      <li><strong>E-Mail:</strong> {(userData as MitarbeiterResource).email}</li>
                      <li><strong>Telefon:</strong> {(userData as MitarbeiterResource).telefon}</li>
                      <li><strong>Abteilung:</strong> {(userData as MitarbeiterResource).abteilung}</li>
                      <li><strong>Status:</strong> {(userData as MitarbeiterResource).aktiv ? 'Aktiv' : 'nicht aktiv'}</li>
                      <li><strong>Eintrittsdatum:</strong> {(userData as MitarbeiterResource).eintrittsdatum}</li>
                      <li><strong>Rollen:</strong> {(userData as MitarbeiterResource).rollen?.join(', ')}</li>
                      <li><strong>Bemerkung:</strong> {(userData as MitarbeiterResource).bemerkung}</li>
                    </>}
                  </ul>
                )}
                {isEditing && (
                  <form className="row g-3 g-sm-4">
                    <div className="col-sm-12">
                      <label className="form-label">Name</label>
                      <input name="name" className="form-control" value={formData.name || ''} onChange={handleChange} />
                    </div>
                    {isKunde && <>
                      <div className="col-sm-12">
                        <label className="form-label">Adresse</label>
                        <textarea name="adresse" className="form-control" value={formData.adresse || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">USt-Id</label>
                        <input name="ustId" className="form-control" value={formData.ustId || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Handelsregister-Nr</label>
                        <input name="handelsregisterNr" className="form-control" value={formData.handelsregisterNr || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Ansprechpartner</label>
                        <input name="ansprechpartner" className="form-control" value={formData.ansprechpartner || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Website</label>
                        <input name="website" className="form-control" value={formData.website || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Gewerbe-Datei URL</label>
                        <input name="gewerbeDateiUrl" className="form-control" value={formData.gewerbeDateiUrl || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Zusatz-Datei URL</label>
                        <input name="zusatzDateiUrl" className="form-control" value={formData.zusatzDateiUrl || ''} onChange={handleChange} />
                      </div>
                    </>}
                    {!isKunde && <>
                      <div className="col-sm-12">
                        <label className="form-label">E-Mail</label>
                        <input name="email" type="email" className="form-control" value={formData.email || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Telefon</label>
                        <input name="telefon" className="form-control" value={formData.telefon || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Abteilung</label>
                        <input name="abteilung" className="form-control" value={formData.abteilung || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Eintrittsdatum</label>
                        <input name="eintrittsdatum" type="date" className="form-control" value={formData.eintrittsdatum || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12 form-check">
                        <input className="form-check-input" type="checkbox" name="aktiv" id="aktiv" checked={formData.aktiv || false} onChange={(e) => setFormData((prev: any) => ({ ...prev, aktiv: e.target.checked }))} />
                        <label className="form-check-label" htmlFor="aktiv">Aktiv</label>
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Bemerkung</label>
                        <textarea name="bemerkung" className="form-control" value={formData.bemerkung || ''} onChange={handleChange} />
                      </div>
                    </>}
                    <div className="col-12 d-flex gap-3 pt-2">
                      <button type="button" className="btn btn-primary" onClick={handleSave}>Änderungen speichern</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>Abbrechen</button>
                    </div>
                  </form>
                )}
              </div>

              {/* Kontakt */}
              {isKunde && (
                <div className="border-bottom py-4">
                  <div className="nav d-flex justify-content-between align-items-center pb-1 mb-3">
                    <h2 className="h6 mb-0">Kontakt</h2>
                    <a className="nav-link text-decoration-underline p-0" href="#!" onClick={() => setIsEditing(!isEditing)}>
                      {isEditing ? 'Schließen' : 'Bearbeiten'}
                    </a>
                  </div>
                  {!isEditing && (
                    <ul className="list-unstyled fs-sm m-0">
                      <li>{(userData as KundeResource).email}</li>
                      <li>{(userData as KundeResource).telefon}</li>
                    </ul>
                  )}
                  {isEditing && (
                    <form className="row g-3 g-sm-4">
                      <div className="col-sm-12">
                        <label className="form-label">E-Mail</label>
                        <input name="email" type="email" className="form-control" value={formData.email || ''} onChange={handleChange} />
                      </div>
                      <div className="col-sm-12">
                        <label className="form-label">Telefon</label>
                        <input name="telefon" className="form-control" value={formData.telefon || ''} onChange={handleChange} />
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Passwort ändern */}
              <div className="border-bottom py-4">
                <div className="nav d-flex justify-content-between align-items-center pb-1 mb-3">
                  <h2 className="h6 mb-0">Passwort ändern</h2>
                </div>
                <input
                  type="password"
                  className="form-control mb-3"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Neues Passwort"
                />
                <button className="btn btn-warning" onClick={async () => {
                  if (newPassword.length < 6) return alert("Passwort zu kurz");
                  const updated = { ...formData, password: newPassword };
                  if (isKunde) await updateKunde(user!.id, updated);
                  else await updateMitarbeiter(user!.id, updated);
                  setNewPassword('');
                  alert("Passwort geändert.");
                }}>
                  Passwort aktualisieren
                </button>
              </div>

              {/* Konto löschen */}
              <div className="pt-3 mt-2 mt-sm-3">
                <h2 className="h6">Konto löschen</h2>
                <p className="fs-sm">
                  Wenn du dein Konto löschen möchtest, wende dich bitte an den Support. Dieser Vorgang ist nicht automatisch möglich.
                </p>
                <button className="btn btn-danger" onClick={() => alert("Bitte kontaktiere den Administrator zur Kontolöschung.")}>
                  Konto löschen
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
};

export default Profil;