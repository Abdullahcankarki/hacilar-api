import React, { useState } from 'react';
import { Offcanvas, Button, Form, Row, Col, Modal } from 'react-bootstrap';
import { ArtikelPositionResource, ArtikelResource } from '../Resources';

type Props = {
    show: boolean;
    onHide: () => void;
    cart: ArtikelPositionResource[];
    articles: ArtikelResource[]; // 🆕 Neue Prop
    onQuantityChange: (index: number, qty: number) => void;
    onEinheitChange: (index: number, einheit: ArtikelPositionResource['einheit']) => void;
    onRemove: (index: number) => void;
    onSubmit: (lieferdatum: string) => void;
};

const WarenkorbPanel: React.FC<Props> = ({
    show,
    onHide,
    cart,
    articles,
    onQuantityChange,
    onEinheitChange,
    onRemove,
    onSubmit
}) => {
    const [editField, setEditField] = useState<number | null>(null);
    const [lieferdatum, setLieferdatum] = useState('');
    const [showDateModal, setShowDateModal] = useState(false);

    const formatEinheit = (einheit?: string, menge?: number) => {
        if (!einheit || !menge) return '';
        const pluralMap: Record<string, string> = {
            stück: 'Stück',
            kiste: 'Kisten',
            karton: 'Kartons',
            kg: 'kg',
        };
        const singularMap: Record<string, string> = {
            stück: 'Stück',
            kiste: 'Kiste',
            karton: 'Karton',
            kg: 'kg',
        };
        const isPlural = menge > 1;
        return isPlural ? pluralMap[einheit] || einheit : singularMap[einheit] || einheit;
    };

    const berechneGesamtgewicht = (
        item: ArtikelPositionResource,
        artikel: ArtikelResource | undefined
    ): number => {
        if (!item.menge || !item.einheit || !artikel) return 0;
        switch (item.einheit) {
            case 'kg':
                return item.menge;
            case 'stück':
                return artikel.gewichtProStueck ? artikel.gewichtProStueck * item.menge : 0;
            case 'kiste':
                return artikel.gewichtProKiste ? artikel.gewichtProKiste * item.menge : 0;
            case 'karton':
                return artikel.gewichtProKarton ? artikel.gewichtProKarton * item.menge : 0;
            default:
                return 0;
        }
    };

    const berechneGesamtpreis = (
        item: ArtikelPositionResource,
        artikel: ArtikelResource | undefined
    ): number => {
        const gewicht = berechneGesamtgewicht(item, artikel);
        return gewicht * (item.einzelpreis ?? 0);
    };

    const gesamtpreis = cart.reduce((sum, item) => {
        const artikel = articles.find(a => a.id === item.artikel);
        return sum + berechneGesamtpreis(item, artikel);
      }, 0);

    const handleBestellungStart = () => {
        setShowDateModal(true);
    };

    const handleBestellungAbsenden = () => {
        if (!lieferdatum) {
            alert("Bitte ein Lieferdatum auswählen.");
            return;
        }
        setShowDateModal(false);
        onSubmit(lieferdatum);
    };

    return (
        <>
            <Offcanvas show={show} onHide={onHide} placement="end" style={{ width: '480px' }}>
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title>Warenkorb</Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body className="d-flex flex-column">
                    {cart.length === 0 ? (
                        <p>Ihr Warenkorb ist leer.</p>
                    ) : (
                        <div className="flex-grow-1 overflow-auto">
                            {cart.map((item, index) => {
                                const artikel = articles.find(a => a.id === item.artikel);
                                const gesamtgewicht = berechneGesamtgewicht(item, artikel);

                                return (
                                    <div key={index} className="border-bottom py-3">
                                        <Row>
                                            <Col xs={9}>
                                                <strong>{item.artikelName}</strong>
                                                <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                                    Einzelpreis: {item.einzelpreis?.toFixed(2)} €
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                                                    Gewicht: {gesamtgewicht.toFixed(2)} kg
                                                </div>

                                                {editField === index ? (
                                                    <div
                                                        className="d-flex gap-2 mt-1 align-items-center"
                                                        onBlur={(e) => {
                                                            if (!e.currentTarget.contains(e.relatedTarget)) {
                                                                setEditField(null);
                                                            }
                                                        }}
                                                        tabIndex={-1}
                                                    >
                                                        <Form.Control
                                                            autoFocus
                                                            type="number"
                                                            min={1}
                                                            value={item.menge}
                                                            style={{
                                                                width: '80px',
                                                                fontSize: '0.9rem',
                                                                lineHeight: '1.4',
                                                                padding: '0.25rem 0.5rem'
                                                            }}
                                                            onChange={(e) =>
                                                                onQuantityChange(index, parseInt(e.target.value))
                                                            }
                                                        />
                                                        <Form.Select
                                                            style={{
                                                                width: '100px',
                                                                fontSize: '0.9rem',
                                                                lineHeight: '1.4',
                                                                padding: '0.25rem 0.5rem'
                                                            }}
                                                            value={item.einheit}
                                                            onChange={(e) => {
                                                                const neueEinheit = e.target.value as ArtikelPositionResource['einheit'];
                                                                onEinheitChange(index, neueEinheit);
                                                            }}
                                                        >
                                                            <option value="kg">kg</option>
                                                            <option value="stück">Stück</option>
                                                            <option value="kiste">Kiste</option>
                                                            <option value="karton">Karton</option>
                                                        </Form.Select>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="mt-1"
                                                        style={{ fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
                                                        onClick={() => setEditField(index)}
                                                        title="Klicken zum Bearbeiten"
                                                    >
                                                        {item.menge} {formatEinheit(item.einheit, item.menge)}
                                                    </div>
                                                )}
                                            </Col>

                                            <Col xs={3} className="text-end d-flex flex-column align-items-end justify-content-between">
                                                <div className="d-flex align-items-center justify-content-end w-100 gap-2">
                                                    <div className="fw-bold text-nowrap" style={{ fontSize: '0.9rem' }}>
                                                        {berechneGesamtpreis(item, artikel).toFixed(2)} €
                                                    </div>
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={() => onRemove(index)}
                                                        title="Entfernen"
                                                        style={{ padding: '0.15rem 0.35rem', fontSize: '0.75rem', lineHeight: 1 }}
                                                    >
                                                        ✕
                                                    </Button>
                                                </div>
                                            </Col>
                                        </Row>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {cart.length > 0 && (
                        <div className="mt-4 border-top pt-3">
                            <h5 className="d-flex justify-content-between">
                                <span>Summe aller Artikel</span>
                                <span>{gesamtpreis.toFixed(2)} €</span>
                            </h5>

                            <div className="d-grid gap-2 mt-3">
                                <Button variant="primary" onClick={handleBestellungStart}>
                                    Bestellung aufgeben
                                </Button>
                                <Button variant="secondary" onClick={onHide}>
                                    Schließen
                                </Button>
                            </div>
                        </div>
                    )}
                </Offcanvas.Body>
            </Offcanvas>

            <Modal show={showDateModal} onHide={() => setShowDateModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Lieferdatum wählen</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group controlId="lieferdatum">
                        <Form.Label>Lieferdatum wählen</Form.Label>
                        <Form.Control
                            type="date"
                            value={lieferdatum}
                            onChange={(e) => setLieferdatum(e.target.value)}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDateModal(false)}>
                        Abbrechen
                    </Button>
                    <Button variant="primary" onClick={handleBestellungAbsenden}>
                        Bestellen
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default WarenkorbPanel;