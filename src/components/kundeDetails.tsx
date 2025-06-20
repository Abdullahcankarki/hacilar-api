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
        <div className="text-end">
          <button className="btn btn-outline-secondary me-2" onClick={() => navigate('/kunden')}>
            Zurück zur Liste
          </button>
          <button
            className="btn btn-success me-2"
            onClick={async () => {
              try {
                await api.updateKunde(kunde.id!, { isApproved: true });
                const updatedKunde = await getKundeById(kunde.id!);
                setKunde(updatedKunde);
                console.log("erfolg")
              } catch (err: any) {
                setError(err.message || 'Fehler beim Genehmigen des Kunden');
              }
            }}
            disabled={kunde.isApproved}
          >
            Genehmigen
          </button>
          <Link to={`/kunden/edit/${kunde.id}`} className="btn btn-primary">
            Bearbeiten
          </Link>
          <button
            className="btn btn-danger"
            onClick={() => handleDelete(kunde.id)}
          >
            Löschen
          </button>
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