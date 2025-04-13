import React, { useState, useEffect } from 'react';
import { KundeResource, VerkaeuferResource } from '../Resources';
import {
  updateKunde,
  updateVerkaeufer,
  getKundeById,
  getVerkaeuferById,
} from '../backend/api';
import { useAuth } from '../providers/Authcontext';

const Profil: React.FC = () => {
  const { user } = useAuth();
  const [userData, setUserData] = useState<KundeResource | VerkaeuferResource | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const isKunde = 'kundenNummer' in (userData || {});

  useEffect(() => {
    if (!user?.id) return;

    async function fetchData() {
      try {
        const kunde = await getKundeById(user!.id);
        setUserData(kunde);
        setFormData(kunde);
      } catch {
        const verkaeufer = await getVerkaeuferById(user!.id);
        setUserData(verkaeufer);
        setFormData(verkaeufer);
      }
    }

    fetchData();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    try {
      if (isKunde) {
        await updateKunde(user.id, formData);
      } else {
        await updateVerkaeufer(user.id, formData);
      }
      setUserData(formData);
      setIsEditing(false);
    } catch {
      alert("Fehler beim Speichern.");
    }
  };

  if (!userData) return <p className="text-center mt-5">Profil wird geladen...</p>;

  return (
    <div className="container mt-5" style={{ maxWidth: '600px' }}>
      <div className="card border-0 shadow-sm p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="m-0">Mein Profil</h4>
          {!isEditing ? (
            <button className="btn btn-sm btn-outline-primary" onClick={() => setIsEditing(true)}>
              Bearbeiten
            </button>
          ) : (
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-success" onClick={handleSave}>Speichern</button>
              <button className="btn btn-sm btn-secondary" onClick={() => setIsEditing(false)}>Abbrechen</button>
            </div>
          )}
        </div>

        <div className="small text-muted mb-3">
          {isKunde ? `Kundennummer: ${(userData as KundeResource).kundenNummer}` : `Verkäufer-ID: ${userData.id}`}
        </div>

        {/* Kompakte Ansicht */}
        {!isEditing ? (
          <div className="profile-view">
            <p><strong>Name:</strong> {userData.name}</p>
            {isKunde && (
              <>
                <p><strong>Email:</strong> {(userData as KundeResource).email}</p>
                <p><strong>Adresse:</strong> {(userData as KundeResource).adresse}</p>
                <p><strong>Telefon:</strong> {(userData as KundeResource).telefon}</p>
              </>
            )}
          </div>
        ) : (
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Name</label>
              <input
                name="name"
                className="form-control"
                value={formData.name || ''}
                onChange={handleChange}
              />
            </div>

            {isKunde && (
              <>
                <div className="col-12">
                  <label className="form-label">E-Mail</label>
                  <input
                    name="email"
                    type="email"
                    className="form-control"
                    value={formData.email || ''}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Adresse</label>
                  <textarea
                    name="adresse"
                    className="form-control"
                    value={formData.adresse || ''}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Telefon</label>
                  <input
                    name="telefon"
                    className="form-control"
                    value={formData.telefon || ''}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Passwort ändern */}
      {isEditing && (
        <div className="card border-0 shadow-sm p-4 mt-3">
          <h5 className="mb-3">Neues Passwort</h5>
          <input
            type="password"
            className="form-control mb-3"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Neues Passwort eingeben"
          />
          <button className="btn btn-warning w-100" onClick={() => {
            if (newPassword.length < 6) return alert("Passwort zu kurz");
            const updated = { ...formData, password: newPassword };
            user?.id && isKunde
              ? updateKunde(user.id, updated)
              : updateVerkaeufer(user!.id, updated);
            setNewPassword('');
            alert("Passwort geändert.");
          }}>
            Passwort ändern
          </button>
        </div>
      )}
      {/* Konto löschen */}
      {isEditing && (
        <div className="card border-0 shadow-sm p-4 mt-3 mb-5">
          <h5 className="mb-2 text-danger">Konto löschen</h5>
          <p className="text-muted small mb-3">
            Dieser Vorgang kann nicht rückgängig gemacht werden. Die Löschung muss aktuell durch einen Administrator erfolgen.
          </p>
          <button
            className="btn btn-danger w-100"
            onClick={() => alert("Bitte wende dich an den Administrator zur Löschung deines Kontos.")}
          >
            Konto löschen
          </button>
        </div>
      )}
    </div>
  );
};

export default Profil;