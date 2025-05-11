import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, Form, Modal, Table } from 'react-bootstrap';
import { AuftragResource, ArtikelPositionResource, ArtikelResource } from '../Resources';
import { api } from '../backend/api';
import AuftragPositionenTabelle from './auftragsPositionenTabelle';

const parseNumberInput = (value: string): number =>
    parseFloat(value.replace(',', '.'));

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
    const [auftrag, setAuftrag] = useState<AuftragResource | null>(null);
    const [positions, setPositions] = useState<ArtikelPositionResource[]>([]);
    const [alleArtikel, setAlleArtikel] = useState<ArtikelResource[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [saving, setSaving] = useState<boolean>(false);
    const [statusError, setStatusError] = useState<string>('');
    const [statusSuccess, setStatusSuccess] = useState<string>('');
    const [showModal, setShowModal] = useState(false);

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
                setAlleArtikel(artikelData);
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

    const handlePositionChange = (
        index: number,
        field: keyof ArtikelPositionResource,
        value: any
    ) => {
        const newPositions = [...positions];
        (newPositions[index] as any)[field] = value;

        if (field === 'menge' || field === 'einzelpreis') {
            const menge = newPositions[index].menge || 0;
            const einzelpreis = newPositions[index].einzelpreis || 0;
            newPositions[index].gesamtpreis = menge * einzelpreis;
        }

        setPositions(newPositions);
    };

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

    const handleSaveAuftrag = async () => {
        try {
            if (!auftrag?.id) return;
            setSaving(true);
            const updated = await api.updateAuftrag(auftrag.id, auftrag);
            setAuftrag(updated);
            setStatusSuccess('Auftrag gespeichert.');
            setShowModal(false);
        } catch (err: any) {
            setStatusError(err.message || 'Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: AuftragResource['status']) => {
        try {
            if (!auftrag?.id) return;
            setSaving(true);
            const updated = await api.updateAuftrag(auftrag.id, {
                ...auftrag,
                status: newStatus,
            });
            setAuftrag(updated);
            setStatusSuccess(`Status geändert zu "${newStatus}"`);
        } catch (err: any) {
            setStatusError(err.message || 'Fehler beim Ändern des Status');
        } finally {
            setSaving(false);
        }
    };

    const handleNeuePosition = () => {
        setPositions([
            ...positions,
            {
                id: undefined,
                artikel: '',
                artikelName: '',
                menge: 1,
                einheit: 'kg',
                einzelpreis: 0,
                gesamtgewicht: 0,
                gesamtpreis: 0,
                bemerkung: '',
            },
        ]);
    };

    if (loading) return <div className="container my-4">Lade...</div>;
    if (error) return <Alert variant="danger">{error}</Alert>;
    if (!auftrag) return <Alert variant="warning">Kein Auftrag gefunden</Alert>;

    return (
        <div className="container my-4">
            <div className="d-flex justify-content-between align-items-start flex-wrap">
              <div>
                <p className="mb-1"><strong>Kunde:</strong></p>
                <h4>{auftrag.kundeName}</h4>
              </div>
              <div>
                <p className="mb-1"><strong>Lieferdatum:</strong></p>
                <span className="badge bg-secondary fs-6">{formatDate(auftrag.lieferdatum)}</span>
              </div>
            </div>
            <Button className= "print-hidden" variant="outline-primary" onClick={() => setShowModal(true)}>
                Auftrag bearbeiten
            </Button>

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

            <AuftragPositionenTabelle
                positions={positions}
                alleArtikel={alleArtikel}
                onChange={setPositions}
                onSave={handleSavePositions}
                saving={saving}
                auftragId={auftrag.id!}
            />

            <div className="mt-4">
              <p><strong>Bemerkung:</strong> {auftrag.bemerkungen || '—'}</p>
            </div>

            {statusError && <Alert variant="danger" className="mt-3 print-hidden">{statusError}</Alert>}
            {statusSuccess && <Alert variant="success" className="mt-3 print-hidden">{statusSuccess}</Alert>}
        </div>
    );
};

export default AuftragDetail;