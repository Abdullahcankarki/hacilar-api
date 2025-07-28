import React, { useState } from 'react';
import { useAuth } from '../providers/Authcontext';
import { Button, Form, Table, Alert, Modal } from 'react-bootstrap';
import { ArtikelPositionResource, ArtikelResource } from '../Resources';
import { api } from '../backend/api';

type Props = {
    positions: ArtikelPositionResource[];
    alleArtikel: ArtikelResource[];
    onChange: (positions: ArtikelPositionResource[]) => void;
    onSave: () => void;
    saving: boolean;
    auftragId: string;
};

const parseNumberInput = (value: string): number => parseFloat(value.replace(',', '.'));

const KomAuftragPositionenTabelle: React.FC<Props> = ({
    positions,
    alleArtikel,
    onChange,
    onSave,
    saving,
    auftragId,
}) => {
    const [error, setError] = useState<string | null>(null);
    // Auth
    const { user } = useAuth();
    const isAdmin = user?.role?.includes('admin');
    const isKommissionierer = user?.role?.includes('kommissionierung');
    // Modal state
    const [modalOpenIndex, setModalOpenIndex] = useState<number | null>(null);
    const [modalFields, setModalFields] = useState<any>({});

    // Helper for Modal Pflichtfeld-Check
    const modalPflichtfelderGefuellt = () => {
        return (
            modalFields.kommissioniertMenge &&
            modalFields.kommissioniertEinheit &&
            modalFields.bruttogewicht
        );
    };
    // Admin darf Modal immer schließen
    const darfModalSchliessen = isAdmin || modalPflichtfelderGefuellt();

    // Modal öffnen, Werte initialisieren
    const openKommissionierenModal = (index: number) => {
        const pos = positions[index];
        setModalOpenIndex(index);
        setModalFields({
            kommissioniertMenge: pos.kommissioniertMenge || '',
            kommissioniertEinheit: pos.kommissioniertEinheit || pos.einheit || '',
            kommissioniertBemerkung: pos.kommissioniertBemerkung || '',
            bruttogewicht: pos.bruttogewicht || '',
            leergut: pos.leergut?.length
                ? pos.leergut.map((l: any) => ({ ...l }))
                : [],
            chargennummern: pos.chargennummern?.length
                ? [...pos.chargennummern]
                : [],
        });
    };

    // Modal schließen
    const closeKommissionierenModal = () => {
        setModalOpenIndex(null);
        setModalFields({});
    };

    // Modal-Feld ändern
    const handleModalFieldChange = (field: string, value: any) => {
        setModalFields((prev: any) => ({
            ...prev,
            [field]: value,
        }));
    };

    // Leergut hinzufügen/entfernen
    const addLeergut = () => {
        setModalFields((prev: any) => ({
            ...prev,
            leergut: [...(prev.leergut || []), { leergutArt: '', leergutAnzahl: '', leergutGewicht: '' }],
        }));
    };
    const removeLeergut = (idx: number) => {
        setModalFields((prev: any) => ({
            ...prev,
            leergut: (prev.leergut || []).filter((_: any, i: number) => i !== idx),
        }));
    };
    const handleLeergutChange = (idx: number, field: string, value: any) => {
        setModalFields((prev: any) => ({
            ...prev,
            leergut: prev.leergut.map((l: any, i: number) =>
                i === idx ? { ...l, [field]: value } : l
            ),
        }));
    };

    // Chargennummern hinzufügen/entfernen
    const addChargennummer = () => {
        setModalFields((prev: any) => ({
            ...prev,
            chargennummern: [...(prev.chargennummern || []), ''],
        }));
    };
    const removeChargennummer = (idx: number) => {
        setModalFields((prev: any) => ({
            ...prev,
            chargennummern: (prev.chargennummern || []).filter((_: any, i: number) => i !== idx),
        }));
    };
    const handleChargennummerChange = (idx: number, value: string) => {
        setModalFields((prev: any) => ({
            ...prev,
            chargennummern: prev.chargennummern.map((c: string, i: number) =>
                i === idx ? value : c
            ),
        }));
    };

    // Fertigstellen
    const fertigstellen = async () => {
        if (modalOpenIndex === null) return;
        const pos = positions[modalOpenIndex];
        const now = new Date();
        try {
            // API-Update
            await api.updateArtikelPositionKommissionierung(pos.id, {
                kommissioniertMenge: modalFields.kommissioniertMenge,
                kommissioniertEinheit: modalFields.kommissioniertEinheit,
                kommissioniertBemerkung: modalFields.kommissioniertBemerkung,
                bruttogewicht: modalFields.bruttogewicht,
                leergut: modalFields.leergut,
                chargennummern: modalFields.chargennummern,
                kommissioniertAm: now,
            });
            // Soft update local state
            const updated = [...positions];
            updated[modalOpenIndex] = {
                ...pos,
                kommissioniertMenge: modalFields.kommissioniertMenge,
                kommissioniertEinheit: modalFields.kommissioniertEinheit,
                kommissioniertBemerkung: modalFields.kommissioniertBemerkung,
                bruttogewicht: modalFields.bruttogewicht,
                leergut: modalFields.leergut,
                chargennummern: modalFields.chargennummern,
                kommissioniertAm: now,
            };
            onChange(updated);
            closeKommissionierenModal();
        } catch (err: any) {
            setError('Fehler beim Speichern: ' + (err.message || 'Unbekannter Fehler'));
        }
    };

    return (
        <div>
            <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-4">
                <h2 className="h4 mb-0">Artikel</h2>
            </div>

            {/* Fehleranzeige */}
            {error && (
                <Alert className="print-hidden shadow-sm border" variant="danger" onClose={() => setError(null)} dismissible>
                    {error}
                </Alert>
            )}

            <div className="card shadow-sm mb-4">
                <div className="card-body p-3">
                    <Table bordered hover responsive className="table-sm align-middle text-nowrap">
                        <thead>
                            <tr>
                                <th className="d-none d-md-table-cell">Bemerkung</th>
                                <th>Artikel</th>
                                <th>Menge</th>
                                <th>Einheit</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map((pos, index) => {
                                const artikelObj = alleArtikel.find(a => a.id === pos.artikel);
                                const isKommissioniert = !!pos.kommissioniertAm;
                                return (
                                    <tr
                                        key={index}
                                        className={isKommissioniert ? "table-secondary" : ""}
                                    >
                                        {/* Bemerkung */}
                                        <td className="d-none d-md-table-cell">
                                            {pos.bemerkung || '-'}
                                        </td>
                                        {/* Artikel */}
                                        <td>
                                            {artikelObj
                                                ? `${artikelObj.name} - ${artikelObj.artikelNummer}`
                                                : '-'}
                                        </td>
                                        {/* Menge */}
                                        <td>
                                            {pos.menge ?? '-'}
                                        </td>
                                        {/* Einheit */}
                                        <td>
                                            {pos.einheit}
                                        </td>
                                        {/* Kommissionieren-Button */}
                                        <td>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                disabled={isKommissioniert && !isAdmin}
                                                style={{ minWidth: 130 }}
                                                onClick={() => openKommissionierenModal(index)}
                                                className="me-2"
                                                hidden={false}
                                            >
                                                {isKommissioniert ? (isAdmin ? 'Bearbeiten' : 'Abgeschlossen') : 'Kommissionieren'}
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            </div>

            {/* Kommissionieren-Modal */}
            <Modal
                show={modalOpenIndex !== null}
                onHide={darfModalSchliessen ? closeKommissionierenModal : undefined}
                backdrop={darfModalSchliessen ? true : "static"}
                keyboard={darfModalSchliessen}
                centered
            >
                <Modal.Header closeButton={darfModalSchliessen}>
                    <Modal.Title>Kommissionieren</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-2">
                            <Form.Label>Menge <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="number"
                                min="0"
                                value={modalFields.kommissioniertMenge ?? ''}
                                onChange={e => handleModalFieldChange('kommissioniertMenge', e.target.value)}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Einheit <span className="text-danger">*</span></Form.Label>
                            <Form.Select
                                value={modalFields.kommissioniertEinheit ?? ''}
                                onChange={e => handleModalFieldChange('kommissioniertEinheit', e.target.value)}
                                required
                            >
                                <option value="">Bitte wählen...</option>
                                <option value="kg">kg</option>
                                <option value="stück">stück</option>
                                <option value="kiste">kiste</option>
                                <option value="karton">karton</option>
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Bemerkung</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={modalFields.kommissioniertBemerkung ?? ''}
                                onChange={e => handleModalFieldChange('kommissioniertBemerkung', e.target.value)}
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Bruttogewicht <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="number"
                                min="0"
                                value={modalFields.bruttogewicht ?? ''}
                                onChange={e => handleModalFieldChange('bruttogewicht', e.target.value)}
                                required
                            />
                        </Form.Group>
                        {/* Leergut */}
                        <Form.Group className="mb-2">
                            <Form.Label>Leergut</Form.Label>
                            <Table bordered size="sm" className="mb-2">
                                <thead>
                                    <tr>
                                        <th>Art</th>
                                        <th>Anzahl</th>
                                        <th>Gewicht</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(modalFields.leergut || []).map((l: any, i: number) => (
                                        <tr key={i}>
                                            <td>
                                                <Form.Control
                                                    value={l.leergutArt}
                                                    onChange={e => handleLeergutChange(i, 'leergutArt', e.target.value)}
                                                    size="sm"
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="number"
                                                    value={l.leergutAnzahl}
                                                    onChange={e => handleLeergutChange(i, 'leergutAnzahl', e.target.value)}
                                                    size="sm"
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="number"
                                                    value={l.leergutGewicht}
                                                    onChange={e => handleLeergutChange(i, 'leergutGewicht', e.target.value)}
                                                    size="sm"
                                                />
                                            </td>
                                            <td>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => removeLeergut(i)}
                                                    tabIndex={-1}
                                                >–</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                            <Button variant="secondary" size="sm" onClick={addLeergut}>
                                +
                            </Button>
                        </Form.Group>
                        {/* Chargennummern */}
                        <Form.Group className="mb-2">
                            <Form.Label>Chargennummern</Form.Label>
                            {(modalFields.chargennummern || []).map((c: string, i: number) => (
                                <div key={i} className="d-flex mb-1">
                                    <Form.Control
                                        value={c}
                                        onChange={e => handleChargennummerChange(i, e.target.value)}
                                        size="sm"
                                    />
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        className="ms-1"
                                        onClick={() => removeChargennummer(i)}
                                        tabIndex={-1}
                                    >–</Button>
                                </div>
                            ))}
                            <Button variant="secondary" size="sm" onClick={addChargennummer}>
                                +
                            </Button>
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={closeKommissionierenModal}
                        disabled={!darfModalSchliessen}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        variant="primary"
                        onClick={fertigstellen}
                        disabled={!isAdmin && !modalPflichtfelderGefuellt()}
                    >
                        Fertigstellen
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default KomAuftragPositionenTabelle;