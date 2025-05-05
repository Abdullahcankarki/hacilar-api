import { Outlet } from 'react-router-dom';
import NavBar from './navbar';
import { useState, useEffect } from 'react';
import WarenkorbModal from './warenkorb';
import { ArtikelPositionResource, AuftragResource, KundeResource, ArtikelResource } from '../Resources';
import { createArtikelPosition, createAuftrag, getAllKunden, getAllArtikel, setGlobalAusgewaehlterKunde } from '../backend/api';
import { useAuth } from '../providers/Authcontext';

export const Layout: React.FC = () => {
  const [showCart, setShowCart] = useState(false);
  const [cart, setCart] = useState<ArtikelPositionResource[]>([]);
  const [kunden, setKunden] = useState<KundeResource[]>([]);
  const [cartGeladen, setCartGeladen] = useState(false);
  const [articles, setArticles] = useState<ArtikelResource[]>([]);
  const { user, ausgewaehlterKunde, setAusgewaehlterKunde } = useAuth();
  const [lokalAusgewaehlterKunde, setLokalAusgewaehlterKunde] = useState<string | null>(null);
  
  useEffect(() => {
    if (!user) return;
  
    const kundenId =
      user.role === 'a' || user.role === 'v' ? lokalAusgewaehlterKunde : user.id;
  
    setAusgewaehlterKunde(kundenId ?? null);
  }, [user, lokalAusgewaehlterKunde]);

  // Kundenliste laden für Admin oder Verkäufer
  useEffect(() => {
    const fetchKunden = async () => {
      try {
        const res = await getAllKunden();
        setKunden(res);
      } catch (err) {
        console.error('Fehler beim Laden der Kunden:', err);
      }
    };

    if (user?.role === 'a' || user?.role === 'v') {
      fetchKunden();
    }
  }, [user]);

  // Artikel laden
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await getAllArtikel();
        setArticles(res);
      } catch (err) {
        console.error('Fehler beim Laden der Artikel:', err);
      }
    };

    fetchArticles();
  }, []);

  // Warenkorb aus LocalStorage laden
  useEffect(() => {
    try {
      const gespeicherterWarenkorb = localStorage.getItem('warenkorb');
      if (gespeicherterWarenkorb) {
        const parsed = JSON.parse(gespeicherterWarenkorb);
        if (Array.isArray(parsed)) {
          setCart(parsed);
          setCartGeladen(true);
        } else {
          console.warn('Warenkorb-Daten ungültig:', parsed);
        }
      } else {
        setCartGeladen(true);
      }
    } catch (err) {
      console.error('Fehler beim Parsen des Warenkorbs:', err);
      setCartGeladen(true);
    }
  }, []);

  // Warenkorb in LocalStorage speichern
  useEffect(() => {
    if (cartGeladen) {
      localStorage.setItem('warenkorb', JSON.stringify(cart));
    }
  }, [cart, cartGeladen]);

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
    const kundeId = user?.role === 'u' ? user.id : lokalAusgewaehlterKunde;

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
            zerlegung: pos.zerlegung || false,
            vakuum: pos.vakuum || false,
            bemerkung: pos.bemerkung || '',
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

  return (
    <>
      <NavBar
        onCartClick={() => setShowCart(true)}
        cartLength={cart.length}
        kunden={kunden}
        ausgewaehlterKunde={lokalAusgewaehlterKunde}
        setAusgewaehlterKunde={setLokalAusgewaehlterKunde}
      />

      <Outlet context={{
        cart,
        setCart,
        showCart,
        setShowCart,
        kunden,
        ausgewaehlterKunde: lokalAusgewaehlterKunde,
        setAusgewaehlterKunde: setLokalAusgewaehlterKunde
      }} />

      <WarenkorbModal
        show={showCart}
        onHide={() => setShowCart(false)}
        cart={cart}
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemoveFromCart}
        onSubmit={handleSubmit}
        onEinheitChange={handleEinheitChange}
        articles={articles}
      />
    </>
  );
};