import React from 'react';
import { ArtikelResource, ArtikelPositionResource } from '../Resources';
import { Card, Col, Form, Button, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import * as AiIcons from 'react-icons/ai';
import { FaShoppingCart } from 'react-icons/fa';
import { addKundenFavorit, removeKundenFavorit } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import fallbackImage from '../Cartzilla/assets/img/shop/grocery/10.png';

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
        <Col key={article.id} xxl={2} xl={3} lg={4} md={6} sm={12} className="swiper-slide">
            <div className="animate-underline">
                <Link className="hover-effect-opacity ratio ratio-1x1 d-block mb-3" to={`/artikel/${article.id}`}>
                    <img src={article.bildUrl || fallbackImage} className="hover-effect-target opacity-100" alt={article.name} />
                    <img src={article.bildUrl || fallbackImage} className="position-absolute top-0 start-0 hover-effect-target opacity-0 rounded-4" alt={`${article.name} Hover`} />
                </Link>
                <h3 className="mb-2">
                    <Link className="d-block fs-sm fw-medium text-truncate" to={`/artikel/${article.id}`}>
                        <span className="animate-target">{article.name}</span>
                    </Link>
                </h3>
                <div className="h6">{article.preis.toFixed(2)} €</div>
                <div className="d-flex gap-2">
                    {isInCart ? (
                        <div className="d-flex gap-2 w-100">
                            <Button variant="primary" className="rounded-pill px-3" onClick={() => {
                                if ((cartItem?.menge || 1) > 1) {
                                    const updated = cart.map(item =>
                                        item.artikel === article.id ? { ...item, menge: item.menge - 1 } : item
                                    );
                                    localStorage.setItem('warenkorb', JSON.stringify(updated));
                                    setCart(updated);
                                } else {
                                    const updated = cart.filter(item => item.artikel !== article.id);
                                    localStorage.setItem('warenkorb', JSON.stringify(updated));
                                    setCart(updated);
                                }
                            }}>
                                <i className="ci-minus" />
                            </Button>

                            <input
                                type="text"
                                value={cartItem?.menge || 1}
                                className="form-control form-control-sm text-center bg-primary text-white border-0 no-spinner"
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

                            <Button variant="primary" className="rounded-pill px-3" onClick={() => {
                                const updated = cart.map(item =>
                                    item.artikel === article.id ? { ...item, menge: item.menge + 1 } : item
                                );
                                localStorage.setItem('warenkorb', JSON.stringify(updated));
                                setCart(updated);
                            }}>
                                <i className="ci-plus" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Button variant="primary" className="w-100 rounded-pill px-3" onClick={() => {
                                const menge = mengen[article.id!] || 1;
                                const einheit = einheiten[article.id!] || 'kg';
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
                            }}>
                                In den Warenkorb
                            </Button>
                            <button type="button" className="btn btn-icon btn-secondary rounded-circle animate-pulse" onClick={toggleFavorit} aria-label="Favorit">
                                {favoriten.includes(article.id!) ? (
                                    <AiIcons.AiFillHeart className="fs-base animate-target" color="#dc3545" />
                                ) : (
                                    <AiIcons.AiOutlineHeart className="fs-base animate-target" color="#ccc" />
                                )}
                            </button>
                        </>
                    )}
                </div>
                {isInCart && (
                    <div className="d-flex gap-2 align-items-center mt-2">
                        <Form.Select
                            size="sm"
                            className="form-control form-control-sm text-center bg-primary text-white border-0 no-spinner"
                            value={einheiten[article.id!] || 'kg'}
                            onChange={(e) => {
                                setEinheiten({ ...einheiten, [article.id!]: e.target.value });
                            }}
                        >
                            <option value="kg">Kilogramm</option>
                            <option value="stück">Stück</option>
                            <option value="kiste">Kiste</option>
                            <option value="karton">Karton</option>
                        </Form.Select>
                        <button type="button" className="btn btn-icon btn-secondary rounded-circle animate-pulse" onClick={toggleFavorit} aria-label="Favorit">
                            {favoriten.includes(article.id!) ? (
                                <AiIcons.AiFillHeart className="fs-base animate-target" color="#dc3545" />
                            ) : (
                                <AiIcons.AiOutlineHeart className="fs-base animate-target" color="#ccc" />
                            )}
                        </button>
                    </div>
                )}
            </div>
        </Col>
    );
};

export default RenderCard;