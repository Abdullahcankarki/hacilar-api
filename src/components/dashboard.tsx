import React, { useEffect, useState } from 'react';
import ArtikelListe from './artikelListe';
import WarenkorbModal from './warenkorb';
import {
  ArtikelResource,
  ArtikelPositionResource,
  AuftragResource,
  KundeResource
} from '../Resources';
import {
  getAllArtikel,
  createAuftrag,
  createArtikelPosition,
  getAllKunden
} from '../backend/api';
import { useAuth } from '../providers/Authcontext';

const Dashboard: React.FC = () => {
  const [articles, setArticles] = useState<ArtikelResource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('nameAsc');
  const [cart, setCart] = useState<ArtikelPositionResource[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [kunden, setKunden] = useState<KundeResource[]>([]);
  const [ausgewaehlterKunde, setAusgewaehlterKunde] = useState<string | null>(null);

  const { user } = useAuth();

  // Artikel & Kunden laden
  useEffect(() => {
    const gespeicherterWarenkorb = localStorage.getItem('warenkorb');
    if (gespeicherterWarenkorb) {
      setCart(JSON.parse(gespeicherterWarenkorb));
    }

    const fetchData = async () => {
      const data = await getAllArtikel();
      setArticles(data);
    };

    fetchData();

    if (user?.role === 'a' || user?.role === 'v') {
      getAllKunden().then(setKunden);
    }
  }, [user]);

  // Warenkorb speichern
  useEffect(() => {
    localStorage.setItem('warenkorb', JSON.stringify(cart));
  }, [cart]);

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

  const handleEinheitChange = (
    index: number,
    neueEinheit: ArtikelPositionResource['einheit']
  ) => {
    setCart((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, einheit: neueEinheit } : item
      )
    );
  };

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, menge: number) => {
    if (menge < 1) return;
    setCart((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, menge } : item
      )
    );
  };

  const handleSubmit = async (lieferdatum: string) => {
    const kundeId = user?.role === 'u' ? user.id : ausgewaehlterKunde;

    if (!kundeId) {
      alert('Bitte einen Kunden auswählen.');
      return;
    }

    try {
      const gespeichertePositionen = await Promise.all(
        cart.map(async (pos) => {
          const neuePosition = {
            artikel: pos.artikel!,
            menge: pos.menge!,
            einheit: pos.einheit!,
            einzelpreis: pos.einzelpreis!,
          };
          return await createArtikelPosition(neuePosition);
        })
      );

      const artikelPositionIds = gespeichertePositionen.map((p) => p.id!);

      const auftrag: Omit<AuftragResource, 'id' | 'createdAt' | 'updatedAt'> = {
        artikelPosition: artikelPositionIds,
        lieferdatum,
        kunde: kundeId,
        status: 'offen',
      };

      await createAuftrag(auftrag);
      alert('Bestellung wurde übermittelt!');
      setCart([]);
      setShowCart(false);
      localStorage.removeItem('warenkorb');
    } catch (error) {
      alert('Fehler beim Übermitteln der Bestellung');
      console.error(error);
    }
  };

  const filteredAndSorted = articles
    .filter((a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.artikelNummer.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOption === 'nameAsc') return a.name.localeCompare(b.name);
      if (sortOption === 'nameDesc') return b.name.localeCompare(a.name);
      if (sortOption === 'preisAsc') return a.preis - b.preis;
      if (sortOption === 'preisDesc') return b.preis - a.preis;
      return 0;
    });

  return (
    <>
      {/* Kunden-Auswahl nur für Admin/Verkäufer */}
      {(user?.role === 'a' || user?.role === 'v') && (
        <div className="container mt-3">
          <label className="form-label">Kunde auswählen:</label>
          <select
            className="form-select"
            value={ausgewaehlterKunde ?? ''}
            onChange={(e) => setAusgewaehlterKunde(e.target.value)}
          >
            <option value="">– bitte wählen –</option>
            {kunden.map((kunde) => (
              <option key={kunde.id} value={kunde.id}>
                {kunde.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <ArtikelListe
        articles={filteredAndSorted}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortOption={sortOption}
        setSortOption={setSortOption}
        onAddToCart={handleAddToCart}
        cartLength={cart.length}
        onCartClick={() => setShowCart(true)}
      />

      <WarenkorbModal
        show={showCart}
        onHide={() => setShowCart(false)}
        cart={cart}
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemoveFromCart}
        onSubmit={handleSubmit}
        onEinheitChange={handleEinheitChange}
      />
    </>
  );
};

export default Dashboard;