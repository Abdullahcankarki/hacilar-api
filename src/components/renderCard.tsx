import React, { useEffect, useState } from 'react';
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

const unitFromModus = (modus?: string) =>
    modus === 'STÜCK' ? 'stück'
        : modus === 'KARTON' ? 'karton'
            : 'kg'; // fallback

const RenderCard: React.FC<Props> = ({
    article, favoriten, setFavoriten, cart, setCart, onAddToCart,
    einheiten, setEinheiten, mengen, setMengen,
    zerlegung, setZerlegung, vakuum, setVakuum,
    bemerkungen, setBemerkungen
}) => {
    if (article.ausverkauft) {
        // z.B. Ein Badge anzeigen oder Stil anpassen, falls gewünscht
    }

    const isInCart = cart.some(item => item.artikel === article.id);
    const cartItem = cart.find(item => item.artikel === article.id);

    const { user } = useAuth();
    const [lokaleMenge, setLokaleMenge] = useState<{ [artikelId: string]: number }>({});
    const [lokaleEinheit, setLokaleEinheit] = useState<{ [artikelId: string]: string }>({});

    useEffect(() => {
        if (!article.id) return;
        const desired = unitFromModus(article.erfassungsModus);
        setLokaleEinheit(prev => {
            if (prev[article.id] === desired) return prev; // kein unnötiges Update
            return { ...prev, [article.id]: desired };
        });
    }, [article.id, article.erfassungsModus]);

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
        <div className="col">
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
                <div className='h6'>{article.preis.toFixed(2)} €</div>
                {article.ausverkauft ? (
                    <Badge bg="danger" className="mb-2">Ausverkauft</Badge>
                ) : (
                    <div className="d-flex flex-column gap-2">
                        <div className="d-flex gap-2 w-100">
                            <Button variant="secondary" className="rounded-pill px-3" onClick={() => {
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
                                value={
                                    isInCart
                                        ? cartItem?.menge?.toString() ?? ''
                                        : lokaleMenge[article.id!]?.toString() ?? ''
                                }
                                className="form-control form-control-sm text-center border-1 no-spinner"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const num = parseInt(val);
                                    const neueMenge = val === '' ? 0 : (isNaN(num) ? 1 : num);

                                    if (isInCart) {
                                        const updatedCart = cart.map(item =>
                                            item.artikel === article.id ? { ...item, menge: neueMenge } : item
                                        );
                                        setCart(updatedCart);
                                        localStorage.setItem('warenkorb', JSON.stringify(updatedCart));
                                    } else {
                                        setLokaleMenge(prev => ({
                                            ...prev,
                                            [article.id!]: neueMenge
                                        }));
                                    }
                                }}
                            />

                            <Button variant="secondary" className="rounded-pill px-3" onClick={() => {
                                const updated = cart.map(item =>
                                    item.artikel === article.id ? { ...item, menge: item.menge + 1 } : item
                                );
                                localStorage.setItem('warenkorb', JSON.stringify(updated));
                                setCart(updated);
                            }}>
                                <i className="ci-plus" />
                            </Button>
                        </div>
                        <Form.Select
                            size="sm"
                            className="form-control form-control-sm text-center border-0 no-spinner"
                            style={{ backgroundColor: '#f0f2f5' }}
                            value={
                                isInCart
                                    ? (cartItem?.einheit ?? '')
                                    : (lokaleEinheit[article.id!] ?? unitFromModus(article.erfassungsModus))
                            }
                            onChange={(e) => {
                                const neueEinheit = e.target.value as 'kg' | 'stück' | 'kiste' | 'karton';
                                if (isInCart) {
                                    const updatedCart = cart.map(item =>
                                        item.artikel === article.id ? { ...item, einheit: neueEinheit } : item
                                    );
                                    setCart(updatedCart);
                                    localStorage.setItem('warenkorb', JSON.stringify(updatedCart));
                                } else {
                                    setLokaleEinheit(prev => ({ ...prev, [article.id!]: neueEinheit }));
                                }
                            }}
                        >
                            <option value="kg">Kg</option>
                            <option value="stück">St</option>
                            <option value="kiste">Kiste</option>
                            <option value="karton">Ktn</option>
                        </Form.Select>
                        <div className="d-flex justify-content-between align-items-center">
                            {isInCart ? (
                                <div className="text-success d-flex align-items-center gap-2">
                                    <FaShoppingCart />
                                    <span>Im Warenkorb</span>
                                </div>
                            ) : (
                                <Button variant="primary" className="rounded-pill px-3" onClick={() => {
                                    const menge = lokaleMenge[article.id!] || 0;
                                    if (menge < 1) return;
                                    const einheit = lokaleEinheit[article.id!] || 'kg';
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
                            )}
                            <button type="button" className="btn btn-icon btn-secondary rounded-circle animate-pulse" onClick={toggleFavorit} aria-label="Favorit">
                                {favoriten.includes(article.id!) ? (
                                    <AiIcons.AiFillHeart className="fs-base animate-target" color="#dc3545" />
                                ) : (
                                    <AiIcons.AiOutlineHeart className="fs-base animate-target" color="#ccc" />
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RenderCard;