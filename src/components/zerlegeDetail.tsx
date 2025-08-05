import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Table, Button, Spinner, Alert } from "react-bootstrap";
import { api } from "../backend/api";
import { useAuth } from '../providers/Authcontext';

const formatDateNormal = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const ZerlegeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showError, setShowError] = useState(true);

  const isZerleger = user?.role.includes("zerleger")
  const isAdmin = user?.role.includes("admin")

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getZerlegeauftragById(id)
      .then(setData)
      .catch((e) => setError("Fehler beim Laden des Zerlegeauftrags."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusUpdate = async (auftragId: string, artikelPositionId: string) => {
    if (!data) return;
    setUpdating(true);
    try {
      await api.updateZerlegeauftragStatus(auftragId, artikelPositionId);
      // Nach Update neu laden
      const refreshed = await api.getZerlegeauftragById(id);
      setData(refreshed);
    } catch (e) {
      setError("Status konnte nicht aktualisiert werden.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Diesen Zerlegeauftrag wirklich löschen?")) return;
    setDeleting(true);
    try {
      await api.deleteZerlegeauftraegeByDatum(id);
      navigate("/zerlege");
    } catch (e) {
      setError("Löschen fehlgeschlagen.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Spinner animation="border" />;
  if (error && showError) return (
    <div className="alert alert-danger alert-dismissible fade show" role="alert">
      {error}
      <button type="button" className="btn-close" onClick={() => setShowError(false)} aria-label="Close"></button>
    </div>
  );
  if (!data) return <Alert variant="warning">Kein Zerlegeauftrag gefunden.</Alert>;

  return (
    <div className="container my-4 px-2 px-md-4">
      <div className="card shadow mb-4">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap text-center text-md-start">
          <div>
            <h5 className="mb-0">Zerlegeauftrag</h5>
            <small className="text-muted">für {data.kundenName}</small><br />
            <small className="text-muted">Auftragsnummer: {data.auftragsnummer}</small>
          </div>
          <small className="text-muted text-end">{formatDateNormal(data.erstelltAm)}</small>
        </div>
        <div className="card-body">
          {data.zerlegerName && <p><strong>Zerleger:</strong> {data.zerlegerName}</p>}
          <div className="table-responsive">
            <Table striped bordered hover className="table-sm w-100 align-middle text-nowrap">
              <thead className="table-light">
                <tr>
                  <th>Artikel</th>
                  <th>Menge</th>
                  <th>Bemerkung</th>
                  <th>Status</th>
                  <th>Erledigt um</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {data.artikelPositionen.map((pos: any) => (
                  <tr key={pos.artikelPositionId}>
                    <td>{pos.artikelName}</td>
                    <td>{pos.menge} kg</td>
                    <td>{pos.bemerkung}</td>
                    <td>
                      <span className={`badge bg-${pos.status === 'erledigt' ? 'success' : 'secondary'}`}>
                        {pos.status}
                      </span>
                    </td>
                    <td>{pos.erledigtAm ? formatDate(pos.erledigtAm) : "-"}</td>
                    <td>
                      {pos.status !== "erledigt" ? (
                        <Button
                          size="sm"
                          variant="success"
                          disabled={updating}
                          onClick={() => handleStatusUpdate(data.id, pos.artikelPositionId)}
                        >
                          <i className="bi bi-check2-circle me-1"></i> Erledigt
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          disabled={updating}
                          onClick={() => handleStatusUpdate(data.id, pos.artikelPositionId)}
                        >
                          <i className="bi bi-arrow-counterclockwise me-1"></i> Rückgängig
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
        {isAdmin && (
          <div className="card-footer text-center">
            <Button
              variant="outline-danger"
              onClick={handleDelete}
              disabled={deleting}
              className="w-100 w-md-auto"
            >
              <i className="bi bi-trash me-2"></i> Zerlegeauftrag löschen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZerlegeDetail;