import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { VerkaeuferResource } from '../Resources';
import { getVerkaeuferById } from '../backend/api';
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  ArcElement, // ⬅️ das ist wichtig!
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  LineElement,
  BarElement,
  ArcElement, // ⬅️ auch hier
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

const VerkaeuferDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [verkaeufer, setVerkaeufer] = useState<VerkaeuferResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'woche' | 'monat' | 'jahr'>('woche');

  const chartLabels = {
    woche: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    monat: Array.from({ length: 30 }, (_, i) => `${i + 1}`),
    jahr: [
      'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
      'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
    ],
  };

  const chartData = {
    woche: [340, 610, 420, 780, 990, 560, 230],
    monat: Array.from({ length: 30 }, () => Math.floor(Math.random() * 1500)),
    jahr: [8120, 9430, 11230, 12345, 10120, 13400, 12000, 11800, 9700, 10300, 9000, 12500],
  };

  const [stats, setStats] = useState({
    tag: 1234.56,
    woche: 8456.78,
    monat: 22145.99,
    jahr: 198342.12,
    artikel: [
      { name: 'Artikel A', umsatz: 7532 },
      { name: 'Artikel B', umsatz: 5421 },
      { name: 'Artikel C', umsatz: 3897 },
    ],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id) throw new Error('Keine Verkäufer-ID angegeben.');
        const data = await getVerkaeuferById(id);
        setVerkaeufer(data);
        // TODO: Statistiken später per API laden
      } catch (err: any) {
        setError(err.message || 'Fehler beim Laden der Verkäuferdaten');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="container text-center my-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container my-5">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  if (!verkaeufer) {
    return (
      <div className="container my-5">
        <div className="alert alert-warning">Kein Verkäufer gefunden.</div>
      </div>
    );
  }

  return (
    <div className="container my-4">
      {/* Kopfbereich */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div>
            <h3 className="mb-1">{verkaeufer.name}</h3>
            <div className="text-muted small">ID: {verkaeufer.id}</div>
            <div className="text-muted small">Rolle: {verkaeufer.admin ? 'Admin' : 'Standard'}</div>
          </div>
          <div>
            <button className="btn btn-outline-secondary me-2" onClick={() => navigate('/verkaeufer')}>
              Zurück
            </button>
            <Link to={`/verkaeufer/edit/${verkaeufer.id}`} className="btn btn-primary">
              Bearbeiten
            </Link>
          </div>
        </div>
      </div>

      {/* Umsatzübersicht */}
      <div className="row g-4 mb-4">
        {/* Umsatz Liniendiagramm */}
        <div className="col-md-8">
          <div className="d-flex justify-content-between align-items-center mb-2 px-2">
            <h6 className="mb-0 text-muted">Umsatzverlauf</h6>
            <div className="btn-group btn-group-sm">
              <button
                className={`btn ${viewMode === 'woche' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setViewMode('woche')}
                title="Wochenansicht"
              >
                Woche
              </button>
              <button
                className={`btn ${viewMode === 'monat' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setViewMode('monat')}
                title="Monatsansicht"
              >
                Monat
              </button>
              <button
                className={`btn ${viewMode === 'jahr' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setViewMode('jahr')}
                title="Jahresansicht"
              >
                Jahr
              </button>
            </div>
          </div>

          <div className="p-3 shadow-sm rounded border bg-white">
            <div className="p-3 shadow-sm rounded border bg-white">
              <Bar
                data={{
                  labels: chartLabels[viewMode],
                  datasets: [
                    {
                      label: 'Umsatz (€)',
                      data: chartData[viewMode],
                      backgroundColor: 'rgba(13, 110, 253, 0.6)',
                      borderRadius: 6,
                      barThickness: 18,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => ` ${ctx.parsed.y.toFixed(2)} €`,
                      },
                    },
                  },
                  scales: {
                    y: {
                      ticks: {
                        callback: (value) => `${value} €`,
                        font: { size: 10 },
                      },
                      beginAtZero: true,
                      grid: { color: 'rgba(0,0,0,0.04)' },
                    },
                    x: {
                      ticks: { font: { size: 10 } },
                      grid: { display: false },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Kreisdiagramm */}
        <div className="col-md-4">
          <div className="shadow-sm rounded border bg-white p-3 h-100">
            <h6 className="text-muted mb-3 text-center">Umsatzanteile nach Artikel</h6>
            <Pie
              data={{
                labels: stats.artikel.map((a) => a.name),
                datasets: [
                  {
                    data: stats.artikel.map((a) => a.umsatz),
                    backgroundColor: ['#0d6efd', '#20c997', '#ffc107', '#6610f2'],
                    borderColor: '#fff',
                    borderWidth: 2,
                  },
                ],
              }}
              options={{
                plugins: {
                  legend: {
                    position: 'bottom' as const,
                    labels: {
                      font: { size: 11 },
                      color: '#444',
                      boxWidth: 12,
                      padding: 15,
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerkaeuferDetails;