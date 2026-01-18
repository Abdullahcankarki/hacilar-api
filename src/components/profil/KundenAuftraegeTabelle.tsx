import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomerStopsToday } from '@/backend/api';

interface ArtikelPosition {
  id?: string;
  artikel?: string;
  menge?: number;
  einheit?: string;
  gesamtpreis?: number;
}

interface Auftrag {
  id?: string;
  auftragsnummer?: string;
  status?: string;
  lieferdatum?: string;
  createdAt?: string;
  preis?: number;
  gewicht?: number;
  artikelPosition?: ArtikelPosition[];
}

interface KundenAuftraegeTabelleProp {
  auftraege: Auftrag[];
  kundeId?: string;
}

type SortField = 'lieferdatum' | 'gewicht' | 'anzahl' | 'status' | 'auftragsnummer' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const KundenAuftraegeTabelle: React.FC<KundenAuftraegeTabelleProp> = ({ auftraege, kundeId }) => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('lieferdatum');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [etaLoading, setEtaLoading] = useState<boolean>(false);
  const [etaLabelHeute, setEtaLabelHeute] = useState<string | null>(null);
  const etaReqIdRef = React.useRef(0);

  // Hilfsfunktion: Formatiert ETA-Zeitfenster
  const formatEtaLabel = (fromIso?: string, toIso?: string): string | null => {
    if (!fromIso || !toIso) return null;
    const now = Date.now();
    const fromMs = new Date(fromIso).getTime();
    const toMs = new Date(toIso).getTime();
    let minMin = Math.max(0, Math.round((fromMs - now) / 60000));
    let maxMin = Math.max(minMin + 15, Math.round((toMs - now) / 60000));
    const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);
    minMin = round5(minMin);
    maxMin = round5(maxMin);
    const fromLocal = new Date(fromMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const toLocal = new Date(toMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${fromLocal}–${toLocal} Uhr`;
  };

  // Hilfsfunktion: Prüft ob ein Datum heute ist
  const isSameDay = (d?: string | Date): boolean => {
    if (!d) return false;
    const dt = new Date(d);
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };

  // Hilfsfunktion: Bestimmt Badge-Farbe für Status
  const statusBadge = (status: string): string => {
    if (!status || status.toLowerCase() === 'offen') return 'bg-warning text-dark';
    if (status.toLowerCase() === 'abgeschlossen') return 'bg-success';
    if (status.toLowerCase() === 'storniert') return 'bg-danger';
    return 'bg-secondary';
  };

  // Handler: Sortierung umschalten
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handler: Zeile anklicken zum Navigieren
  const handleRowClick = (auftragId?: string) => {
    if (auftragId) {
      navigate(`/auftraege/${auftragId}`);
    }
  };

  // Effect: ETA für heutige Aufträge laden
  useEffect(() => {
    if (!kundeId || !Array.isArray(auftraege)) {
      setEtaLoading(false);
      setEtaLabelHeute(null);
      return;
    }

    const hasToday = auftraege.some((a) => isSameDay(a.lieferdatum));
    if (!hasToday) {
      setEtaLoading(false);
      setEtaLabelHeute(null);
      return;
    }

    setEtaLoading(true);
    setEtaLabelHeute(null);
    const reqId = ++etaReqIdRef.current;

    getCustomerStopsToday(kundeId)
      .then((stops) => {
        if (reqId === etaReqIdRef.current) {
          const first = Array.isArray(stops) ? stops[0] : undefined;
          if (first && first.etaFromUtc && first.etaToUtc) {
            setEtaLabelHeute(formatEtaLabel(first.etaFromUtc, first.etaToUtc));
          } else {
            setEtaLabelHeute('—');
          }
          setEtaLoading(false);
        }
      })
      .catch((e) => {
        if (reqId === etaReqIdRef.current) {
          console.error('ETA (heute) laden fehlgeschlagen', e);
          setEtaLabelHeute('—');
          setEtaLoading(false);
        }
      });
  }, [auftraege, kundeId]);

  // Sortierte Aufträge
  const sortedAuftraege = [...auftraege].sort((a, b) => {
    let aValue: any, bValue: any;
    switch (sortField) {
      case 'lieferdatum':
        aValue = a.lieferdatum ? new Date(a.lieferdatum).getTime() : 0;
        bValue = b.lieferdatum ? new Date(b.lieferdatum).getTime() : 0;
        break;
      case 'gewicht':
        aValue = a.gewicht || 0;
        bValue = b.gewicht || 0;
        break;
      case 'anzahl':
        aValue = a.artikelPosition?.length || 0;
        bValue = b.artikelPosition?.length || 0;
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      case 'auftragsnummer':
        aValue = a.auftragsnummer || '';
        bValue = b.auftragsnummer || '';
        break;
      case 'createdAt':
        aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        break;
      default:
        return 0;
    }
    if (typeof aValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body">
        <h2 className="h5 mb-3 pb-2 border-bottom">Meine letzten Aufträge</h2>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th
                  className="text-center"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSort('auftragsnummer')}
                >
                  Auftragsnummer {sortField === 'auftragsnummer' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="text-center d-none d-md-table-cell"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSort('createdAt')}
                >
                  Bestellt am {sortField === 'createdAt' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="text-center"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSort('lieferdatum')}
                >
                  Lieferdatum {sortField === 'lieferdatum' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="text-center d-none d-md-table-cell"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSort('anzahl')}
                >
                  Artikel {sortField === 'anzahl' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="text-center d-none d-md-table-cell"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSort('gewicht')}
                >
                  Gewicht {sortField === 'gewicht' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="text-center d-none d-md-table-cell"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSort('status')}
                >
                  Status {sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="text-center">Ankunft</th>
              </tr>
            </thead>
            <tbody>
              {sortedAuftraege.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    Keine Aufträge vorhanden
                  </td>
                </tr>
              ) : (
                sortedAuftraege.map((auftrag) => (
                  <tr
                    key={auftrag.id}
                    onClick={() => handleRowClick(auftrag.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="fw-medium text-center">{auftrag.auftragsnummer || '—'}</td>
                    <td className="text-center d-none d-md-table-cell">
                      {auftrag.createdAt ? new Date(auftrag.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="text-center">
                      {auftrag.lieferdatum ? new Date(auftrag.lieferdatum).toLocaleDateString() : '—'}
                    </td>
                    <td className="text-center d-none d-md-table-cell">{auftrag.artikelPosition?.length || 0}</td>
                    <td className="text-center d-none d-md-table-cell">{auftrag.gewicht?.toFixed(2) || '0.00'} kg</td>
                    <td className="text-center d-none d-md-table-cell">
                      <span className={`badge ${statusBadge(auftrag.status || '')}`}>{auftrag.status || 'offen'}</span>
                    </td>
                    <td className="text-center">
                      {isSameDay(auftrag.lieferdatum) ? (
                        etaLoading ? (
                          <div className="progress" style={{ height: 6 }}>
                            <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: '100%' }} />
                          </div>
                        ) : (
                          <span className="small text-nowrap">{etaLabelHeute ?? '—'}</span>
                        )
                      ) : (
                        <span className="small text-nowrap">
                          {auftrag.lieferdatum ? new Date(auftrag.lieferdatum).toLocaleDateString() : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default KundenAuftraegeTabelle;
