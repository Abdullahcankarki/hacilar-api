import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Overpass: See https://wiki.openstreetmap.org/wiki/Overpass_API

// --- Types

type VehicleGps = {
  time: string;
  latitude: number;
  longitude: number;
  headingDegrees?: number;
  speedMilesPerHour?: number;
  reverseGeo?: { formattedLocation?: string };
};

type VehicleStatReading = { time: string; value: number } | null;

export type CustomerStop = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  windowStart?: string; // ISO
  windowEnd?: string;   // ISO
  delivered?: boolean;
};

export type SamsaraFleetBoardProps = {
  /** Today's customer stops you want to visualize. Provide geo-coordinates (lat/lng). */
  customers?: CustomerStop[];
  /** Map center fallback (default Berlin). */
  initialCenter?: LatLngExpression;
  /** Poll interval in ms for live data (default 15s). */
  pollMs?: number;
  /** How many hours back to show breadcrumb trail for the selected vehicle (default 2h). */
  trailHours?: number;
  /** Optional: restrict to these Samsara vehicle IDs. */
  vehicleIds?: string[];
};

// --- Helpers

// Prefer env override; fall back to dev backend on :3355; safely join /api/samsara
const API_SERVER = (process.env.REACT_APP_API_SERVER_URL || 'http://localhost:3355');
const API_BASE = `${API_SERVER.replace(/\/+$/, '')}/api/samsara`;
const headers = () => ({});

// Utility to robustly parse JSON and surface HTML/error bodies nicely
async function jsonOrThrow(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const body = await res.text();
    // If HTML was returned (e.g., index.html or error page), throw a clearer error
    if (body.trim().startsWith('<')) {
      throw new Error(`${res.status} ${res.statusText} – Erwartete JSON-Antwort, bekam HTML (prüfe API-URL/Proxy).`);
    }
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  if (!ct.includes('application/json')) {
    const body = await res.text();
    if (body.trim().startsWith('<')) {
      throw new Error(`Erwartete JSON-Antwort, bekam HTML (vermutlich 404/Proxy).`);
    }
    // Try to parse nonetheless
    try { return JSON.parse(body); } catch {
      throw new Error('Antwort ist kein JSON. Inhalt: ' + body.slice(0, 200));
    }
  }
  return res.json();
}

// Normalize a percentage value that may come as percent (0–100) or milli-percent (0–100000)
function toPercent(value?: number | null): number | null {
  if (value == null) return null;
  // If it's clearly milli-percent, convert to % with one decimal: 50000 -> 50.0
  if (value > 1000) return Math.round(value / 100) / 10; // divide by 1000 and keep 1 decimal
  // Otherwise treat as percent and keep 1 decimal precision
  return Math.round(value * 10) / 10;
}

function milliCtoC(milli?: number | null): number | null {
  if (milli == null) return null;
  return Math.round(milli) / 1000;
}

function kmhFromMph(mph?: number): number | null {
  if (mph == null) return null;
  return Math.round(mph * 1.60934);
}

function minutesUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const now = new Date();
  const eta = new Date(iso);
  const diffMs = eta.getTime() - now.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

// Beautiful-but-lightweight utility for Bootstrap progress colors
function progressVariant(value: number | null, warn = 30, danger = 15): 'success' | 'warning' | 'danger' {
  if (value == null) return 'warning';
  if (value <= danger) return 'danger';
  if (value <= warn) return 'warning';
  return 'success';
}

// Create a crispy vehicle dot icon that doesn’t rely on bundled images
function vehicleIcon(color: string, selected = false, variant: 'moving' | 'idle' | 'stopped' = 'stopped') {
  return L.divIcon({
    className: `vehicle-dot ${variant}`,
    html: `
      <div style="
        width:${selected ? 22 : 16}px; height:${selected ? 22 : 16}px; 
        background:${color}; border-radius:50%; border:2px solid #fff
      "></div>
    `,
    iconSize: [selected ? 22 : 16, selected ? 22 : 16],
    iconAnchor: [selected ? 11 : 8, selected ? 11 : 8],
  });
}

