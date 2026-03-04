import { ArtikelPositionResource, ArtikelResource } from '@/Resources';

export const unitFromModus = (modus?: string) =>
  modus === 'STÜCK' ? 'stück' : modus === 'KARTON' ? 'karton' : 'kg';

export const formatCurrency = (val: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const fmtEUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function berechneGesamtgewicht(
  item: ArtikelPositionResource,
  artikel: ArtikelResource | undefined
): number {
  if (!item.menge || !item.einheit || !artikel) return 0;
  switch (item.einheit) {
    case 'kg': return item.menge;
    case 'stück': return artikel.gewichtProStueck ? artikel.gewichtProStueck * item.menge : 0;
    case 'kiste': return artikel.gewichtProKiste ? artikel.gewichtProKiste * item.menge : 0;
    case 'karton': return artikel.gewichtProKarton ? artikel.gewichtProKarton * item.menge : 0;
    default: return 0;
  }
}

export function berechneGesamtpreis(
  item: ArtikelPositionResource,
  artikel: ArtikelResource | undefined
): number {
  const gewicht = berechneGesamtgewicht(item, artikel);
  return gewicht * (item.einzelpreis ?? 0);
}

export function mergeCartWithOrder(
  cart: ArtikelPositionResource[],
  orderPositions: ArtikelPositionResource[]
): ArtikelPositionResource[] {
  const map = new Map<string, ArtikelPositionResource>();
  const keyOf = (p: ArtikelPositionResource) =>
    `${p.artikel}|${p.einheit}|${p.zerlegung ? '1' : '0'}|${p.vakuum ? '1' : '0'}`;
  for (const p of [...cart, ...orderPositions]) {
    const k = keyOf(p);
    const ex = map.get(k);
    map.set(k, ex ? { ...ex, menge: (ex.menge || 0) + (p.menge || 0) } : p);
  }
  return Array.from(map.values());
}
