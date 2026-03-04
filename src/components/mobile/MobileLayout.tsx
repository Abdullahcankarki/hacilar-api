import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { ArtikelPositionResource, ArtikelResource } from '@/Resources';
import { createAuftragComplete, getAllArtikel, getKundeById } from '@/backend/api';
import { useAuth } from '@/providers/Authcontext';
import { usePersistedCart } from '@/hooks/usePersistedCart';
import MobileCart from './MobileCart';
import './mobile-shop.css';

const MobileLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [showCart, setShowCart] = useState(false);
  const [articles, setArticles] = useState<ArtikelResource[]>([]);
  const [kundeRegion, setKundeRegion] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const { cart, setCart, ready: cartGeladen } = usePersistedCart();

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load articles for cart calculations
  useEffect(() => {
    let c = false;
    (async () => {
      try { const res = await getAllArtikel(); if (!c) setArticles(res.items ?? []); }
      catch { if (!c) setArticles([]); }
    })();
    return () => { c = true; };
  }, []);

  // Load customer region
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const k = await getKundeById(user.id);
        setKundeRegion((k as any)?.region ?? null);
      } catch { setKundeRegion(null); }
    })();
  }, [user]);

  const kundeId = user?.id ?? null;

  const handleEinheitChange = useCallback((index: number, neueEinheit: ArtikelPositionResource['einheit']) => {
    setCart(prev => prev.map((item, i) => i === index ? { ...item, einheit: neueEinheit } : item));
  }, [setCart]);

  const handleRemoveFromCart = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  }, [setCart]);

  const handleQuantityChange = useCallback((index: number, menge: number) => {
    if (menge < 0.1) return;
    setCart(prev => prev.map((item, i) => i === index ? { ...item, menge } : item));
  }, [setCart]);

  const handleSubmit = useCallback(async (lieferdatum: string, bemerkung: string) => {
    if (submitLoading) return;
    if (!kundeId) { setToast({ type: 'danger', msg: 'Kein Kunde ausgewählt.' }); return; }
    if (!cartGeladen || !cart.length) { setToast({ type: 'danger', msg: 'Warenkorb ist leer.' }); return; }
    if (!lieferdatum) { setToast({ type: 'danger', msg: 'Bitte ein Lieferdatum wählen.' }); return; }

    setSubmitLoading(true);
    try {
      const result = await createAuftragComplete({
        kunde: kundeId,
        lieferdatum,
        bemerkungen: bemerkung,
        positionen: cart.map(pos => ({
          artikel: pos.artikel!, menge: pos.menge!, einheit: pos.einheit!,
          zerlegung: pos.zerlegung || false, vakuum: pos.vakuum || false, bemerkung: pos.bemerkung || '',
        })),
      });
      const nr = (result as any).auftragsnummer;
      setToast({ type: 'success', msg: `Bestellung aufgegeben! Nr: ${nr || result.id}` });
      setCart([]);
      setShowCart(false);
      localStorage.removeItem('warenkorb');
    } catch (e: any) {
      setToast({ type: 'danger', msg: e?.message || 'Fehler beim Bestellen' });
    } finally {
      setSubmitLoading(false);
    }
  }, [submitLoading, kundeId, cartGeladen, cart, setCart]);

  const outletCtx = useMemo(() => ({
    cart, setCart, showCart, setShowCart,
  }), [cart, showCart]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="ms-app">
      {/* Header */}
      <header className="ms-header">
        <span className="ms-header-title">HACILAR</span>
        <button className="ms-header-btn" onClick={() => setShowCart(true)} aria-label="Warenkorb">
          <i className="ci-shopping-cart" />
          {cart.length > 0 && <span className="ms-header-badge">{cart.length}</span>}
        </button>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`ms-toast ${toast.type}`}>
          <span>{toast.msg}</span>
          <button className="ms-toast-close" onClick={() => setToast(null)}>&times;</button>
        </div>
      )}

      {/* Page Content */}
      <main>
        <Outlet context={outletCtx} />
      </main>

      {/* Bottom Tab Bar */}
      <nav className="ms-bottom-tabs">
        <NavLink to="/home" className={`ms-tab ${isActive('/home') ? 'active' : ''}`}>
          <i className="ci-home" />
          <span>Shop</span>
        </NavLink>
        <NavLink to="/meine-auftraege" className={`ms-tab ${isActive('/meine-auftraege') || isActive('/auftraege') ? 'active' : ''}`}>
          <i className="ci-package" />
          <span>Aufträge</span>
        </NavLink>
        <NavLink to="/profil" className={`ms-tab ${isActive('/profil') ? 'active' : ''}`}>
          <i className="ci-user" />
          <span>Profil</span>
        </NavLink>
      </nav>

      {/* Cart Bottom Sheet */}
      <MobileCart
        show={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        articles={articles}
        kundeRegion={kundeRegion}
        onQuantityChange={handleQuantityChange}
        onEinheitChange={handleEinheitChange}
        onRemove={handleRemoveFromCart}
        onSubmit={handleSubmit}
        submitLoading={submitLoading}
      />
    </div>
  );
};

export default MobileLayout;
