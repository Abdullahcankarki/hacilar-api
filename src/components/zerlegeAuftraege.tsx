import React, { useEffect, useState } from 'react';
import { ZerlegeauftragResource } from '../Resources';
import { api } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import { useNavigate } from 'react-router-dom';

const ZerlegeAuftraege: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [auftraege, setAuftraege] = useState<ZerlegeauftragResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [todayDeleted, setTodayDeleted] = useState(false);

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

  useEffect(() => {
    fetchZerlegeauftraege();
  }, []);

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
        <div className="alert alert-success" role="alert">
          Zerlegeaufträge wurden erfolgreich gelöscht.
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
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Auftrags-Nr.</th>
                  <th scope="col">Kunde</th>
                  <th scope="col">Artikel</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {auftraege.map((auftrag) => (
                  <tr
                    key={auftrag.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/zerlege/${auftrag.id}`)}
                  >
                    <td className="fw-semibold">
                      #{auftrag.auftragId?.slice(-6).toUpperCase()}
                    </td>
                    <td>{auftrag.kundenName}</td>
                    <td>
                      {auftrag.artikelPositionen.map((p) => (
                        <div key={p.artikelPositionId}>
                          <i
                            className={`ci-check-circle me-1 ${
                              p.status === 'erledigt' ? 'text-success' : 'text-muted'
                            }`}
                          ></i>
                          {p.artikelName || p.artikelPositionId}
                        </div>
                      ))}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          auftrag.artikelPositionen.every((p) => p.status === 'erledigt')
                            ? 'bg-success'
                            : 'bg-warning text-dark'
                        }`}
                      >
                        {auftrag.artikelPositionen.every((p) => p.status === 'erledigt')
                          ? 'Alle erledigt'
                          : 'Offen'}
                      </span>
                    </td>
                  </tr>
                ))}
                {auftraege.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4">
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