import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuftragResource } from '../Resources';
import { FaChevronDown, FaChevronRight, FaChevronUp } from 'react-icons/fa';
import { useAuth } from '../providers/Authcontext';

type Props = {
    titel: string;
    auftraege: AuftragResource[];
    onComplete: (id: string) => void;
    onCancel: (id: string) => void;
    defaultCollapsed?: boolean;
};

const AuftragTabelle: React.FC<Props> = ({ titel, auftraege, onComplete, onCancel, defaultCollapsed }) => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed ?? false);
    const [sortField, setSortField] = useState<'kunde' | 'lieferdatum' | 'preis' | 'gewicht' | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const { user } = useAuth();
    const isUser = user?.role === 'u';

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
                    : a.gewicht || 0;

        const valB = sortField === 'kunde'
            ? ((b as any).kundeName || b.kunde || '')
            : sortField === 'lieferdatum'
                ? b.lieferdatum || ''
                : sortField === 'preis'
                    ? b.preis || 0
                    : b.gewicht || 0;

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div className="mb-4 border rounded">
            <div
                className="d-flex justify-content-between align-items-center p-3 bg-light"
                style={{ cursor: 'pointer' }}
                onClick={toggleCollapse}
            >
                <h5 className="mb-0">{titel}</h5>
                <span>{collapsed ? <FaChevronRight /> : <FaChevronDown />}</span>
            </div>

            {!collapsed && (
                <div className="p-3">
                    {sorted.length === 0 ? (
                        <p className="text-muted">Keine Aufträge vorhanden.</p>
                    ) : (
                        <table className="table table-striped table-hover mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th onClick={() => handleSort('kunde')} style={{ cursor: 'pointer' }}>
                                        Kunde {sortField === 'kunde' ? (sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />) : ''}
                                    </th>
                                    <th onClick={() => handleSort('lieferdatum')} style={{ cursor: 'pointer' }}>
                                        Lieferdatum {sortField === 'lieferdatum' ? (sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />) : ''}
                                    </th>
                                    <th onClick={() => handleSort('preis')} style={{ cursor: 'pointer' }}>
                                        Preis {sortField === 'preis' ? (sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />) : ''}
                                    </th>
                                    <th onClick={() => handleSort('gewicht')} style={{ cursor: 'pointer' }}>
                                        Gewicht {sortField === 'gewicht' ? (sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />) : ''}
                                    </th>
                                    <th>Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((auftrag) => (
                                    <tr
                                        key={auftrag.id}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/auftraege/${auftrag.id}`)}
                                    >
                                        <td>{(auftrag as any).kundeName || auftrag.kunde}</td>
                                        <td>{auftrag.lieferdatum ? new Date(auftrag.lieferdatum).toLocaleDateString() : '-'}</td>
                                        <td>{auftrag.preis ? `${auftrag.preis} €` : '-'}</td>
                                        <td>{auftrag.gewicht ? `${auftrag.gewicht} kg` : '-'}</td>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            {!isUser && (
                                                <>
                                                    <button className="btn btn-sm btn-info me-1" onClick={() => onComplete(auftrag.id!)}>
                                                        Abschließen
                                                    </button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => onCancel(auftrag.id!)}>
                                                        Stornieren
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default AuftragTabelle;