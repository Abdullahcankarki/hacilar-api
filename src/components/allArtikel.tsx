import React, { useEffect, useState } from 'react';
import HeroSlider from './HeroSlider';
import ArtikelListe from './artikelListe';
import {
  ArtikelResource,
  ArtikelPositionResource,
  KundeResource
} from '../Resources';
import { getAllArtikel } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import { useOutletContext } from 'react-router-dom';
import AngebotsSlider from './AngebotsSlider';

type AllArtikelContextType = {
  cart: ArtikelPositionResource[];
  setCart: React.Dispatch<React.SetStateAction<ArtikelPositionResource[]>>;
  showCart: boolean;
  setShowCart: React.Dispatch<React.SetStateAction<boolean>>;
  kunden: KundeResource[];
  ausgewaehlterKunde: string | null;
  setAusgewaehlterKunde: React.Dispatch<React.SetStateAction<string | null>>;
};

const AllArtikel: React.FC = () => {
  const {
    cart,
    setCart,
    setShowCart
  } = useOutletContext<AllArtikelContextType>();

  const [articles, setArticles] = useState<ArtikelResource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('nameAsc');
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAllArtikel();
        setArticles(data);
      } catch (error) {
        setLadeFehler('Fehler beim Laden der Artikel. Bitte versuche es später erneut.');
      }
    };
    fetchData();
  }, []);

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

  const filteredAndSorted = articles
    .filter((a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.artikelNummer.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortOption) {
        case 'nameAsc': return a.name.localeCompare(b.name);
        case 'nameDesc': return b.name.localeCompare(a.name);
        case 'preisAsc': return a.preis - b.preis;
        case 'preisDesc': return b.preis - a.preis;
        default: return 0;
      }
    });

  return (
    <>
        <ArtikelListe
          articles={filteredAndSorted}
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

export default AllArtikel;