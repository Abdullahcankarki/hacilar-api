// KundeDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { KundeResource, AuftragResource } from '../Resources';
import { getKundeById, apiFetch } from '../backend/api';

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
              <div>
                <div><strong>Bestellt am:</strong>{' '}
                  {new Date(auftrag.createdAt!).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                {auftrag.lieferdatum && (
                  <div className="text-muted small">
                    Lieferung am:{' '}
                    {new Date(auftrag.lieferdatum).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="container my-4">
      {/* Header-Bereich */}
      <div className="mb-4 p-4 rounded shadow" style={{ background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)' }}>
        <div className="d-flex align-items-center">
          <div>
            <h1 className="h3 mb-0">{kunde.name}</h1>
            <small className="text-muted">Kundennummer: {kunde.kundenNummer}</small>
          </div>
        </div>
        <hr />
        <div className="row">
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
        </div>
        <div className="text-end">
          <button className="btn btn-outline-secondary me-2" onClick={() => navigate('/kunden')}>
            Zurück zur Liste
          </button>
          <Link to={`/kunden/edit/${kunde.id}`} className="btn btn-primary">
            Bearbeiten
          </Link>
        </div>
      </div>

      {/* Auftragsbereich */}
      <div>
        <h2 className="mb-3">Aufträge</h2>
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
  );
};

export default KundeDetail;