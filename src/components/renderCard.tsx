import React from 'react';
import { ArtikelResource, ArtikelPositionResource } from '../Resources';
import { Card, Col, Form, Button, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import * as AiIcons from 'react-icons/ai';
import { FaShoppingCart } from 'react-icons/fa';
import { addKundenFavorit, removeKundenFavorit } from '../backend/api';
import { useAuth } from '../providers/Authcontext';

type Props = {
    article: ArtikelResource;
    favoriten: string[];
    setFavoriten: (ids: string[]) => void;
    cart: ArtikelPositionResource[];
    setCart: (cart: ArtikelPositionResource[]) => void;
    onAddToCart: (position: ArtikelPositionResource) => void;
    einheiten: { [id: string]: string };
    setEinheiten: (data: { [id: string]: string }) => void;
    mengen: { [id: string]: number };
    setMengen: (data: { [id: string]: number }) => void;
    zerlegung: { [id: string]: boolean };
    setZerlegung: (data: { [id: string]: boolean }) => void;
    vakuum: { [id: string]: boolean };
    setVakuum: (data: { [id: string]: boolean }) => void;
    bemerkungen: { [id: string]: string };
    setBemerkungen: (data: { [id: string]: string }) => void;
};

const RenderCard: React.FC<Props> = ({
    article, favoriten, setFavoriten, cart, setCart, onAddToCart,
    einheiten, setEinheiten, mengen, setMengen,
    zerlegung, setZerlegung, vakuum, setVakuum,
    bemerkungen, setBemerkungen
}) => {
    const isInCart = cart.some(item => item.artikel === article.id);
    const cartItem = cart.find(item => item.artikel === article.id);

    const { user } = useAuth();

    const toggleFavorit = async () => {
        if (!article.id || !user) return;

        const isFavorit = favoriten.includes(article.id);
        try {
            if (isFavorit) {
                await removeKundenFavorit(user.id, article.id);
                setFavoriten(favoriten.filter(f => f !== article.id));
            } else {
                await addKundenFavorit(user.id, article.id);
                setFavoriten([...favoriten, article.id]);
            }
        } catch (e) {
            console.error('Fehler beim Favorit-Toggle', e);
        }
    };



    return (
        <Col key={article.id} xxl={2} xl={3} lg={4} md={6} sm={12} className="mb-4 d-flex justify-content-center">
            <Card className="h-100 position-relative border border-secondary-subtle rounded-3 shadow-sm" style={{ maxWidth: '300px', width: '100%' }}>



                <Card.Body className="d-flex flex-column justify-content-between p-3" style={{ fontSize: '0.85rem' }}>
                    <div>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            {/* Linksbündig: Herz & Artikelname */}
                            <div className="d-flex align-items-center gap-2">
                                <span onClick={toggleFavorit} style={{ cursor: 'pointer' }}>
                                    {favoriten.includes(article.id!) ? (
                                        <AiIcons.AiFillHeart size={20} color="#dc3545" className="favorit-icon" />
                                    ) : (
                                        <AiIcons.AiOutlineHeart size={20} color="#ccc" className="favorit-icon" />
                                    )}
                                </span>
                                <Card.Title as="h6" className="mb-0 text-primary fs-6">
                                    <Link to={`/artikel/${article.id}`} className="text-decoration-none">{article.name}</Link>
                                </Card.Title>
                            </div>

                            {/* Rechtsbündig: Badge */}
                            {isInCart && (
                                <OverlayTrigger
                                    placement="top"
                                    overlay={<Tooltip>Im Warenkorb</Tooltip>}
                                >
                                    <span>
                                        <FaShoppingCart size={16} className="text-success" />
                                    </span>
                                </OverlayTrigger>
                            )}
                        </div>

                        <div className="text-muted mb-2">
                            Preis: <strong>{article.preis.toFixed(2)} €</strong>
                        </div>

                        {/* === Wenn im Warenkorb === */}
                        {isInCart ? (
                            <>
                                <div className="d-flex gap-2 align-items-center mb-2">
                                    <Form.Control
                                        type="number"
                                        size="sm"
                                        min={1}
                                        style={{ width: '70px' }}
                                        value={cartItem?.menge || 1}
                                        onChange={(e) => {
                                            const neueMenge = parseInt(e.target.value);
                                            if (!neueMenge || neueMenge < 1) return;
                                            const updated = cart.map(item =>
                                                item.artikel === article.id ? { ...item, menge: neueMenge } : item
                                            );
                                            localStorage.setItem('warenkorb', JSON.stringify(updated));
                                            setCart(updated);
                                        }}
                                    />

                                    <Form.Select
                                        size="sm"
                                        style={{ width: '90px' }}
                                        value={cartItem?.einheit || 'kg'}
                                        onChange={(e) => {
                                            const neueEinheit = e.target.value as ArtikelPositionResource['einheit'];
                                            const updated = cart.map(item =>
                                                item.artikel === article.id ? { ...item, einheit: neueEinheit } : item
                                            );
                                            localStorage.setItem('warenkorb', JSON.stringify(updated));
                                            setCart(updated);
                                        }}
                                    >
                                        <option value="kg">kg</option>
                                        <option value="stück">Stück</option>
                                        <option value="kiste">Kiste</option>
                                        <option value="karton">Karton</option>
                                    </Form.Select>

                                    <Button
                                        variant="outline-danger"
                                        size="sm"
                                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                        onClick={() => {
                                            const updated = cart.filter(item => item.artikel !== article.id);
                                            localStorage.setItem('warenkorb', JSON.stringify(updated));
                                            setCart(updated);
                                        }}
                                    >
                                        X
                                    </Button>
                                </div>

                                <div className="d-flex gap-2 mb-2">
                                    <Form.Check
                                        type="checkbox"
                                        label="Zerlegung"
                                        checked={cartItem?.zerlegung || false}
                                        onChange={(e) => {
                                            const updated = cart.map(item =>
                                                item.artikel === article.id ? { ...item, zerlegung: e.target.checked } : item
                                            );
                                            localStorage.setItem('warenkorb', JSON.stringify(updated));
                                            setCart(updated);
                                        }}
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Vakuum"
                                        checked={cartItem?.vakuum || false}
                                        onChange={(e) => {
                                            const updated = cart.map(item =>
                                                item.artikel === article.id ? { ...item, vakuum: e.target.checked } : item
                                            );
                                            localStorage.setItem('warenkorb', JSON.stringify(updated));
                                            setCart(updated);
                                        }}
                                    />
                                </div>

                                <Form.Control
                                    placeholder="Bemerkung"
                                    size="sm"
                                    value={cartItem?.bemerkung || ''}
                                    onChange={(e) => {
                                        const updated = cart.map(item =>
                                            item.artikel === article.id ? { ...item, bemerkung: e.target.value } : item
                                        );
                                        localStorage.setItem('warenkorb', JSON.stringify(updated));
                                        setCart(updated);
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <div className="d-flex gap-2 mb-2">
                                    <Form.Control
                                        type="number"
                                        size="sm"
                                        min={1}
                                        placeholder="0"
                                        style={{ width: '75px' }}
                                        value={mengen[article.id!] || ''}
                                        onChange={(e) => setMengen({ ...mengen, [article.id!]: parseInt(e.target.value) })}
                                    />
                                    <Form.Select
                                        size="sm"
                                        style={{ width: '90px' }}
                                        value={einheiten[article.id!] || 'kg'}
                                        onChange={(e) => setEinheiten({ ...einheiten, [article.id!]: e.target.value })}
                                    >
                                        <option value="kg">kg</option>
                                        <option value="stück">Stück</option>
                                        <option value="kiste">Kiste</option>
                                        <option value="karton">Karton</option>
                                    </Form.Select>
                                </div>

                                <div className="d-flex gap-2 mb-2">
                                    <Form.Check
                                        type="checkbox"
                                        label="Zerlegung"
                                        checked={zerlegung[article.id!] || false}
                                        onChange={(e) => setZerlegung({ ...zerlegung, [article.id!]: e.target.checked })}
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Vakuum"
                                        checked={vakuum[article.id!] || false}
                                        onChange={(e) => setVakuum({ ...vakuum, [article.id!]: e.target.checked })}
                                    />
                                </div>

                                <Form.Control
                                    placeholder="Bemerkung"
                                    className="mb-2"
                                    size="sm"
                                    value={bemerkungen[article.id!] || ''}
                                    onChange={(e) => setBemerkungen({ ...bemerkungen, [article.id!]: e.target.value })}
                                />

                                <span className="d-grid">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            const menge = mengen[article.id!];
                                            const einheit = einheiten[article.id!] || 'kg';
                                            if (!menge) return;

                                            onAddToCart({
                                                artikel: article.id!,
                                                artikelName: article.name,
                                                menge,
                                                einheit: einheit as 'kg' | 'stück' | 'kiste' | 'karton',
                                                einzelpreis: article.preis,
                                                zerlegung: zerlegung[article.id!] || false,
                                                vakuum: vakuum[article.id!] || false,
                                                bemerkung: bemerkungen[article.id!] || '',
                                            });
                                        }}
                                        disabled={!mengen[article.id!]}
                                    >
                                        In den Warenkorb
                                    </Button>
                                </span>
                            </>
                        )}
                    </div>
                </Card.Body>
            </Card>
        </Col>
    );
};

export default RenderCard;