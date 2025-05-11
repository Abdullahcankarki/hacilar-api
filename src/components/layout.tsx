import { Outlet } from 'react-router-dom';
import NavBar from './navbar';
import { useState, useEffect } from 'react';
import WarenkorbModal from './warenkorb';
import { ArtikelPositionResource, AuftragResource, KundeResource, ArtikelResource } from '../Resources';
import { createArtikelPosition, createAuftrag, getAllKunden, getAllArtikel, setGlobalAusgewaehlterKunde, updateAuftrag } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import { Alert } from 'react-bootstrap';

export const Layout: React.FC = () => {
  const [showCart, setShowCart] = useState(false);
  const [cart, setCart] = useState<ArtikelPositionResource[]>([]);
  const [kunden, setKunden] = useState<KundeResource[]>([]);
  const [cartGeladen, setCartGeladen] = useState(false);
  const [articles, setArticles] = useState<ArtikelResource[]>([]);
  const { user, ausgewaehlterKunde, setAusgewaehlterKunde } = useAuth();
  const [lokalAusgewaehlterKunde, setLokalAusgewaehlterKunde] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; variant: 'success' | 'danger' } | null>(null);

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
      setMeldung({ text: 'Bitte einen Kunden auswählen.', variant: 'danger' });
      return;
    }

    try {
      // Auftrag zuerst erstellen mit leerer Positionsliste
      const auftragDraft: Omit<AuftragResource, 'id' | 'createdAt' | 'updatedAt'> = {
        artikelPosition: [],
        lieferdatum,
        kunde: kundeId,
        status: 'offen',
      };

      const gespeicherterAuftrag = await createAuftrag(auftragDraft);
      const auftragId = gespeicherterAuftrag.id;

      // Positionen einzeln mit auftragId erstellen
      const gespeichertePositionen = await Promise.all(
        cart.map(async (pos) => {
          const neuePosition = {
            artikel: pos.artikel!,
            menge: pos.menge!,
            einheit: pos.einheit!,
            zerlegung: pos.zerlegung || false,
            vakuum: pos.vakuum || false,
            bemerkung: pos.bemerkung || '',
            auftragId,
          };
          return await createArtikelPosition(neuePosition);
        })
      );

      // Positionen IDs einsammeln
      const artikelPositionIds = gespeichertePositionen.map((p) => p.id!);

      // Auftrag mit Artikelpositionen aktualisieren
      await updateAuftrag(auftragId, { artikelPosition: artikelPositionIds });

      setMeldung({ text: 'Bestellung wurde übermittelt!', variant: 'success' });
      setCart([]);
      setShowCart(false);
      localStorage.removeItem('warenkorb');
    } catch (error) {
      setMeldung({ text: 'Fehler beim Übermitteln der Bestellung', variant: 'danger' });
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
      {meldung && (
        <div className="container mt-3">
          <Alert
            variant={meldung.variant}
            onClose={() => setMeldung(null)}
            dismissible
          >
            {meldung.text}
          </Alert>
        </div>
      )}

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