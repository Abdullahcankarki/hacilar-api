import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import cx from 'classnames';
import { api } from '@/backend/api';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Chart, Line, Bar, Pie } from 'react-chartjs-2';

// === Chart.js (react-chartjs-2) ===
// Hinweis: Stelle sicher, dass folgende Pakete installiert sind:
// npm i chart.js react-chartjs-2

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const numberDE = (v: number, fractionDigits?: number) =>
    (typeof v === 'number' ? v : Number(v || 0)).toLocaleString(
        'de-DE',
        fractionDigits != null ? { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits } : undefined
    );

// dezente, bootstrap-nahe Palette
const palette = {
    primary: 'rgba(13,110,253,1)',
    priamaryFill: 'rgba(13,110,253,0.15)',
    success: 'rgba(25,135,84,1)',
    successFill: 'rgba(25,135,84,0.15)',
    warning: 'rgba(255,193,7,1)',
    warningFill: 'rgba(255,193,7,0.18)',
    grid: 'rgba(0,0,0,0.08)',
    ticks: 'rgba(0,0,0,0.6)',
};

// Timeline (Menge) – Line
const buildTimelineChart = (timeline: any[], granularity: 'day' | 'week' | 'month') => {
    const labels = (timeline || []).map(t =>
        granularity === 'week' ? formatWeekLabel(t.date) : new Date(t.date).toLocaleDateString('de-DE')
    );
    const values = (timeline || []).map(t => Number(t.menge) || 0);
    return {
        data: {
            labels,
            datasets: [{
                label: 'Menge',
                data: values,
                borderColor: palette.primary,
                backgroundColor: palette.priamaryFill,
                borderWidth: 2,
                fill: 'start',
                tension: 0.35,
                pointRadius: 2.5,
                pointHoverRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${numberDE(ctx.parsed.y)} kg` } }
            },
            scales: {
                x: { ticks: { color: palette.ticks, maxRotation: 0, autoSkip: true }, grid: { color: palette.grid, drawBorder: false } },
                y: { ticks: { color: palette.ticks, callback: (v: any) => numberDE(Number(v)) }, grid: { color: palette.grid, drawBorder: false } }
            },
            elements: { line: { cubicInterpolationMode: 'monotone' } }
        } as const
    };
};

// Top-Kunden (Menge) – Horizontal Bar
const buildTopCustomersChart = (byCustomer: any[]) => {
    const rows = (byCustomer || []).slice(0, 10);
    const labels = rows.map(r => r?.name || '—');
    const values = rows.map(r => Number(r?.menge) || 0);
    return {
        data: {
            labels,
            datasets: [{
                label: 'Menge',
                data: values,
                backgroundColor: palette.successFill,
                borderColor: palette.success,
                borderWidth: 1.5,
                borderRadius: 6,
            }]
        },
        options: {
            indexAxis: 'y' as const,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${numberDE(ctx.parsed.x)} kg` } }
            },
            scales: {
                x: { ticks: { color: palette.ticks, callback: (v: any) => numberDE(Number(v)) }, grid: { color: palette.grid, drawBorder: false } },
                y: { ticks: { color: palette.ticks }, grid: { display: false, drawBorder: false } }
            }
        } as const
    };
};

// Top-Kunden – Pie (Mengenanteile)
const buildTopCustomersPieChart = (byCustomer: any[]) => {
  const rows = (byCustomer || []).slice(0, 8);
  const labels = rows.map(r => r?.name || '—');
  const values = rows.map(r => Number(r?.menge) || 0);
  // automatische, harmonische Farben
  const base = [
    'rgba(13,110,253,0.75)',  // secondary
    'rgba(25,135,84,0.75)',   // success
    'rgba(255,193,7,0.75)',   // warning
    'rgba(220,53,69,0.75)',   // danger
    'rgba(111,66,193,0.75)',  // purple
    'rgba(32,201,151,0.75)',  // teal
    'rgba(102,16,242,0.75)',  // indigo
    'rgba(255,133,27,0.75)',  // orange
  ];
  const borders = base.map(c => c.replace('0.75', '1'));
  return {
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: base,
        borderColor: borders,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' as const, labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed as number;
              const total = values.reduce((a,b)=>a+b,0) || 1;
              const pct = Math.round((v/total)*100);
              return ` ${numberDE(v)} kg (${pct}%)`;
            }
          }
        }
      }
    } as const
  };
};

// Preis-Histogramm – Bar
const buildPriceHistogramChart = (buckets: any[]) => {
    const labels = (buckets || []).map(b => `${(Number(b?.min) || 0).toFixed(2)}–${(Number(b?.max) || 0).toFixed(2)} €`);
    const values = (buckets || []).map(b => Number(b?.count) || 0);
    return {
        data: {
            labels,
            datasets: [{
                label: 'Anzahl',
                data: values,
                backgroundColor: palette.warningFill,
                borderColor: palette.warning,
                borderWidth: 1.5,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${numberDE(ctx.parsed.y)} Vorgänge` } }
            },
            scales: {
                x: { ticks: { color: palette.ticks, maxRotation: 0, autoSkip: true }, grid: { display: false, drawBorder: false } },
                y: { ticks: { color: palette.ticks, callback: (v: any) => numberDE(Number(v)) }, grid: { color: palette.grid, drawBorder: false } }
            }
        } as const
    };
};

// Preisverteilung (exakt, ohne Buckets) – Bar
const buildPriceExactChart = (rows: any[]) => {
  const labels = (rows || []).map(r => (Number(r.preis) || 0).toFixed(2) + ' €');
  const values = (rows || []).map(r => Number(r.count) || 0);
  return {
    data: {
      labels,
      datasets: [{
        label: 'Anzahl',
        data: values,
        backgroundColor: palette.warningFill,
        borderColor: palette.warning,
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${numberDE(ctx.parsed.y)} Vorgänge`
          }
        }
      },
      scales: {
        x: { ticks: { color: palette.ticks, maxRotation: 0, autoSkip: true }, grid: { display: false, drawBorder: false } },
        y: { ticks: { color: palette.ticks, callback: (v:any)=>numberDE(Number(v)) }, grid: { color: palette.grid, drawBorder: false } }
      }
    } as const
  };
};

