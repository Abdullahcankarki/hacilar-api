// Artikel.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArtikelResource, KundenPreisResource, KundeResource } from '../Resources';
import { api } from '../backend/api';
import fallbackImage from '../Cartzilla/assets/img/shop/grocery/10.png';

// Hilfsfunktion für Number-Inputs, die Kommas in Punkte umwandelt
const parseNumberInput = (value: string): number =>
  parseFloat(value.replace(',', '.'));

const Artikel: React.FC = () => {
  const [artikel, setArtikel] = useState<ArtikelResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showArticleModal, setShowArticleModal] = useState<boolean>(false);
  const [editingArticle, setEditingArticle] = useState<ArtikelResource | null>(null);
  const [newArticle, setNewArticle] = useState<Omit<ArtikelResource, 'id'>>({
    name: '',
    preis: 0,
    artikelNummer: '',
    kategorie: 'Rind',
    gewichtProStueck: 0,
    gewichtProKarton: 0,
    gewichtProKiste: 0,
    bildUrl: '',
    ausverkauft: false, // NEU
  });
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<KundeResource[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('nameAsc'); // Standard-Sortierung
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);

  const navigate = useNavigate();

  // Artikel laden
  const fetchArticles = async () => {
    try {
      const data = await api.getAllArtikelClean();
      setArtikel(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Artikel');
    } finally {
      setLoading(false);
    }
  };

  // Kunden laden (für das Dropdown in Kundenaufpreis-Modals)
  const fetchCustomers = async () => {
    try {
      const data = await api.getAllKunden();
      setCustomers(data);
    } catch (err: any) {
      console.error('Fehler beim Laden der Kunden', err);
    }
  };

  useEffect(() => {
    fetchArticles();
    fetchCustomers();
  }, []);

  // Artikel erstellen oder bearbeiten
  const handleArticleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (editingArticle) {
        const updated = await api.updateArtikel(editingArticle.id!, newArticle);
        setArtikel(prev => prev.map(a => (a.id === updated.id ? updated : a)));
      } else {
        const created = await api.createArtikel(newArticle);
        setArtikel(prev => [...prev, created]);
      }
      setShowArticleModal(false);
      setEditingArticle(null);
      setNewArticle({
        name: '',
        preis: 0,
        artikelNummer: '',
        kategorie: 'Rind',
        gewichtProStueck: 0,
        gewichtProKarton: 0,
        gewichtProKiste: 0,
        bildUrl: '',
        ausverkauft: false
      });
    } catch (err: any) {
      alert(err.message || 'Fehler beim Speichern des Artikels');
    }
  };

  // Löschen: Öffnet das Bestätigungsmodal
  const confirmDeleteArticle = (id: string | undefined) => {
    if (!id) return;
    setArticleToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteArticle = async () => {
    if (!articleToDelete) return;
    try {
      await api.deleteArtikel(articleToDelete);
      setArtikel(prev => prev.filter(a => a.id !== articleToDelete));
      setShowDeleteModal(false);
      setArticleToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Fehler beim Löschen des Artikels');
    }
  };

  // Such- und Sortierlogik
  const filteredArticles = artikel
    .filter(a => {
      const term = searchTerm.toLowerCase();
      return (
        a.name.toLowerCase().includes(term) ||
        a.artikelNummer.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (sortOption === 'nameAsc') {
        return a.name.localeCompare(b.name);
      } else if (sortOption === 'nameDesc') {
        return b.name.localeCompare(a.name);
      } else if (sortOption === 'preisAsc') {
        return a.preis - b.preis;
      } else if (sortOption === 'preisDesc') {
        return b.preis - a.preis;
      }
      return 0;
    });

  if (loading)
    return (
      <div className="container text-center my-4">
        <p>Lädt...</p>
      </div>
    );
  if (error)
    return (
      <div className="container my-4">
        <div className="alert alert-danger">{error}</div>
      </div>
    );

  return (
    <div className="container my-4">
      <h2>Artikelverwaltung</h2>

      {/* Such- und Sortierleiste */}
      <div className="row mb-3">
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Suche nach Name oder Artikelnummer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="nameAsc">Name: Aufsteigend</option>
            <option value="nameDesc">Name: Absteigend</option>
            <option value="preisAsc">Preis: Aufsteigend</option>
            <option value="preisDesc">Preis: Absteigend</option>
            <option value="kategorieAsc">Kategorie: Aufsteigend</option>
            <option value="kategorieDesc">Kategorie: Absteigend</option>
          </select>
        </div>
        <div className="col-md-4 text-end">
          <button
            className="btn btn-success"
            onClick={() => {
              setShowArticleModal(true);
              setEditingArticle(null);
            }}
          >
            Neuen Artikel erstellen
          </button>
        </div>
      </div>

      {/* Artikeltabelle */}
      <table className="table table-striped table-hover">
        <thead className="table-light">
          <tr>
            <th>Bild</th>
            <th>Name</th>
            <th>Artikelnummer</th>
            <th>Preis</th>
            <th>Kategorie</th>
            <th>Gewicht/Stück</th>
            <th>Gewicht/Karton</th>
            <th>Gewicht/Kiste</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filteredArticles.map(a => (
            <tr key={a.id}>
              <td>
                <img
                  src={a.bildUrl || fallbackImage}
                  alt={a.name}
                  style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = fallbackImage;
                  }}
                />
              </td>
              <td>{a.name}</td>
              <td>{a.artikelNummer}</td>
              <td>{a.preis.toFixed(2)}€</td>
              <td>{a.kategorie}</td>
              <td>{a.gewichtProStueck !== undefined ? a.gewichtProStueck.toFixed(2) : '-'} kg</td>
              <td>{a.gewichtProKarton !== undefined ? a.gewichtProKarton.toFixed(2) : '-'} kg</td>
              <td>{a.gewichtProKiste !== undefined ? a.gewichtProKiste.toFixed(2) : '-'} kg</td>
              <td onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-primary btn-sm me-1" onClick={() => {
                  setEditingArticle(a);
                  setNewArticle({
                    name: a.name,
                    preis: a.preis,
                    artikelNummer: a.artikelNummer,
                    kategorie: a.kategorie,
                    gewichtProStueck: a.gewichtProStueck || 0,
                    gewichtProKarton: a.gewichtProKarton || 0,
                    gewichtProKiste: a.gewichtProKiste || 0,
                    bildUrl: a.bildUrl || '',
                    ausverkauft: a.ausverkauft || false,
                  });
                  setShowArticleModal(true);
                }}>
                  <i className="ci-edit me-1"></i>
                </button>
                <button className="btn btn-warning btn-sm me-1" onClick={() => navigate(`/kundenaufpreise/${a.id}`)}>
                  <i className="ci-dollar-sign"></i>
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => confirmDeleteArticle(a.id)}>
                  <i className="ci-trash me-1"></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal für Artikel erstellen / bearbeiten */}
      {showArticleModal && (
        <>
          <div className="modal show fade" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{editingArticle ? 'Artikel bearbeiten' : 'Neuen Artikel erstellen'}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowArticleModal(false)}></button>
                </div>
                <form onSubmit={handleArticleSubmit}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newArticle.name}
                        onChange={(e) => setNewArticle({ ...newArticle, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Artikelnummer</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newArticle.artikelNummer}
                        onChange={(e) => setNewArticle({ ...newArticle, artikelNummer: e.target.value })}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Preis</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={newArticle.preis}
                        onChange={(e) =>
                          setNewArticle({ ...newArticle, preis: parseNumberInput(e.target.value) })
                        }
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Kategorie</label>
                      <select
                        className="form-select"
                        value={newArticle.kategorie}
                        onChange={(e) => setNewArticle({ ...newArticle, kategorie: e.target.value })}
                        required
                      >
                        <option value="Rind">Rind</option>
                        <option value="Kalb">Kalb</option>
                        <option value="Lamm">Lamm</option>
                        <option value="Schaf">Schaf</option>
                        <option value="Huhn">Huhn</option>
                        <option value="Pute">Pute</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Gewicht pro Stück</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={newArticle.gewichtProStueck || ''}
                        onChange={(e) =>
                          setNewArticle({
                            ...newArticle,
                            gewichtProStueck: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Gewicht pro Karton</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={newArticle.gewichtProKarton || ''}
                        onChange={(e) =>
                          setNewArticle({
                            ...newArticle,
                            gewichtProKarton: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Gewicht pro Kiste</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={newArticle.gewichtProKiste || ''}
                        onChange={(e) =>
                          setNewArticle({
                            ...newArticle,
                            gewichtProKiste: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Bild-URL</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newArticle.bildUrl || ''}
                        onChange={(e) => setNewArticle({ ...newArticle, bildUrl: e.target.value })}
                      />
                    </div>
                    <div className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="ausverkauftCheck"
                        checked={newArticle.ausverkauft}
                        onChange={(e) =>
                          setNewArticle({ ...newArticle, ausverkauft: e.target.checked })
                        }
                      />
                      <label className="form-check-label" htmlFor="ausverkauftCheck">
                        Ausverkauft
                      </label>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowArticleModal(false)}>
                      Abbrechen
                    </button>
                    <button type="submit" className="btn btn-success">
                      {editingArticle ? 'Speichern' : 'Erstellen'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}


      {/* Modal für Löschbestätigung */}
      {showDeleteModal && (
        <>
          <div className="modal show fade" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Artikel löschen</h5>
                  <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
                </div>
                <div className="modal-body">
                  <p>Möchtest du diesen Artikel wirklich löschen?</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                    Abbrechen
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleDeleteArticle}>
                    Löschen
                  </button>
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

export default Artikel;