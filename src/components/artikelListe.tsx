// ArtikelListe.tsx
import React, { useState } from 'react';
import { Row, Col, Card, Button, Form, InputGroup, Carousel } from 'react-bootstrap';
import { ArtikelResource, ArtikelPositionResource } from '../Resources';
import { Link } from 'react-router-dom';
import banner1 from "../assets/Banner1.jpg";
import banner2 from "../assets/Banner2.jpg";
import banner3 from "../assets/Banner3.jpg";

type Props = {
    articles: ArtikelResource[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    sortOption: string;
    setSortOption: (value: string) => void;
    onAddToCart: (position: ArtikelPositionResource) => void;
    cartLength: number;
    onCartClick: () => void;
};

const ArtikelListe: React.FC<Props> = ({
    articles, searchTerm, setSearchTerm,
    sortOption, setSortOption, onAddToCart,
    cartLength, onCartClick
}) => {
    const [einheiten, setEinheiten] = useState<{ [id: string]: string }>({});
    const [mengen, setMengen] = useState<{ [id: string]: number }>({});

    return (
        <>
            <Carousel className="mb-4">
                {[banner1, banner2, banner3].map((b, i) => (
                    <Carousel.Item key={i}>
                        <img className="d-block w-100" src={b} alt={`Banner ${i + 1}`} style={{ maxHeight: '500px', objectFit: 'cover' }} />
                    </Carousel.Item>
                ))}
            </Carousel>

            <Row className="mb-4 align-items-center">
                <Col md={6}>
                    <InputGroup>
                        <Form.Control
                            type="text"
                            placeholder="Artikelname oder Nummer suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
                    </InputGroup>
                </Col>
                <Col md={3}>
                    <Form.Select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                        <option value="nameAsc">Name: Aufsteigend</option>
                        <option value="nameDesc">Name: Absteigend</option>
                        <option value="preisAsc">Preis: Aufsteigend</option>
                        <option value="preisDesc">Preis: Absteigend</option>
                    </Form.Select>
                </Col>
                <Col md={3} className="text-end">
                    <Button variant="success" onClick={onCartClick}>
                        Warenkorb ({cartLength})
                    </Button>
                </Col>
            </Row>

            <Row>
                {articles.map(article => (
                    <Col key={article.id} md={4} className="mb-4">
                        <Card className="h-100 shadow-sm">
                            <Card.Body className="d-flex flex-column">
                                <Card.Title>
                                    <Link to={`/artikel/${article.id}`} className="text-decoration-none">
                                        {article.name}
                                    </Link>
                                </Card.Title>
                                <Card.Text>
                                    Artikelnummer: {article.artikelNummer} <br />
                                    Preis: {article.preis.toFixed(2)} €
                                </Card.Text>

                                <Form.Group className="mt-2">
                                    <Form.Label>Einheit wählen:</Form.Label>
                                    <Form.Select
                                        size="sm"
                                        value={einheiten[article.id!] || ''}
                                        onChange={(e) =>
                                            setEinheiten({ ...einheiten, [article.id!]: e.target.value })
                                        }
                                    >
                                        <option value="">Bitte wählen</option>
                                        <option value="kg">Kilogramm</option>
                                        <option value="stück">Stück</option>
                                        <option value="kiste">Kiste</option>
                                        <option value="karton">Karton</option>
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mt-2">
                                    <Form.Label>Menge:</Form.Label>
                                    <Form.Control
                                        type="number"
                                        size="sm"
                                        min={1}
                                        value={mengen[article.id!] || ''}
                                        onChange={(e) =>
                                            setMengen({ ...mengen, [article.id!]: parseInt(e.target.value) })
                                        }
                                    />
                                </Form.Group>

                                <Button
                                    variant="primary"
                                    className="mt-3"
                                    onClick={() => {
                                        const einheit = einheiten[article.id!];
                                        const menge = mengen[article.id!];
                                        if (!einheit || !menge) {
                                            alert('Bitte Einheit und Menge wählen.');
                                            return;
                                        }
                                        onAddToCart({
                                            artikel: article.id!,
                                            artikelName: article.name,
                                            menge,
                                            einheit: einheit as "kg" | "stück" | "kiste" | "karton",
                                            einzelpreis: article.preis,
                                        });
                                    }}
                                >
                                    In den Warenkorb
                                </Button>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </>
    );
};

export default ArtikelListe;