// Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { Carousel, Modal, Button, Form, Card, Row, Col, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { ArtikelResource, AuftragResource, ArtikelPositionResource } from '../Resources';
import { api } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import banner1 from "../assets/Banner1.jpg";
import banner2 from "../assets/Banner2.jpg";
import banner3 from "../assets/Banner3.jpg";

// Hilfsfunktion: Wandelt Kommas in Punkte um und parsed den Wert als Zahl
const parseNumberInput = (value: string): number =>
  parseFloat(value.replace(',', '.'));

const Dashboard: React.FC = () => {
  const [articles, setArticles] = useState<ArtikelResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  // Warenkorb: Hier werden Artikel als Positionen gespeichert, die der Nutzer bearbeiten kann
  const [cart, setCart] = useState<ArtikelPositionResource[]>([]);
  const [showCartModal, setShowCartModal] = useState<boolean>(false);
  
  // Such- und Sortierzustände
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('nameAsc');
  
  const navigate = useNavigate();
  const { user } = useAuth();

  // Artikel laden
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const data = await api.getAllArtikel();
        setArticles(data);
      } catch (err: any) {
        setError(err.message || 'Fehler beim Laden der Artikel');
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  // Artikel zum Warenkorb hinzufügen (Positionen können jederzeit direkt im Warenkorb bearbeitet werden)
  const addToCart = (article: ArtikelResource) => {
    const newPosition: ArtikelPositionResource = {
      artikel: article.id || '',
      artikelName: article.name,
      menge: 1,
      einheit: 'stück',
      einzelpreis: article.preis,
      gesamtgewicht: article.gewichtProStueck || 0,
      gesamtpreis: article.preis,
    };
    setCart(prev => [...prev, newPosition]);
  };

  // Menge im Warenkorb bearbeiten
  const updateCartQuantity = (index: number, quantity: number) => {
    const newCart = [...cart];
    newCart[index].menge = quantity;
    newCart[index].gesamtpreis = newCart[index].einzelpreis! * quantity;
    setCart(newCart);
  };

  // Position aus dem Warenkorb entfernen
  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Bestellvorgang: Auftrag wird erstellt, danach werden alle Artikelpositionen angelegt und dem Auftrag zugeordnet
  const placeOrder = async () => {
    setError('');
    try {
      // Schritt 1: Auftrag erstellen (ohne Positionen)
      const orderData: Omit<AuftragResource, 'id' | 'createdAt' | 'updatedAt'> = {
        kunde: user?.role === 'u' ? user.id : 'dummyCustomerId', // Bei Verkäufern/Admins evtl. Shop-as nutzen
        kundeName: "",
        artikelPosition: [], // Initial leer
        status: 'offen',
        lieferdatum: new Date().toISOString(),
        bemerkungen: '',
        preis: cart.reduce((sum, item) => sum + item.gesamtpreis!, 0),
        gewicht: cart.reduce((sum, item) => sum + (item.gesamtgewicht! * item.menge!), 0),
      };
      const order = await api.createAuftrag(orderData);

      // Schritt 2: Für jede Position im Warenkorb wird eine Artikelposition erstellt
      const positionIds: string[] = [];
      for (const item of cart) {
        const pos = await api.createArtikelPosition(item);
        positionIds.push(pos.id!);
      }

      // Schritt 3: Auftrag aktualisieren, um die erstellten Artikelpositionen zu übernehmen
      await api.updateAuftrag(order.id!, { artikelPosition: positionIds });

      // Warenkorb leeren und zur Detailseite des Auftrags navigieren
      setCart([]);
      navigate(`/auftraege/${order.id}`);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Aufgeben der Bestellung');
    }
  };

  // Filter- und Sortierlogik
  const filteredArticles = articles
    .filter(a => {
      const term = searchTerm.toLowerCase();
      return (
        a.name.toLowerCase().includes(term) ||
        a.artikelNummer.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (sortOption === 'nameAsc') return a.name.localeCompare(b.name);
      if (sortOption === 'nameDesc') return b.name.localeCompare(a.name);
      if (sortOption === 'preisAsc') return a.preis - b.preis;
      if (sortOption === 'preisDesc') return b.preis - a.preis;
      return 0;
    });

  if (loading)
    return (
      <div className="container text-center my-4">
        <p>Lädt...</p>
      </div>
    );
  if (error)
    return (
      <div className="container my-4">
        <div className="alert alert-danger">{error}</div>
      </div>
    );

  return (
    <div className="container my-4">
      {/* Banner Carousel */}
      <Carousel className="mb-4">
        <Carousel.Item>
          <img
            className="d-block w-100"
            src={banner1}
            alt="Banner 1"
            style={{ maxHeight: '500px', objectFit: 'cover' }}
          />
          <Carousel.Caption>
            <h3>Willkommen im Web-Shop</h3>
            <p>Entdecken Sie unsere exklusiven Produkte!</p>
          </Carousel.Caption>
        </Carousel.Item>
        <Carousel.Item>
          <img
            className="d-block w-100"
            src={banner2}
            alt="Banner 2"
            style={{ maxHeight: '500px', objectFit: 'cover' }}
          />
          <Carousel.Caption>
            <h3>Top Angebote</h3>
            <p>Sparen Sie jetzt mit unseren Sonderaktionen.</p>
          </Carousel.Caption>
        </Carousel.Item>
        <Carousel.Item>
          <img
            className="d-block w-100"
            src={banner3}
            alt="Banner 3"
            style={{ maxHeight: '500px', objectFit: 'cover' }}
          />
          <Carousel.Caption>
            <h3>Neu eingetroffen</h3>
            <p>Sehen Sie sich unsere neuesten Produkte an.</p>
          </Carousel.Caption>
        </Carousel.Item>
      </Carousel>

      {/* Such- und Sortierleiste */}
      <Row className="mb-4 align-items-center">
        <Col md={6}>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Artikelname oder Nummer suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
          </InputGroup>
        </Col>
        <Col md={3}>
          <Form.Select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="nameAsc">Name: Aufsteigend</option>
            <option value="nameDesc">Name: Absteigend</option>
            <option value="preisAsc">Preis: Aufsteigend</option>
            <option value="preisDesc">Preis: Absteigend</option>
          </Form.Select>
        </Col>
        <Col md={3} className="text-end">
          <Button variant="success" onClick={() => setShowCartModal(true)}>
            Warenkorb ({cart.length})
          </Button>
        </Col>
      </Row>

      {/* Artikelübersicht */}
      <h2 className="mb-4">Produkte</h2>
      <Row>
        {filteredArticles.map(article => (
          <Col key={article.id} md={4} className="mb-4">
            <Card className="h-100 shadow-sm">
              <Card.Img
                variant="top"
                src={`https://via.placeholder.com/400x400?text=${encodeURIComponent(article.name)}`}
                alt={article.name}
                style={{ maxHeight: '400px', objectFit: 'cover' }}
              />
              <Card.Body className="d-flex flex-column">
                <Card.Title>{article.name}</Card.Title>
                <Card.Text>
                  Artikelnummer: {article.artikelNummer} <br />
                  Preis: {article.preis.toFixed(2)} €
                </Card.Text>
                <Button
                  variant="primary"
                  className="mt-auto"
                  onClick={() => addToCart(article)}
                >
                  In den Warenkorb
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Warenkorb Modal */}
      <Modal show={showCartModal} onHide={() => setShowCartModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Warenkorb</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cart.length === 0 ? (
            <p>Ihr Warenkorb ist leer.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th>Menge</th>
                    <th>Einzelpreis</th>
                    <th>Gesamtpreis</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => (
                    <tr key={index}>
                      <td>{item.artikel}</td>
                      <td>
                        <Form.Control
                          type="number"
                          min="1"
                          value={item.menge}
                          onChange={(e) =>
                            updateCartQuantity(index, parseInt(e.target.value))
                          }
                        />
                      </td>
                      <td>{item.einzelpreis!.toFixed(2)} €</td>
                      <td>{(item.einzelpreis! * item.menge!).toFixed(2)} €</td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeFromCart(index)}
                        >
                          Löschen
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCartModal(false)}>
            Schließen
          </Button>
          {cart.length > 0 && (
            <Button variant="primary" onClick={placeOrder}>
              Bestellung aufgeben
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Dashboard;