// Preis × Zeitraum (exakt) – Stacked Bar (Top N Preise als eigene Serien)
const buildPriceExactByDateChart = (rows: any[], granularity: 'day'|'week'|'month', topN = 6) => {
  // Build period labels in order
  const periodsOrdered = Array.from(new Set((rows || []).map(r => new Date(r.date).toISOString()))).sort();
  const labels = periodsOrdered.map(d => granularity === 'week' ? formatWeekLabel(d) : new Date(d).toLocaleDateString('de-DE'));

  // Aggregate total count per price
  const totalByPrice = new Map<number, number>();
  (rows || []).forEach(r => {
    const p = Number(r.preis) || 0;
    totalByPrice.set(p, (totalByPrice.get(p) || 0) + (Number(r.count) || 0));
  });
  // Top N prices
  const topPrices = Array.from(totalByPrice.entries())
    .sort((a,b) => b[1] - a[1])
    .slice(0, topN)
    .map(([p]) => p);

  // Generate color palette for series
  const seriesColors = [
    'rgba(13,110,253,0.8)',
    'rgba(25,135,84,0.8)',
    'rgba(255,193,7,0.8)',
    'rgba(220,53,69,0.8)',
    'rgba(111,66,193,0.8)',
    'rgba(32,201,151,0.8)',
    'rgba(102,16,242,0.8)',
    'rgba(255,133,27,0.8)',
  ];

  const datasets: any[] = [];
  topPrices.forEach((price, idx) => {
    const data = periodsOrdered.map(iso => {
      const rec = (rows || []).find(r => new Date(r.date).toISOString() === iso && Number(r.preis) === price);
      return rec ? Number(rec.count) || 0 : 0;
    });
    datasets.push({
      label: `${price.toFixed(2)} €`,
      data,
      backgroundColor: seriesColors[idx % seriesColors.length],
      borderColor: seriesColors[idx % seriesColors.length],
      borderWidth: 1,
      stack: 'prices'
    });
  });

  // "Andere" Sammelserie
  const otherData = periodsOrdered.map((iso, i) => {
    const sumTop = topPrices.reduce((acc, p) => acc + ((rows || []).find(r => new Date(r.date).toISOString() === iso && Number(r.preis) === p)?.count || 0), 0);
    const sumAll = (rows || []).filter(r => new Date(r.date).toISOString() === iso).reduce((acc, r) => acc + (Number(r.count) || 0), 0);
    return Math.max(0, sumAll - sumTop);
  });
  if (otherData.some(v => v > 0)) {
    datasets.push({
      label: 'Andere',
      data: otherData,
      backgroundColor: 'rgba(0,0,0,0.15)',
      borderColor: 'rgba(0,0,0,0.25)',
      borderWidth: 1,
      stack: 'prices'
    });
  }

  return {
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' as const },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${numberDE(ctx.parsed.y)} Vorgänge`
          }
        }
      },
      scales: {
        x: { stacked: true, ticks: { color: palette.ticks, maxRotation: 0, autoSkip: true }, grid: { display: false, drawBorder: false } },
        y: { stacked: true, ticks: { color: palette.ticks, callback: (v:any)=>numberDE(Number(v)) }, grid: { color: palette.grid, drawBorder: false } }
      }
    } as const
  };
};

// Erfüllung (bestellt vs. raus) – Gruppenbalken + Differenz als Linie
const buildFulfillmentTimelineChart = (rows: any[], granularity: 'day'|'week'|'month') => {
  const labels = (rows || []).map(r => granularity === 'week' ? formatWeekLabel(r.date) : new Date(r.date).toLocaleDateString('de-DE'));
  const bestellt = (rows || []).map(r => Number(r.bestelltMenge) || 0);
  const raus = (rows || []).map(r => Number(r.rausMenge) || 0);
  const diff = (rows || []).map(r => Number(r.differenz) || 0);
  return {
    data: {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Bestellt',
          data: bestellt,
          backgroundColor: palette.priamaryFill,
          borderColor: palette.primary,
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2
        },
        {
          type: 'bar' as const,
          label: 'Raus',
          data: raus,
          backgroundColor: palette.successFill,
          borderColor: palette.success,
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2
        },
        {
          type: 'line' as const,
          label: 'Differenz (Raus − Bestellt)',
          data: diff,
          borderColor: palette.warning,
          backgroundColor: palette.warningFill,
          borderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 4,
          fill: false,
          yAxisID: 'y1',
          tension: 0.35,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' as const },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const label = ctx.dataset.label || '';
              const val = typeof ctx.parsed.y === 'number' ? ctx.parsed.y : ctx.raw;
              return ` ${label}: ${numberDE(Number(val))} kg`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: palette.ticks, maxRotation: 0, autoSkip: true }, grid: { color: palette.grid, drawBorder: false } },
        y: {
          position: 'left' as const,
          ticks: { color: palette.ticks, callback: (v:any)=>numberDE(Number(v)) },
          grid: { color: palette.grid, drawBorder: false }
        },
        y1: {
          position: 'right' as const,
          ticks: { color: palette.ticks, callback: (v:any)=>numberDE(Number(v)) },
          grid: { drawOnChartArea: false, drawBorder: false }
        }
      }
    } as const
  };
};

