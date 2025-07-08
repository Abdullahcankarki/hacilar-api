// Auftraege.tsx
import React, { useEffect, useState } from 'react';
import { AuftragResource } from '../Resources';
import { api, deleteAuftrag, getAllAuftraege, getAuftragByCutomerId } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import AuftragTabelle from './auftragTabelle';


const Auftraege: React.FC = () => {
  const [auftraege, setAuftraege] = useState<AuftragResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const { user } = useAuth();

  // Alle Aufträge laden
  const fetchAuftraege = async () => {
    try {
      const data = user?.role.includes('admin')
        ? await getAllAuftraege()
        : await getAuftragByCutomerId(user?.id!);
      setAuftraege(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Aufträge');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuftraege();
  }, []);

  // Weitere Filter und Suche
  const filteredAuftraege = auftraege.filter((auftrag) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const id = auftrag.id ?? '';
    const kunde = (auftrag as any).kundeName ?? auftrag.kunde ?? '';

    const idMatch = id.toString().toLowerCase().includes(term);
    const kundeMatch = kunde ? String(kunde).toLowerCase().includes(term) : false;

    return idMatch || kundeMatch;
  });
  // Fügt innerhalb der Komponente (z.B. direkt nach useState) diese Funktionen ein:
  const gruppiertNachStatus = {
    offen: filteredAuftraege.filter(a => a.status === 'offen'),
    inBearbeitung: filteredAuftraege.filter(a => a.status === 'in Bearbeitung'),
    abgeschlossen: filteredAuftraege.filter(a => a.status === 'abgeschlossen'),
    storniert: filteredAuftraege.filter(a => a.status === 'storniert'),
  };
  // Aktualisiert den Auftragsstatus über die API
  const updateOrderStatus = async (orderId: string, newStatus: AuftragResource['status']) => {
    try {
      const updated = await api.updateAuftrag(orderId, { status: newStatus });
      setAuftraege(prev => prev.map(o => (o.id === orderId ? updated : o)));
    } catch (err: any) {
      console.error(err.message || 'Fehler beim Aktualisieren des Auftrags');
    }
  };

  // Setzt den Status auf "abgeschlossen"
  const handleComplete = async (orderId: string) => {
    await updateOrderStatus(orderId, 'abgeschlossen');
  };

  // Setzt den Status auf "storniert"
  const handleCancel = async (orderId: string) => {
    await updateOrderStatus(orderId, 'storniert');
  };

  const handleBearbeitung = async (orderId: string) => {
    await updateOrderStatus(orderId, 'in Bearbeitung');
  };

  const handleOeffnen = async (orderId: string) => {
    await updateOrderStatus(orderId, 'offen');
  };

  // React Modal für Löschbestätigung
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  const confirmDelete = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowModal(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedOrderId) return;
    try {
      await deleteAuftrag(selectedOrderId);
      setAuftraege(prev => prev.filter(a => a.id !== selectedOrderId));
      console.log(`Auftrag ${selectedOrderId} erfolgreich gelöscht`);
    } catch (err: any) {
      console.error('Fehler beim Löschen des Auftrags:', err.message || err);
    } finally {
      setSelectedOrderId(null);
      setShowModal(false);
    }
  };

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
      <h2 className="mb-4">Aufträge</h2>

      {/* Such-, Filter- und Sortierleiste */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="input-group">
            <span className="input-group-text bg-white">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Suche (Auftrag, Kunde)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>


      <AuftragTabelle
        titel="Offene Aufträge"
        auftraege={gruppiertNachStatus.offen}
        onBearbeitung={handleBearbeitung}
        onCancel={handleCancel}
      />
      <AuftragTabelle
        titel="In Bearbeitung"
        auftraege={gruppiertNachStatus.inBearbeitung}
        onComplete={handleComplete}
        onOeffnen={handleOeffnen}
      />
      <AuftragTabelle
        titel="Abgeschlossene Aufträge"
        auftraege={gruppiertNachStatus.abgeschlossen}
        onOeffnen={handleOeffnen}
        onCancel={handleCancel}
        defaultCollapsed={true}
      />
      <AuftragTabelle
        titel="Stornierte Aufträge"
        auftraege={gruppiertNachStatus.storniert}
        defaultCollapsed={true}
        onDelete={confirmDelete}
      />
      {showModal && (
        <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-labelledby="deleteConfirmModalLabel" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="deleteConfirmModalLabel">Löschbestätigung</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} aria-label="Schließen"></button>
              </div>
              <div className="modal-body">
                Möchten Sie diesen Auftrag wirklich löschen?
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Abbrechen</button>
                <button type="button" className="btn btn-danger" onClick={handleDeleteConfirmed}>Löschen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auftraege;