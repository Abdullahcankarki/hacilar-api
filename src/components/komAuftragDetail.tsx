import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { AuftragResource, ArtikelPositionResource, ArtikelResource } from '../Resources';
import { api } from '../backend/api';
import AuftragPositionenTabelle from './auftragsPositionenTabelle';
import { useAuth } from '../providers/Authcontext';
import KomAuftragPositionenTabelle from './komAuftragsPositionenTabelle';

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};


const formatDateJustDay = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

// Hilfsfunktion: Summiert Paletten und Boxen aus Leergut-Feldern aller Positionen
const calcTotalsFromLeergut = (positions: ArtikelPositionResource[]) => {
    let paletten = 0;
    let boxen = 0;
    for (const pos of positions) {
        if (!pos.leergut || !Array.isArray(pos.leergut)) continue;
        for (const lg of pos.leergut) {
            const artNorm = (lg.leergutArt || '').toString().trim().toLowerCase();
            const anzahl = Number(lg.leergutAnzahl) || 0;
            // Zähllogik basierend auf den fixen Values aus dem UI
            const paletteKeys = new Set(['h1', 'einwegpalette', 'euro palette', 'europalette']);
            const isPalette = paletteKeys.has(artNorm);
            const isBigBox = artNorm === 'big box';
            if (isPalette) paletten += anzahl;
            if (isBigBox) boxen += anzahl;
        }
    }
    return { paletten, boxen };
};


const KomAuftragDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [auftrag, setAuftrag] = useState<AuftragResource | null>(null);
    const [positions, setPositions] = useState<ArtikelPositionResource[]>([]);
    const [alleArtikel, setAlleArtikel] = useState<ArtikelResource[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [saving, setSaving] = useState<boolean>(false);
    const [statusError, setStatusError] = useState<string>('');
    const [statusSuccess, setStatusSuccess] = useState<string>('');
    const [showModal, setShowModal] = useState(false);
    const [editingKommissioniert, setEditingKommissioniert] = useState(false);
    const [editingKontrollstatus, setEditingKontrollstatus] = useState(false);
    const [editingPaletten, setEditingPaletten] = useState(false);
    const [editingBoxen, setEditingBoxen] = useState(false);
    const [showKontrolleModal, setShowKontrolleModal] = useState(false);

    // Hilfsfunktion: entfernt lieferdatum aus Payloads für updateAuftrag
    const ohneLieferdatum = (obj: any) => {
        if (!obj) return obj;
        const { lieferdatum, ...rest } = obj;
        return rest;
    };

    const isAdmin = user?.role?.includes('admin');
    const isKommissionierer = user?.role?.includes('kommissionierung');
    const isKontrolleur = user?.role?.includes('kontrolle');
    const istZustaendigerKontrolleur = auftrag?.kontrolliertVon === user?.id;

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!id) throw new Error('Keine Auftrag-ID angegeben.');
                const auftragData = await api.getAuftragById(id);
                setAuftrag(auftragData);

                if (auftragData.artikelPosition?.length) {
                    const pos = await Promise.all(
                        auftragData.artikelPosition.map(api.getArtikelPositionById)
                    );
                    setPositions(pos);
                }

                const artikelData = await api.getAllArtikel(); // API: alle Artikel laden
                setAlleArtikel(artikelData.items);
            } catch (err: any) {
                setError(err.message || 'Fehler beim Laden der Daten');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    useEffect(() => {
        if (statusSuccess) {
            const timeout = setTimeout(() => setStatusSuccess(''), 5000);
            return () => clearTimeout(timeout);
        }
    }, [statusSuccess]);

    useEffect(() => {
        if (statusError) {
            const timeout = setTimeout(() => setStatusError(''), 5000);
            return () => clearTimeout(timeout);
        }
    }, [statusError]);

    // Automatische Berechnung der Leergut-Summen, solange keine manuelle Bearbeitung aktiv ist
    useEffect(() => {
        if (!auftrag) return;
        if (editingPaletten || editingBoxen) return; // manuelle Eingabe hat Vorrang
        const { paletten, boxen } = calcTotalsFromLeergut(positions);
        setAuftrag(prev => prev ? { ...prev, gesamtPaletten: paletten, gesamtBoxen: boxen } : prev);
    }, [positions, editingPaletten, editingBoxen]);

    // Beim Öffnen des Modals aktuelle berechnete Werte in den Auftrag setzen, damit Felder vorbefüllt sind
    useEffect(() => {
        if (!auftrag) return;
        if (!showModal) return;
        const { paletten, boxen } = calcTotalsFromLeergut(positions);
        setAuftrag(prev => prev ? { ...prev, gesamtPaletten: paletten, gesamtBoxen: boxen } : prev);
    }, [showModal, positions]);

    const handleSavePositions = async () => {
        setError('');
        try {
            setSaving(true);
            for (const pos of positions) {
                if (pos.id) {
                    await api.updateArtikelPosition(pos.id, pos);
                } else {
                    if (!auftrag?.id) {
                        throw new Error('Auftrag-ID fehlt beim Erstellen einer neuen Position.');
                    }
                    await api.createArtikelPosition({
                        artikel: pos.artikel!,
                        menge: pos.menge!,
                        einheit: pos.einheit!,
                        einzelpreis: pos.einzelpreis!,
                        zerlegung: pos.zerlegung,
                        vakuum: pos.vakuum,
                        bemerkung: pos.bemerkung,
                        auftragId: auftrag.id, // ✨ HIER wird Auftrag übergeben
                    });
                }
            }
            setStatusSuccess('Positionen erfolgreich gespeichert.');
        } catch (err: any) {
            setError(err.message || 'Fehler beim Speichern.');
        } finally {
            setSaving(false);
        }
    };

    const handleEndeKommissionierung = async () => {
        try {
            if (!auftrag?.id) return;
            setSaving(true);
            const updated = await api.updateAuftrag(auftrag.id, {
                ...ohneLieferdatum(auftrag),
                kommissioniertStatus: 'fertig',
                kommissioniertEndzeit: new Date().toISOString(),
                kontrolliertStatus: 'offen'
            });
            setAuftrag(updated);
            setShowModal(false);
            navigate('/kommissionierung');
        } catch (err: any) {
            setStatusError(err.message || 'Fehler beim Beenden der Kommissionierung');
        } finally {
            setSaving(false);
        }
    };

    const handleEndeKontrolle = async () => {
        try {
            if (!auftrag?.id) return;
            setSaving(true);
            const updated = await api.updateAuftrag(auftrag.id, {
                ...ohneLieferdatum(auftrag),
                kontrolliertStatus: 'geprüft',
                kontrolliertZeit: new Date().toISOString(),
            });
            setAuftrag(updated);
            navigate('/kommissionierung');
        } catch (err: any) {
            setStatusError(err.message || 'Fehler beim Abschließen der Kontrolle');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center my-5" style={{ minHeight: '200px' }}>
            <Spinner animation="border" role="status" />
            <span className="ms-2">Lade...</span>
        </div>
    );
    if (error) return (
        <div className="d-flex justify-content-center align-items-center my-5" style={{ minHeight: '200px' }}>
            <Alert variant="danger" className="w-50 text-center">{error}</Alert>
        </div>
    );
    if (!auftrag) return (
        <div className="d-flex justify-content-center align-items-center my-5" style={{ minHeight: '200px' }}>
            <Alert variant="warning" className="w-50 text-center">Kein Auftrag gefunden</Alert>
        </div>
    );

    if (!isAdmin) {
        if (auftrag?.kommissioniertStatus === 'fertig' && !isKontrolleur) {
            return (
                <div className="d-flex justify-content-center align-items-center my-5">
                    <Alert variant="warning">Diesen Auftrag können nur Admin und Kontrolle einsehen.</Alert>
                </div>
            );
        }

        if (auftrag?.kontrolliertStatus === 'in Kontrolle') {
            if (!isKontrolleur) {
                return (
                    <div className="d-flex justify-content-center align-items-center my-5">
                        <Alert variant="warning">Dieser Auftrag wird gerade kontrolliert von {auftrag.kontrolliertVonName}.</Alert>
                    </div>
                );
            }
            if (isKontrolleur && !istZustaendigerKontrolleur) {
                return (
                    <div className="d-flex justify-content-center align-items-center my-5">
                        <Alert variant="warning">Dieser Auftrag wird gerade kontrolliert von {auftrag.kontrolliertVonName}.</Alert>
                    </div>
                );
            }
        }
    }
    const dauerMs = new Date(auftrag.kommissioniertEndzeit!).getTime() - new Date(auftrag.kommissioniertStartzeit!).getTime();
    const dauerMinuten = Math.floor(dauerMs / 60000);

    const statusColor = auftrag.kommissioniertStatus === 'fertig' ? 'success'
        : auftrag.kommissioniertStatus === 'gestartet' ? 'warning'
            : 'secondary';

    const kontrollStatusColor = auftrag.kontrolliertStatus === 'geprüft' ? 'success'
        : auftrag.kontrolliertStatus === 'in Kontrolle' ? 'warning'
            : 'secondary';

    return (
        <div className="container my-4">
            {/* Kundenname, Lieferdatum und Auftragsnummer immer sichtbar */}
            <div className="card card-body mb-3">
                <div className="d-flex justify-content-between align-items-start flex-wrap">
                    <div>
                        <p className="mb-1"><strong>Kunde:</strong></p>
                        <h4>{auftrag.kundeName}</h4>
                        <p className="mb-0"><strong>Auftragsnummer:</strong> <span className="badge bg-info text-uppercase"> {auftrag.auftragsnummer ?? "-"} </span></p>
                        {(isKontrolleur || isAdmin) && (
                            <div>
                                <p className="mb-0"><strong>Gesamtanzahl der Paletten:</strong>{' '}
                                    {!editingPaletten ? (
                                        <span style={{ cursor: 'pointer' }} onClick={() => setEditingPaletten(true)}>
                                            {auftrag.gesamtPaletten ?? '—'} <i className="bi bi-pencil ms-1"></i>
                                        </span>
                                    ) : (
                                        <Form.Control
                                            type="number"
                                            min={0}
                                            value={auftrag.gesamtPaletten || ''}
                                            onChange={(e) => setAuftrag(prev => ({ ...prev!, gesamtPaletten: parseInt(e.target.value) }))}
                                            onBlur={async () => {
                                                setEditingPaletten(false);
                                            if (auftrag?.id) {
                                                const updated = await api.updateAuftrag(auftrag.id, { ...ohneLieferdatum(auftrag), gesamtPaletten: auftrag.gesamtPaletten });
                                                setAuftrag(updated);
                                            }
                                            }}
                                            autoFocus
                                            size="sm"
                                            style={{ display: 'inline-block', width: '100px' }}
                                        />
                                    )}
                                </p>
                                <p className="mb-0"><strong>Gesamtanzahl der Boxen:</strong>{' '}
                                    {!editingBoxen ? (
                                        <span style={{ cursor: 'pointer' }} onClick={() => setEditingBoxen(true)}>
                                            {auftrag.gesamtBoxen ?? '—'} <i className="bi bi-pencil ms-1"></i>
                                        </span>
                                    ) : (
                                        <Form.Control
                                            type="number"
                                            min={0}
                                            value={auftrag.gesamtBoxen || ''}
                                            onChange={(e) => setAuftrag(prev => ({ ...prev!, gesamtBoxen: parseInt(e.target.value) }))}
                                            onBlur={async () => {
                                                setEditingBoxen(false);
                                            if (auftrag?.id) {
                                                const updated = await api.updateAuftrag(auftrag.id, { ...ohneLieferdatum(auftrag), gesamtBoxen: auftrag.gesamtBoxen });
                                                setAuftrag(updated);
                                            }
                                            }}
                                            autoFocus
                                            size="sm"
                                            style={{ display: 'inline-block', width: '100px' }}
                                        />
                                    )}
                                </p>
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="mb-1"><strong>Lieferdatum:</strong></p>
                        <span className="badge bg-secondary fs-6">{formatDateJustDay(auftrag.lieferdatum)}</span>
                    </div>
                </div>
            </div>

            {/* Detailinformationen nur für Admin */}
            {isAdmin && (
                <div className="card card-body mb-3">
                    <div className="d-flex justify-content-between align-items-start flex-wrap">
                        <div>
                            <p className="mb-0">
                                <strong>Kommissionierungsstatus:</strong>{' '}
                                {editingKommissioniert ? (
                                    <Form.Select
                                        size="sm"
                                        className="d-inline w-auto ms-2"
                                        value={auftrag.kommissioniertStatus}
                                        onChange={async (e) => {
                                            const neuerStatus = e.target.value as any;
                                            setAuftrag(prev => ({ ...prev!, kommissioniertStatus: neuerStatus }));
                                        await api.updateAuftrag(auftrag.id!, { ...ohneLieferdatum(auftrag), kommissioniertStatus: neuerStatus });
                                            setEditingKommissioniert(false);
                                        }}
                                    >
                                        <option value="offen">offen</option>
                                        <option value="gestartet">gestartet</option>
                                        <option value="fertig">fertig</option>
                                    </Form.Select>
                                ) : (
                                    <span
                                        className={`badge bg-${statusColor} ms-2`}
                                        onClick={() => setEditingKommissioniert(true)}
                                        style={{ cursor: 'pointer' }}
                                        title="Status bearbeiten"
                                    >
                                        {auftrag.kommissioniertStatus || 'offen'}
                                    </span>
                                )}
                            </p>
                            <p className="mb-0"><strong>Kommisioniert von:</strong> {auftrag.kommissioniertVonName || '—'}</p>
                            <p className="mb-0"><strong>Kommissionierung gestartet:</strong> {formatDate(auftrag.kommissioniertStartzeit)}</p>
                            <p className="mb-0"><strong>Kommissionierung abgeschlossen:</strong> {formatDate(auftrag.kommissioniertEndzeit)}</p>
                            <p className="mb-0">
                                <strong>Dauer:</strong>{' '}
                                {auftrag.kommissioniertStartzeit && auftrag.kommissioniertEndzeit
                                    ? `${dauerMinuten} Minuten`
                                    : '—'}
                            </p>
                            <p className="mb-0">
                                <strong>Kontrollstatus:</strong>{' '}
                                {editingKontrollstatus ? (
                                    <Form.Select
                                        size="sm"
                                        className="d-inline w-auto ms-2"
                                        value={auftrag.kontrolliertStatus}
                                        onChange={async (e) => {
                                            const neuerStatus = e.target.value as any;
                                            setAuftrag(prev => ({ ...prev!, kontrolliertStatus: neuerStatus }));
                                        await api.updateAuftrag(auftrag.id!, { ...ohneLieferdatum(auftrag), kontrolliertStatus: neuerStatus });
                                            setEditingKontrollstatus(false);
                                        }}
                                    >
                                        <option value="offen">offen</option>
                                        <option value="in Kontrolle">in Kontrolle</option>
                                        <option value="geprüft">geprüft</option>
                                    </Form.Select>
                                ) : (
                                    <span
                                        className={`badge bg-${kontrollStatusColor} ms-2`}
                                        onClick={() => setEditingKontrollstatus(true)}
                                        style={{ cursor: 'pointer' }}
                                        title="Status bearbeiten"
                                    >
                                        {auftrag.kontrolliertStatus || '—'}
                                    </span>
                                )}
                            </p>
                            <p className="mb-0"><strong>Kontrolliert von:</strong> {auftrag.kontrolliertVonName || '—'}</p>
                            <p className="mb-0"><strong>Kontrolliert am:</strong> {formatDate(auftrag.kontrolliertZeit)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Kontrolleur sieht nur zwei Felder */}
            {!isAdmin && isKontrolleur && (
                <div className="card card-body mb-3">
                    <p className="mb-0"><strong>Kommissioniert von:</strong> {auftrag.kommissioniertVonName || '—'}</p>
                    <p className="mb-0">
                        <strong>Kommissionierungsstatus:</strong>{' '}
                        <span className={`badge bg-${statusColor} ms-2`}>{auftrag.kommissioniertStatus || 'offen'}</span>
                    </p>
                </div>
            )}

            <Modal show={showModal} onHide={() => setShowModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Kommissionierung beenden</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Bist du sicher, dass du die Kommissionierung beenden möchtest? Diese Aktion kann nicht rückgängig gemacht werden.</p>
                    <Form.Group className="mb-3">
                        <Form.Label>Gesamtanzahl der Paletten</Form.Label>
                        <Form.Control
                            type="number"
                            min={0}
                            value={auftrag.gesamtPaletten || '0'}
                            onChange={(e) => setAuftrag({ ...auftrag, gesamtPaletten: parseInt(e.target.value) })}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Gesamtanzahl der Boxen</Form.Label>
                        <Form.Control
                            type="number"
                            min={0}
                            value={auftrag.gesamtBoxen || '0'}
                            onChange={(e) => setAuftrag({ ...auftrag, gesamtBoxen: parseInt(e.target.value) })}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>
                        Abbrechen
                    </Button>
                    <Button variant="danger" onClick={handleEndeKommissionierung}>
                        Beenden
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Positions-Tabelle */}
            <KomAuftragPositionenTabelle
                positions={positions}
                alleArtikel={alleArtikel}
                onChange={setPositions}
                onSave={handleSavePositions}
                saving={saving}
                auftragId={auftrag.id!}
            />

            {/* Button Kommissionierung beenden UNTER der Tabelle */}
            {(() => {
                const allePositionenFertig = positions.every(p => !!p.kommissioniertAm);
                // Button nur zeigen, wenn Admin oder (Kommissionierer UND allePositionenFertig)
                if (
                    !isKontrolleur &&
                    auftrag.kommissioniertStatus !== 'fertig' &&
                    (isAdmin || (isKommissionierer && allePositionenFertig))
                ) {
                    return (
                        <Button
                            variant="danger"
                            className="mb-3 mt-3"
                            onClick={() => setShowModal(true)}
                            title="Kommissionierung abschließen"
                        >
                            Kommissionierung beenden
                        </Button>
                    );
                }
                // Button Kontrolle abschließen öffnet Modal
                if ((isKontrolleur || isAdmin) && auftrag.kontrolliertStatus === 'in Kontrolle' && istZustaendigerKontrolleur) {
                    return (
                        <Button
                            variant="success"
                            className="mb-3 mt-3"
                            onClick={() => setShowKontrolleModal(true)}
                        >
                            Kontrolle abschließen
                        </Button>
                    );
                }
                return null;
            })()}

            <div className="card mt-4 border-secondary">
                <div className="card-header bg-light text-dark">
                    Bemerkung
                </div>
                <div className="card-body">
                    {auftrag.bemerkungen ? (
                        <p className="mb-0 fw-bold" style={{ backgroundColor: '#dc3545', color: 'white', padding: '10px', borderRadius: '6px' }}>
                            {auftrag.bemerkungen}
                        </p>
                    ) : (
                        <p className="mb-0 text-muted">—</p>
                    )}
                </div>
            </div>

            {statusError && <Alert variant="danger" className="mt-3 print-hidden">{statusError}</Alert>}
            {statusSuccess && <Alert variant="success" className="mt-3 print-hidden">{statusSuccess}</Alert>}

            {/* Kontrolle abschließen Modal */}
            <Modal show={showKontrolleModal} onHide={() => setShowKontrolleModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Kontrolle abschließen</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Bist du sicher, dass du die Kontrolle abschließen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.</p>
                    <p><strong>Zusammenfassung Leergut:</strong></p>
                    <table className="table table-sm table-bordered">
                        <thead>
                            <tr>
                                {Array.from(
                                    new Set(
                                        positions.flatMap(pos =>
                                            pos.leergut?.map(lg => lg.leergutArt) || []
                                        )
                                    )
                                ).map(art => (
                                    <th key={art}>{art}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {Object.entries(positions.reduce((acc, pos) => {
                                    if (pos.leergut && Array.isArray(pos.leergut)) {
                                        for (const lg of pos.leergut) {
                                            const key = lg.leergutArt;
                                            if (!acc[key]) acc[key] = 0;
                                            acc[key] += lg.leergutAnzahl || 0;
                                        }
                                    }
                                    return acc;
                                }, {} as Record<string, number>)).map(([_, anzahl]) => (
                                    <td key={_}>{anzahl}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowKontrolleModal(false)}>
                        Abbrechen
                    </Button>
                    <Button variant="success" onClick={() => {
                        handleEndeKontrolle();
                        setShowKontrolleModal(false);
                    }}>
                        Kontrolle jetzt abschließen
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default KomAuftragDetail;