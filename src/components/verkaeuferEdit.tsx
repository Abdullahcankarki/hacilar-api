// VerkaeuferEdit.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { VerkaeuferResource } from '../Resources';
import { getVerkaeuferById, updateVerkaeufer } from '../backend/api';

const VerkaeuferEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [verkaeufer, setVerkaeufer] = useState<VerkaeuferResource | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const [formData, setFormData] = useState<Omit<VerkaeuferResource, 'id'>>({
    name: '',
    admin: false,
    password: '',
  });

  useEffect(() => {
    const fetchVerkaeufer = async () => {
      try {
        if (!id) throw new Error('Keine Verkäufer-ID angegeben.');
        const data = await getVerkaeuferById(id);
        setVerkaeufer(data);
        setFormData({
          name: data.name,
          admin: data.admin,
          password: '', // Passwort wird leer gelassen
        });
      } catch (err: any) {
        setError(err.message || 'Fehler beim Laden des Verkäufers');
      } finally {
        setLoading(false);
      }
    };
    fetchVerkaeufer();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<VerkaeuferResource> = { ...formData };
      if (!payload.password || payload.password.trim() === '') {
        delete payload.password;
      }
      await updateVerkaeufer(id!, payload);
      navigate(`/verkaeufer/${id}`);
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
        <div className="alert alert-warning">Kein Verkäufer gefunden.</div>
      </div>
    );

  return (
    <div className="container my-4">
      <h2 className="mb-4 text-center">Verkäufer bearbeiten</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Name</label>
          <input
            name="name"
            type="text"
            className="form-control"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-check mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            name="admin"
            id="adminCheck"
            checked={formData.admin}
            onChange={handleChange}
          />
          <label className="form-check-label" htmlFor="adminCheck">
            Admin-Rechte
          </label>
        </div>
        <div className="mb-3">
          <label className="form-label">Neues Passwort (nur bei Änderung)</label>
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
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
          <Link to={`/verkaeufer/${verkaeufer.id}`} className="btn btn-secondary ms-2">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
};

export default VerkaeuferEdit;