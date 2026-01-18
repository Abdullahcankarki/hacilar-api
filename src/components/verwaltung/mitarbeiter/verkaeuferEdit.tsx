// VerkaeuferEdit.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { MitarbeiterResource, MitarbeiterRolle } from '@/Resources';
import { getMitarbeiterById, updateMitarbeiter } from '@/backend/api';

const MitarbeiterRollen: MitarbeiterRolle[] = [
  'admin',
  'verkauf',
  'kommissionierung',
  'buchhaltung',
  'wareneingang',
  'lager',
  'fahrer',
  'statistik',
  'kunde',
  'zerleger',
  'support'
];


const VerkaeuferEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [verkaeufer, setVerkaeufer] = useState<MitarbeiterResource | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const [formData, setFormData] = useState<Omit<MitarbeiterResource, 'id'>>({
    name: '',
    password: '',
    email: '',
    telefon: '',
    abteilung: '',
    aktiv: false,
    eintrittsdatum: '',
    bemerkung: '',
    rollen: []
  });

  useEffect(() => {
    const fetchVerkaeufer = async () => {
      try {
        if (!id) throw new Error('Keine Verkäufer-ID angegeben.');
        const data = await getMitarbeiterById(id);
        setVerkaeufer(data);
        setFormData({
          name: data.name,
          password: '', // Passwort wird leer gelassen
          email: data.email || '',
          telefon: data.telefon || '',
          abteilung: data.abteilung || '',
          aktiv: data.aktiv || false,
          eintrittsdatum: data.eintrittsdatum || '',
          bemerkung: data.bemerkung || '',
          rollen: data.rollen || []
        });
      } catch (err: any) {
        setError(err.message || 'Fehler beim Laden des Verkäufers');
      } finally {
        setLoading(false);
      }
    };
    fetchVerkaeufer();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    if (name === 'rollen') {
      const rolle = value as MitarbeiterRolle;
      setFormData((prev) => {
        const rollenSet = new Set(prev.rollen);
        if (checked) {
          rollenSet.add(rolle);
        } else {
          rollenSet.delete(rolle);
        }
        return {
          ...prev,
          rollen: Array.from(rollenSet),
        };
      });
    } else if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<MitarbeiterResource> = { ...formData };
      if (!payload.password || payload.password.trim() === '') {
        delete payload.password;
      }
      await updateMitarbeiter(id!, payload);
      navigate(`/mitarbeiter/${id}`);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Aktualisieren des Verkäufers');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container text-center my-4">Lädt...</div>;
  if (error)
    return (
      <div className="container my-4">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  if (!verkaeufer)
    return (
      <div className="container my-4">
        <div className="alert alert-warning">Kein Mitarbeiter gefunden.</div>
      </div>
    );

  return (
    <div className="container my-4 shadow p-4 bg-white rounded">
      <h2 className="mb-4 text-center"><i className="ci-user me-2"></i> Mitarbeiter bearbeiten</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label"><i className="ci-user me-2 text-muted"></i> Name</label>
          <input
            name="name"
            type="text"
            className="form-control"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label"><i className="ci-mail me-2 text-muted"></i> E-Mail</label>
          <input
            name="email"
            type="email"
            className="form-control"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label"><i className="ci-phone me-2 text-muted"></i> Telefon</label>
          <input
            name="telefon"
            type="text"
            className="form-control"
            value={formData.telefon}
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <label className="form-label"><i className="ci-briefcase me-2 text-muted"></i> Abteilung</label>
          <input
            name="abteilung"
            type="text"
            className="form-control"
            value={formData.abteilung}
            onChange={handleChange}
          />
        </div>
        <div className="form-check mb-3">
          <input
            name="aktiv"
            type="checkbox"
            className="form-check-input"
            id="aktivCheckbox"
            checked={formData.aktiv}
            onChange={handleChange}
          />
          <label className="form-check-label" htmlFor="aktivCheckbox">
            Aktiv
          </label>
        </div>
        <div className="mb-3">
          <label className="form-label"><i className="ci-calendar me-2 text-muted"></i> Eintrittsdatum</label>
          <input
            name="eintrittsdatum"
            type="date"
            className="form-control"
            value={formData.eintrittsdatum}
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <label className="form-label"><i className="ci-note me-2 text-muted"></i> Bemerkung</label>
          <textarea
            name="bemerkung"
            className="form-control"
            value={formData.bemerkung}
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <label className="form-label"><i className="ci-settings me-2 text-muted"></i> Rollen</label>
          <div>
            {MitarbeiterRollen.map((rolle) => (
              <div className="form-check form-check-inline" key={rolle}>
                <input
                  type="checkbox"
                  className="form-check-input"
                  id={`rolle-${rolle}`}
                  name="rollen"
                  value={rolle}
                  checked={formData.rollen.includes(rolle)}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor={`rolle-${rolle}`}>
                  {rolle}
                </label>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label"><i className="ci-lock me-2 text-muted"></i> Neues Passwort (nur bei Änderung)</label>
          <input
            name="password"
            type="password"
            className="form-control"
            value={formData.password}
            onChange={handleChange}
            placeholder="Leer lassen, falls nicht ändern"
          />
        </div>
        <div className="d-flex">
          <button type="submit" className="btn btn-primary d-inline-flex align-items-center" disabled={saving}>
            <i className="ci-save me-2"></i> {saving ? 'Speichern...' : 'Speichern'}
          </button>
          <Link to={`/mitarbeiter/${verkaeufer.id}`} className="btn btn-outline-secondary ms-2 d-inline-flex align-items-center">
            <i className="ci-arrow-left me-2"></i> Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
};

export default VerkaeuferEdit;