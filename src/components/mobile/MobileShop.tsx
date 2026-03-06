import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArtikelResource, ArtikelPositionResource } from '@/Resources';
import { getAllArtikel, getAuswahlArtikel, getAuftragLetzte, getKundenFavoriten, addKundenFavorit, removeKundenFavorit } from '@/backend/api';
import { useAuth } from '@/providers/Authcontext';
import { unitFromModus, round2, mergeCartWithOrder } from '@/utils/cartHelpers';
import MobileProductCard from './MobileProductCard';
import HeroSlider from '../dashboard/HeroSlider';

type OutletCtx = {
  cart: ArtikelPositionResource[];
  setCart: React.Dispatch<React.SetStateAction<ArtikelPositionResource[]>>;
  showCart: boolean;
  setShowCart: React.Dispatch<React.SetStateAction<boolean>>;
};

const CATEGORY_EMOJIS: Record<string, string> = {
  'Geflügel': '🐔', 'Kalb': '🐄', 'Lamm': '🐑',
  'Pute': '🦃', 'Rind': '🥩', 'Schaf': '🐏',
};

const MobileShop: React.FC = () => {
  const { cart, setCart } = useOutletContext<OutletCtx>();
  const { user } = useAuth();

  const [articles, setArticles] = useState<ArtikelResource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOption, setSortOption] = useState('nameAsc');
  const [activeKat, setActiveKat] = useState<string | null>(null);
  const [favoriten, setFavoriten] = useState<string[]>([]);
  const [letzterAuftrag, setLetzterAuftrag] = useState<ArtikelPositionResource[]>([]);
  const [letzteArtikel, setLetzteArtikel] = useState<string[]>([]);
  const [lastState, setLastState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showSearch, setShowSearch] = useState(false);

  // Load articles
  useEffect(() => {
    (async () => {
      try {
        const res = await getAuswahlArtikel();
        setArticles(res);
      } catch { setArticles([]); }
    })();
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Fetch when search changes
  useEffect(() => {
    if (debouncedSearch.length < 2) return;
    (async () => {
      try {
        const res = await getAllArtikel({ name: debouncedSearch });
        setArticles(res.items);
      } catch {}
    })();
  }, [debouncedSearch]);

  // Reset to curated when search cleared
  useEffect(() => {
    if (debouncedSearch.length < 2 && debouncedSearch === '') {
      (async () => {
        try { const res = await getAuswahlArtikel(); setArticles(res); } catch {}
      })();
    }
  }, [debouncedSearch]);

  // Load favorites
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const favs = await getKundenFavoriten(user.id);
        setFavoriten(favs);
      } catch {}
    })();
  }, [user]);

  // Load last order
  useEffect(() => {
    (async () => {
      try {
        const { artikelPositionen } = await getAuftragLetzte();
        setLetzterAuftrag(artikelPositionen);
        setLetzteArtikel(artikelPositionen.map(p => p.artikel!).filter(Boolean));
        setLastState('ready');
      } catch { setLastState('error'); }
    })();
  }, []);

  // Filter + Sort
  const normSearch = useMemo(() => debouncedSearch.trim().toLocaleLowerCase('de-DE'), [debouncedSearch]);
  const filtered = useMemo(() => {
    let arr = articles.filter(a => a.name.toLocaleLowerCase('de-DE').includes(normSearch));
    if (activeKat) arr = arr.filter(a => (a.kategorie || 'Andere') === activeKat);
    switch (sortOption) {
      case 'nameAsc': arr.sort((a, b) => a.name.localeCompare(b.name, 'de')); break;
      case 'nameDesc': arr.sort((a, b) => b.name.localeCompare(a.name, 'de')); break;
      case 'preisAsc': arr.sort((a, b) => (a.preis ?? 0) - (b.preis ?? 0)); break;
      case 'preisDesc': arr.sort((a, b) => (b.preis ?? 0) - (a.preis ?? 0)); break;
    }
    return arr;
  }, [articles, normSearch, sortOption, activeKat]);

  const groupedArticles = useMemo(() => {
    const grouped: Record<string, ArtikelResource[]> = {};
    filtered.forEach(a => {
      const kat = a.kategorie || 'Andere';
      if (!grouped[kat]) grouped[kat] = [];
      grouped[kat].push(a);
    });
    return grouped;
  }, [filtered]);

  const kategorien = useMemo(() => Object.keys(groupedArticles).sort((a, b) => a.localeCompare(b, 'de')), [groupedArticles]);

  const artikelById = useMemo(() => {
    const m = new Map<string, ArtikelResource>();
    for (const a of articles) if (a.id) m.set(a.id, a);
    return m;
  }, [articles]);

  const allKategorien = useMemo(() => {
    const s = new Set<string>();
    articles.forEach(a => s.add(a.kategorie || 'Andere'));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'de'));
  }, [articles]);

  // Handlers
  const toggleFavorit = async (artikelId: string) => {
    if (!user) return;
    const isFav = favoriten.includes(artikelId);
    try {
      if (isFav) {
        await removeKundenFavorit(user.id, artikelId);
        setFavoriten(prev => prev.filter(f => f !== artikelId));
      } else {
        await addKundenFavorit(user.id, artikelId);
        setFavoriten(prev => [...prev, artikelId]);
      }
    } catch {}
  };

  const handleAddToCart = (article: ArtikelResource, menge: number) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.artikel === article.id);
      const pos: ArtikelPositionResource = {
        artikel: article.id!, artikelName: article.name, menge: round2(menge),
        einheit: unitFromModus(article.erfassungsModus) as any,
        einzelpreis: article.preis, gesamtpreis: round2((article.preis || 0) * menge),
      } as any;
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = pos;
        return updated;
      }
      return [...prev, pos];
    });
  };

  const handleOvernehmeLetztenAuftrag = () => {
    const neu = letzterAuftrag.map(pos => ({
      artikel: pos.artikel!, artikelName: pos.artikelName || '', menge: pos.menge || 1,
      einheit: pos.einheit || 'kg', einzelpreis: pos.einzelpreis || 0,
      zerlegung: pos.zerlegung || false, vakuum: pos.vakuum || false, bemerkung: pos.bemerkung || '',
    } as ArtikelPositionResource));
    setCart(prev => mergeCartWithOrder(prev, neu));
  };

  const cartQtyMap = useMemo(() => {
    const m = new Map<string, number>();
    cart.forEach(i => m.set(i.artikel, (m.get(i.artikel) || 0) + (i.menge || 0)));
    return m;
  }, [cart]);

  const favArticles = articles.filter(a => favoriten.includes(a.id!));

  return (
    <>
      {/* Compact Hero */}
      <div className="ms-hero">
        <HeroSlider />
      </div>

      {/* Search */}
      <div className="ms-search-bar">
        <div style={{ position: 'relative' }}>
          <i className="ci-search ms-search-icon" />
          <input
            className="ms-search-input"
            type="search"
            placeholder="Produkte suchen..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <select className="ms-sort-select" value={sortOption} onChange={e => setSortOption(e.target.value)}>
            <option value="nameAsc">A–Z</option>
            <option value="nameDesc">Z–A</option>
            <option value="preisAsc">Preis ↑</option>
            <option value="preisDesc">Preis ↓</option>
          </select>
        </div>
      </div>

      {/* Category Icons */}
      <div className="ms-categories">
        <div
          className={`ms-cat-item ${!activeKat ? 'active' : ''}`}
          onClick={() => setActiveKat(null)}
        >
          <div className="ms-cat-icon">🏪</div>
          <span className="ms-cat-label">Alle</span>
        </div>
        {allKategorien.map(kat => (
          <div
            key={kat}
            className={`ms-cat-item ${activeKat === kat ? 'active' : ''}`}
            onClick={() => setActiveKat(activeKat === kat ? null : kat)}
          >
            <div className="ms-cat-icon">{CATEGORY_EMOJIS[kat] || '📦'}</div>
            <span className="ms-cat-label">{kat}</span>
          </div>
        ))}
      </div>

      {/* Favoriten (horizontal scroll) */}
      {favArticles.length > 0 && (
        <>
          <div className="ms-section-header">
            <h3 className="ms-section-title">Favoriten</h3>
            <span className="ms-section-badge">{favArticles.length}</span>
          </div>
          <div className="ms-hscroll">
            {favArticles.map(article => (
              <MobileProductCard
                key={article.id}
                article={article}
                isFavorite={true}
                onToggleFavorite={() => toggleFavorit(article.id!)}
                onAddToCart={(menge) => handleAddToCart(article, menge)}
                cartQty={cartQtyMap.get(article.id!) || 0}
              />
            ))}
          </div>
        </>
      )}

      {/* Letzter Auftrag */}
      {lastState === 'ready' && letzteArtikel.length > 0 && (
        <>
          <div className="ms-section-header">
            <h3 className="ms-section-title">Letzte Bestellung</h3>
            <button className="ms-section-btn" onClick={handleOvernehmeLetztenAuftrag}>
              Alle übernehmen
            </button>
          </div>
          <div className="ms-hscroll">
            {letzteArtikel.map(id => {
              const article = artikelById.get(id);
              if (!article) return null;
              return (
                <MobileProductCard
                  key={id}
                  article={article}
                  isFavorite={favoriten.includes(id)}
                  onToggleFavorite={() => toggleFavorit(id)}
                  onAddToCart={(menge) => handleAddToCart(article, menge)}
                  cartQty={cartQtyMap.get(id) || 0}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Products by Category */}
      {kategorien.map(kat => (
        <React.Fragment key={kat}>
          <div className="ms-section-header">
            <h3 className="ms-section-title">{CATEGORY_EMOJIS[kat] || '📦'} {kat}</h3>
            <span className="ms-section-badge">{groupedArticles[kat].length}</span>
          </div>
          <div className="ms-grid">
            {groupedArticles[kat].map(article => (
              <MobileProductCard
                key={article.id}
                article={article}
                isFavorite={favoriten.includes(article.id!)}
                onToggleFavorite={() => toggleFavorit(article.id!)}
                onAddToCart={(menge) => handleAddToCart(article, menge)}
                cartQty={cartQtyMap.get(article.id!) || 0}
              />
            ))}
          </div>
        </React.Fragment>
      ))}

      {filtered.length === 0 && (
        <div className="ms-empty">
          <div className="ms-empty-icon">🔍</div>
          <p>Keine Produkte gefunden</p>
        </div>
      )}

    </>
  );
};

export default MobileShop;
