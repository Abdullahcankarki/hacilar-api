import React, { useEffect, useMemo, useState } from 'react';
import SamsaraFleetBoard from './SamsaraFleetBoard';
import { getCustomerStopsByDate } from '../backend/api';

function todayYmd(tz: string = 'Europe/Berlin'): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('de-DE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [{ value: day }, , { value: month }, , { value: year }] = fmt.formatToParts(now) as any;
  return `${year}-${month}-${day}`;
}

export default function FleetPage() {
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; address?: string; lat: number; lng: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute a buffered window around today so backends with pagination don’t miss today
  const ymd = useMemo(() => todayYmd('Europe/Berlin'), []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Direkt alle Kundenstopps für heute vom Backend laden (inkl. lat/lng, sofern verfügbar)
        const items = await getCustomerStopsByDate({ date: ymd });

        const markers = (items || [])
          .map((st) => ({
            id: String(st.kundeId),
            name: st.kundeName || `Kunde ${st.kundeId}`,
            address: st.kundeAdress,
            lat: Number(st.lat),
            lng: Number(st.lng),
          }))
          .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

        // Deduplicate: if two or more stops have the same coordinates, keep only one
        const seen = new Set<string>();
        const unique: typeof markers = [] as any;
        for (const m of markers) {
          const key = `${m.lat.toFixed(6)},${m.lng.toFixed(6)}`; // ~10 cm tolerance
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(m);
        }

        setCustomers(unique);
      } catch (e: any) {
        setError(e?.message || 'Fehler beim Laden');
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [ymd]);

  return (
    <SamsaraFleetBoard
      customers={customers}
      pollMs={15000}
      trailHours={2}
    />
  );
}