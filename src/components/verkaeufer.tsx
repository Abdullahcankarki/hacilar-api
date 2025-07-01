// Verkaeufer.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MitarbeiterResource, MitarbeiterRolle } from '../Resources';
import { api } from '../backend/api';

const Verkaeufer: React.FC = () => {
  const [verkaeuferListe, setVerkaeuferListe] = useState<MitarbeiterResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const navigate = useNavigate();

  const [newVerkaeufer, setNewVerkaeufer] = useState<Omit<MitarbeiterResource, 'id'>>({
    name: '',
    password: '',
    rollen: [],
    email: '',
    telefon: '',
    abteilung: '',
    aktiv: false,
    bemerkung: '',
    eintrittsdatum: ''
  });

  // Verkäufer laden
  const fetchVerkaeufer = async () => {
    try {
      const data = await api.getAllMitarbeiter();
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
      const created = await api.createMitarbeiter(newVerkaeufer);
      setVerkaeuferListe([...verkaeuferListe, created]);
      setNewVerkaeufer({ name: '', password: '', rollen: [], email: '', telefon: '', abteilung: '', aktiv: false, bemerkung: '', eintrittsdatum: '' });
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
      await api.deleteMitarbeiter(id);
      setVerkaeuferListe(verkaeuferListe.filter((v) => v.id !== id));
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Verkäufers');
    }
  };

  // Suche & Filter
  const filteredVerkaeufer = verkaeuferListe.filter((v) =>
    v.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Alle verfügbaren Rollen für Checkbox-Liste (angenommen, diese sind bekannt oder aus API)
  const availableRoles: MitarbeiterRolle[] = [
    "admin",
    "verkauf",
    "kommissionierung",
    "buchhaltung",
    "wareneingang",
    "lager",
    "fahrer",
    "statistik",
    "kunde",
    "support"
  ];

  if (loading) return <div className="container text-center my-4"><p>Lädt...</p></div>;
  if (error) return <div className="container my-4"><div className="alert alert-danger">{error}</div></div>;

  return (
    <div className="container my-4">
      <h2 className="mb-4">Mitarbeiter</h2>

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
            Neuen Mitarbeiter erstellen
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead className="table-light">
            <tr>
              <th>Name</th>
              <th>Rolle</th>
              <th>E-Mail</th>
              <th>Telefon</th>
              <th>Abteilung</th>
              <th>Aktiv</th>
              <th>Eintrittsdatum</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredVerkaeufer.map((v) => (
              <tr
                key={v.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/mitarbeiter/${v.id}`)}
              >
                <td>{v.name}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {v.rollen?.join(', ')}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {v.email}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {v.telefon}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {v.abteilung}
                </td>
                <td onClick={(e) => e.stopPropagation()} className="text-center">
                  {v.aktiv ? 'Ja' : 'Nein'}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {v.eintrittsdatum ? new Date(v.eintrittsdatum).toLocaleDateString('de-DE') : ''}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <Link to={`/mitarbeiter/edit/${v.id}`} className="btn btn-primary btn-sm me-2">
                    <i className="ci-edit me-1"></i>
                  </Link>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(v.id)}>
                    <i className="ci-trash me-1"></i>
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
                  <h5 className="modal-title">Neuen Mitarbeiter erstellen</h5>
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
                    <div className="mb-3">
                      <label className="form-label">E-Mail</label>
                      <input
                        type="email"
                        className="form-control"
                        value={newVerkaeufer.email}
                        onChange={(e) => setNewVerkaeufer({ ...newVerkaeufer, email: e.target.value })}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Telefon</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={newVerkaeufer.telefon}
                        onChange={(e) => setNewVerkaeufer({ ...newVerkaeufer, telefon: e.target.value })}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Abteilung</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newVerkaeufer.abteilung}
                        onChange={(e) => setNewVerkaeufer({ ...newVerkaeufer, abteilung: e.target.value })}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Rollen</label>
                      <div>
                        {availableRoles.map((role) => (
                          <div className="form-check form-check-inline" key={role}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`role-${role}`}
                              value={role}
                              checked={newVerkaeufer.rollen.includes(role)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewVerkaeufer({ ...newVerkaeufer, rollen: [...newVerkaeufer.rollen, role] });
                                } else {
                                  setNewVerkaeufer({ ...newVerkaeufer, rollen: newVerkaeufer.rollen.filter(r => r !== role) });
                                }
                              }}
                            />
                            <label className="form-check-label" htmlFor={`role-${role}`}>{role}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mb-3 form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="aktivCheck"
                        checked={newVerkaeufer.aktiv}
                        onChange={(e) => setNewVerkaeufer({ ...newVerkaeufer, aktiv: e.target.checked })}
                      />
                      <label className="form-check-label" htmlFor="aktivCheck">Aktiv</label>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Bemerkung</label>
                      <textarea
                        className="form-control"
                        value={newVerkaeufer.bemerkung}
                        onChange={(e) => setNewVerkaeufer({ ...newVerkaeufer, bemerkung: e.target.value })}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Eintrittsdatum</label>
                      <input
                        type="date"
                        className="form-control"
                        value={newVerkaeufer.eintrittsdatum}
                        onChange={(e) => setNewVerkaeufer({ ...newVerkaeufer, eintrittsdatum: e.target.value })}
                      />
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                        <i className="ci-arrow-left me-2"></i> Abbrechen
                      </button>
                      <button type="submit" className="btn btn-success">
                        <i className="ci-user me-2"></i> Mitarbeiter erstellen
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