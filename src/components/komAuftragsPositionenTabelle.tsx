import React, { useEffect, useState } from 'react';
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
    const isKontrolleur = user?.role?.includes('kontrolle');
    // Modal state
    const [modalOpenIndex, setModalOpenIndex] = useState<number | null>(null);
    const [modalFields, setModalFields] = useState<any>({});
    // Edit mode state for modal
    const [isEditMode, setIsEditMode] = useState(false);

    // Helper for Modal Pflichtfeld-Check
    const modalPflichtfelderGefuellt = () => {
        return (
            modalFields.leergut &&
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
            artikelName: pos.artikelName,
            menge: pos.menge,
            einheit: pos.einheit,
            kommissioniertBemerkung: pos.kommissioniertBemerkung || '',
            bruttogewicht: pos.bruttogewicht || '',
            leergut: pos.leergut?.length
                ? pos.leergut.map((l: any) => ({ ...l }))
                : [],
            chargennummern: pos.chargennummern?.length
                ? [...pos.chargennummern]
                : [],
            kommissioniertAm: pos.kommissioniertAm, // für disabled-Logik
        });
        // Nur editierbar, wenn noch nicht kommissioniert
        setIsEditMode(!pos.kommissioniertAm);
    };

    // Modal schließen
    const closeKommissionierenModal = () => {
        setModalOpenIndex(null);
        setModalFields({});
        setIsEditMode(false);
    };

    // Modal-Feld ändern
    const handleModalFieldChange = (field: string, value: any) => {
        setModalFields((prev: any) => ({
            ...prev,
            [field]: value,
        }));
    };

    // Automatisches Setzen des Leergut-Gewichts bei Auswahl
    useEffect(() => {
        if (!modalFields.leergut) return;
        const updatedLeergut = modalFields.leergut.map((item: any) => {
            if (item.leergutArt === 'korb') return { ...item, leergutGewicht: 1.5 };
            if (item.leergutArt === 'e2') return { ...item, leergutGewicht: 2 };
            if (item.leergutArt === 'e1') return { ...item, leergutGewicht: 1.50 };
            if (item.leergutArt === 'h1') return { ...item, leergutGewicht: 18 };
            if (item.leergutArt === 'e6') return { ...item, leergutGewicht: 1.5 };
            if (item.leergutArt === 'big box') return { ...item, leergutGewicht: 34.5 };
            if (item.leergutArt === 'karton') return item; // manuell
            // additional cases
            if (item.leergutArt === 'euro palette') return item; // manuell
            if (item.leergutArt === 'einwegpalette') return item; // manuell
            if (item.leergutArt === 'haken') return { ...item, leergutGewicht: 1.3 };
            if (item.leergutArt === 'tüten') return { ...item, leergutGewicht: 0 };
            return item;
        });
        setModalFields((prev: any) => ({
            ...prev,
            leergut: updatedLeergut,
        }));
        // eslint-disable-next-line
    }, [modalFields.leergut?.map((l: any) => l.leergutArt).join(',')]);

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
            // Leergut korrekt typisieren (Anzahl und Gewicht als Zahlen)
            const leergutTyped = (modalFields.leergut || []).map((l: any) => ({
                leergutArt: l.leergutArt,
                leergutAnzahl: parseFloat(l.leergutAnzahl),
                leergutGewicht: parseFloat(l.leergutGewicht),
            }));
            // API-Update
            await api.updateArtikelPositionKommissionierung(pos.id, {
                kommissioniertBemerkung: modalFields.kommissioniertBemerkung,
                bruttogewicht: modalFields.bruttogewicht,
                leergut: leergutTyped,
                chargennummern: modalFields.chargennummern,
                kommissioniertAm: now,
            });
            // Soft update local state
            const updated = [...positions];
            updated[modalOpenIndex] = {
                ...pos,
                kommissioniertBemerkung: modalFields.kommissioniertBemerkung,
                bruttogewicht: modalFields.bruttogewicht,
                leergut: leergutTyped,
                chargennummern: modalFields.chargennummern,
                kommissioniertAm: now,
            };
            onChange(updated);
            closeKommissionierenModal();
        } catch (err: any) {
            setError('Beim Speichern ist ein Problem aufgetreten. Bitte überprüfe deine Eingaben und versuche es erneut.');
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
                                {(isKontrolleur || isAdmin) && <th>Kommissioniertes Gewicht (netto)</th>}
                                {(isKontrolleur || isAdmin) && <th>Leergut</th>}
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
                                            {pos.bemerkung ? (
                                                <span style={{ backgroundColor: '#dc3545', color: 'white', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', display: 'inline-block' }}>
                                                    {pos.bemerkung}
                                                </span>
                                            ) : (
                                                <span className="text-muted">–</span>
                                            )}
                                        </td>
                                        {/* Artikel */}
                                        <td>
                                            {artikelObj
                                                ? `${artikelObj.name} - ${artikelObj.artikelNummer}`
                                                : '-'}
                                        </td>
                                        {/* Menge */}
                                        <td>
                                            {pos.menge ?? '-'} {pos.einheit ?? "kg"}
                                        </td>
                                        {/* Kommissioniertes Gewicht (netto) */}
                                        {(isKontrolleur || isAdmin) && (
                                            <td>
                                                {pos.kommissioniertAm
                                                    ? (typeof pos.nettogewicht !== "undefined" && pos.nettogewicht !== null
                                                        ? pos.nettogewicht
                                                        : '—')
                                                    : 'noch nicht kommissioniert'}
                                            </td>
                                        )}
                                        {/* Leergut Spalte */}
                                        {(isKontrolleur || isAdmin) && (
                                            <td>
                                                {pos.leergut && pos.leergut.length > 0 ? (
                                                    pos.leergut
                                                        .filter(l => l.leergutArt && l.leergutAnzahl)
                                                        .map(l => `${l.leergutArt}: ${l.leergutAnzahl}`)
                                                        .join(', ')
                                                ) : (
                                                    <span className="text-muted">–</span>
                                                )}
                                            </td>
                                        )}
                                        {/* Kommissionieren-Button */}
                                        <td>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                disabled={isKommissioniert && !isAdmin && !isKontrolleur}
                                                style={{ minWidth: 130 }}
                                                onClick={() => openKommissionierenModal(index)}
                                                className="me-2"
                                                hidden={false}
                                            >
                                                {isKommissioniert ? (isAdmin || isKontrolleur ? 'Details' : 'Abgeschlossen') : 'Kommissionieren'}
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                    {/* Summierte Leergutarten-Tabelle */}
                    {(isKontrolleur || isAdmin) && (
                        <Table bordered size="sm" className="mt-4 w-auto">
                            <thead>
                                <tr>
                                    {Array.from(new Set(positions.flatMap(p => p.leergut || []).map(l => l.leergutArt)))
                                        .map((art, i) => (
                                            <th key={i} className="text-center">{art}</th>
                                        ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    {Array.from(new Set(positions.flatMap(p => p.leergut || []).map(l => l.leergutArt)))
                                        .map((art, i) => {
                                            const summe = positions
                                                .flatMap(p => p.leergut || [])
                                                .filter(l => l.leergutArt === art)
                                                .reduce((acc, l) => acc + (typeof l.leergutAnzahl === 'number' ? l.leergutAnzahl : 0), 0);
                                            return <td key={i} className="text-center fw-bold">{summe || '–'}</td>;
                                        })}
                                </tr>
                            </tbody>
                        </Table>
                    )}
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
                    <p className="text-muted mt-2 mb-3">
                        Zu kommissionieren: <strong>{modalFields.artikelName}</strong> – <strong>{modalFields.menge} {modalFields.einheit}</strong>
                    </p>
                    <Form>
                        <Form.Group className="mb-2">
                            <Form.Label>Bruttogewicht <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="number"
                                min="0"
                                value={modalFields.bruttogewicht ?? ''}
                                onChange={e => handleModalFieldChange('bruttogewicht', e.target.value)}
                                required
                                disabled={
                                    !!modalFields.kommissioniertAm &&
                                    (isAdmin || isKontrolleur) &&
                                    !isEditMode
                                }
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label>Bemerkung</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={modalFields.kommissioniertBemerkung ?? ''}
                                onChange={e => handleModalFieldChange('kommissioniertBemerkung', e.target.value)}
                                disabled={
                                    !!modalFields.kommissioniertAm &&
                                    (isAdmin || isKontrolleur) &&
                                    !isEditMode
                                }
                            />
                        </Form.Group>
                        {/* Leergut */}
                        <Form.Group className="mb-2">
                            <Form.Label>Leergut <span className="text-danger">*</span></Form.Label>
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
                                                <Form.Select
                                                    value={l.leergutArt}
                                                    onChange={e => handleLeergutChange(i, 'leergutArt', e.target.value)}
                                                    size="sm"
                                                    disabled={
                                                        !!modalFields.kommissioniertAm &&
                                                        (isAdmin || isKontrolleur) &&
                                                        !isEditMode
                                                    }
                                                >
                                                    <option value="">Bitte wählen...</option>
                                                    <option value="e2">E2</option>
                                                    <option value="e1">E1</option>
                                                    <option value="h1">H1</option>
                                                    <option value="karton">Karton</option>
                                                    <option value="e6">E6</option>
                                                    <option value="big box">Big Box</option>
                                                    <option value="korb">Korb</option>
                                                    <option value="euro palette">Europalette</option>
                                                    <option value="einwegpalette">Einwegpalette</option>
                                                    <option value="haken">Haken</option>
                                                    <option value="tüten">Tüte(n)</option>
                                                </Form.Select>
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="number"
                                                    value={l.leergutAnzahl}
                                                    onChange={e => handleLeergutChange(i, 'leergutAnzahl', e.target.value)}
                                                    size="sm"
                                                    disabled={
                                                        !!modalFields.kommissioniertAm &&
                                                        (isAdmin || isKontrolleur) &&
                                                        !isEditMode
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="number"
                                                    value={l.leergutGewicht}
                                                    onChange={e => handleLeergutChange(i, 'leergutGewicht', e.target.value)}
                                                    size="sm"
                                                    disabled={
                                                        !(l.leergutArt === 'karton' || l.leergutArt === 'einwegpalette' || l.leergutArt === 'euro palette') ||
                                                        (!!modalFields.kommissioniertAm &&
                                                            (isAdmin || isKontrolleur) &&
                                                            !isEditMode)
                                                    }
                                                />
                                                {(l.leergutArt === 'karton' || l.leergutArt === 'einwegpalette' || l.leergutArt === 'euro palette') && (
                                                    <small className="text-danger">Bitte wiege das Objekt ab und trage das Gewicht ein.</small>
                                                )}
                                            </td>
                                            <td>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => removeLeergut(i)}
                                                    tabIndex={-1}
                                                    disabled={
                                                        !!modalFields.kommissioniertAm &&
                                                        (isAdmin || isKontrolleur) &&
                                                        !isEditMode
                                                    }
                                                >–</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={addLeergut}
                                disabled={
                                    !!modalFields.kommissioniertAm &&
                                    (isAdmin || isKontrolleur) &&
                                    !isEditMode
                                }
                            >
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
                                        disabled={
                                            !!modalFields.kommissioniertAm &&
                                            (isAdmin || isKontrolleur) &&
                                            !isEditMode
                                        }
                                    />
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        className="ms-1"
                                        onClick={() => removeChargennummer(i)}
                                        tabIndex={-1}
                                        disabled={
                                            !!modalFields.kommissioniertAm &&
                                            (isAdmin || isKontrolleur) &&
                                            !isEditMode
                                        }
                                    >–</Button>
                                </div>
                            ))}
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={addChargennummer}
                                disabled={
                                    !!modalFields.kommissioniertAm &&
                                    (isAdmin || isKontrolleur) &&
                                    !isEditMode
                                }
                            >
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
                    {(isAdmin || isKontrolleur) && modalFields.kommissioniertAm && !isEditMode ? (
                        <Button
                            variant="primary"
                            onClick={() => setIsEditMode(true)}
                        >
                            Bearbeiten
                        </Button>
                    ) : (
                        <Button
                            variant="success"
                            onClick={fertigstellen}
                            disabled={(!isAdmin && !isKontrolleur) && !modalPflichtfelderGefuellt()}
                        >
                            Fertigstellen
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default KomAuftragPositionenTabelle;

