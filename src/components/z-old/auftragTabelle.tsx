import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuftragResource } from '../../Resources';
import { FaChevronDown, FaChevronRight, FaChevronUp, FaEdit, FaFolderOpen, FaCheck, FaTimes, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../providers/Authcontext';

type Props = {
    titel: string;
    auftraege: AuftragResource[];
    onBearbeitung?: (id: string) => void;
    onOeffnen?: (id: string) => void;
    onComplete?: (id: string) => void;
    onCancel?: (id: string) => void;
    onDelete?: (id: string) => void;
    defaultCollapsed?: boolean;
};

const AuftragTabelle: React.FC<Props> = ({ titel, auftraege, onBearbeitung, onOeffnen, onComplete, onCancel, onDelete, defaultCollapsed }) => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed ?? false);
    const [sortField, setSortField] = useState<'kunde' | 'lieferdatum' | 'preis' | 'gewicht' | 'auftragsnummer' | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const { user } = useAuth();
    const isUser = user?.role?.includes('kunde');

    const toggleCollapse = () => setCollapsed(prev => !prev);

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const sorted = [...auftraege].sort((a, b) => {
        if (!sortField) return 0;

        const valA = sortField === 'kunde'
            ? ((a as any).kundeName || a.kunde || '')
            : sortField === 'lieferdatum'
                ? a.lieferdatum || ''
                : sortField === 'preis'
                    ? a.preis || 0
                    : sortField === 'gewicht'
                        ? a.gewicht || 0
                        : a.id?.slice(-6).toUpperCase() || '';

        const valB = sortField === 'kunde'
            ? ((b as any).kundeName || b.kunde || '')
            : sortField === 'lieferdatum'
                ? b.lieferdatum || ''
                : sortField === 'preis'
                    ? b.preis || 0
                    : sortField === 'gewicht'
                        ? b.gewicht || 0
                        : b.id?.slice(-6).toUpperCase() || '';

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div className="card card-body shadow-sm mb-4">
            <div
                className="d-flex align-items-center justify-content-between fw-bold mb-3"
                style={{ cursor: 'pointer' }}
                onClick={toggleCollapse}
            >
                <h5 className="mb-0">{titel}</h5>
                <span>{collapsed ? <FaChevronRight /> : <FaChevronDown />}</span>
            </div>

            {!collapsed && (
                <>
                    {sorted.length === 0 ? (
                        <p className="text-muted">Keine Aufträge vorhanden.</p>
                    ) : (
                        <table className="table table-hover table-sm mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th onClick={() => handleSort('auftragsnummer')} style={{ cursor: 'pointer' }}>
                                        Auftragsnummer {sortField === 'auftragsnummer' ? (sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />) : ''}
                                    </th>
                                    <th onClick={() => handleSort('kunde')} style={{ cursor: 'pointer' }}>
                                        Kunde {sortField === 'kunde' ? (sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />) : ''}
                                    </th>
                                    <th onClick={() => handleSort('lieferdatum')} style={{ cursor: 'pointer' }} className="text-nowrap">
                                        Lieferdatum {sortField === 'lieferdatum' ? (sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />) : ''}
                                    </th>
                                    <th onClick={() => handleSort('preis')} style={{ cursor: 'pointer' }} className="text-nowrap d-none d-md-table-cell">
                                        Preis {sortField === 'preis' ? (sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />) : ''}
                                    </th>
                                    <th onClick={() => handleSort('gewicht')} style={{ cursor: 'pointer' }} className="text-nowrap d-none d-md-table-cell">
                                        Gewicht {sortField === 'gewicht' ? (sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />) : ''}
                                    </th>
                                    <th className="text-nowrap d-none d-md-table-cell">Status</th>
                                    {!isUser && (onBearbeitung || onOeffnen || onComplete || onCancel || onDelete) && (
                                        <th className="d-none d-md-table-cell">Aktionen</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((auftrag) => (
                                    <tr
                                        key={auftrag.id}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/auftraege/${auftrag.id}`)}
                                    >
                                        <td>
                                            <span className="badge bg-info">{auftrag.auftragsnummer ?? "-"}</span>
                                        </td>
                                        <td>{(auftrag as any).kundeName || auftrag.kunde}</td>
                                        <td className="text-nowrap">
                                            {auftrag.lieferdatum ? new Date(auftrag.lieferdatum).toLocaleDateString() : <span className="text-muted">-</span>}
                                        </td>
                                        <td className="text-nowrap d-none d-md-table-cell">
                                            {auftrag.preis != null ? `${auftrag.preis.toFixed(2)} €` : <span className="text-muted">-</span>}
                                        </td>
                                        <td className="text-nowrap d-none d-md-table-cell">
                                            {auftrag.gewicht != null ? `${auftrag.gewicht.toFixed(2)} kg` : <span className="text-muted">-</span>}
                                        </td>
                                        <td className="text-nowrap d-none d-md-table-cell">
                                            {auftrag.kontrolliertStatus ? (
                                                <span className={`badge bg-${auftrag.kontrolliertStatus === 'geprüft' ? 'success' : auftrag.kontrolliertStatus === 'in Kontrolle' ? 'warning' : 'secondary'}`}>
                                                    Kontrolle: {auftrag.kontrolliertStatus}
                                                </span>
                                            ) : auftrag.kommissioniertStatus ? (
                                                <span className={`badge bg-${auftrag.kommissioniertStatus === 'fertig' ? 'success' : auftrag.kommissioniertStatus === 'gestartet' ? 'warning' : 'secondary'}`}>
                                                    Kommission: {auftrag.kommissioniertStatus}
                                                </span>
                                            ) : (
                                                <span className="badge bg-secondary">–</span>
                                            )}
                                        </td>
                                        {!isUser && (onBearbeitung || onOeffnen || onComplete || onCancel || onDelete) && (
                                            <td onClick={(e) => e.stopPropagation()} className="d-none d-md-table-cell">
                                                <div className="btn-group" role="group" aria-label="Aktionen">
                                                    {onBearbeitung && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-warning"
                                                            onClick={() => onBearbeitung(auftrag.id!)}
                                                            title="Bearbeiten"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                    )}
                                                    {onOeffnen && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => onOeffnen(auftrag.id!)}
                                                            title="Öffnen"
                                                        >
                                                            <FaFolderOpen />
                                                        </button>
                                                    )}
                                                    {onComplete && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-success"
                                                            onClick={() => onComplete(auftrag.id!)}
                                                            title="Abschließen"
                                                        >
                                                            <FaCheck />
                                                        </button>
                                                    )}
                                                    {onCancel && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => onCancel(auftrag.id!)}
                                                            title="Stornieren"
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => onDelete(auftrag.id!)}
                                                            title="Endgültig Löschen"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </div>
    );
};

export default AuftragTabelle;