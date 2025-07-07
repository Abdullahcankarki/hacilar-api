// Kunden.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KundeResource } from '../Resources';
import { api } from '../backend/api';


const Kunden: React.FC = () => {
  const [kunden, setKunden] = useState<KundeResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<keyof KundeResource>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const navigate = useNavigate();

  const [cardView, setCardView] = useState<boolean>(true);

  const [newKunde, setNewKunde] = useState<Omit<KundeResource, 'id' | 'updatedAt'>>({
    name: '',
    kundenNummer: '',
    password: '',
    email: '',
    adresse: '',
    telefon: '',
    lieferzeit:'',
    ustId: '',
    handelsregisterNr: '',
    ansprechpartner: '',
    website: '',
    isApproved: false,
    gewerbeDateiUrl: '',
    zusatzDateiUrl: '',
  });


const handleSort = (field: keyof KundeResource) => {
  if (sortField === field) {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  } else {
    setSortField(field);
    setSortDirection('asc');
  }
};

  // Alle Kunden laden
  const fetchKunden = async () => {
    try {
      const data = await api.getAllKunden();
      setKunden(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Kunden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKunden();
  }, []);

  // Neuen Kunden erstellen
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const created = await api.createKunde(newKunde);
      setKunden([...kunden, created]);
      setNewKunde({ name: '', kundenNummer: '', password: '', email: '', adresse: '', telefon: '', lieferzeit: '', ustId: '', kategorie: '', region: '', handelsregisterNr: '', ansprechpartner: '', website: '', isApproved: false, gewerbeDateiUrl: '', zusatzDateiUrl: '' });
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen des Kunden');
    }
  };

  // Kunden löschen
  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    if (!window.confirm('Möchten Sie diesen Kunden wirklich löschen?')) return;
    try {
      await api.deleteKunde(id);
      setKunden(kunden.filter((k) => k.id !== id));
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Kunden');
    }
  };

  // Filtere und sortiere die Kundenliste
  const filteredKunden = kunden
    .filter((k) => {
      const term = searchTerm.toLowerCase();
      return (
        k.name?.toLowerCase().includes(term) ||
        k.kundenNummer?.toLowerCase().includes(term) ||
        (k.email && k.email.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

  if (loading) return <div className="container text-center my-4"><p>Lädt...</p></div>;
  if (error) return <div className="container my-4"><div className="alert alert-danger">{error}</div></div>;

  return (
    <div className="container my-4">
      {/* Cartzilla-kompatibler Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="h4 mb-0">Kundenübersicht</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="ci-user me-2"></i>Neuen Kunden erstellen
        </button>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <button className={`btn btn-sm me-2 ${cardView ? 'btn-outline-primary' : 'btn-light'}`} onClick={() => setCardView(true)}>
            <i className="ci-grid"></i> Kartenansicht
          </button>
          <button className={`btn btn-sm ${!cardView ? 'btn-outline-primary' : 'btn-light'}`} onClick={() => setCardView(false)}>
            <i className="ci-table"></i> Tabellenansicht
          </button>
        </div>
      </div>

      {/* Bootstrap InputGroup Suche */}
      <div className="input-group mb-4">
        <input
          type="text"
          className="form-control"
          placeholder="Suche nach Name, Nummer oder E-Mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="btn btn-outline-secondary" type="button">
          <i className="ci-search"></i>
        </button>
      </div>

      {cardView ? (
        <>
          <div className="d-flex justify-content-end mb-3">
            <select
              className="form-select w-auto"
              value={sortField}
              onChange={(e) => handleSort(e.target.value as keyof KundeResource)}
            >
              <option value="name">Sortieren nach Name</option>
              <option value="kundenNummer">Sortieren nach Kundennummer</option>
              <option value="kategorie">Sortieren nach Kategorie</option>
              <option value="region">Sortieren nach Region</option>
            </select>
            <button className="btn btn-outline-secondary ms-2" onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}>
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          <div className="row">
            {filteredKunden.map((kunde) => (
              <div className="col-md-6 col-lg-4 mb-4" key={kunde.id}>
                <div className="card h-100" onClick={() => navigate(`/kunden/${kunde.id}`)} style={{ cursor: 'pointer' }}>
                  <div className="card-body">
                    <h5 className="card-title">{kunde.name}</h5>
                    <h6 className="card-subtitle mb-2 text-muted">#{kunde.kundenNummer}</h6>
                    <p className="card-text mb-1"><strong>Kategorie:</strong> {kunde.kategorie}</p>
                    <p className="card-text mb-1"><strong>Region:</strong> {kunde.region}</p>
                    <p className="card-text mb-1"><strong>Adresse:</strong> {kunde.adresse}</p>
                    <p className="card-text mb-1"><strong>Email:</strong> {kunde.email}</p>
                    <p className="card-text mb-1"><strong>Telefon:</strong> {kunde.telefon}</p>
                    <p className="card-text mb-1"><strong>Lieferzeit:</strong> {kunde.lieferzeit}</p>
                    <span className={`badge ${kunde.isApproved ? 'bg-success' : 'bg-warning text-dark'}`}>
                      {kunde.isApproved ? 'Genehmigt' : 'Nicht genehmigt'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('kundenNummer')} style={{ cursor: 'pointer' }}>
                  Kundennummer {sortField === 'kundenNummer' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('kategorie')} style={{ cursor: 'pointer' }}>
                  Kategorie {sortField === 'kategorie' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('region')} style={{ cursor: 'pointer' }}>
                  Region {sortField === 'region' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('adresse')} style={{ cursor: 'pointer' }}>
                  Adresse {sortField === 'adresse' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('telefon')} style={{ cursor: 'pointer' }}>
                  Telefon {sortField === 'telefon' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('lieferzeit')} style={{ cursor: 'pointer' }}>
                  Lieferzeit {sortField === 'lieferzeit' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('isApproved')} style={{ cursor: 'pointer' }}>
                  Status {sortField === 'isApproved' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredKunden.map((kunde) => (
                <tr key={kunde.id} onClick={() => navigate(`/kunden/${kunde.id}`)} style={{ cursor: 'pointer' }}>
                  <td>{kunde.name}</td>
                  <td>{kunde.kundenNummer}</td>
                  <td>{kunde.kategorie}</td>
                  <td>{kunde.region}</td>
                  <td>{kunde.adresse}</td>
                  <td>{kunde.telefon}</td>
                  <td>{kunde.lieferzeit}</td>
                  <td>
                    <span className={`badge ${kunde.isApproved ? 'bg-success' : 'bg-warning text-dark'}`}>
                      {kunde.isApproved ? 'Genehmigt' : 'Nicht genehmigt'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal für Kundenerstellung (Cartzilla-Stil, modal-lg, Buttons mit Icons) */}
      {showModal && (
        <>
          <div className="modal show fade" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">Neuen Kunden erstellen</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleCreate}>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.name}
                          onChange={(e) => setNewKunde({ ...newKunde, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Kundennummer</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.kundenNummer}
                          onChange={(e) => setNewKunde({ ...newKunde, kundenNummer: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <div className="col-md-4">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={newKunde.email}
                          onChange={(e) => setNewKunde({ ...newKunde, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Telefon</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.telefon}
                          onChange={(e) => setNewKunde({ ...newKunde, telefon: e.target.value })}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Lieferzeit</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.lieferzeit}
                          onChange={(e) => setNewKunde({ ...newKunde, lieferzeit: e.target.value })}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Passwort</label>
                        <input
                          type="password"
                          className="form-control"
                          value={newKunde.password}
                          onChange={(e) => setNewKunde({ ...newKunde, password: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Adresse</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newKunde.adresse}
                        onChange={(e) => setNewKunde({ ...newKunde, adresse: e.target.value })}
                        required
                      />
                    </div>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label">USt-ID</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.ustId}
                          onChange={(e) => setNewKunde({ ...newKunde, ustId: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Handelsregister-Nr.</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.handelsregisterNr}
                          onChange={(e) => setNewKunde({ ...newKunde, handelsregisterNr: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label">Ansprechpartner</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.ansprechpartner}
                          onChange={(e) => setNewKunde({ ...newKunde, ansprechpartner: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Website</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.website}
                          onChange={(e) => setNewKunde({ ...newKunde, website: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label">Kategorie</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.gewerbeDateiUrl}
                          onChange={(e) => setNewKunde({ ...newKunde, gewerbeDateiUrl: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Region</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.zusatzDateiUrl}
                          onChange={(e) => setNewKunde({ ...newKunde, zusatzDateiUrl: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label">Gewerbeanmeldung (URL)</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.gewerbeDateiUrl}
                          onChange={(e) => setNewKunde({ ...newKunde, gewerbeDateiUrl: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Zusatzdokument (URL)</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newKunde.zusatzDateiUrl}
                          onChange={(e) => setNewKunde({ ...newKunde, zusatzDateiUrl: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-check mb-3">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="isApprovedCheck"
                        checked={newKunde.isApproved}
                        onChange={(e) => setNewKunde({ ...newKunde, isApproved: e.target.checked })}
                      />
                      <label className="form-check-label" htmlFor="isApprovedCheck">
                        Genehmigt
                      </label>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                        <i className="ci-close me-2"></i>Abbrechen
                      </button>
                      <button type="submit" className="btn btn-success">
                        <i className="ci-user me-2"></i> Kunden erstellen
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

export default Kunden;