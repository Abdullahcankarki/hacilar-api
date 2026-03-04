import { useState, useEffect } from 'react';
import { ArtikelPositionResource } from '@/Resources';

export function usePersistedCart(key = 'warenkorb') {
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
