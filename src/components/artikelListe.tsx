import React, { useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import { ArtikelResource, ArtikelPositionResource } from '../Resources';
import RenderCard from './renderCard';
import { getAuftragLetzte, getAuftragLetzteArtikel } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import { getKundenFavoriten } from '../backend/api';
import { Link } from 'react-router-dom';
import ArtikelCard from './artikelCard';

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
    const [lastState, setLastState] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
    const [letzterAuftrag, setLetzterAuftrag] = useState<ArtikelPositionResource[]>([]);
    const [favoriten, setFavoriten] = useState<string[]>([]);
    const [activeKat, setActiveKat] = useState<string | null>(null);

    // Viewport width state and effect
    const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        const onResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', onResize, { passive: true } as any);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Bootstrap breakpoints: sm 576px, md 768px, lg 992px, xl 1200px
    // "Kurz vor" Wechsel: 4→3 happens as we approach 992px from above; 3→2 happens as we approach 576px from above.
    const smallCardMode = useMemo(() => {
        const nearFourToThree = viewportWidth >= 765 && viewportWidth < 992; // ~last 92px before lg breakpoint
        const nearFourToThree2 = viewportWidth >= 1200 && viewportWidth < 1270;
        const nearThreeToTwo = viewportWidth >= 500 && viewportWidth < 709; // ~first 64px above sm breakpoint
        const nearTwoToOne = viewportWidth >= 0 && viewportWidth < 450; // ~first 64px above sm breakpoint
        return nearFourToThree || nearFourToThree2 || nearThreeToTwo || nearTwoToOne;
    }, [viewportWidth]);

    useEffect(() => {
        (async () => {
            try {
                const { artikelPositionen } = await getAuftragLetzte();
                setLetzterAuftrag(artikelPositionen);
                setLetzteArtikel(artikelPositionen.map(p => p.artikel!).filter(Boolean));
                setLastState('ready');
            } catch (e) {
                setLastState('error');
            }
        })();
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

    // Removed effect that fetched letzteArtikel separately

    const artikelById = useMemo(() => {
        const m = new Map<string, ArtikelResource>();
        for (const a of articles) if (a.id) m.set(a.id, a);
        return m;
    }, [articles]);

    const normSearch = useMemo(() => searchTerm.trim().toLocaleLowerCase('de-DE'), [searchTerm]);

    const filtered = useMemo(() => {
        const arr = articles.filter(a => a.name.toLocaleLowerCase('de-DE').includes(normSearch));
        switch (sortOption) {
            case 'nameAsc':
                arr.sort((a, b) => a.name.localeCompare(b.name, 'de'));
                break;
            case 'nameDesc':
                arr.sort((a, b) => b.name.localeCompare(a.name, 'de'));
                break;
            case 'preisAsc':
                arr.sort((a, b) => (a.preis ?? 0) - (b.preis ?? 0));
                break;
            case 'preisDesc':
                arr.sort((a, b) => (b.preis ?? 0) - (a.preis ?? 0));
                break;
        }
        return arr;
    }, [articles, normSearch, sortOption]);

    const groupedArticles = useMemo(() => {
        const grouped: { [key: string]: ArtikelResource[] } = {};
        filtered.forEach(article => {
            const kat = article.kategorie || 'Andere';
            if (!grouped[kat]) grouped[kat] = [];
            grouped[kat].push(article);
        });
        return grouped;
    }, [filtered]);

    const kategorien = useMemo(() => Object.keys(groupedArticles).sort((a, b) => a.localeCompare(b, 'de')), [groupedArticles]);

    useEffect(() => {
        const catIds = kategorien.map(k => k.replace(/\s+/g, '-'));
        const extraIds: string[] = ['letzter-auftrag'];
        if (favoriten.length > 0) extraIds.unshift('favoriten');
        const ids = [...extraIds, ...catIds];

        const getSections = () => ids
            .map(id => document.getElementById(id))
            .filter(Boolean) as HTMLElement[];

        let sections = getSections();

        const OFFSET = 110; // match scrollMarginTop

        const onScroll = () => {
            if (sections.length === 0) {
                sections = getSections();
                if (sections.length === 0) return;
            }
            let current: string | null = ids[0] || null;
            for (const sec of sections) {
                if (sec.getBoundingClientRect().top - OFFSET <= 0) {
                    current = sec.id;
                }
            }
            setActiveKat(current);
        };

        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [kategorien, favoriten.length]);

    return (
        <>
            <h1 className="display-6 fw-semibold container pb-2 pb-md-3 pb-lg-4">Produkte</h1>


            <section className="container pb-5 mb-2 mb-sm-3 mb-lg-4 mb-xl-5">
                <div className="row">
                    {/* Sidebar */}
                    <aside className="col-lg-3">
                        <div
                            className="offcanvas-lg offcanvas-start pe-lg-4 sticky-lg-top"
                            id="filterSidebar"
                            style={{ top: 'calc(72px + 1rem)', maxHeight: 'calc(100vh - (72px + 1rem))', overflowY: 'auto' }}
                        >
                            <div className="offcanvas-header py-3">
                                <h5 className="offcanvas-title">Kategorien</h5>
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
                                    {kategorien.map((kategorie, i) => {
                                        const id = kategorie.replace(/\s+/g, '-');
                                        const isActive = activeKat === id;
                                        return (
                                            <a
                                                key={i}
                                                href={`#${id}`}
                                                className={`d-flex align-items-center text-decoration-none rounded-3 px-2 py-2 ${isActive ? 'bg-body-tertiary text-dark' : 'text-body'}`}
                                                aria-current={isActive ? 'true' : undefined}
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
                                                <span className="fs-sm fw-semibold">{kategorie}</span>
                                            </a>
                                        );
                                    })}

                                    {favoriten.length > 0 && (() => {
                                        const isActive = activeKat === 'favoriten';
                                        return (
                                            <a
                                                href="#favoriten"
                                                className={`d-flex align-items-center text-decoration-none rounded-3 px-2 py-2 ${isActive ? 'bg-body-tertiary text-dark' : 'text-body'}`}
                                                aria-current={isActive ? 'true' : undefined}
                                            >
                                                <span
                                                    className="d-flex align-items-center justify-content-center bg-warning rounded-circle me-3"
                                                    style={{ width: '56px', height: '56px' }}
                                                >
                                                    <i className="ci-star-filled"></i>
                                                </span>
                                                <span className="fs-sm">Favoriten</span>
                                            </a>
                                        );
                                    })()}

                                    {(() => {
                                        const isActive = activeKat === 'letzter-auftrag';
                                        return (
                                            <a
                                                href="#letzter-auftrag"
                                                className={`d-flex align-items-center text-decoration-none rounded-3 px-2 py-2 ${isActive ? 'bg-body-tertiary text-dark' : 'text-body'}`}
                                                aria-current={isActive ? 'true' : undefined}
                                            >
                                                <span
                                                    className="d-flex align-items-center justify-content-center bg-primary rounded-circle me-3 text-white fw-bold"
                                                    style={{ width: '56px', height: '56px' }}
                                                >
                                                    <i className="ci-package"></i>
                                                </span>
                                                <span className="fs-sm">Letzter Auftrag</span>
                                            </a>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Hauptbereich */}
                    <div className="col-lg-9">
                        {/* Suche + Sortierung (in Card) */}
                        <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 toolbar-sticky">
                            <div className="row g-3 align-items-center">
                                {/* Mobile: Filter öffnen */}
                                <div className="col-12 d-md-none order-3">
                                    <button
                                        className="btn btn-outline-secondary w-100 rounded-pill"
                                        type="button"
                                        data-bs-toggle="offcanvas"
                                        data-bs-target="#filterSidebar"
                                        aria-controls="filterSidebar"
                                    >
                                        <i className="ci-filter me-2"></i>Filter öffnen
                                    </button>
                                </div>

                                {/* Suche */}
                                <div className="col-12 col-md">
                                    <div className="position-relative">
                                        <input
                                            type="search"
                                            className="form-control form-control-lg rounded-pill ps-5"
                                            placeholder="Produkte suchen"
                                            aria-label="Search"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                        <i className="ci-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                                    </div>
                                </div>

                                {/* Sortierung */}
                                <div className="col-12 col-md-auto">
                                    <div className="d-flex align-items-center gap-2">
                                        <label className="form-label fw-semibold mb-0 d-none d-sm-inline">Sortieren:</label>
                                        <Form.Select
                                            className="rounded-pill"
                                            value={sortOption}
                                            onChange={(e) => setSortOption(e.target.value)}
                                            style={{ minWidth: 220 }}
                                        >
                                            <option value="nameAsc">Name (A–Z)</option>
                                            <option value="nameDesc">Name (Z–A)</option>
                                            <option value="preisAsc">Preis aufsteigend</option>
                                            <option value="preisDesc">Preis absteigend</option>
                                        </Form.Select>
                                    </div>
                                </div>

                                {/* Trefferanzahl */}
                                <div className="col-12 col-md-auto text-muted small order-4 order-md-0">
                                    {filtered.length} Artikel gefunden{(articles as any)?.loadingAll ? ' … (Suche in allen Artikeln)' : ''}
                                </div>
                            </div>
                        </div>
                        {/* Favoriten */}
                        {favoriten.length > 0 && (
                            <>
                                <div className="d-flex align-items-center justify-content-between mb-3" id="favoriten" style={{ scrollMarginTop: '110px' }}>
                                    <h5 className="mb-0">⭐ Favoriten</h5>
                                    <span className="badge bg-warning-subtle text-warning-emphasis">
                                        {articles.filter(a => favoriten.includes(a.id!)).length}
                                    </span>
                                </div>
                                <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-3 row-cols-xl-4 g-4">
                                    {articles.filter(a => favoriten.includes(a.id!)).map(article => (
                                        <ArtikelCard
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
                                            small={smallCardMode}
                                        />
                                    ))}
                                </div>
                                <br />
                                <hr className="my-4 opacity-25" />
                            </>
                        )}

                        {/* Letzter Auftrag */}
                        <div className="mb-5" id="letzter-auftrag" style={{ scrollMarginTop: '110px' }}>
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <h5 className="mb-0">📦 Letzter Auftrag</h5>
                                {letzteArtikel.length > 0 && (
                                    <span className="badge bg-primary-subtle text-primary-emphasis">
                                        {letzteArtikel.length}
                                    </span>
                                )}
                            </div>

                            {lastState === 'loading' && (
                                <div className="text-muted">⏳ Wird geladen...</div>
                            )}

                            {lastState === 'error' && (
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

                            {lastState === 'ready' && letzteArtikel.length === 0 && (
                                <div className="text-muted">Kein letzter Auftrag gefunden.</div>
                            )}

                            {lastState === 'ready' && letzteArtikel.length > 0 && (
                                <>
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <span className="text-muted">{letzteArtikel.length} Artikel im letzten Auftrag</span>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => {
                                                const neu: ArtikelPositionResource[] = letzterAuftrag.map(pos => ({
                                                    artikel: pos.artikel!,
                                                    artikelName: pos.artikelName || '',
                                                    menge: pos.menge || 1,
                                                    einheit: pos.einheit || 'kg',
                                                    einzelpreis: pos.einzelpreis || 0,
                                                    zerlegung: pos.zerlegung || false,
                                                    vakuum: pos.vakuum || false,
                                                    bemerkung: pos.bemerkung || '',
                                                }));

                                                const merged = (() => {
                                                    const map = new Map<string, ArtikelPositionResource>();
                                                    const keyOf = (p: ArtikelPositionResource) => `${p.artikel}|${p.einheit}|${p.zerlegung ? '1' : '0'}|${p.vakuum ? '1' : '0'}`;
                                                    for (const p of [...cart, ...neu]) {
                                                        const k = keyOf(p);
                                                        const ex = map.get(k);
                                                        map.set(k, ex ? { ...ex, menge: (ex.menge || 0) + (p.menge || 0) } : p);
                                                    }
                                                    return Array.from(map.values());
                                                })();
                                                setCart(merged);
                                            }}
                                        >
                                            Letzten Auftrag übernehmen
                                        </button>
                                    </div>

                                    <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-3 row-cols-xl-4 g-4">
                                        {letzteArtikel.map((artikelId) => {
                                            const article = artikelById.get(artikelId);
                                            if (!article) return null;
                                            return (
                                                <ArtikelCard
                                                    key={artikelId}
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
                                                    small={smallCardMode}
                                                />
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                            <hr className="my-5 opacity-25" />
                        </div>

                        {/* Artikel nach Kategorie */}
                        {kategorien.map(kat => (
                            <div
                                key={kat}
                                className="mb-5"
                                id={kat.replace(/\s+/g, '-')}
                                style={{ scrollMarginTop: '110px' }}
                            >
                                <h5 className="mb-3">{kat}</h5>
                                {/* <!-- Grid --> */}
                                <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-3 row-cols-xl-4 g-4">
                                    {groupedArticles[kat].map(article => (
                                        <ArtikelCard
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
                                            small={smallCardMode}
                                        />
                                    ))}
                                </div>
                                <div className="mt-3">
                                    <Link to="/allArtikel" className="btn nav-link animate-underline text-decoration-none px-0">
                                        <span className="animate-target">Zeige alle Artikel</span>
                                        <i className="ci-chevron-right fs-base ms-1"></i>
                                    </Link>
                                </div>
                                <hr className="my-5 opacity-25" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            <style>
                {`
  /* Sidebar: smoother hover */
  #filterSidebar .offcanvas-body a { transition: background-color .15s ease; }
  #filterSidebar .offcanvas-body a:hover { background-color: var(--bs-body-tertiary); }

  /* Einheitliche Scroll-Margins für Abschnittsanker */
  [style*='scrollMarginTop'] { scroll-margin-top: 110px !important; }
  
  /* Sticky toolbar (unter der Navbar) */
  .toolbar-sticky { position: sticky; top: calc(72px + .75rem); z-index: 1020; }
  /* Auf Handy: nicht sticky, normal scrollen */
  @media (max-width: 767.98px) {
    .toolbar-sticky { position: static; top: auto; }
  }
`}
            </style>
        </>
    );
};

export default ArtikelListe;