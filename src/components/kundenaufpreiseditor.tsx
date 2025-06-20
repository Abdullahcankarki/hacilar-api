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
  const [massKategorie, setMassKategorie] = useState('');
  const [massRegion, setMassRegion] = useState('');
  const [massAufpreis, setMassAufpreis] = useState<number>(0);
  const [massAufpreisRaw, setMassAufpreisRaw] = useState<string>('0');

  // Hilfsfunktion: Wandelt Kommas in Punkte um und parsed die Zahl
  const parseNumberInput = (value: string): number =>
    parseFloat(value.replace(',', '.'));

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!artikelId) throw new Error('Keine Artikel-ID angegeben.');
        // Artikel laden
        const artData = await api.getArtikelById(artikelId);
        setArticle(artData);
        // Kundenaufpreise laden
        const kpData = await api.getKundenpreiseByArtikel(artikelId);
        setKundenpreise(kpData);
        // Kundenliste laden
        const custData = await api.getAllKunden();
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
    const parsed = parseFloat(massAufpreisRaw.replace(',', '.'));
    if (isNaN(parsed)) throw new Error('Ungültiger Aufpreis-Wert.');
    await api.createMassKundenpreis({
      artikel: artikelId,
      aufpreis: parsed,
      kategorie: massKategorie || undefined,
      region: massRegion || undefined,
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
                <i className="bi bi-plus-lg"></i> Neuen Aufpreis hinzufügen
              </button>
              <button className="btn btn-outline-primary" onClick={() => setShowMassModal(true)}>
                <i className="bi bi-people-fill"></i> Aufpreis für Kategorie/Region setzen
              </button>
            </div>
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead className="table-light">
                  <tr>
                    <th>Kunde</th>
                    <th>Aufpreis (€)</th>
                    <th>Endpreis (€)</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {kundenpreise.map((kp, index) => (
                    <tr key={index}>
                      <td>
                        <select
                          className="form-select"
                          value={kp.customer || ''}
                          onChange={(e) => handleCustomerSelect(index, e.target.value)}
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
                          value={kp.aufpreis}
                          onChange={(e) => handleSurchargeChange(index, parseNumberInput(e.target.value))}
                        />
                      </td>
                      <td>
                        {article ? (article.preis + kp.aufpreis).toFixed(2) : '-'}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => deleteSurcharge(index)}
                        >
                          <i className="bi bi-trash"></i> Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer d-flex justify-content-end gap-2">
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>
              Abbrechen
            </button>
            <button className="btn btn-success" onClick={saveSurcharges}>
              Speichern
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
                  <input className="form-control" value={massKategorie} onChange={(e) => setMassKategorie(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Region</label>
                  <input className="form-control" value={massRegion} onChange={(e) => setMassRegion(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Aufpreis (€)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control"
                    value={massAufpreisRaw}
                    onChange={(e) => setMassAufpreisRaw(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowMassModal(false)}>Abbrechen</button>
                <button className="btn btn-primary" onClick={saveMassSurcharges}>Speichern</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KundenaufpreisEditor;