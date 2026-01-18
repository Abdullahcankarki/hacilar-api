import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import HeroSlider from './HeroSlider';
import ArtikelListe from './artikelListe';
import {
  ArtikelResource,
  ArtikelPositionResource,
  KundeResource
} from '@/Resources';
import { getAllArtikel, getAuswahlArtikel } from '@/backend/api';
import { useOutletContext } from 'react-router-dom';
import AngebotsSlider from './AngebotsSlider';

type DashboardContextType = {
  cart: ArtikelPositionResource[];
  setCart: React.Dispatch<React.SetStateAction<ArtikelPositionResource[]>>;
  showCart: boolean;
  setShowCart: React.Dispatch<React.SetStateAction<boolean>>;
  kunden: KundeResource[];
  ausgewaehlterKunde: string | null;
  setAusgewaehlterKunde: React.Dispatch<React.SetStateAction<string | null>>;
};

const Dashboard: React.FC = () => {
  const {
    cart,
    setCart,
    setShowCart
  } = useOutletContext<DashboardContextType>();

  const [articles, setArticles] = useState<ArtikelResource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('nameAsc');
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAuswahlArtikel();
        setArticles(data);
      } catch (error) {
        setLadeFehler('Fehler beim Laden der Artikel. Bitte versuche es später erneut.');
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    (async () => {
      try {
        if (debouncedSearch && debouncedSearch.length >= 2) {
          // Suche global über alle Artikel
          const res = await getAllArtikel({ q: debouncedSearch, limit: 500, sortBy: 'nameAsc' } as any);
          const items = (res as any)?.items ?? res ?? [];
          setArticles(items);
        } else {
          // Fallback: kuratierte Auswahl
          const data = await getAuswahlArtikel();
          setArticles(data);
        }
      } catch (error) {
        setLadeFehler('Fehler beim Laden der Artikel. Bitte versuche es später erneut.');
      }
    })();
  }, [debouncedSearch]);

  const handleAddToCart = (position: ArtikelPositionResource) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.artikel === position.artikel);
      if (existing) {
        return prevCart.map((item) =>
          item.artikel === position.artikel
            ? { ...item, menge: item.menge! + position.menge! }
            : item
        );
      } else {
        return [...prevCart, position];
      }
    });
  };

  return (
    <>
      <HeroSlider />


      {ladeFehler && createPortal(
        <div className="toast-container position-fixed bottom-0 end-0 p-3"
             style={{ zIndex: 2000, pointerEvents: 'none' }}>
          <div
            className="toast align-items-center text-bg-danger border-0 show"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="d-flex">
              <div className="toast-body">{ladeFehler}</div>
              <button type="button"
                      className="btn-close btn-close-white me-2 m-auto"
                      aria-label="Close"
                      onClick={() => setLadeFehler(null)} />
            </div>
          </div>
        </div>,
        document.body
      )}

        <AngebotsSlider />

        <ArtikelListe
          articles={articles}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortOption={sortOption}
          setSortOption={setSortOption}
          onAddToCart={handleAddToCart}
          cartLength={cart.length}
          onCartClick={() => setShowCart(true)}
          cart={cart}
          setCart={setCart}
        />

    </>
  );
};

export default Dashboard;