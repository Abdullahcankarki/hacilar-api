import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/providers/Authcontext';
import { getAuftragByCutomerId, getCustomerStopsToday } from '@/backend/api';
import { AuftragResource } from '@/Resources';
import { fmtEUR } from '@/utils/cartHelpers';

const MobileOrders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [auftraege, setAuftraege] = useState<AuftragResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [etaLabel, setEtaLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const res = await getAuftragByCutomerId(user.id);
        const list = Array.isArray(res) ? res : (res as any).items ?? [];
        list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAuftraege(list);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [user]);

  // ETA for today
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const stops = await getCustomerStopsToday(user.id);
        if (stops?.length) {
          const s = stops[0];
          const from = new Date(s.etaFromUtc).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const to = new Date(s.etaToUtc).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          setEtaLabel(`${from}–${to} Uhr`);
        }
      } catch {}
    })();
  }, [user]);

  const statusClass = (s: string) => {
    if (s === 'offen') return 'offen';
    if (s === 'abgeschlossen') return 'abgeschlossen';
    if (s === 'storniert') return 'storniert';
    return 'offen';
  };

  const isSameDay = (d1: string, d2: Date) => {
    const a = new Date(d1);
    return a.toDateString() === d2.toDateString();
  };

  const today = new Date();

  if (loading) {
    return (
      <div className="ms-empty">
        <div className="spinner-border text-primary" role="status" />
        <p style={{ marginTop: '12px' }}>Aufträge werden geladen...</p>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '12px', paddingBottom: '16px' }}>
      <div className="ms-section-header">
        <h3 className="ms-section-title">Meine Aufträge</h3>
        <span className="ms-section-badge">{auftraege.length}</span>
      </div>

      {auftraege.length === 0 ? (
        <div className="ms-empty">
          <div className="ms-empty-icon">📦</div>
          <p>Noch keine Aufträge</p>
        </div>
      ) : (
        auftraege.map((a: any) => (
          <div
            key={a.id}
            className="ms-order-card"
            onClick={() => navigate(`/auftraege/${a.id}`)}
          >
            <div className="ms-order-header">
              <span className="ms-order-nr">{a.auftragsnummer || a.id?.slice(-6)}</span>
              <span className={`ms-status ${statusClass(a.status)}`}>
                {a.status === 'offen' && '● '}
                {a.status === 'abgeschlossen' && '✓ '}
                {a.status}
              </span>
            </div>
            <div className="ms-order-row" style={{ marginBottom: '4px' }}>
              <span>Bestellt: {new Date(a.createdAt).toLocaleDateString('de-DE')}</span>
              <span className="ms-order-price">{fmtEUR.format(a.preis || a.gewicht || 0)}</span>
            </div>
            <div className="ms-order-row">
              <span>Lieferung: {a.lieferdatum ? new Date(a.lieferdatum).toLocaleDateString('de-DE') : '–'}</span>
              {a.lieferdatum && isSameDay(a.lieferdatum, today) && etaLabel && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ms-accent)', fontWeight: 600 }}>
                  ETA: {etaLabel}
                </span>
              )}
            </div>
            <div className="ms-order-row" style={{ marginTop: '4px' }}>
              <span>{a.artikelPosition?.length || 0} Artikel</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MobileOrders;
