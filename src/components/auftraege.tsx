// Auftraege.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuftragResource } from '../Resources';
import { api } from '../backend/api';
import { useAuth } from '../providers/Authcontext';

const Auftraege: React.FC = () => {
  const [auftraege, setAuftraege] = useState<AuftragResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>(''); // leer = kein Filter
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Sortierung nach Lieferdatum
  const navigate = useNavigate();
  const { user } = useAuth();

  // Alle Aufträge laden
  const fetchAuftraege = async () => {
    try {
      const data = await api.apiFetch<AuftragResource[]>('/api/auftrag');
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

  // Filter: Wenn der eingeloggte Nutzer Kunde ist (Rolle "u"), zeige nur seine Aufträge
  const filteredByUser = user?.role === 'u'
    ? auftraege.filter(auftrag => auftrag.kunde === user.id)
    : auftraege;

  // Weitere Filter und Suche
  const filteredAuftraege = filteredByUser
  .filter((auftrag) => {
    if (filterStatus && auftrag.status !== filterStatus) return false;

    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const id = auftrag.id ?? '';
    const kunde = (auftrag as any).kundeName ?? auftrag.kunde ?? '';

    const idMatch = id.toString().toLowerCase().includes(term);
    const kundeMatch = kunde ? kunde.toString().toLowerCase().includes(term) : false;

    return idMatch || kundeMatch;
  })
  .sort((a, b) => {
    const dateA = a.lieferdatum ? new Date(a.lieferdatum).getTime() : 0;
    const dateB = b.lieferdatum ? new Date(b.lieferdatum).getTime() : 0;
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });
    // Fügt innerhalb der Komponente (z.B. direkt nach useState) diese Funktionen ein:

// Aktualisiert den Auftragsstatus über die API
const updateOrderStatus = async (orderId: string, newStatus: AuftragResource['status']) => {
  try {
    const updated = await api.updateAuftrag(orderId, { status: newStatus });
    setAuftraege(prev => prev.map(o => (o.id === orderId ? updated : o)));
  } catch (err: any) {
    console.error(err.message || 'Fehler beim Aktualisieren des Auftrags');
  }
};

// Setzt beim Drucken den Status auf "in Bearbeitung" und startet dann den Druckvorgang
const handlePrint = async (orderId: string) => {
  await updateOrderStatus(orderId, 'in Bearbeitung');
  window.print();
};

// Setzt den Status auf "abgeschlossen"
const handleComplete = async (orderId: string) => {
  await updateOrderStatus(orderId, 'abgeschlossen');
};

// Setzt den Status auf "storniert"
const handleCancel = async (orderId: string) => {
  await updateOrderStatus(orderId, 'storniert');
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
          <input
            type="text"
            className="form-control"
            placeholder="Suche (Auftrag, Kunde)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Alle Status</option>
            <option value="offen">offen</option>
            <option value="in Bearbeitung">in Bearbeitung</option>
            <option value="abgeschlossen">abgeschlossen</option>
            <option value="storniert">storniert</option>
          </select>
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="asc">Lieferdatum: Aufsteigend</option>
            <option value="desc">Lieferdatum: Absteigend</option>
          </select>
        </div>
      </div>

      <table className="table table-striped table-hover">
        <thead className="table-light">
          <tr>
            {/* Wir zeigen hier nur den Kundennamen */}
            <th>Kunde</th>
            <th>Status</th>
            <th>Lieferdatum</th>
            <th>Preis</th>
            <th>Gewicht</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filteredAuftraege.map((auftrag) => (
            <tr
              key={auftrag.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/auftraege/${auftrag.id}`)}
            >
              {/* Zeige Kundennamen (falls vorhanden) oder alternativ den Kundenwert */}
              <td>{(auftrag as any).kundeName || auftrag.kunde}</td>
              <td>{auftrag.status}</td>
              <td>
                {auftrag.lieferdatum
                  ? new Date(auftrag.lieferdatum).toLocaleDateString()
                  : '-'}
              </td>
              <td>{auftrag.preis ? `${auftrag.preis} €` : '-'}</td>
              <td>{auftrag.gewicht ? `${auftrag.gewicht} kg` : '-'}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn btn-sm btn-info me-1"
                  onClick={() => handleComplete(auftrag.id!)}
                >
                  Abschließen
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleCancel(auftrag.id!)}
                >
                  Stornieren
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Auftraege;