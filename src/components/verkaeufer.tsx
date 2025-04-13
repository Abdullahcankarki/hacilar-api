// Verkaeufer.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { VerkaeuferResource } from '../Resources';
import { api } from '../backend/api';

const Verkaeufer: React.FC = () => {
  const [verkaeuferListe, setVerkaeuferListe] = useState<VerkaeuferResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const navigate = useNavigate();

  const [newVerkaeufer, setNewVerkaeufer] = useState<Omit<VerkaeuferResource, 'id'>>({
    name: '',
    admin: false,
    password: '',
  });

  // Verkäufer laden
  const fetchVerkaeufer = async () => {
    try {
      const data = await api.getAllVerkaeufer();
      setVerkaeuferListe(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Verkäufer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerkaeufer();
  }, []);

  // Verkäufer erstellen
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const created = await api.createVerkaeufer(newVerkaeufer);
      setVerkaeuferListe([...verkaeuferListe, created]);
      setNewVerkaeufer({ name: '', admin: false, password: '' });
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen des Verkäufers');
    }
  };

  // Verkäufer löschen
  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    if (!window.confirm('Diesen Verkäufer wirklich löschen?')) return;
    try {
      await api.deleteVerkaeufer(id);
      setVerkaeuferListe(verkaeuferListe.filter((v) => v.id !== id));
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Verkäufers');
    }
  };

  // Suche & Filter
  const filteredVerkaeufer = verkaeuferListe.filter((v) =>
    v.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="container text-center my-4"><p>Lädt...</p></div>;
  if (error) return <div className="container my-4"><div className="alert alert-danger">{error}</div></div>;

  return (
    <div className="container my-4">
      <h2 className="mb-4">Verkäuferliste</h2>

      {/* Suchleiste */}
      <div className="row mb-4 align-items-end">
        <div className="col-md-6">
          <label className="form-label">Suche:</label>
          <input
            type="text"
            className="form-control"
            placeholder="Name suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="col-md-6 text-end">
          <button className="btn btn-success mt-3" onClick={() => setShowModal(true)}>
            Neuen Verkäufer erstellen
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead className="table-light">
            <tr>
              <th>Name</th>
              <th>Admin</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredVerkaeufer.map((v) => (
              <tr
                key={v.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/verkaeufer/${v.id}`)}
              >
                <td>{v.name}</td>
                <td>{v.admin ? 'Ja' : 'Nein'}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <Link to={`/verkaeufer/edit/${v.id}`} className="btn btn-primary btn-sm me-2">
                    Bearbeiten
                  </Link>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(v.id)}>
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Verkäufer erstellen */}
      {showModal && (
        <>
          <div className="modal show fade" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">Neuen Verkäufer erstellen</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleCreate}>
                    <div className="mb-3">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newVerkaeufer.name}
                        onChange={(e) => setNewVerkaeufer({ ...newVerkaeufer, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Passwort</label>
                      <input
                        type="password"
                        className="form-control"
                        value={newVerkaeufer.password}
                        onChange={(e) => setNewVerkaeufer({ ...newVerkaeufer, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="mb-3 form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="adminCheck"
                        checked={newVerkaeufer.admin}
                        onChange={(e) => setNewVerkaeufer({ ...newVerkaeufer, admin: e.target.checked })}
                      />
                      <label className="form-check-label" htmlFor="adminCheck">
                        Admin-Rechte
                      </label>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                        Abbrechen
                      </button>
                      <button type="submit" className="btn btn-success">
                        Verkäufer erstellen
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  );
};

export default Verkaeufer;