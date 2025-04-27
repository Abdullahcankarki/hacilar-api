import React, { useEffect, useState } from 'react';
import ArtikelSlider from './artikelSlider';
import ArtikelListe from './artikelListe';
import {
  ArtikelResource,
  ArtikelPositionResource,
  KundeResource
} from '../Resources';
import { getAllArtikel } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import { useOutletContext } from 'react-router-dom';

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
    <div className="container-fluid px-4 py-3">
      {ladeFehler && (
        <div className="alert alert-danger text-center mb-4" role="alert">
          {ladeFehler}
        </div>
      )}

      <ArtikelSlider />

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
    </div>
  );
};

export default Dashboard;