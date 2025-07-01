import React, { useEffect, useMemo, useState } from 'react';
import { Row, Col, Form, InputGroup } from 'react-bootstrap';
import { ArtikelResource, ArtikelPositionResource } from '../Resources';
import RenderCard from './renderCard';
import { getAuftragLetzte, getAuftragLetzteArtikel } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import { getKundenFavoriten } from '../backend/api';
import { Link } from 'react-router-dom';

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
    const [favoriten, setFavoriten] = useState<string[]>([]);

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
                if (user?.role && user.role.includes('kunde')) {
                    const favs = await getKundenFavoriten(user.id); // explizit user.id
                    setFavoriten(favs);
                    localStorage.setItem('favoriten', JSON.stringify(favs));
                } else if (user?.role && user.role.includes('admin')) {
                    const favs = await getKundenFavoriten(); // nutzt localStorage ausgewaehlterKunde
                    setFavoriten(favs);
                }
            } catch (e) {
                console.error('Fehler beim Laden der Favoriten', e);
            }
        };

        fetchFavoriten();
    }, [user]);


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
        <>
            <h1 className="h3 container pb-2 pb-md-3 pb-lg-4">Shop catalog</h1>


            <section className="container pb-5 mb-2 mb-sm-3 mb-lg-4 mb-xl-5">
                <div className="row">
                    {/* Sidebar */}
                    <aside className="col-lg-3">
                        <div className="offcanvas-lg offcanvas-start pe-lg-4" id="filterSidebar">
                            <div className="offcanvas-header py-3">
                                <h5 className="offcanvas-title">Filter products</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    data-bs-dismiss="offcanvas"
                                    data-bs-target="#filterSidebar"
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="offcanvas-body flex-column pt-2 py-lg-0">
                                <div className="d-flex flex-column gap-3">
                                    {kategorien.map((kategorie, i) => (
                                        <a
                                            key={i}
                                            href={`#${kategorie.replace(/\s+/g, '-')}`}
                                            className="d-flex align-items-center text-decoration-none text-body"
                                        >
                                            <span
                                                className="d-flex align-items-center justify-content-center bg-body-secondary rounded-circle me-3"
                                                style={{ width: '56px', height: '56px' }}
                                            >
                                                <span className="fs-4">
                                                    {kategorie === 'Geflügel' && '🐔'}
                                                    {kategorie === 'Kalb' && '🐄'}
                                                    {kategorie === 'Lamm' && '🐑'}
                                                    {kategorie === 'Pute' && '🦃'}
                                                    {kategorie === 'Rind' && '🐄'}
                                                    {kategorie === 'Schaf' && '🐏'}
                                                    {!['Geflügel', 'Kalb', 'Lamm', 'Pute', 'Rind', 'Schaf'].includes(kategorie) && '📦'}
                                                </span>
                                            </span>
                                            <span className="fs-sm">{kategorie}</span>
                                        </a>
                                    ))}

                                    {favoriten.length > 0 && (
                                        <a
                                            href="#favoriten"
                                            className="d-flex align-items-center text-decoration-none text-body"
                                        >
                                            <span
                                                className="d-flex align-items-center justify-content-center bg-warning rounded-circle me-3"
                                                style={{ width: '56px', height: '56px' }}
                                            >
                                                <i className="ci-star-filled"></i>
                                            </span>
                                            <span className="fs-sm">Favoriten</span>
                                        </a>
                                    )}

                                    <a
                                        href="#letzter-auftrag"
                                        className="d-flex align-items-center text-decoration-none text-body"
                                    >
                                        <span
                                            className="d-flex align-items-center justify-content-center bg-primary rounded-circle me-3 text-white fw-bold"
                                            style={{ width: '56px', height: '56px' }}
                                        >
                                            <i className="ci-package"></i>
                                        </span>
                                        <span className="fs-sm">Letzter Auftrag</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Hauptbereich */}
                    <div className="col-lg-9">
                        {/* Suche + Sortierung */}
                        {/* Sucheingabe */}
                        <div className="position-relative w-100 d-none d-md-block me-3 me-xl-4 mb-4">
                            <input
                                type="search"
                                className="form-control form-control-lg rounded-pill"
                                placeholder="Produkte suchen"
                                aria-label="Search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button
                                type="button"
                                className="btn btn-icon btn-ghost fs-lg btn-secondary text-bo border-0 position-absolute top-0 end-0 rounded-circle mt-1 me-1"
                                aria-label="Search button"
                            >
                                <i className="ci-search"></i>
                            </button>
                        </div>
                        {/* Sortierung und gefundene Artikelanzahl */}
                        <div className="d-sm-flex align-items-center justify-content-between mb-4">
                            <div className="fs-sm text-body-emphasis text-nowrap mb-2 mb-sm-0">
                                {articles.length} Artikel gefunden
                            </div>
                            <div className="d-flex align-items-center text-nowrap">
                                <label className="form-label fw-semibold mb-0 me-2">Sortieren nach:</label>
                                <div style={{ width: 200 }}>
                                    <Form.Select
                                        className="rounded-pill"
                                        value={sortOption}
                                        onChange={(e) => setSortOption(e.target.value)}
                                    >
                                        <option value="nameAsc">Name (A–Z)</option>
                                        <option value="nameDesc">Name (Z–A)</option>
                                        <option value="preisAsc">Preis aufsteigend</option>
                                        <option value="preisDesc">Preis absteigend</option>
                                    </Form.Select>
                                </div>
                            </div>
                        </div>


                        {/* Favoriten */}
                        {favoriten.length > 0 && (
                            <>
                                <h5 id="favoriten" className="mb-3">⭐ Favoriten</h5>
                                <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-3 row-cols-xl-4 g-4">
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
                                </div>
                                <br />
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

                                    <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-3 row-cols-xl-4 g-4">
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
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Artikel nach Kategorie */}
                        {kategorien.map(kat => (
                            <div key={kat} className="mb-5" id={kat.replace(/\s+/g, '-')}>
                                <h5 className="mb-3">{kat}</h5>
                                {/* <!-- Grid --> */}
                                <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-3 row-cols-xl-4 g-4">
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
                                </div>
                                <div className="mt-3">
                                    <Link to="/allArtikel" className="btn nav-link animate-underline text-decoration-none px-0">
                                        <span className="animate-target">Zeige alle Artikel</span>
                                        <i className="ci-chevron-right fs-base ms-1"></i>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
};

export default ArtikelListe;