// Helper to get ISO week (Monday-based) and formatter for week label
const getISOWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { week: weekNo, year: d.getUTCFullYear() };
};

const formatWeekLabel = (isoString: string) => {
    const start = new Date(isoString);
    // Ensure start is Monday; end is Sunday, but we show Mon–Sun (or Mon–Sun inclusive)
    const startDay = start.getDay() === 0 ? 7 : start.getDay();
    const monday = new Date(start);
    monday.setDate(start.getDate() - (startDay - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const { week, year } = getISOWeek(monday);
    const fmt = (d: Date) => d.toLocaleDateString('de-DE');
    return `KW ${week}/${year} (${fmt(monday)} – ${fmt(sunday)})`;
};

// Small Badge helper (fallback if you don't have a shared one)
const Badge: React.FC<{ children: React.ReactNode; variant?: 'secondary' | 'success' | 'warning' | 'danger'; className?: string }> = ({ children, variant = 'secondary', className }) => (
    <span className={cx('badge', `bg-${variant}`, 'rounded-pill', className)}>{children}</span>
);

// Modal: Bulk edit Kundenpreise for a given Artikel using Kunden-Filter
const BulkEditKundenpreiseForArtikelModal: React.FC<{
    artikelId: string;
    preselectedCustomerIds: string[];
    onClose: () => void;
    onDone: () => void;
}> = ({ artikelId, preselectedCustomerIds, onClose, onDone }) => {
    const [mode, setMode] = useState<'set' | 'add' | 'sub'>('set');
    const [value, setValue] = useState<string>('0');
    const [kundenKategorie, setKundenKategorie] = useState<string>('');
    const [region, setRegion] = useState<string>('');
    const [nummerFrom, setNummerFrom] = useState<string>('');
    const [nummerTo, setNummerTo] = useState<string>('');
    const [useSelected, setUseSelected] = useState<boolean>(preselectedCustomerIds.length > 0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const num = Number(value);
        if (Number.isNaN(num)) {
            setError('Bitte eine gültige Zahl angeben.');
            return;
        }

        const selection: any = {};
        if (useSelected && preselectedCustomerIds.length > 0) selection.customerIds = preselectedCustomerIds;
        if (kundenKategorie.trim()) selection.kundenKategorie = kunderKategorieFix(kundenKategorie);
        if (region.trim()) selection.region = region.trim();
        if (nummerFrom.trim()) selection.kundennummerFrom = nummerFrom.trim();
        if (nummerTo.trim()) selection.kundennummerTo = nummerTo.trim();

        if (!selection.customerIds && !selection.kundenKategorie && !selection.region && !selection.kundennummerFrom && !selection.kundennummerTo) {
            setError('Bitte mindestens ein Kriterium wählen: Auswahl, Kategorie, Region oder Kundennummern-Spanne.');
            return;
        }

        try {
            setBusy(true);
            await api.bulkEditKundenpreiseByArtikel(artikelId, {
                selection,
                action: { mode, value: num },
            });
            onDone();
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Fehler bei der Massenbearbeitung');
        } finally {
            setBusy(false);
        }
    };

    // small normalizer
    const kunderKategorieFix = (s: string) => s.trim();

    return (
        <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: 'rgba(30,33,37,.6)' }}>
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
                <form className="modal-content" onSubmit={submit}>
                    <div className="modal-header">
                        <div>
                            <h5 className="modal-title mb-0"><i className="ci-edit me-2" />Massenbearbeitung · Kundenpreise (Artikel)</h5>
                            <div className="text-muted small"><i className="ci-tune me-2" />Setzen / Addieren / Subtrahieren für ausgewählte Kunden oder per Filter.</div>
                        </div>
                        <button type="button" className="btn-close" onClick={onClose} disabled={busy} />
                    </div>
                    <div className="modal-body">
                        {error && <div className="alert alert-danger">{error}</div>}

                        {/* Aktion & Wert */}
                        <div className="mb-4">
                            <label className="form-label d-block mb-2"><i className="ci-settings me-2" />Aktion</label>
                            <div className="d-flex flex-column gap-3">
                                <div className="btn-group" role="group">
                                    <button type="button" className={cx('btn', mode === 'set' ? 'btn-secondary' : 'btn-outline-secondary')} onClick={() => setMode('set')}><i className="ci-edit me-2" />Setzen</button>
                                    <button type="button" className={cx('btn', mode === 'add' ? 'btn-secondary' : 'btn-outline-secondary')} onClick={() => setMode('add')}><i className="ci-plus me-2" />Addieren</button>
                                    <button type="button" className={cx('btn', mode === 'sub' ? 'btn-secondary' : 'btn-outline-secondary')} onClick={() => setMode('sub')}><i className="ci-minus me-2" />Subtrahieren</button>
                                </div>
                                <div>
                                    <label className="form-label small text-muted mb-1"><i className="ci-cash me-2" />Wert</label>
                                    <div className="input-group">
                                        <span className="input-group-text">€</span>
                                        <input type="number" step="0.01" className="form-control" value={value} onChange={(e) => setValue(e.target.value)} placeholder="z. B. 0.10" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr className="text-muted" />

                        {/* Kriterien */}
                        <div className="mb-3 d-flex align-items-center justify-content-between">
                            <h6 className="mb-0"><i className="ci-filter me-2" />Kriterien</h6>
                            <span className="badge bg-secondary"><i className="ci-users me-2" />Ausgewählt: {preselectedCustomerIds.length}</span>
                        </div>

                        <div className="row g-3">
                            <div className="col-md-12">
                                <div className="form-check">
                                    <input className="form-check-input" type="checkbox" id="useSelectedCustomers" checked={useSelected} onChange={(e) => setUseSelected(e.target.checked)} />
                                    <label className="form-check-label" htmlFor="useSelectedCustomers"><i className="ci-check-square me-2" />Aktuelle Auswahl verwenden ({preselectedCustomerIds.length})</label>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label"><i className="ci-tag me-2" />Kunden-Kategorie</label>
                                <input className="form-control" placeholder="z. B. Gastro" value={kundenKategorie} onChange={(e) => setKundenKategorie(e.target.value)} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label"><i className="ci-location me-2" />Region</label>
                                <input className="form-control" placeholder="z. B. Süd" value={region} onChange={(e) => setRegion(e.target.value)} />
                            </div>
                            <div className="col-md-12">
                                <label className="form-label"><i className="ci-hash me-2" />Kundennummern-Bereich</label>
                                <div className="input-group">
                                    <span className="input-group-text">von</span>
                                    <input className="form-control" placeholder="1000" value={nummerFrom} onChange={(e) => setNummerFrom(e.target.value)} />
                                    <span className="input-group-text">bis</span>
                                    <input className="form-control" placeholder="1999" value={nummerTo} onChange={(e) => setNummerTo(e.target.value)} />
                                </div>
                                <div className="form-text">Optional: beide Felder kombinierbar oder nur eins davon.</div>
                            </div>
                        </div>

                        <div className="alert alert-light border mt-3 mb-0 py-2">
                            <i className="ci-info me-2" />Mindestens <strong>ein</strong> Kriterium ist erforderlich.
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Abbrechen</button>
                        <button type="submit" className="btn btn-secondary" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Anwenden</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Types for Kundenpreise-Overview rows
export type KundenpreisArtikelRow = {
    id: string;          // KundenPreis-ID oder 'default'
    customer: string;    // Kunden-ID
    kundeName?: string;
    kundennummer?: string;
    kategorie?: string;
    region?: string;
    basispreis: number;
    aufpreis: number;
    effektivpreis: number;
};

const ArtikelDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [artikel, setArtikel] = useState<any>(null);

    // Kundenpreise (artikelzentriert)
    const [preise, setPreise] = useState<KundenpreisArtikelRow[]>([]);
    const [preiseLoading, setPreiseLoading] = useState(false);
    const [preiseError, setPreiseError] = useState('');

    // Dashboard / Analytics
    const [activeTab, setActiveTab] = useState<'dashboard' | 'preise'>('dashboard');
    const [from, setFrom] = useState<string>(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1); d.setHours(0, 0, 0, 0);
        return d.toISOString().slice(0, 10);
    });
    const [to, setTo] = useState<string>(() => {
        const d = new Date(); d.setHours(23, 59, 59, 999);
        return d.toISOString().slice(0, 10);
    });
    const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('week');
    const [analytics, setAnalytics] = useState<any>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsError, setAnalyticsError] = useState('');

    // Filters
    const [q, setQ] = useState('');
    const [sort, setSort] = useState<'kundeName' | 'kundennummer' | 'kategorie' | 'region' | 'basispreis' | 'aufpreis' | 'effektivpreis'>('kundeName');
    const [order, setOrder] = useState<'asc' | 'desc'>('asc');
    const [includeAllCustomers, setIncludeAllCustomers] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(500);

    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
    const [bulkOpen, setBulkOpen] = useState(false);

    const title = useMemo(() => artikel?.name ? `${artikel.name} (${artikel.artikelNummer})` : 'Artikel', [artikel]);

    const loadArtikel = async () => {
        if (!id) return;
        try {
            setLoading(true); setError('');
            const a = await api.getArtikelByIdClean(id);
            setArtikel(a);
        } catch (e: any) {
            setError(e?.message || 'Fehler beim Laden des Artikels');
        } finally {
            setLoading(false);
        }
    };

    const loadPreise = async () => {
        if (!id) return;
        try {
            setPreiseLoading(true); setPreiseError('');
            const rows = await api.getKundenpreiseArtikelOverview(id, { q: q || undefined, sort, order, includeAllCustomers, page, limit });
            setPreise(rows);
            setSelectedCustomerIds([]);
        } catch (e: any) {
            setPreiseError(e?.message || 'Fehler beim Laden der Kundenpreise');
        } finally {
            setPreiseLoading(false);
        }
    };

    const loadAnalytics = useCallback(async () => {
        if (!id) return;
        try {
            setAnalyticsLoading(true); setAnalyticsError('');
            const data = await api.getArtikelAnalyticsApi(id, {
                from: new Date(from).toISOString(),
                to: new Date(new Date(to).setHours(23, 59, 59, 999)).toISOString(),
                granularity,
                topCustomersLimit: 20,
                recentOrdersLimit: 50,
            });
            setAnalytics(data);
        } catch (e: any) {
            setAnalyticsError(e?.message || 'Fehler beim Laden der Analytics');
        } finally {
            setAnalyticsLoading(false);
        }
    }, [id, from, to, granularity]);

    const toggleSelectCustomer = (customerId: string) => {
        setSelectedCustomerIds((prev) => prev.includes(customerId) ? prev.filter(id => id !== customerId) : [...prev, customerId]);
    };
    const selectAllVisible = () => setSelectedCustomerIds(preise.map(p => p.customer));
    const clearSelection = () => setSelectedCustomerIds([]);

    // Initial
    useEffect(() => { loadArtikel(); }, [id]);
    useEffect(() => { loadPreise(); }, [id, q, sort, order, includeAllCustomers, page, limit]);

    // Reset pagination on filters
    useEffect(() => { setPage(1); }, [q, sort, order, includeAllCustomers]);

    useEffect(() => {
        if (activeTab === 'dashboard') {
            loadAnalytics();
        }
    }, [activeTab, loadAnalytics]);

    useEffect(() => {
        if (activeTab === 'dashboard') {
            loadAnalytics();
        }
    }, [from, to, granularity]);

    return (
        <div className="container py-3">
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h3 className="h5 mb-1"><i className="ci-package me-2" />{title}</h3>
                    {artikel && (
                        <div className="d-flex flex-wrap gap-2 text-muted small">
                            <span>Nr.: {artikel.artikelNummer}</span>
                            <span> · Kategorie: {artikel.kategorie || '—'}</span>
                            <span> · Basispreis: {Number(artikel.preis).toFixed(2)} €</span>
                            {artikel.erfassungsModus && <span> · Modus: {artikel.erfassungsModus}</span>}
                        </div>
                    )}
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/artikel')}><i className="ci-arrow-left me-2" />Zurück</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => id && navigate(`/artikel/${id}/edit`)}><i className="ci-edit me-2" />Bearbeiten</button>
                </div>
            </div>

            {/* Tabs */}
            <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                    <button
                        className={cx('nav-link', activeTab === 'dashboard' && 'active')}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        <i className="ci-analytics me-2" />Dashboard
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={cx('nav-link', activeTab === 'preise' && 'active')}
                        onClick={() => setActiveTab('preise')}
                    >
                        <i className="ci-cash me-2" />Kundenpreise
                    </button>
                </li>
            </ul>

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
                <div className="card border-0 shadow-sm mb-3">
                    <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h6 className="mb-0"><i className="ci-analytics me-2" />Artikel-Dashboard</h6>
                            <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-outline-secondary" onClick={loadAnalytics} disabled={analyticsLoading}>
                                    {analyticsLoading ? <span className="spinner-border spinner-border-sm me-2" /> : <div></div>}
                                    Aktualisieren
                                </button>
                            </div>
                        </div>

                        {/* Filterleiste */}
                        <div className="row g-3 align-items-end mb-3">
                            <div className="col-md-3">
                                <label className="form-label small text-muted"><i className="ci-calendar me-2" />Von</label>
                                <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small text-muted"><i className="ci-calendar me-2" />Bis</label>
                                <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small text-muted"><i className="ci-trending-up me-2" />Granularität</label>
                                <select className="form-select" value={granularity} onChange={(e) => setGranularity(e.target.value as any)}>
                                    <option value="day">Tag</option>
                                    <option value="week">Woche</option>
                                    <option value="month">Monat</option>
                                </select>
                            </div>
                        </div>

                        {/* Quick Date Range Presets */}
                        <div className="mb-3 d-flex flex-wrap gap-2">
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                            const d = new Date(); setFrom(d.toISOString().slice(0,10)); setTo(d.toISOString().slice(0,10));
                          }}>Heute</button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                            const d = new Date(); d.setDate(d.getDate() - 1); setFrom(d.toISOString().slice(0,10)); setTo(d.toISOString().slice(0,10));
                          }}>Gestern</button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                            const now = new Date();
                            const monday = new Date(now); const day = now.getDay() || 7;
                            monday.setDate(now.getDate() - day + 1);
                            const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
                            setFrom(monday.toISOString().slice(0,10)); setTo(sunday.toISOString().slice(0,10));
                          }}>Diese Woche</button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                            const now = new Date();
                            const monday = new Date(now); const day = now.getDay() || 7;
                            monday.setDate(now.getDate() - day - 6);
                            const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
                            setFrom(monday.toISOString().slice(0,10)); setTo(sunday.toISOString().slice(0,10));
                          }}>Letzte Woche</button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                            const now = new Date();
                            const first = new Date(now.getFullYear(), now.getMonth(), 1);
                            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                            setFrom(first.toISOString().slice(0,10)); setTo(last.toISOString().slice(0,10));
                          }}>Diesen Monat</button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                            const now = new Date();
                            const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                            const last = new Date(now.getFullYear(), now.getMonth(), 0);
                            setFrom(first.toISOString().slice(0,10)); setTo(last.toISOString().slice(0,10));
                          }}>Letzten Monat</button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                            const now = new Date();
                            const first = new Date(now.getFullYear(), 0, 1);
                            const last = new Date(now.getFullYear(), 11, 31);
                            setFrom(first.toISOString().slice(0,10)); setTo(last.toISOString().slice(0,10));
                          }}>Dieses Jahr</button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                            const now = new Date();
                            const first = new Date(now.getFullYear() - 1, 0, 1);
                            const last = new Date(now.getFullYear() - 1, 11, 31);
                            setFrom(first.toISOString().slice(0,10)); setTo(last.toISOString().slice(0,10));
                          }}>Letztes Jahr</button>
                        </div>

                        {analyticsError && <div className="alert alert-danger">{analyticsError}</div>}

                        {analyticsLoading ? (
                            <div className="d-flex flex-column align-items-center justify-content-center py-5 my-3 border rounded bg-light">
                                <span className="spinner-border mb-3" style={{ width: '3rem', height: '3rem' }} />
                                <div className="fw-medium text-muted">Analytics werden geladen…</div>
                            </div>
                        ) : analytics ? (
                            <>
                                {/* KPI-Zeile */}
                                <div className="row g-3 mb-3">
                                    <div className="col-md-3">
                                        <div className="p-3 border rounded bg-light h-100">
                                            <div className="text-muted small">Menge gesamt</div>
                                            <div className="h5 mb-0">{(analytics.totals?.totalMenge ?? 0).toLocaleString('de-DE')} kg</div>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="p-3 border rounded bg-light h-100">
                                            <div className="text-muted small">Umsatz gesamt</div>
                                            <div className="h5 mb-0">{(analytics.totals?.totalUmsatz ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="p-3 border rounded bg-light h-100">
                                            <div className="text-muted small">Ø-Preis</div>
                                            <div className="h5 mb-0">{(analytics.totals?.avgPreisGewichtet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="p-3 border rounded bg-light h-100">
                                            <div className="text-muted small">Kunden</div>
                                            <div className="h5 mb-0">{analytics.totals?.kundenCount ?? 0}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Timeline (Chart rechts von Tabelle) */}
                                <div className="mb-4">
                                  <h6 className="mb-2">Zeitverlauf</h6>
                                  <div className="row g-3 align-items-stretch">
                                    <div className="col-md-7">
                                      <div className="table-responsive">
                                        <table className="table table-sm">
                                          <thead>
                                            <tr>
                                              <th>Periode</th>
                                              <th className="text-end">Menge</th>
                                              <th className="text-end">Umsatz</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {analytics.timeline?.map((t: any, i: number) => (
                                              <tr key={i}>
                                                <td>
                                                  {granularity === 'week'
                                                    ? formatWeekLabel(t.date)
                                                    : new Date(t.date).toLocaleDateString('de-DE')}
                                                </td>
                                                <td className="text-end">{t.menge?.toLocaleString('de-DE')}</td>
                                                <td className="text-end">{t.umsatz?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                                              </tr>
                                            ))}
                                            {(!analytics.timeline || analytics.timeline.length === 0) && (
                                              <tr><td colSpan={3} className="text-muted">Keine Daten im Zeitraum.</td></tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                    <div className="col-md-5">
                                      <div className="card border-0 h-100">
                                        <div className="card-body">
                                          <div style={{ height: 240 }}>
                                            {(() => {
                                              const cfg = buildTimelineChart(analytics.timeline || [], granularity);
                                              return <Line data={cfg.data} options={cfg.options} />;
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Erfüllung: Bestellt vs. Raus (Chart rechts von Tabelle) */}
                                <div className="mb-4">
                                  <h6 className="mb-2"><i className="ci-check-circle me-2" />Erfüllung (Bestellt vs. Raus)</h6>
                                  <div className="row g-3 align-items-stretch">
                                    <div className="col-md-7">
                                      <div className="table-responsive">
                                        <table className="table table-sm">
                                          <thead>
                                            <tr>
                                              <th>Periode</th>
                                              <th className="text-end">Bestellt (kg)</th>
                                              <th className="text-end">Raus (kg)</th>
                                              <th className="text-end">Differenz</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(analytics.fulfillmentTimeline || []).map((r:any, idx:number) => (
                                              <tr key={idx}>
                                                <td>{granularity === 'week' ? formatWeekLabel(r.date) : new Date(r.date).toLocaleDateString('de-DE')}</td>
                                                <td className="text-end">{Number(r.bestelltMenge ?? 0).toLocaleString('de-DE')}</td>
                                                <td className="text-end">{Number(r.rausMenge ?? 0).toLocaleString('de-DE')}</td>
                                                <td className={cx('text-end', Number(r.differenz ?? 0) < 0 && 'text-danger')}>
                                                  {Number(r.differenz ?? 0).toLocaleString('de-DE')}
                                                </td>
                                              </tr>
                                            ))}
                                            {(!analytics.fulfillmentTimeline || analytics.fulfillmentTimeline.length === 0) && (
                                              <tr><td colSpan={4} className="text-muted">Keine Daten (nur Positionen mit Nettogewicht werden berücksichtigt).</td></tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                      {/* Totals row */}
                                      {analytics.fulfillment && (
                                        <div className="mt-2 text-muted small">
                                          <span className="me-3"><strong>Summe bestellt:</strong> {Number(analytics.fulfillment.bestelltMenge ?? 0).toLocaleString('de-DE')} kg</span>
                                          <span className="me-3"><strong>Summe raus:</strong> {Number(analytics.fulfillment.rausMenge ?? 0).toLocaleString('de-DE')} kg</span>
                                          <span className={cx(Number(analytics.fulfillment.differenz ?? 0) < 0 && 'text-danger')}>
                                            <strong>Diff:</strong> {Number(analytics.fulfillment.differenz ?? 0).toLocaleString('de-DE')} kg
                                          </span>
                                          {analytics.fulfillment.rate != null && (
                                            <span className="ms-3"><strong>Erfüllungsquote:</strong> {(Number(analytics.fulfillment.rate) * 100).toFixed(1)}%</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="col-md-5">
                                      <div className="card border-0 h-100">
                                        <div className="card-body">
                                          <div style={{ height: 260 }}>
                                            {(() => {
                                              const cfg = buildFulfillmentTimelineChart(analytics.fulfillmentTimeline || [], granularity);
                                              return <Chart type="bar" data={cfg.data as any} options={cfg.options} />;
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Top-Kunden (Pie rechts von Tabelle) */}
                                <div className="mb-4">
                                  <h6 className="mb-2"><i className="ci-users me-2" />Top-Kunden (Menge)</h6>
                                  <div className="row g-3 align-items-stretch">
                                    <div className="col-md-7">
                                      <div className="table-responsive">
                                        <table className="table table-sm align-middle">
                                          <thead>
                                            <tr>
                                              <th>Kunde</th>
                                              <th className="text-end">Menge</th>
                                              <th className="text-end">Umsatz</th>
                                              <th className="text-end">Ø-Preis (gew.)</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {analytics.byCustomer?.map((c: any) => (
                                              <tr key={c.customerId} onClick={() => navigate(`/kunden/${c.customerId}`)} style={{ cursor: 'pointer' }}>
                                                <td>
                                                  <div className="fw-medium">{c.name || '—'}</div>
                                                  <div className="text-muted small">{[c.kategorie, c.region].filter(Boolean).join(' · ')}</div>
                                                </td>
                                                <td className="text-end">{c.menge?.toLocaleString('de-DE')}</td>
                                                <td className="text-end">{c.umsatz?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                                                <td className="text-end">{(c.avgPreisGewichtet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                                              </tr>
                                            ))}
                                            {(!analytics.byCustomer || analytics.byCustomer.length === 0) && (
                                              <tr><td colSpan={4} className="text-muted">Keine Kunden im Zeitraum.</td></tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                    <div className="col-md-5">
                                      <div className="card border-0 h-100">
                                        <div className="card-body">
                                          <div style={{ height: 260 }}>
                                            {(() => {
                                              const cfg = buildTopCustomersPieChart(analytics.byCustomer || []);
                                              return <Pie data={cfg.data} options={cfg.options} />;
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Preis × Zeitraum (exakt) */}
                                <div className="mt-4">
                                  <h6 className="mb-2"><i className="ci-timeline me-2" />Preis × Zeitraum (exakt)</h6>
                                  <div className="row g-3 align-items-stretch">
                                    <div className="col-md-7">
                                      <div className="table-responsive">
                                        <table className="table table-sm">
                                          <thead>
                                            <tr>
                                              <th>Periode</th>
                                              <th className="text-end">Preis (€)</th>
                                              <th className="text-end">Anzahl</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(analytics.priceExactByDate || []).map((r:any, idx:number) => (
                                              <tr key={idx}>
                                                <td>{granularity === 'week' ? formatWeekLabel(r.date) : new Date(r.date).toLocaleDateString('de-DE')}</td>
                                                <td className="text-end">{(Number(r.preis) || 0).toFixed(2)}</td>
                                                <td className="text-end">{r.count}</td>
                                              </tr>
                                            ))}
                                            {(!analytics.priceExactByDate || analytics.priceExactByDate.length === 0) && (
                                              <tr><td colSpan={3} className="text-muted">Keine Daten.</td></tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                    <div className="col-md-5">
                                      <div className="card border-0 h-100">
                                        <div className="card-body">
                                          <div style={{ height: 260 }}>
                                            {(() => {
                                              const cfg = buildPriceExactByDateChart(analytics.priceExactByDate || [], granularity);
                                              return <Bar data={cfg.data} options={cfg.options} />;
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-muted">Keine Daten.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Kundenpreise Tab */}
            {activeTab === 'preise' && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h6 className="mb-0">Kundenpreise</h6>
                            <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-outline-secondary" onClick={loadPreise} disabled={preiseLoading}>
                                    {preiseLoading ? <span className="spinner-border spinner-border-sm me-2" /> : <div></div>}
                                    Aktualisieren
                                </button>
                            </div>
                        </div>

                        <div className="row g-2 align-items-end mb-3">
                            <div className="col-md-4">
                                <label className="form-label small text-muted"><i className="ci-search me-2" />Suche</label>
                                <input className="form-control" placeholder="Kundenname oder Kundennummer…" value={q} onChange={(e) => setQ(e.target.value)} />
                            </div>
                            <div className="col-md-3">
                                <div className="form-check mt-4">
                                    <input id="includeAllCustomers" className="form-check-input" type="checkbox" checked={includeAllCustomers} onChange={(e) => setIncludeAllCustomers(e.target.checked)} />
                                    <label className="form-check-label" htmlFor="includeAllCustomers">Alle Kunden anzeigen</label>
                                </div>
                            </div>
                            <div className="col-md-5 d-flex gap-2">
                                <div className="flex-grow-1">
                                    <label className="form-label small text-muted"><i className="ci-sort me-2" />Sortieren nach</label>
                                    <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                                        <option value="kundeName">Kunde</option>
                                        <option value="kundennummer">Kundennummer</option>
                                        <option value="kategorie">Kategorie</option>
                                        <option value="region">Region</option>
                                        <option value="basispreis">Basispreis</option>
                                        <option value="aufpreis">Aufpreis</option>
                                        <option value="effektivpreis">Effektivpreis</option>
                                    </select>
                                </div>
                                <div style={{ width: 120 }}>
                                    <label className="form-label small text-muted"><i className="ci-sort me-2" />Reihenfolge</label>
                                    <select className="form-select" value={order} onChange={(e) => setOrder(e.target.value as any)}>
                                        <option value="asc">Aufsteigend</option>
                                        <option value="desc">Absteigend</option>
                                    </select>
                                </div>
                                <button className="btn btn-secondary align-self-end" onClick={loadPreise} disabled={preiseLoading}><i className="ci-search me-2" />Suchen</button>
                            </div>
                        </div>

                        <div className="d-flex flex-wrap gap-2 mb-2">
                            <button className="btn btn-sm btn-secondary" onClick={() => setBulkOpen(true)} disabled={selectedCustomerIds.length === 0 && !q && !includeAllCustomers}><i className="ci-edit me-2" />Massenbearbeitung</button>
                            <span className="small text-muted ms-auto">Ausgewählt: {selectedCustomerIds.length}</span>
                        </div>

                        {preiseError && <div className="alert alert-danger">{preiseError}</div>}

                        {preiseLoading ? (
                            <div className="d-flex flex-column align-items-center justify-content-center py-5 my-3 border rounded bg-light">
                                <span className="spinner-border mb-3" style={{ width: '3rem', height: '3rem' }} />
                                <div className="fw-medium text-muted">Kundenpreise werden geladen…</div>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 36 }}><input className="form-check-input" type="checkbox" onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()} /></th>
                                            <th>Kunde</th>
                                            <th>Kundennr.</th>
                                            <th>Kategorie</th>
                                            <th>Region</th>
                                            <th className="text-end">Basis</th>
                                            <th className="text-end">Aufpreis</th>
                                            <th className="text-end">Effektiv</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preise.map((r) => (
                                            <tr
                                                key={`${r.id}-${r.customer}`}
                                                onClick={() => navigate(`/kunden/${r.customer}`)}
                                                style={{ cursor: 'pointer' }}
                                                className="table-row-link"
                                            >
                                                <td onClick={(ev) => ev.stopPropagation()}>
                                                    <input className="form-check-input" type="checkbox" checked={selectedCustomerIds.includes(r.customer)} onChange={() => toggleSelectCustomer(r.customer)} />
                                                </td>
                                                <td>
                                                    <div className="fw-medium text-truncate" title={r.kundeName || r.kundennummer}>{r.kundeName || '—'}</div>
                                                </td>
                                                <td className="text-muted">{r.kundennummer || '—'}</td>
                                                <td className="text-muted">{r.kategorie || '—'}</td>
                                                <td className="text-muted">{r.region || '—'}</td>
                                                <td className="text-end">{r.basispreis.toFixed(2)} €</td>
                                                <td className={cx('text-end', r.aufpreis < 0 && 'text-danger')}>{r.aufpreis.toFixed(2)} €</td>
                                                <td className="text-end fw-bold">{r.effektivpreis.toFixed(2)} €</td>
                                            </tr>
                                        ))}
                                        {preise.length === 0 && !preiseLoading && (
                                            <tr>
                                                <td colSpan={9} className="text-muted">Keine Einträge.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        <div className="d-flex align-items-center justify-content-between mt-2">
                            <div className="d-flex align-items-center gap-2">
                                <span className="text-muted small">Einträge pro Seite</span>
                                <select className="form-select form-select-sm" style={{ width: 90 }} value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                    <option value={500}>500</option>
                                    <option value={1000}>1000</option>
                                </select>
                            </div>
                            <div className="btn-group">
                                <button className="btn btn-sm btn-outline-secondary" disabled={preiseLoading || page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}><i className="ci-arrow-left me-2" />Zurück</button>
                                <button className="btn btn-sm btn-outline-secondary" disabled={preiseLoading || preise.length < limit} onClick={() => setPage(p => p + 1)}>Weiter<i className="ci-arrow-right ms-2" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {bulkOpen && id && (
                <BulkEditKundenpreiseForArtikelModal
                    artikelId={id}
                    preselectedCustomerIds={selectedCustomerIds}
                    onClose={() => setBulkOpen(false)}
                    onDone={() => loadPreise()}
                />
            )}
        </div>
    );
};

export default ArtikelDetails;