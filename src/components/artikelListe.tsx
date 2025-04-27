import React, { useEffect, useMemo, useState } from 'react';
import { Row, Col, Form, InputGroup } from 'react-bootstrap';
import { ArtikelResource, ArtikelPositionResource } from '../Resources';
import RenderCard from './renderCard';
import { getAuftragLetzte, getAuftragLetzteArtikel } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import { getKundenFavoriten } from '../backend/api';

type Props = {
    articles: ArtikelResource[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    sortOption: string;
    setSortOption: (value: string) => void;
    onAddToCart: (position: ArtikelPositionResource) => void;
    cartLength: number;
    onCartClick: () => void;
    cart: ArtikelPositionResource[];
    setCart: (cart: ArtikelPositionResource[]) => void;
};

const ArtikelListe: React.FC<Props> = ({
    articles, searchTerm, setSearchTerm,
    sortOption, setSortOption, onAddToCart, cart, setCart
}) => {
    const [einheiten, setEinheiten] = useState<{ [id: string]: string }>({});
    const [mengen, setMengen] = useState<{ [id: string]: number }>({});
    const [zerlegung, setZerlegung] = useState<{ [id: string]: boolean }>({});
    const [vakuum, setVakuum] = useState<{ [id: string]: boolean }>({});
    const [bemerkungen, setBemerkungen] = useState<{ [id: string]: string }>({});
    const [letzteArtikel, setLetzteArtikel] = useState<string[]>([]);
    const [auftragLadeStatus, setAuftragLadeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [letzterAuftrag, setLetzterAuftrag] = useState<ArtikelPositionResource[]>([]);
    const [favoriten, setFavoriten] = useState<string[]>(() => {
        const stored = localStorage.getItem('favoriten');
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        const fetchLetzterAuftrag = async () => {
            try {
                const { artikelPositionen } = await getAuftragLetzte();
                setLetzterAuftrag(artikelPositionen);
                setAuftragLadeStatus('ready');
            } catch (e) {
                setAuftragLadeStatus('error');
            }
        };
        fetchLetzterAuftrag();
    }, []);

    const { user } = useAuth();

    useEffect(() => {
        const fetchFavoriten = async () => {
            try {
                if (user?.role === 'u' && favoriten.length === 0) {
                    const favs = await getKundenFavoriten(user.id);
                    setFavoriten(favs);
                }
            } catch (e) {
                console.error('Fehler beim Laden der Favoriten', e);
            }
        };

        fetchFavoriten();
    }, [user]);

    useEffect(() => {
        localStorage.setItem('favoriten', JSON.stringify(favoriten));
    }, [favoriten]);

    useEffect(() => {
        if (!user) {
          localStorage.removeItem('favoriten');
        }
      }, [user]);

    useEffect(() => {
        const fetchletzteArtikel = async () => {
            try {
                const ids = await getAuftragLetzteArtikel(); // string[]
                setLetzteArtikel(ids);
                setAuftragLadeStatus('ready');
            } catch (e) {
                setAuftragLadeStatus('error');
            }
        };
        fetchletzteArtikel();
    }, []);

    const kategorien = useMemo(() => {
        const set = new Set<string>();
        articles.forEach(article => {
            if (
                article.kategorie &&
                article.name.toLowerCase().includes(searchTerm.toLowerCase())
            ) {
                set.add(article.kategorie);
            }
        });
        return Array.from(set).sort();
    }, [articles, searchTerm]);

    const groupedArticles = useMemo(() => {
        const grouped: { [key: string]: ArtikelResource[] } = {};
        articles
            .filter(article =>
                article.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .forEach(article => {
                const kat = article.kategorie || 'Andere';
                if (!grouped[kat]) grouped[kat] = [];
                grouped[kat].push(article);
            });
        return grouped;
    }, [articles, searchTerm]);

    return (
        <div className="d-flex">
            {/* Sidebar */}
            <div className="px-3 py-4 border-end" style={{ minWidth: '220px', position: 'sticky', top: '0', height: '100vh' }}>
                <h5 className="mb-3">Kategorien</h5>
                <ul className="nav flex-column small">
                    <li className="nav-item mb-2">
                        <a className="nav-link p-0" href="#favoriten">⭐ Favoriten</a>
                    </li>
                    <li className="nav-item mb-2">
                        <a className="nav-link p-0" href="#letzter-auftrag">📦 Letzter Auftrag</a>
                    </li>
                    {kategorien.map(kat => (
                        <li key={kat} className="nav-item mb-2">
                            <a className="nav-link p-0" href={`#${kat.replace(/\s+/g, '-')}`}>📁 {kat}</a>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Hauptbereich */}
            <div className="flex-grow-1 px-4">
                {/* Suche + Sortierung */}
                <Row className="my-4 align-items-end g-2">
                    <Col lg={5} md={6}>
                        <InputGroup>
                            <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
                            <Form.Control
                                type="text"
                                placeholder="Artikelname eingeben..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </InputGroup>
                    </Col>
                    <Col lg={4} md={4}>
                        <Form.Select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                        >
                            <option value="nameAsc">Name (A–Z)</option>
                            <option value="nameDesc">Name (Z–A)</option>
                            <option value="preisAsc">Preis aufsteigend</option>
                            <option value="preisDesc">Preis absteigend</option>
                        </Form.Select>
                    </Col>
                </Row>

                {/* Favoriten */}
                {favoriten.length > 0 && (
                    <>
                        <h5 id="favoriten" className="mb-3">⭐ Favoriten</h5>
                        <Row className="mb-5">
                            {articles.filter(a => favoriten.includes(a.id!)).map(article => (
                                <RenderCard
                                    key={article.id}
                                    article={article}
                                    favoriten={favoriten}
                                    setFavoriten={setFavoriten}
                                    cart={cart}
                                    setCart={setCart}
                                    onAddToCart={onAddToCart}
                                    einheiten={einheiten}
                                    setEinheiten={setEinheiten}
                                    mengen={mengen}
                                    setMengen={setMengen}
                                    zerlegung={zerlegung}
                                    setZerlegung={setZerlegung}
                                    vakuum={vakuum}
                                    setVakuum={setVakuum}
                                    bemerkungen={bemerkungen}
                                    setBemerkungen={setBemerkungen}
                                />
                            ))}
                        </Row>
                    </>
                )}

                {/* Letzter Auftrag */}
                <div className="mb-5" id="letzter-auftrag">
                    <h5 className="mb-3">📦 Letzter Auftrag</h5>

                    {auftragLadeStatus === 'loading' && (
                        <div className="text-muted">⏳ Wird geladen...</div>
                    )}

                    {auftragLadeStatus === 'error' && (
                        <div className="d-flex justify-content-between align-items-center bg-danger text-white rounded px-3 py-2 mb-3">
                            <span className="m-0">Fehler beim Laden des letzten Auftrags.</span>
                            <button
                                className="btn btn-sm btn-dark ms-3"
                                onClick={() => window.location.reload()}
                            >
                                Erneut versuchen
                            </button>
                        </div>
                    )}

                    {auftragLadeStatus === 'ready' && letzteArtikel.length === 0 && (
                        <div className="text-muted">Kein letzter Auftrag gefunden.</div>
                    )}

                    {auftragLadeStatus === 'ready' && letzteArtikel.length > 0 && (
                        <>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <span className="text-muted">{letzteArtikel.length} Artikel im letzten Auftrag</span>
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => {
                                        const neuePositionen: ArtikelPositionResource[] = letzterAuftrag.map(pos => ({
                                            artikel: pos.artikel!,
                                            artikelName: pos.artikelName || '',
                                            menge: pos.menge || 0,
                                            einheit: pos.einheit || 'kg',
                                            einzelpreis: pos.einzelpreis || 0,
                                            zerlegung: pos.zerlegung || false,
                                            vakuum: pos.vakuum || false,
                                            bemerkung: pos.bemerkung || '',
                                        }));

                                        setCart([...cart, ...neuePositionen]);
                                    }}
                                >
                                    Letzten Auftrag übernehmen
                                </button>
                            </div>

                            <Row>
                                {letzteArtikel.map((artikelId, index) => {
                                    const article = articles.find(a => a.id === artikelId);
                                    if (!article) return null;
                                    return (
                                        <RenderCard
                                            key={`${artikelId}-${index}`}
                                            article={article}
                                            favoriten={favoriten}
                                            setFavoriten={setFavoriten}
                                            cart={cart}
                                            setCart={setCart}
                                            onAddToCart={onAddToCart}
                                            einheiten={einheiten}
                                            setEinheiten={setEinheiten}
                                            mengen={mengen}
                                            setMengen={setMengen}
                                            zerlegung={zerlegung}
                                            setZerlegung={setZerlegung}
                                            vakuum={vakuum}
                                            setVakuum={setVakuum}
                                            bemerkungen={bemerkungen}
                                            setBemerkungen={setBemerkungen}
                                        />
                                    );
                                })}
                            </Row>
                        </>
                    )}
                </div>

                {/* Artikel nach Kategorie */}
                {kategorien.map(kat => (
                    <div key={kat} className="mb-5" id={kat.replace(/\s+/g, '-')}>
                        <h5 className="mb-3">{kat}</h5>
                        <Row>
                            {groupedArticles[kat].map(article => (
                                <RenderCard
                                    key={article.id}
                                    article={article}
                                    favoriten={favoriten}
                                    setFavoriten={setFavoriten}
                                    cart={cart}
                                    setCart={setCart}
                                    onAddToCart={onAddToCart}
                                    einheiten={einheiten}
                                    setEinheiten={setEinheiten}
                                    mengen={mengen}
                                    setMengen={setMengen}
                                    zerlegung={zerlegung}
                                    setZerlegung={setZerlegung}
                                    vakuum={vakuum}
                                    setVakuum={setVakuum}
                                    bemerkungen={bemerkungen}
                                    setBemerkungen={setBemerkungen}
                                />
                            ))}
                        </Row>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ArtikelListe;