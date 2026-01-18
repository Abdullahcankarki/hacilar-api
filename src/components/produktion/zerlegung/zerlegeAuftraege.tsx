import React, { useEffect, useState } from 'react';
import { ZerlegeauftragResource } from '@/Resources';
import { api } from '@/backend/api';
import { useAuth } from '@/providers/Authcontext';
import { useNavigate } from 'react-router-dom';

const formatDateNormal = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTime = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const ZerlegeAuftraege: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [auftraege, setAuftraege] = useState<ZerlegeauftragResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [todayDeleted, setTodayDeleted] = useState(false);
  const isZerleger = user?.role.includes('zerleger');
  const isAdmin = user?.role.includes('admin');
  const [updating, setUpdating] = useState(false);

  const fetchZerlegeauftraege = async () => {
    try {
      const data = user?.role.includes('admin')
        ? await api.getAllZerlegeauftraege()
        : await api.getAllOffeneZerlegeauftraege();
      setAuftraege(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const deleteHeute = async () => {
    try {
      const heute = new Date().toISOString().split('T')[0];
      const result = await api.deleteZerlegeauftraegeByDatum(heute);
      console.log(`${result.deleted} Zerlegeaufträge gelöscht`);
      setTodayDeleted(true);
      fetchZerlegeauftraege(); // Refresh
    } catch (err: any) {
      console.error(err.message || 'Fehler beim Löschen');
    }
  };

  const handleStatusUpdate = async (auftragId: string, artikelPositionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setUpdating(true);
    try {
      await api.updateZerlegeauftragStatus(auftragId, artikelPositionId);
      await fetchZerlegeauftraege();
    } catch (err: any) {
      console.error(err.message || 'Status konnte nicht aktualisiert werden');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchZerlegeauftraege();
  }, []);

  useEffect(() => {
    if (todayDeleted) {
      const timeout = setTimeout(() => setTodayDeleted(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [todayDeleted]);

  if (loading) return <div className="container my-4">Lädt...</div>;

  return (
    <div className="container my-5">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap">
        <h2 className="h3 mb-3 mb-md-0">
          Zerlegeaufträge{' '}
          <span className="badge bg-secondary">
            {user?.role.includes('admin') ? 'Alle' : 'Nur offene'}
          </span>
        </h2>
        {user?.role.includes('admin') && (
          <button className="btn btn-outline-danger" onClick={deleteHeute}>
            <i className="ci-trash me-2"></i>Erledigte Aufträge löschen
          </button>
        )}
      </div>

      {todayDeleted && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          Zerlegeaufträge wurden erfolgreich gelöscht.
          <button type="button" className="btn-close" onClick={() => setTodayDeleted(false)} aria-label="Close"></button>
        </div>
      )}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover table-bordered align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Auftrags-Nr.</th>
                  <th scope="col">Kunde</th>
                  <th scope="col">Artikel (Menge / Bemerkung)</th>
                  <th scope="col">Status</th>
                  <th scope="col">Erledigt am</th>
                  <th scope="col">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {auftraege.map((auftrag) => (
                  <React.Fragment key={auftrag.id}>
                    {auftrag.artikelPositionen.map((p, idx) => (
                      <tr
                        key={`${auftrag.id}-${p.artikelPositionId}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/zerlege/${auftrag.id}`)}
                      >
                        {idx === 0 && (
                          <td className="fw-semibold" rowSpan={auftrag.artikelPositionen.length}>
                            #{auftrag.auftragsnummer}
                          </td>
                        )}
                        {idx === 0 && (
                          <td rowSpan={auftrag.artikelPositionen.length}>{auftrag.kundenName}</td>
                        )}
                        <td>
                          <div className="fw-semibold">{p.artikelName || p.artikelPositionId}</div>
                          {typeof p.menge !== 'undefined' && (
                            <div className="text-muted small">Menge: {p.menge} kg</div>
                          )}
                          {p.bemerkung && (
                            <div className="text-muted small">Bemerkung: {p.bemerkung}</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${p.status === 'erledigt' ? 'bg-success' : 'bg-warning text-dark'}`}>
                            {p.status === 'erledigt' ? 'erledigt' : 'offen'}
                          </span>
                        </td>
                        <td className="small">{p.erledigtAm ? formatTime(p.erledigtAm) : '—'}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {p.status !== 'erledigt' ? (
                            <button
                              className="btn btn-sm btn-success"
                              disabled={updating || !(isZerleger || isAdmin)}
                              onClick={(e) => handleStatusUpdate(auftrag.id, p.artikelPositionId, e)}
                            >
                              <i className="bi bi-check2-circle me-1"></i> Erledigt
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={updating || !(isZerleger || isAdmin)}
                              onClick={(e) => handleStatusUpdate(auftrag.id, p.artikelPositionId, e)}
                            >
                              <i className="bi bi-arrow-counterclockwise me-1"></i> Rückgängig
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="table-group-divider">
                      <td colSpan={6}></td>
                    </tr>
                  </React.Fragment>
                ))}
                {auftraege.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-4">
                      Keine Zerlegeaufträge gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZerlegeAuftraege;