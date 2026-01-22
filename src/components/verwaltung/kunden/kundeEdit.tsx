// KundeEdit.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { KundeResource } from '@/Resources';
import { getKundeById, updateKunde } from '@/backend/api';

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
    land: 'Deutschland',
    telefon: '',
    lieferzeit: '',
    ustId: '',
    handelsregisterNr: '',
    ansprechpartner: '',
    website: '',
    isApproved: false,
    gewerbeDateiUrl: '',
    zusatzDateiUrl: '',
    kategorie: '',
    region: '',
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
          land: data.land || 'Deutschland',
          telefon: data.telefon || '',
          lieferzeit: data.lieferzeit || '',
          ustId: data.ustId || '',
          handelsregisterNr: data.handelsregisterNr || '',
          ansprechpartner: data.ansprechpartner || '',
          website: data.website || '',
          isApproved: data.isApproved ?? false,
          gewerbeDateiUrl: data.gewerbeDateiUrl || '',
          zusatzDateiUrl: data.zusatzDateiUrl || '',
          kategorie: data.kategorie || '',
          region: data.region || '',
        });
      } catch (err: any) {
        setError(err.message || 'Fehler beim Laden des Kunden');
      } finally {
        setLoading(false);
      }
    };
    fetchKunde();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'isApproved' && e.target instanceof HTMLInputElement) {
      setFormData({
        ...formData,
        isApproved: e.target.checked,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
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
      console.error('Fehler beim Speichern:', err);
      if (err.response && err.response.data && typeof err.response.data === 'object') {
        const serverErrors = Object.values(err.response.data).join(' ');
        setError(`Fehler vom Server: ${serverErrors}`);
      } else {
        setError(err.message || 'Unbekannter Fehler beim Aktualisieren des Kunden.');
      }
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
      <div className="card shadow">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">Kunde bearbeiten</h5>
        </div>
        {/* Fehler-Alert oberhalb des Formulars */}
        {error && (
          <div className="alert alert-danger mx-3 mt-3">
            <i className="ci-warning me-2"></i>{error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6 mb-3">
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
              <div className="col-md-6 mb-3">
                <label className="form-label">USt-IdNr.</label>
                <input
                  name="ustId"
                  type="text"
                  className="form-control"
                  value={formData.ustId}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Handelsregister-Nr.</label>
                <input
                  name="handelsregisterNr"
                  type="text"
                  className="form-control"
                  value={formData.handelsregisterNr}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Ansprechpartner</label>
                <input
                  name="ansprechpartner"
                  type="text"
                  className="form-control"
                  value={formData.ansprechpartner}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Website</label>
                <input
                  name="website"
                  type="text"
                  className="form-control"
                  value={formData.website}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 mb-3">
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
              <div className="col-md-6 mb-3">
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
              <div className="col-md-6 mb-3">
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
              <div className="col-md-6 mb-3">
                <label className="form-label">Land</label>
                <select
                  name="land"
                  className="form-select"
                  value={formData.land || 'Deutschland'}
                  onChange={handleChange}
                >
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
              <div className="col-md-6 mb-3">
                <label className="form-label">Telefon</label>
                <input
                  name="telefon"
                  type="text"
                  className="form-control"
                  value={formData.telefon}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Lieferzeit</label>
                <input
                  name="lieferzeit"
                  type="text"
                  className="form-control"
                  value={formData.lieferzeit}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Kategorie</label>
                <input
                  name="kategorie"
                  type="text"
                  className="form-control"
                  value={formData.kategorie}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Region</label>
                <input
                  name="region"
                  type="text"
                  className="form-control"
                  value={formData.region}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Gewerbe Datei URL</label>
                <input
                  name="gewerbeDateiUrl"
                  type="text"
                  className="form-control"
                  value={formData.gewerbeDateiUrl}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Zusatz Datei URL</label>
                <input
                  name="zusatzDateiUrl"
                  type="text"
                  className="form-control"
                  value={formData.zusatzDateiUrl}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="mb-3 form-check">
              <input
                name="isApproved"
                type="checkbox"
                className="form-check-input"
                id="isApproved"
                checked={formData.isApproved}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="isApproved">
                Genehmigt
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
          </div>
          <div className="card-footer text-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              <i className="ci-save me-2"></i>
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
            <Link
              to={`/kunden/${kunde.id}`}
              className="btn btn-secondary ms-2"
            >
              <i className="ci-arrow-left me-2"></i>
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default KundeEdit;