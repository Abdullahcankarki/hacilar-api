import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuftragResource } from '../Resources';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { useAuth } from '../providers/Authcontext';
import { api } from '../backend/api';

type Props = {
    titel: string;
    auftraege: AuftragResource[];
    defaultCollapsed?: boolean;
};

const KomAuftragTabelle: React.FC<Props> = ({ titel, auftraege, defaultCollapsed }) => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed ?? false);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const { user } = useAuth();

    const toggleCollapse = () => setCollapsed(prev => !prev);

    const sorted = [...auftraege].sort((a, b) => {
        return (a.lieferdatum || '').localeCompare(b.lieferdatum || '');
    });

    const darfUebernehmen = (auftrag: AuftragResource) => {
        return (
            (user?.role?.includes('kommissionierung') || user?.role?.includes('admin')) &&
            (!auftrag.kommissioniertVon && auftrag.kommissioniertStatus !== 'gestartet')
        );
    };

    const darfKontrollieren = (auftrag: AuftragResource) => {
        return (
            (user?.role?.includes('kontrolle') || user?.role?.includes('admin')) &&
            auftrag.kommissioniertStatus === 'fertig' &&
            !auftrag.kontrolliertVon
        );
    };

    const handleUebernehmen = async (auftragId: string) => {
        setLoadingId(auftragId);
        await api.updateAuftrag(auftragId, {
            kommissioniertStatus: 'gestartet',
            kommissioniertVon: user?.id,
            kommissioniertStartzeit: new Date().toISOString(),
        });
        navigate(`/kommissionierung/${auftragId}`);
    };

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
                                    <th>Auftragsnummer</th>
                                    <th>Kunde</th>
                                    <th>Lieferdatum</th>
                                    <th>Kommissioniert Start</th>
                                    <th>Kommissionierer / Kontrolle</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((auftrag) => (
                                    <tr
                                        key={auftrag.id}
                                        style={user?.role?.includes('admin') ? { cursor: 'pointer' } : undefined}
                                        onClick={() => {
                                            if (user?.role?.includes('admin')) {
                                                navigate(`/kommissionierung/${auftrag.id}`);
                                            }
                                        }}
                                    >
                                        <td>
                                            <span
                                                className="badge bg-info"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => {
                                                    if (user?.role?.includes('admin')) {
                                                      navigate(`/kommissionierung/${auftrag.id}`);
                                                    }
                                                  }}
                                            >
                                                {auftrag.auftragsnummer ?? "-"}
                                            </span>
                                        </td>
                                        <td>{auftrag.kundeName || auftrag.kunde}</td>
                                        <td>
                                            {auftrag.lieferdatum
                                                ? new Date(auftrag.lieferdatum).toLocaleDateString()
                                                : <span className="text-muted">-</span>}
                                        </td>
                                        <td>
                                            {auftrag.kommissioniertStartzeit
                                                ? new Date(auftrag.kommissioniertStartzeit).toLocaleString()
                                                : <span className="text-muted">-</span>}
                                        </td>
                                        <td>
                                            {auftrag.kommissioniertVonName && (
                                                <div>
                                                    <strong>Kommissionierer:</strong> {auftrag.kommissioniertVonName}
                                                </div>
                                            )}
                                            {auftrag.kontrolliertVonName && (
                                                <div>
                                                    <strong>Kontrolliert von:</strong> {auftrag.kontrolliertVonName}
                                                </div>
                                            )}
                                            {auftrag.kontrolliertZeit && (
                                                <div>
                                                    <strong>Kontrolliert am:</strong> {new Date(auftrag.kontrolliertZeit).toLocaleString()}
                                                </div>
                                            )}

                                            {darfUebernehmen(auftrag) && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-success mt-2"
                                                    disabled={loadingId === auftrag.id}
                                                    onClick={() => handleUebernehmen(auftrag.id!)}
                                                >
                                                    {loadingId === auftrag.id ? 'Wird übernommen...' : 'Übernehmen'}
                                                </button>
                                            )}
                                            {darfKontrollieren(auftrag) && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-warning mt-2"
                                                    disabled={loadingId === auftrag.id}
                                                    onClick={async () => {
                                                        setLoadingId(auftrag.id!);
                                                        await api.updateAuftrag(auftrag.id!, {
                                                            kontrolliertStatus: 'in Kontrolle',
                                                            kontrolliertVon: user?.id,
                                                        });
                                                        navigate(`/kommissionierung/${auftrag.id}`);
                                                    }}
                                                >
                                                    {loadingId === auftrag.id ? 'Wird geprüft...' : 'Kontrollieren'}
                                                </button>
                                            )}
                                        </td>
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

export default KomAuftragTabelle;