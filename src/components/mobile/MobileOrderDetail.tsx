import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuftragResource, ArtikelPositionResource } from '@/Resources';
import { getAuftragById, getArtikelPositionById } from '@/backend/api';
import { fmtEUR } from '@/utils/cartHelpers';

const MobileOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [auftrag, setAuftrag] = useState<AuftragResource | null>(null);
  const [positions, setPositions] = useState<ArtikelPositionResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const a = await getAuftragById(id);
        setAuftrag(a);
        if (a.artikelPosition?.length) {
          const pos = await Promise.all(a.artikelPosition.map(getArtikelPositionById));
          setPositions(pos);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="ms-empty">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!auftrag) {
    return (
      <div className="ms-empty">
        <p>Auftrag nicht gefunden</p>
      </div>
    );
  }

  const a = auftrag as any;
  const statusClass = a.status === 'offen' ? 'offen' : a.status === 'abgeschlossen' ? 'abgeschlossen' : a.status === 'storniert' ? 'storniert' : 'offen';

  return (
    <div style={{ padding: '16px' }}>
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: '1.3rem', padding: '4px', color: 'var(--ms-primary)' }}
        >
          ←
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{a.auftragsnummer || 'Auftrag'}</h2>
          <span className={`ms-status ${statusClass}`} style={{ marginTop: '4px' }}>{a.status}</span>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: 'var(--ms-shadow)', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: 'var(--ms-muted)', fontSize: '0.85rem' }}>Bestellt am</span>
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString('de-DE') : '–'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: 'var(--ms-muted)', fontSize: '0.85rem' }}>Lieferdatum</span>
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.lieferdatum ? new Date(a.lieferdatum).toLocaleDateString('de-DE') : '–'}</span>
        </div>
        {a.bemerkungen && (
          <div style={{ marginTop: '8px', padding: '10px', background: '#f7f8fa', borderRadius: '10px', fontSize: '0.85rem' }}>
            <strong>Bemerkung:</strong> {a.bemerkungen}
          </div>
        )}
      </div>

      {/* Positions */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Positionen</h3>
      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: 'var(--ms-shadow)', overflow: 'hidden' }}>
        {positions.map((pos: any, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            borderBottom: i < positions.length - 1 ? '1px solid #f0f0f0' : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pos.artikelName || 'Artikel'}</span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ms-primary)' }}>
                {fmtEUR.format(pos.gesamtpreis || 0)}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--ms-muted)' }}>
              {pos.menge} {pos.einheit}
              {pos.zerlegung && ' · Zerlegung'}
              {pos.vakuum && ' · Vakuum'}
            </div>
            {pos.bemerkung && (
              <div style={{ fontSize: '0.78rem', color: 'var(--ms-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                {pos.bemerkung}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '16px 0',
        fontSize: '1.1rem', fontWeight: 700, marginTop: '8px'
      }}>
        <span>Gesamt</span>
        <span style={{ color: 'var(--ms-primary)' }}>{fmtEUR.format(a.preis || 0)}</span>
      </div>
    </div>
  );
};

export default MobileOrderDetail;