function customerIcon(complete = false) {
  const color = complete ? '#22c55e' : '#f43f5e'; // grün für geliefert, rot für ausstehend
  return L.divIcon({
    className: 'customer-pin',
    html: `
      <div style="position:relative;width:26px;height:26px;">
        <div style="position:absolute;left:50%;top:0;transform:translate(-50%,0);width:16px;height:16px;background:${color};border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>
        <div style="position:absolute;left:50%;top:16px;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${color};filter:drop-shadow(0 2px 2px rgba(0,0,0,.2))"></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

// --- Component

const FitBounds: React.FC<{ points: LatLngExpression[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const b = L.latLngBounds(points as any);
    map.fitBounds(b.pad(0.2));
  }, [points, map]);
  return null;
};


const Skeleton: React.FC<{ height?: number }> = ({ height = 180 }) => (
  <div className="placeholder-glow">
    <div className="placeholder w-100 rounded" style={{ height }} />
  </div>
);


// Flies to the selected vehicle **only when the selection changes** (not on every GPS poll)
const FollowSelected: React.FC<{ vehicle: any | null; enabled: boolean; zoom?: number }> = ({ vehicle, enabled, zoom = 14 }) => {
  const map = useMap();
  const lastVehicleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (!vehicle?.gps?.latitude || !vehicle?.gps?.longitude) return;
    if (vehicle.id !== lastVehicleIdRef.current) {
      lastVehicleIdRef.current = vehicle.id;
      map.flyTo([vehicle.gps.latitude, vehicle.gps.longitude] as any, zoom, { duration: 0.8 });
    }
  }, [vehicle?.id, enabled, zoom, map, vehicle?.gps?.latitude, vehicle?.gps?.longitude]);
  return null;
};

const ZoomWatcher: React.FC<{ onZoom: (z: number) => void }> = ({ onZoom }) => {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoom(map.getZoom());
    map.on('zoomend', handler);
    handler(); // initialize once
    return () => { map.off('zoomend', handler); };
  }, [map, onZoom]);
  return null;
};

// InteractionWatcher: disables auto-fit when user interacts (zoom/drag)
const InteractionWatcher: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const map = useMap();
  useEffect(() => {
    const handler = () => onInteract();
    map.on('zoomstart', handler);
    map.on('dragstart', handler);
    return () => {
      map.off('zoomstart', handler);
      map.off('dragstart', handler);
    };
  }, [map, onInteract]);
  return null;
};

export default function SamsaraFleetBoard({
  customers = [],
  initialCenter = [52.52, 13.405], // Berlin
  pollMs = 15000,
  trailHours = 2,
  vehicleIds,
}: SamsaraFleetBoardProps) {
  const [autoFit, setAutoFit] = useState(true);
  const [followSelected, setFollowSelected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [trails, setTrails] = useState<Record<string, [number, number][]>>({});
  const [etas, setEtas] = useState<Record<string, { nextStopName?: string; eta?: string }>>({});
  // UI controls removed: always cluster, always show highways
  const isClustering = true;
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<Record<string, { moving: boolean; idleMin: number }>>({});
  const idleSinceRef = useRef<Record<string, number>>({});
  const hasAutoSelectedRef = useRef(false);
  const userSelectedRef = useRef(false);
  const IDLE_THRESHOLD_MIN = 7; // länger stehende Fahrzeuge ab 7 Minuten
  // Disable autoFit when a vehicle is selected (to avoid re-fitting after flyTo)
  useEffect(() => {
    if (selectedVehicleId) {
      setAutoFit(false);
      setFollowSelected(true); // follow only once on new selection
    }
  }, [selectedVehicleId]);

  // Beim ersten Mount: letzte Auswahl aus localStorage holen
  useEffect(() => {
    const saved = localStorage.getItem('sfb_selectedVehicleId');
    if (saved) {
      setSelectedVehicleId(saved);
      userSelectedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bei jeder Änderung: Auswahl speichern
  useEffect(() => {
    if (selectedVehicleId) localStorage.setItem('sfb_selectedVehicleId', selectedVehicleId);
  }, [selectedVehicleId]);



  const pointsForBounds: LatLngExpression[] = useMemo(() => {
    const pts: LatLngExpression[] = [];
    vehicles.forEach(v => {
      if (v.gps?.latitude && v.gps?.longitude) pts.push([v.gps.latitude, v.gps.longitude]);
    });
    customers.forEach(c => pts.push([c.lat, c.lng]));
    return pts;
  }, [vehicles, customers]);

  // Poll current snapshot (GPS + Fuel + DEF + temp as decoration)
  async function fetchSnapshot() {
    try {
      setStatsError(null);
      const params = new URLSearchParams();
      params.set('types', 'gps,fuelPercents,defLevelMilliPercent');
      params.set('decorations', 'ambientAirTemperatureMilliC');
      if (vehicleIds?.length) params.set('vehicleIds', vehicleIds.join(','));

      const res = await fetch(`${API_BASE}/vehicles/stats?${params.toString()}`);
      const json = await jsonOrThrow(res);
      const data = Array.isArray(json?.data) ? json.data : [];

      const normalized = data.map((v: any) => {
        const gps: VehicleGps | null = v.gps || null;
        const fuel: VehicleStatReading = v.fuelPercents || v.fuelPercent || null;
        const def: VehicleStatReading = v.defLevelMilliPercent || v.defLevelPercent || null;
        const ambient = v?.decorations?.ambientAirTemperatureMilliC || v.ambientAirTemperatureMilliC || null;
        return {
          id: v.id,
          name: v.name,
          gps,
          fuelPct: typeof fuel?.value === 'number' ? toPercent(fuel.value) : null,
          defPct: typeof def?.value === 'number' ? toPercent(def.value) : null,
          ambientC: typeof ambient?.value === 'number' ? ambient.value : null,
        };
      });
      const normalizedFiltered = normalized.filter((x: any) => (x?.name || '').toLowerCase() !== 'tacho reader');

      if (!mountedRef.current) return;
      setVehicles(normalizedFiltered);

      // Compute moving/idle duration per vehicle
      const nowTs = Date.now();
      const newStatus: Record<string, { moving: boolean; idleMin: number }> = {};
      for (const v of normalizedFiltered) {
        const mph = v?.gps?.speedMilesPerHour ?? 0;
        const moving = (mph || 0) > 1;
        if (moving) {
          idleSinceRef.current[v.id] = 0;
        } else {
          if (!idleSinceRef.current[v.id]) idleSinceRef.current[v.id] = nowTs;
        }
        const idleMin = moving ? 0 : (idleSinceRef.current[v.id] ? Math.floor((nowTs - idleSinceRef.current[v.id]) / 60000) : 0);
        newStatus[v.id] = { moving, idleMin };
      }
      setStatus(newStatus);

      setLoading(false);

      // On first load, preselect first vehicle with GPS
      // On first load only, never override user choice
      if (!hasAutoSelectedRef.current && !userSelectedRef.current && !selectedVehicleId) {
        const firstWithGps = normalizedFiltered.find((v: any) => v.gps?.latitude && v.gps?.longitude);
        if (firstWithGps) {
          setSelectedVehicleId(firstWithGps.id);
          hasAutoSelectedRef.current = true;
        }
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setStatsError(e?.message ?? 'Fehler beim Laden der Telemetriedaten');
      setLoading(false);
    }
  }

  // Fetch breadcrumb trail (historical locations) for selected vehicle
  async function fetchTrail(vehicleId: string) {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - trailHours * 3600 * 1000);
      const params = new URLSearchParams();
      params.set('startTime', start.toISOString());
      params.set('endTime', end.toISOString());
      params.set('vehicleIds', vehicleId);

      const res = await fetch(`${API_BASE}/vehicles/locations/history?${params.toString()}`);
      const json = await jsonOrThrow(res);
      const row = (json?.data || []).find((d: any) => d.id === vehicleId);
      const pts: [number, number][] = (row?.locations || []).map((p: any) => [p.latitude, p.longitude]);
      if (!mountedRef.current) return;
      setTrails(prev => ({ ...prev, [vehicleId]: pts }));
    } catch (e) {
      // non-fatal
      console.warn('Trail fetch failed', e);
    }
  }

  // Fetch active route ETA for each vehicle (best-effort)
  async function fetchEtas(vehicleList: any[]) {
    try {
      setRouteError(null);
      // We do per-vehicle requests to keep the logic simple and robust
      const newEtas: Record<string, { nextStopName?: string; eta?: string }> = {};
      const newStops: Record<string, any[]> = {};
      for (const v of vehicleList) {
        try {
          const params = new URLSearchParams();
          params.set('vehicleIds', v.id);
          params.set('limit', '10');
          params.set('states', 'en route,scheduled');

          const res = await fetch(`${API_BASE}/routes?${params.toString()}`);
          const json = await jsonOrThrow(res);
          const routes: any[] = json?.data || [];
          const route = routes.find(r => r?.vehicle?.id === v.id);
          let nextStopName: string | undefined;
          let eta: string | undefined;
          if (route?.stops?.length) {
            // find first en route stop, else next scheduled
            const enroute = route.stops.find((s: any) => s.state === 'en route' && s.eta);
            const scheduled = route.stops.find((s: any) => s.state === 'scheduled' && s.eta);
            const target = enroute || scheduled || null;
            if (target) {
              nextStopName = target?.name || target?.address?.name;
              eta = target?.eta || target?.scheduledArrivalTime;
            }
            // cache a short list
            const upcoming = route.stops.filter((s: any) => ['en route', 'scheduled'].includes(s.state));
            newStops[v.id] = upcoming.slice(0, 5);
          }
          newEtas[v.id] = { nextStopName, eta };
        } catch (inner) {
          // ignore this vehicle’s ETA
        }
      }
      if (!mountedRef.current) return;
      setEtas(newEtas);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setRouteError(e?.message ?? 'Fehler beim Laden der Route/ETA');
    }
  }

  // Polling
  useEffect(() => {
    mountedRef.current = true;
    fetchSnapshot();
    const t = setInterval(fetchSnapshot, pollMs);
    return () => { mountedRef.current = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs, vehicleIds?.join(',')]);

  // Update trails when selection changes
  useEffect(() => {
    if (selectedVehicleId) fetchTrail(selectedVehicleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleId, trailHours]);

  // Recompute ETAs every poll cycle, after stats load
  useEffect(() => {
    if (vehicles.length) fetchEtas(vehicles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles.map(v => v.id).join(',')]);

  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId) || null, [vehicles, selectedVehicleId]);

  const vehiclesSorted = useMemo(() => {
    return [...vehicles].sort((a: any, b: any) => {
      const an = (a.name || a.id || '').toString().toLocaleLowerCase('de');
      const bn = (b.name || b.id || '').toString().toLocaleLowerCase('de');
      return an.localeCompare(bn, 'de');
    });
  }, [vehicles]);

  const theme = {
    // keep Cartzilla/Bootstrap vibe — neutral with a hint of brand
    accent: '#0d6efd',
    accentSoft: 'rgba(13,110,253,.08)',
    ok: '#22c55e',
    warn: '#f59e0b',
    danger: '#ef4444',
  };

  // KPIs for tiles
  const vehicleCount = vehicles.length;
  const movingCount = useMemo(() => vehicles.filter(v => (v.gps?.speedMilesPerHour ?? 0) > 1).length, [vehicles]);
  const avgFuel = useMemo(() => {
    const vals = vehicles.map(v => v.fuelPct).filter((x: number | null) => typeof x === 'number') as number[];
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [vehicles]);


  const [mapZoom, setMapZoom] = useState(11);
  return (
    <div className="container-fluid py-3">
      <style>{`.progress.progress-thin{height:6px}
.leaflet-tooltip.vehicle-label{background:transparent;border:0;box-shadow:none;color:#495057;font-size:11px;padding:0 2px}
.leaflet-tooltip.vehicle-label:before{display:none}
.badge-truncate{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`}</style>
      {/* Header */}
      <div className="sticky-top bg-white border-bottom" style={{ top: 0, zIndex: 900 }}>
        <div className="container-fluid d-flex align-items-center py-2 gap-3">
          <div className="d-flex align-items-center gap-2">
            <i className="ci-navigation fs-4 text-primary" />
            <h5 className="mb-0">Flottenboard</h5>
            <span className="badge bg-light text-dark border">{new Date().toLocaleTimeString('de-DE')} aktualisiert</span>
          </div>
          <div className="ms-auto d-flex align-items-center flex-wrap gap-2"></div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="container-fluid mt-3">
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <div className="card border-0 shadow-sm">
              <div className="card-body d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small">Fahrzeuge gesamt</div>
                  <div className="fs-4 fw-semibold">{vehicleCount}</div>
                </div>
                <i className="ci-truck fs-2 text-primary"></i>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card border-0 shadow-sm">
              <div className="card-body d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small">In Bewegung</div>
                  <div className="fs-4 fw-semibold">{movingCount}</div>
                </div>
                <i className="ci-speedometer fs-2 text-primary"></i>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card border-0 shadow-sm">
              <div className="card-body d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small">Ø Kraftstoff</div>
                  <div className="fs-4 fw-semibold">{avgFuel != null ? `${avgFuel}%` : '–'}</div>
                </div>
                <i className="ci-droplet fs-2 text-primary"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="row g-3 mt-1">

        {/* Right rail: vehicle list */}
        <div className="col-12 col-xxl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white" style={{ borderBottom: '1px solid #eee' }}>
              <strong>Fahrzeuge</strong>
            </div>
            <div className="card-body p-0 d-flex flex-column" style={{ maxHeight: 560 }}>
              {/* Selected vehicle quick panel */}
              {selectedVehicle && (
                <div className="border-bottom p-3">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                      <span className="me-1" dangerouslySetInnerHTML={{ __html: vehicleIcon(theme.accent, true).options.html as string }} />
                      <div className="fw-semibold">{selectedVehicle.name || selectedVehicle.id}</div>
                    </div>
                    {selectedVehicle.gps?.speedMilesPerHour != null && (
                      <span className="badge bg-primary-subtle text-primary border">{kmhFromMph(selectedVehicle.gps.speedMilesPerHour)} km/h</span>
                    )}
                  </div>
                  <div className="mt-2 small text-muted text-truncate" style={{ maxWidth: '100%' }}>
                    {selectedVehicle.gps?.reverseGeo?.formattedLocation || '–'}
                  </div>
                  <div className="row g-2 mt-2">
                    <div className="col-6">
                      <div className="d-flex justify-content-between small mb-1"><span>Kraftstoff</span><span className="fw-semibold">{selectedVehicle.fuelPct != null ? Math.round(selectedVehicle.fuelPct) : '–'}%</span></div>
                      <div className="progress progress-thin"><div className={`progress-bar bg-${progressVariant(selectedVehicle.fuelPct != null ? Math.round(selectedVehicle.fuelPct) : null)}`} style={{ width: `${selectedVehicle.fuelPct != null ? Math.round(selectedVehicle.fuelPct) : 0}%` }} /></div>
                    </div>
                    <div className="col-6">
                      <div className="d-flex justify-content-between small mb-1"><span>AdBlue</span><span className="fw-semibold">{selectedVehicle.defPct != null ? Math.round(selectedVehicle.defPct) : '–'}%</span></div>
                      <div className="progress progress-thin"><div className={`progress-bar bg-${progressVariant(selectedVehicle.defPct ?? null)}`} style={{ width: `${selectedVehicle.defPct != null ? Math.round(selectedVehicle.defPct) : 0}%` }} /></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Vehicle list */}
              <div className="flex-grow-1 overflow-auto p-2">
                <div className="list-group list-group-flush">
                  {loading && (
                    <div className="p-3"><Skeleton height={60} /></div>
                  )}
                  {!loading && vehicles.length === 0 && (
                    <div className="p-3 text-muted">Keine Fahrzeuge gefunden.</div>
                  )}
                  {!loading && vehiclesSorted.map(v => {
                    const isSelected = v.id === selectedVehicleId;
                    const fuelPct = v.fuelPct != null ? Math.round(v.fuelPct) : null;
                    const defPct = v.defPct != null ? Math.round(v.defPct) : null;
                    const temp = v.ambientC != null ? milliCtoC(v.ambientC) : null;
                    const etaInfo = etas[v.id];
                    const mins = minutesUntil(etaInfo?.eta);
                    const st = status[v.id];
                    const longIdle = st && !st.moving && st.idleMin >= IDLE_THRESHOLD_MIN;
                    const speed = v.gps?.speedMilesPerHour != null ? kmhFromMph(v.gps.speedMilesPerHour) : null;
                    return (
                      <button key={v.id} className="list-group-item list-group-item-action py-3" onClick={() => { userSelectedRef.current = true; setSelectedVehicleId(v.id); }}>
                        <div className="d-flex align-items-start justify-content-between gap-3">
                          <div className="d-flex align-items-center gap-2">
                            <span className="me-1" dangerouslySetInnerHTML={{ __html: vehicleIcon(isSelected ? theme.accent : '#6c757d', isSelected).options.html as string }} />
                            <div>
                              <div className="fw-semibold mb-1">{v.name || v.id}</div>
                              <div className="d-flex flex-wrap align-items-center gap-2 small">
                                {/* Status badge */}
                                {st?.moving && <span className="badge bg-success">Fährt</span>}
                                {!st?.moving && longIdle && <span className="badge bg-warning text-dark">Steht · {st.idleMin} min</span>}
                                {!st?.moving && !longIdle && <span className="badge bg-secondary">Steht</span>}

                                {/* Speed badge */}
                                {speed != null && <span className="badge bg-light text-dark border">🚚 {speed} km/h</span>}

                                {/* Other badges */}
                                {mins != null && <span className="badge bg-primary-subtle text-primary border">ETA {mins} min</span>}
                                {temp != null && <span className="badge bg-light text-dark border">🌡️ {temp}°C</span>}
                                {v.gps?.reverseGeo?.formattedLocation && (
                                  <span className="badge bg-light text-dark border badge-truncate">📍 {v.gps.reverseGeo.formattedLocation}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ minWidth: 160, width: 180 }}>
                            <div className="d-flex justify-content-between small"><span className="text-muted">⛽</span><span className="fw-semibold">{fuelPct ?? '–'}%</span></div>
                            <div className="progress progress-thin mb-1"><div className={`progress-bar bg-${progressVariant(fuelPct)}`} style={{ width: `${fuelPct ?? 0}%` }} /></div>
                            <div className="d-flex justify-content-between small"><span className="text-muted">🧪</span><span className="fw-semibold">{defPct ?? '–'}%</span></div>
                            <div className="progress progress-thin"><div className={`progress-bar bg-${progressVariant(defPct)}`} style={{ width: `${defPct ?? 0}%` }} /></div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Map card */}
        <div className="col-12 col-xxl-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white d-flex align-items-center gap-2" style={{ borderBottom: '1px solid #eee' }}>
              <strong>Live-Karte</strong>
              <span className="text-muted small">Fahrzeuge, Route & Kunden (heute)</span>
            </div>
            <div className="card-body p-0" style={{ height: 560 }}>
              {loading ? (
                <Skeleton height={560} />
              ) : (
                <MapContainer center={initialCenter} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                  {/* Minimal basemap: streets only, no POIs/parks (Carto Light No Labels + label overlay) */}
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors & CARTO'
                    url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                  />
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors & CARTO'
                    url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                    zIndex={1000}
                  />
                  <ZoomWatcher onZoom={(z) => setMapZoom(z)} />
                  <InteractionWatcher onInteract={() => { setAutoFit(false); setFollowSelected(false); }} />
                  {/* Fokus auf ausgewähltes Fahrzeug */}
                  {selectedVehicle && (
                    <FollowSelected vehicle={selectedVehicle} enabled={followSelected} />
                  )}

                  {/* Fit to all points */}
                  {!!pointsForBounds.length && autoFit && <FitBounds points={pointsForBounds} />}

                  {/* Vehicle markers */}
                  {vehicles.map(v => {
                    const lat = v.gps?.latitude;
                    const lng = v.gps?.longitude;
                    const st = status[v.id];
                    if (!lat || !lng) return null;
                    if (!st?.moving && mapZoom < 10) return null; // hide standing vehicles until zoomed in
                    const fuelPct = v.fuelPct != null ? Math.round(v.fuelPct) : null;
                    const defPct = v.defPct;
                    const temp = v.ambientC != null ? milliCtoC(v.ambientC) : null;
                    const etaInfo = etas[v.id];
                    const mins = minutesUntil(etaInfo?.eta);
                    const selected = v.id === selectedVehicleId;
                    const longIdle = st && !st.moving && st.idleMin >= IDLE_THRESHOLD_MIN;
                    const variant: 'moving' | 'idle' | 'stopped' = st?.moving ? 'moving' : (longIdle ? 'idle' : 'stopped');
                    const color = selected ? theme.accent : (st?.moving ? theme.accent : (longIdle ? theme.warn : '#6c757d'));
                    return (
                      <Marker key={v.id} position={[lat, lng]} icon={vehicleIcon(color, selected, variant)} eventHandlers={{ click: () => { userSelectedRef.current = true; setSelectedVehicleId(v.id); } }}>
                        <Tooltip direction="top" offset={[0, -12]} opacity={0.9} permanent className="vehicle-label">
                          {v.name || v.id}
                        </Tooltip>
                        <Popup>
                          <div className="d-flex flex-column gap-1" style={{ minWidth: 220 }}>
                            <div className="fw-semibold">{v.name || v.id}</div>
                            <div className="text-muted small">{v.gps?.reverseGeo?.formattedLocation || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</div>
                            <div className="small d-flex flex-wrap gap-2 mt-1">
                              <span className={`badge bg-${progressVariant(fuelPct)}-subtle text-${progressVariant(fuelPct)} border`}>⛽ Fuel {fuelPct ?? '–'}%</span>
                              <span className={`badge bg-${progressVariant(defPct ?? null)}-subtle text-${progressVariant(defPct ?? null)} border`}>🧪 AdBlue {defPct != null ? Math.round(defPct) : '–'}%</span>
                              <span className="badge bg-light text-dark border">🌡️ {temp ?? '–'}°C</span>
                              {mins != null && <span className="badge bg-primary">ETA {mins} min</span>}
                            </div>
                            {etaInfo?.nextStopName && <div className="small"><span className="text-muted">Nächster Stopp:</span> {etaInfo.nextStopName}</div>}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {/* Selected vehicle trail */}
                  {selectedVehicleId && trails[selectedVehicleId] && trails[selectedVehicleId].length > 1 && (
                    <Polyline positions={trails[selectedVehicleId]} weight={4} opacity={0.7} />
                  )}


                  {/* Customer markers with clustering (always clustered) */}
                  <MarkerClusterGroup chunkedLoading>
                    {customers.map(c => {
                      if (mapZoom < 13) return null; // hide stops until zoomed in
                      return (
                        <Marker key={c.id} position={[c.lat, c.lng]} icon={customerIcon(!!c.delivered)}>
                          <Popup>
                            <div className="d-flex flex-column gap-1" style={{ minWidth: 240 }}>
                              <div className="fw-semibold">{c.name}</div>
                              {c.address && <div className="text-muted small">{c.address}</div>}
                              {(c.windowStart || c.windowEnd) && (
                                <div className="small"><span className="text-muted">Zeitfenster:</span> {c.windowStart ? new Date(c.windowStart).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–'} – {c.windowEnd ? new Date(c.windowEnd).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–'}</div>
                              )}
                              {typeof c.delivered === 'boolean' && (
                                <span className={`badge ${c.delivered ? 'bg-success' : 'bg-warning text-dark'}`}>{c.delivered ? 'Geliefert' : 'Ausstehend'}</span>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MarkerClusterGroup>
                </MapContainer>
              )}
            </div>
            {(statsError || routeError) && (
              <div className="alert alert-warning border-0 rounded-0 mb-0">
                <div className="d-flex align-items-center gap-2">
                  <i className="ci-alert-circle" />
                  <div>
                    <strong>Hinweis:</strong> {statsError || routeError}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="d-flex align-items-center gap-3 mt-3 text-muted small border rounded px-3 py-2 bg-white">
        <div className="d-flex align-items-center gap-1"><span dangerouslySetInnerHTML={{ __html: vehicleIcon('#0d6efd', true).options.html as string }} /> <span>Fahrzeug</span></div>
        <div className="d-flex align-items-center gap-1"><span dangerouslySetInnerHTML={{ __html: customerIcon(false).options.html as string }} /> <span>Kunde</span></div>
        <div className="d-flex align-items-center gap-1"><span className="rounded-pill border" style={{ width: 22, height: 6, background: '#6c757d' }} /> <span>Strecke {trailHours}h</span></div>
      </div>
    </div>
  );
}
