// KundeDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { KundeResource, AuftragResource } from '../Resources';
import { getKundeById, apiFetch, api } from '../backend/api';

const KundeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kunde, setKunde] = useState<KundeResource | null>(null);
  const [auftraege, setAuftraege] = useState<AuftragResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id) throw new Error('Keine Kunden-ID angegeben.');
        // Lade Kundendaten
        const kundeData = await getKundeById(id);
        setKunde(kundeData);
        // Lade Aufträge des Kunden (angenommener Endpunkt)
        const auftraegeData = await apiFetch<AuftragResource[]>(`/api/auftrag/kunden/${id}`);
        setAuftraege(auftraegeData);
      } catch (err: any) {
        setError(err.message || 'Fehler beim Laden der Daten');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    if (!window.confirm('Möchten Sie diesen Kunden wirklich löschen?')) return;
    try {
      await api.deleteKunde(id);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Kunden');
    }
  };

  if (loading) {
    return (
      <div className="container text-center my-4">
        <p>Lädt...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="container my-4">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }
  if (!kunde) {
    return (
      <div className="container my-4">
        <div className="alert alert-warning">Kein Kunde gefunden.</div>
      </div>
    );
  }

  // Aufträge gruppieren
  const offeneAuftraege = auftraege.filter(a => a.status === 'offen');
  const inBearbeitungAuftraege = auftraege.filter(a => a.status === 'in Bearbeitung');
  const abgeschlosseneAuftraege = auftraege.filter(a => a.status === 'abgeschlossen');
  const stornierteAuftraege = auftraege.filter(a => a.status === 'storniert');

  // Hilfsfunktion: Rendern einer Auftragsliste

  const renderAuftragsListe = (title: string, list: AuftragResource[]) => (
    <div className="mb-4">
      <h5>{title} ({list.length})</h5>
      {list.length === 0 ? (
        <p className="text-muted">Keine Aufträge in diesem Status.</p>
      ) : (
        <ul className="list-group">
          {list.map(auftrag => (
            <Link
              key={auftrag.id}
              to={`/auftraege/${auftrag.id}`}
              className="list-group-item list-group-item-action d-flex justify-content-between align-items-center text-dark text-decoration-none"
            >
              <div className="w-100">
                <div className="d-flex justify-content-between">
                  <strong>Auftrag #{auftrag.id?.slice(-6).toUpperCase()}</strong>
                  <small
                    className="text-muted"
                    title={`Zuletzt geändert: ${new Date(auftrag.updatedAt!).toLocaleString('de-DE')}`}
                  >
                    {new Date(auftrag.createdAt!).toLocaleDateString('de-DE')}
                  </small>
                </div>

                {auftrag.lieferdatum && (
                  <div className="text-muted small mt-1">
                    Lieferung am: {new Date(auftrag.lieferdatum).toLocaleDateString('de-DE')}
                  </div>
                )}

                <div className="text-muted small d-flex flex-wrap mt-1">
                  {auftrag.gewicht != null && <span className="me-3">Gewicht: {auftrag.gewicht} kg</span>}
                  {auftrag.preis != null && <span className="me-3">Wert: {auftrag.preis.toFixed(2)} €</span>}
                  {auftrag.bemerkungen && (
                    <span className="me-3">
                      <i className="ci-note text-muted" title={auftrag.bemerkungen}></i>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="container my-4">
      {/* Header-Bereich als Cartzilla Card */}
      <div className="card shadow mb-4">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{kunde.name}</h5>
          <div>
            <Link to={`/kunden/edit/${kunde.id}`} className="btn btn-light btn-sm me-2">
              <i className="ci-edit me-1"></i> Bearbeiten
            </Link>
            <button className="btn btn-light btn-sm me-2" onClick={() => handleDelete(kunde.id)}>
              <i className="ci-trash me-1"></i> Löschen
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={async () => {
                try {
                  await api.updateKunde(kunde.id!, { isApproved: true });
                  const updatedKunde = await getKundeById(kunde.id!);
                  setKunde(updatedKunde);
                } catch (err: any) {
                  setError(err.message || 'Fehler beim Genehmigen des Kunden');
                }
              }}
              disabled={kunde.isApproved}
            >
              <i className="ci-check me-1"></i> Genehmigen
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="row g-4">
            <div className="col-md-4">
              <p className="mb-1"><strong>Email</strong></p>
              <p>{kunde.email}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Adresse</strong></p>
              <p>{kunde.adresse}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Telefon</strong></p>
              <p>{kunde.telefon}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Lieferzeit</strong></p>
              <p>{kunde.lieferzeit}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Kundennummer</strong></p>
              <p>{kunde.kundenNummer || '-'}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>USt-ID</strong></p>
              <p>{kunde.ustId || '-'}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Handelsregister-Nr.</strong></p>
              <p>{kunde.handelsregisterNr || '-'}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Ansprechpartner</strong></p>
              <p>{kunde.ansprechpartner || '-'}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Website</strong></p>
              <p>{kunde.website || '-'}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Gewerbedatei</strong></p>
              <p>
                {kunde.gewerbeDateiUrl ? (
                  <a href={kunde.gewerbeDateiUrl} target="_blank" rel="noopener noreferrer">Anzeigen</a>
                ) : '-'}
              </p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Zusatzdatei</strong></p>
              <p>
                {kunde.zusatzDateiUrl ? (
                  <a href={kunde.zusatzDateiUrl} target="_blank" rel="noopener noreferrer">Anzeigen</a>
                ) : '-'}
              </p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Genehmigt</strong></p>
              <p>{kunde.isApproved ? 'Ja' : 'Nein'}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Letzte Änderung</strong></p>
              <p>{kunde.updatedAt ? new Date(kunde.updatedAt).toLocaleString('de-DE') : '-'}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Kategorie</strong></p>
              <p>{kunde.kategorie || '-'}</p>
            </div>
            <div className="col-md-4">
              <p className="mb-1"><strong>Region</strong></p>
              <p>{kunde.region || '-'}</p>
            </div>
          </div>
        </div>
        <div className="card-footer text-end">
          <button className="btn btn-outline-secondary" onClick={() => navigate('/kunden')}>
            <i className="ci-arrow-left me-1"></i> Zurück zur Liste
          </button>
        </div>
      </div>

      {/* Auftragsbereich als Cartzilla Card */}
      <div className="card shadow">
        <div className="card-header bg-secondary text-white">
          <h6 className="mb-0">Aufträge</h6>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              {renderAuftragsListe('Offene Aufträge', offeneAuftraege)}
              {renderAuftragsListe('Aufträge in Bearbeitung', inBearbeitungAuftraege)}
            </div>
            <div className="col-md-6">
              {renderAuftragsListe('Abgeschlossene Aufträge', abgeschlosseneAuftraege)}
              {renderAuftragsListe('Stornierte Aufträge', stornierteAuftraege)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KundeDetail;