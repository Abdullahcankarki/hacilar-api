// KundeEdit.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { KundeResource } from '../Resources';
import { getKundeById, updateKunde } from '../backend/api';

const KundeEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kunde, setKunde] = useState<KundeResource | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  
  // Formulardaten: Passwort ist leer, wenn nicht geändert
  const [formData, setFormData] = useState<Omit<KundeResource, 'id' | 'updatedAt'>>({
    name: '',
    kundenNummer: '',
    password: '',
    email: '',
    adresse: '',
    telefon: '',
  });

  useEffect(() => {
    const fetchKunde = async () => {
      try {
        if (!id) throw new Error('Keine Kunden-ID angegeben.');
        const data = await getKundeById(id);
        setKunde(data);
        setFormData({
          name: data.name,
          kundenNummer: data.kundenNummer,
          password: '', // Passwort nicht vorab anzeigen
          email: data.email || '',
          adresse: data.adresse || '',
          telefon: data.telefon || '',
        });
      } catch (err: any) {
        setError(err.message || 'Fehler beim Laden des Kunden');
      } finally {
        setLoading(false);
      }
    };
    fetchKunde();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Erstelle ein Payload, das das Passwort nur enthält, wenn es geändert wurde.
      const payload: Partial<Omit<KundeResource, 'id' | 'updatedAt'>> = { ...formData };
      if (!payload.password || payload.password.trim() === '') {
        delete payload.password;
      }
      await updateKunde(id!, payload);
      navigate(`/kunden/${id}`);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Aktualisieren des Kunden');
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
  if (!kunde)
    return (
      <div className="container my-4">
        <div className="alert alert-warning">Kein Kunde gefunden.</div>
      </div>
    );

  return (
    <div className="container my-4">
      <h2 className="mb-4 text-center">Kunde bearbeiten</h2>
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
        <div className="mb-3">
          <label className="form-label">Kundennummer</label>
          <input
            name="kundenNummer"
            type="text"
            className="form-control"
            value={formData.kundenNummer}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
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
          <label className="form-label">Adresse</label>
          <input
            name="adresse"
            type="text"
            className="form-control"
            value={formData.adresse}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Telefon</label>
          <input
            name="telefon"
            type="text"
            className="form-control"
            value={formData.telefon}
            onChange={handleChange}
          />
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
          <Link to={`/kunden/${kunde.id}`} className="btn btn-secondary ms-2">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
};

export default KundeEdit;