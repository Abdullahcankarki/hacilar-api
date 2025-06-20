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
      <h2 className="mb-4">Kundenliste</h2>

      {/* Such- und Sortierleiste */}
      <div className="row mb-4 align-items-end">
        <div className="col-md-6">
          <label className="form-label">Suche:</label>
          <input
            type="text"
            className="form-control"
            placeholder="Name, Kundennummer oder Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="col-md-3" />
        <div className="col-md-3 text-end">
          <button className="btn btn-success" onClick={() => setShowModal(true)}>
            Neuen Kunden erstellen
          </button>
        </div>
      </div>

      {/* Kunden-Tabelle */}
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead className="table-light">
            <tr>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('kundenNummer')} style={{ cursor: 'pointer' }}>
                Kundennummer {sortField === 'kundenNummer' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => {
                if (sortField === 'kategorie') {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField('kategorie');
                  setSortDirection('asc');
                }
              }} style={{ cursor: 'pointer' }}>
                Kategorie {sortField === 'kategorie' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => {
                if (sortField === 'region') {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField('region');
                  setSortDirection('asc');
                }
              }} style={{ cursor: 'pointer' }}>
                Region {sortField === 'region' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => {
                if (sortField === 'adresse') {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField('adresse');
                  setSortDirection('asc');
                }
              }} style={{ cursor: 'pointer' }}>
                Adresse {sortField === 'adresse' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => {
                if (sortField === 'telefon') {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField('telefon');
                  setSortDirection('asc');
                }
              }} style={{ cursor: 'pointer' }}>
                Telefon {sortField === 'telefon' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => {
                if (sortField === 'lieferzeit') {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField('lieferzeit');
                  setSortDirection('asc');
                }
              }} style={{ cursor: 'pointer' }}>
                Lieferzeit {sortField === 'lieferzeit' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => {
                if (sortField === 'isApproved') {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField('isApproved');
                  setSortDirection('asc');
                }
              }} style={{ cursor: 'pointer' }}>
                Genehmigt {sortField === 'isApproved' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredKunden.map((kunde) => (
              <tr
                key={kunde.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/kunden/${kunde.id}`)}
              >
                <td>{kunde.name}</td>
                <td>{kunde.kundenNummer}</td>
                <td>{kunde.kategorie}</td>
                <td>{kunde.region}</td>
                <td>{kunde.adresse}</td>
                <td>{kunde.telefon}</td>
                <td>{kunde.lieferzeit}</td>
                <td>{kunde.isApproved ? "ja" : "nein"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal für Kundenerstellung */}
      {showModal && (
        <>
          <div className="modal show fade" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog">
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
                        Abbrechen
                      </button>
                      <button type="submit" className="btn btn-success">
                        Kunden erstellen
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