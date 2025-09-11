import { Outlet } from 'react-router-dom';
import NavBar from './navbar';
import { useState, useEffect, useMemo, useCallback } from 'react';
import WarenkorbModal from './warenkorb';
import { ArtikelPositionResource, AuftragResource, KundeResource, ArtikelResource } from '../Resources';
import { createArtikelPosition, createAuftrag, getAllKunden, getAllArtikel, updateAuftrag, getKundeById } from '../backend/api';
import { useAuth } from '../providers/Authcontext';
import { createPortal } from 'react-dom';

export const Layout: React.FC = () => {
  const [showCart, setShowCart] = useState(false);
  const [kunden, setKunden] = useState<KundeResource[]>([]);
  const [articles, setArticles] = useState<ArtikelResource[]>([]);
  const [kundeRegionFromProfile, setKundeRegionFromProfile] = useState<string | null>(null);
  const { user, ausgewaehlterKunde, setAusgewaehlterKunde } = useAuth();

  // Persistenter Warenkorb + Toasts + Submit-Loading
  const [toast, setToast] = useState<{ type: 'success' | 'danger' | 'info'; msg: string } | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Persisted Cart Hook
  function usePersistedCart(key = 'warenkorb') {
    const [cart, setCart] = useState<ArtikelPositionResource[]>([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        setCart(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCart([]);
      } finally {
        setReady(true);
      }
    }, [key]);

    useEffect(() => {
      if (ready) {
        localStorage.setItem(key, JSON.stringify(cart));
      }
    }, [cart, ready, key]);

    return { cart, setCart, ready };
  }

  const { cart, setCart, ready: cartGeladen } = usePersistedCart();

  // aktuell gewählter Kunde und seine Region ableiten
  const kundeId = useMemo(() => {
    if (!user) return null;
    const role = Array.isArray((user as any).role) ? (user as any).role : [];
    const result = role.includes('kunde') ? user.id : ausgewaehlterKunde;
    return result;
  }, [user, ausgewaehlterKunde]);

  const kundeRegion = useMemo(() => {
    if (!kundeId) { return null; }
    const k = kunden.find((x) => x.id === kundeId);
    const region = k?.region ?? null;
    return region;
  }, [kunden, kundeId]);

  // Kundenliste laden für Admin oder Verkäufer
  useEffect(() => {
    if (!user) return;
    const role = Array.isArray((user as any).role) ? (user as any).role : [];
    const isAdminOrVerkauf = role.includes('admin') || role.includes('verkauf');
    if (!isAdminOrVerkauf) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await getAllKunden();
        if (!cancelled) setKunden(res.items ?? []);
      } catch {
        if (!cancelled) setKunden([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Fallback: Wenn ein Kunde eingeloggt ist und keine Kundenliste geladen wird,
  // hole die Region direkt aus seinem Profil
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      const role = Array.isArray((user as any).role) ? (user as any).role : [];
      const isKunde = role.includes('kunde');
      if (!isKunde) { setKundeRegionFromProfile(null); return; }
      if (!user.id) return;
      if (kundeRegion) { // bereits über Kundenliste ermittelt
        setKundeRegionFromProfile(null);
        return;
      }
      try {
        const k = await getKundeById(user.id);
        const region = (k as any)?.region ?? null;
        setKundeRegionFromProfile(region);
      } catch (e) {
        setKundeRegionFromProfile(null);
      }
    };
    run();
  }, [user, kundeRegion]);

  // Artikel laden
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getAllArtikel();
        if (!cancelled) setArticles(res.items ?? []);
      } catch {
        if (!cancelled) setArticles([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleEinheitChange = useCallback((index: number, neueEinheit: ArtikelPositionResource['einheit']) => {
    setCart((prev) => prev.map((item, i) => (i === index ? { ...item, einheit: neueEinheit } : item)));
  }, [setCart]);

  const handleRemoveFromCart = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, [setCart]);

  const handleQuantityChange = useCallback((index: number, menge: number) => {
    if (menge < 1) return;
    setCart((prev) => prev.map((item, i) => (i === index ? { ...item, menge } : item)));
  }, [setCart]);

  const handleSubmit = useCallback(async (lieferdatum: string, bemerkung: string) => {
    if (submitLoading) return;
    if (!kundeId) {
      setToast({ type: 'danger', msg: 'Bitte einen Kunden auswählen.' });
      return;
    }
    if (!cartGeladen) return;
    if (!cart.length) {
      setToast({ type: 'danger', msg: 'Warenkorb ist leer.' });
      return;
    }
    if (!lieferdatum) {
      setToast({ type: 'danger', msg: 'Bitte ein Lieferdatum wählen.' });
      return;
    }

    setSubmitLoading(true);
    try {
      // Auftrag zuerst erstellen mit leerer Positionsliste
      const auftragDraft: Omit<AuftragResource, 'id' | 'createdAt' | 'updatedAt'> = {
        artikelPosition: [],
        bemerkungen: bemerkung,
        kunde: kundeId,
        status: 'offen',
      };

      const gespeicherterAuftrag = await createAuftrag(auftragDraft);
      const auftragId = gespeicherterAuftrag.id;
      const auftragsnummer = (gespeicherterAuftrag as any).auftragsnummer;

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
      await updateAuftrag(auftragId, { artikelPosition: artikelPositionIds, lieferdatum: lieferdatum });

      setToast({ type: 'success', msg: `Bestellung übermittelt. Auftragsnummer: ${auftragsnummer || auftragId}` });
      setCart([]);
      setShowCart(false);
      localStorage.removeItem('warenkorb');
    } catch (error: any) {
      setToast({ type: 'danger', msg: error?.message || 'Fehler beim Übermitteln der Bestellung' });
    } finally {
      setSubmitLoading(false);
    }
  }, [submitLoading, kundeId, cartGeladen, cart, setCart]);

  const outletCtx = useMemo(() => ({
    cart,
    setCart,
    showCart,
    setShowCart,
    kunden,
    ausgewaehlterKunde,
    setAusgewaehlterKunde
  }), [cart, showCart, kunden, ausgewaehlterKunde, setAusgewaehlterKunde]);

  return (
    <>
      <NavBar
        onCartClick={() => setShowCart(true)}
        cartLength={cart.length}
        kunden={kunden}
        ausgewaehlterKunde={ausgewaehlterKunde}
        setAusgewaehlterKunde={setAusgewaehlterKunde}
      />
      {toast && createPortal(
        <div className="toast-container position-fixed bottom-0 end-0 p-3"
             style={{ zIndex: 2000, pointerEvents: 'none' }}>
          <div
            className={
              "toast align-items-center text-bg-" + (toast.type === "success" ? "success" : toast.type === "danger" ? "danger" : "info")
              + " border-0 show"
            }
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="d-flex">
              <div className="toast-body">{toast.msg}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} aria-label="Close" />
            </div>
          </div>
        </div>,
        document.body
      )}

      <Outlet context={outletCtx} />

      <WarenkorbModal
        show={showCart}
        onHide={() => setShowCart(false)}
        cart={cart}
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemoveFromCart}
        onSubmit={handleSubmit}
        onEinheitChange={handleEinheitChange}
        articles={articles}
        kundeRegion={kundeRegion ?? kundeRegionFromProfile}
        submitLoading={submitLoading}
      />
    </>
  );
};