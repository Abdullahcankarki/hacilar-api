// KundenaufpreisEditor.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { KundenPreisResource, KundeResource, ArtikelResource } from '../Resources';
import { api } from '../backend/api';

const KundenaufpreisEditor: React.FC = () => {
  const { artikelId } = useParams<{ artikelId: string }>();
  const navigate = useNavigate();

  const [article, setArticle] = useState<ArtikelResource | null>(null);
  const [kundenpreise, setKundenpreise] = useState<KundenPreisResource[]>([]);
  const [customers, setCustomers] = useState<KundeResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string>('');
  // Modal-States für Massen-Aufpreis
  const [showMassModal, setShowMassModal] = useState(false);
  const [massEdit, setMassEdit] = useState({
    kategorie: '',
    region: '',
    rawAufpreis: '0',
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 25;
  const totalPages = Math.ceil(kundenpreise.length / entriesPerPage);
  const visiblePrices = kundenpreise.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  // Hilfsfunktion: Wandelt Kommas in Punkte um und parsed die Zahl
  const parseNumberInput = (value: string): number =>
    parseFloat(value.replace(',', '.'));

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!artikelId) throw new Error('Keine Artikel-ID angegeben.');
        // Artikel, Kundenaufpreise und Kundenliste parallel laden
        const [artData, kpData, custData] = await Promise.all([
          api.getArtikelByIdClean(artikelId),
          api.getKundenpreiseByArtikel(artikelId),
          api.getAllKunden(),
        ]);
        setArticle(artData);
        setKundenpreise(kpData);
        setCustomers(custData);
      } catch (err: any) {
        setError(err.message || 'Fehler beim Laden der Daten.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [artikelId]);

  const addNewSurcharge = () => {
    setKundenpreise(prev => [
      ...prev,
      { artikel: artikelId!, customer: '', aufpreis: 0 },
    ]);
  };

  const handleSurchargeChange = (index: number, value: number) => {
    const updated = [...kundenpreise];
    updated[index].aufpreis = value;
    setKundenpreise(updated);
  };

  const handleCustomerSelect = (index: number, customerId: string) => {
    const updated = [...kundenpreise];
    updated[index].customer = customerId;
    setKundenpreise(updated);
  };

  const deleteSurcharge = async (index: number) => {
    const kp = kundenpreise[index];
    if (kp.id) {
      try {
        await api.deleteKundenpreis(kp.id);
      } catch (err: any) {
        setError(err.message || 'Fehler beim Löschen des Kundenaufpreises.');
        return;
      }
    }
    const updated = [...kundenpreise];
    updated.splice(index, 1);
    setKundenpreise(updated);
  };

const saveMassSurcharges = async () => {
  setError('');
  setSaveMessage('');
  try {
    if (!artikelId) throw new Error('Keine Artikel-ID vorhanden.');
    const parsed = parseFloat(massEdit.rawAufpreis.replace(',', '.'));
    if (isNaN(parsed)) throw new Error('Ungültiger Aufpreis-Wert.');
    await api.createMassKundenpreis({
      artikel: artikelId,
      aufpreis: parsed,
      kategorie: massEdit.kategorie || undefined,
      region: massEdit.region || undefined,
    });
    setSaveMessage('Massenaufpreise wurden erfolgreich gesetzt.');
    setShowMassModal(false);
    setTimeout(() => {
      navigate(0);
    }, 2000);
  } catch (err: any) {
    setError(err.message || 'Fehler beim Setzen der Massenaufpreise.');
  }
};

  const saveSurcharges = async () => {
    setError('');
    setSaveMessage('');
    try {
      for (const kp of kundenpreise) {
        if (!kp.customer) {
          throw new Error('Bitte wählen Sie für jeden Eintrag einen Kunden aus.');
        }
        if (kp.id) {
          await api.updateKundenpreis(kp.id, { aufpreis: kp.aufpreis, customer: kp.customer });
        } else {
          await api.createKundenpreis({ artikel: kp.artikel, customer: kp.customer, aufpreis: kp.aufpreis });
        }
      }
      setSaveMessage('Kundenpreise wurden erfolgreich aktualisiert.');
      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern der Kundenpreise.');
    }
  };

  if (loading) {
    return (
      <div className="container text-center my-4">
        <p>Lädt...</p>
      </div>
    );
  }

  return (
    <>
      <div className="container my-4">
        {/* Inline Alerts für Fehler/Erfolg */}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {saveMessage && (
          <div className="alert alert-success" role="alert">
            {saveMessage}
          </div>
        )}

        <div className="card shadow">
          <div className="card-header bg-primary text-white">
            <h2 className="h5 mb-0 d-flex justify-content-between align-items-center">
              <span>
                Kundenaufpreise für Artikel: {article ? article.name : artikelId}
              </span>
              {article && (
                <span className="badge bg-light text-dark">
                  Einkaufspreis: {article.preis.toFixed(2)} €
                </span>
              )}
            </h2>
          </div>
          <div className="card-body">
            <div className="mb-3 d-flex justify-content-between">
              <button className="btn btn-outline-dark" onClick={addNewSurcharge}>
                <i className="ci-user-plus me-2"></i> Neuen Aufpreis hinzufügen
              </button>
              <button className="btn btn-outline-primary" onClick={() => setShowMassModal(true)}>
                <i className="ci-group me-2"></i> Aufpreis für Kategorie/Region setzen
              </button>
            </div>
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Kunde</th>
                    <th>Aufpreis (€)</th>
                    <th>Endpreis (€)</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePrices.map((kp, index) => (
                    <tr key={kp.id ?? index}>
                      <td>{(currentPage - 1) * entriesPerPage + index + 1}</td>
                      <td>
                        <select
                          className="form-select"
                          value={kp.customer || ''}
                          onChange={(e) => handleCustomerSelect(kundenpreise.indexOf(kp), e.target.value)}
                          required
                        >
                          <option value="">Bitte wählen</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          value={kp.aufpreis.toFixed(2)}
                          onChange={(e) => handleSurchargeChange(kundenpreise.indexOf(kp), parseNumberInput(e.target.value))}
                        />
                      </td>
                      <td>
                        {article ? (article.preis + kp.aufpreis).toFixed(2) : '-'}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => deleteSurcharge(kundenpreise.indexOf(kp))}
                        >
                          <i className="ci-trash me-1"></i> Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Pagination */}
          <nav>
            <ul className="pagination justify-content-center mt-3">
              {Array.from({ length: totalPages }, (_, i) => (
                <li key={i} className={`page-item ${i + 1 === currentPage ? 'active' : ''}`}>
                  <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                    {i + 1}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="card-footer d-flex justify-content-end gap-2">
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>
              <i className="ci-arrow-left me-2"></i> Abbrechen
            </button>
            <button className="btn btn-success" onClick={saveSurcharges}>
              <i className="ci-save me-2"></i> Speichern
            </button>
          </div>
        </div>
      </div>
      {/* Modal für Massen-Aufpreis */}
      {showMassModal && (
        <div className="modal d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Aufpreis für Kategorie/Region</h5>
                <button type="button" className="btn-close" onClick={() => setShowMassModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Kategorie</label>
                  <select
                    className="form-select mb-2"
                    value={massEdit.kategorie}
                    onChange={(e) =>
                      setMassEdit((prev) => ({ ...prev, kategorie: e.target.value }))
                    }
                  >
                    <option value="">Kategorie wählen</option>
                    <option value="Discounter">Discounter</option>
                    <option value="Großhandel">Großhandel</option>
                    <option value="Gastronomie">Gastronomie</option>
                    <option value="custom">Andere (manuell eingeben)</option>
                  </select>
                  {massEdit.kategorie === 'custom' && (
                    <input
                      className="form-control mt-1"
                      placeholder="Eigene Kategorie eingeben"
                      onChange={(e) =>
                        setMassEdit((prev) => ({ ...prev, kategorie: e.target.value }))
                      }
                    />
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label">Region</label>
                  <input
                    className="form-control"
                    value={massEdit.region}
                    onChange={(e) =>
                      setMassEdit((prev) => ({ ...prev, region: e.target.value }))
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Aufpreis (€)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control"
                    value={massEdit.rawAufpreis}
                    onChange={(e) =>
                      setMassEdit((prev) => ({ ...prev, rawAufpreis: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowMassModal(false)}>
                  <i className="ci-close me-2"></i> Abbrechen
                </button>
                <button className="btn btn-primary" onClick={saveMassSurcharges}>
                  <i className="ci-save me-2"></i> Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KundenaufpreisEditor;