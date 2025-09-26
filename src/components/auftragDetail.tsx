import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { AuftragResource, ArtikelPositionResource, ArtikelResource } from '../Resources';
import { api } from '../backend/api';
import AuftragPositionenTabelle from './auftragsPositionenTabelle';
import { useAuth } from '../providers/Authcontext';

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

const AuftragDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isKunde = user?.role?.includes('kunde');
    const [auftrag, setAuftrag] = useState<AuftragResource | null>(null);
    const [positions, setPositions] = useState<ArtikelPositionResource[]>([]);
    const [alleArtikel, setAlleArtikel] = useState<ArtikelResource[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [saving, setSaving] = useState<boolean>(false);
    const [statusError, setStatusError] = useState<string>('');
    const [statusSuccess, setStatusSuccess] = useState<string>('');
    const [showModal, setShowModal] = useState(false);
    const [initialLieferdatum, setInitialLieferdatum] = useState<string | undefined>(undefined);

        // Hilfsfunktion: entfernt lieferdatum aus Payloads für updateAuftrag
    const ohneLieferdatum = (obj: any) => {
        if (!obj) return obj;
        const { lieferdatum, ...rest } = obj;
        return rest;
    };


    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!id) throw new Error('Keine Auftrag-ID angegeben.');
                const auftragData = await api.getAuftragById(id);
                setAuftrag(auftragData);
                setInitialLieferdatum(auftragData.lieferdatum || undefined);

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
            setError(err.message + "Fehler beim Speichern" || 'Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    const normDate = (v?: string) => {
        if (!v) return '';
        // falls bereits 'YYYY-MM-DD'
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        try { return new Date(v).toISOString().split('T')[0]; } catch { return ''; }
    };

    const handleSaveAuftrag = async () => {
        try {
            if (!auftrag?.id) return;
            setSaving(true);
            const payload: any = { ...auftrag };
            if (normDate(payload.lieferdatum) === normDate(initialLieferdatum)) {
                delete payload.lieferdatum; // nur senden, wenn wirklich geändert
            }
            const updated = await api.updateAuftrag(auftrag.id, payload);
            setAuftrag(updated);
            setStatusSuccess('Auftrag gespeichert.');
            setShowModal(false);
        } catch (err: any) {
            setStatusError(err.message || 'Fehler beim Speichern');
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

    return (
        <div className="container my-4">
            <div className="card card-body mb-3">
                <div className="d-flex justify-content-between align-items-start flex-wrap">
                    <div>
                        <p className="mb-1"><strong>Kunde:</strong></p>
                        <h4>{auftrag.kundeName}</h4>
                        <p className="mb-0"><strong>Auftragsnummer:</strong> <span className="badge bg-info text-uppercase">{auftrag.auftragsnummer ?? "-"}</span></p>
                    </div>
                    <div>
                        <p className="mb-1"><strong>Lieferdatum:</strong></p>
                        <span className="badge bg-secondary fs-6">{formatDate(auftrag.lieferdatum)}</span>
                    </div>
                </div>
            </div>
            {!isKunde && (
                <Button className="btn btn-outline-accent rounded-pill btn-sm mb-3 print-hidden" onClick={() => setShowModal(true)}>
                    Auftrag bearbeiten
                </Button>
            )}
            {!isKunde && !(auftrag.status === 'in Bearbeitung' && auftrag.kommissioniertStatus === 'offen') && (
                <Button
                    variant="outline-success"
                    className="rounded-pill btn-sm mb-3 ms-2 print-hidden"
                    onClick={async () => {
                        try {
                            if (!auftrag?.id) return;
                            await api.setAuftragInBearbeitung(auftrag.id);
                            setStatusSuccess('Auftrag in Kommissionierung überführt.');
                            navigate('/auftraege');
                        } catch (err: any) {
                            setStatusError(err.message || 'Fehler beim Start der Kommissionierung.');
                        }
                    }}
                >
                    In Kommissionierung überführen
                </Button>
            )}

            {!isKunde && (
                <Modal show={showModal} onHide={() => setShowModal(false)}>
                    <Modal.Header closeButton>
                        <Modal.Title>Auftrag bearbeiten</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Lieferdatum</Form.Label>
                            <Form.Control
                                type="date"
                                value={
                                    auftrag.lieferdatum
                                        ? new Date(auftrag.lieferdatum).toISOString().split('T')[0]
                                        : ''
                                }
                                onChange={(e) =>
                                    setAuftrag({ ...auftrag, lieferdatum: e.target.value })
                                }
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Bemerkung</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={auftrag.bemerkungen || ''}
                                onChange={(e) =>
                                    setAuftrag({ ...auftrag, bemerkungen: e.target.value })
                                }
                            />
                        </Form.Group>

                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>
                            Abbrechen
                        </Button>
                        <Button variant="primary" onClick={handleSaveAuftrag}>
                            Speichern
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}

            <AuftragPositionenTabelle
                positions={positions}
                alleArtikel={alleArtikel}
                onChange={isKunde ? undefined : setPositions}
                onSave={isKunde ? undefined : handleSavePositions}
                saving={isKunde ? undefined : saving}
                auftragId={auftrag.id!}
            />

            {!isKunde && (
                <div className="card mt-4">
                    <div className="card-header">
                        Bemerkung
                    </div>
                    <div className="card-body">
                        <p className="mb-0">{auftrag.bemerkungen || '—'}</p>
                    </div>
                </div>
            )}

            {!isKunde && statusError && <Alert variant="danger" className="mt-3 print-hidden">{statusError}</Alert>}
            {!isKunde && statusSuccess && <Alert variant="success" className="mt-3 print-hidden">{statusSuccess}</Alert>}
        </div>
    );
};

export default AuftragDetail;