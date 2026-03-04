import React, { useState, useEffect } from 'react';
import { ArtikelResource, ArtikelPositionResource } from '@/Resources';
import { getImageUrl } from '@/utils/imageUtils';
import { formatCurrency, unitFromModus, round2 } from '@/utils/cartHelpers';
import fallbackImage from '@/Cartzilla/assets/img/shop/grocery/10.png';

type Props = {
  article: ArtikelResource;
  cart: ArtikelPositionResource[];
  onAddToCart: (pos: ArtikelPositionResource) => void;
  onClose: () => void;
};

const MobileProductDetail: React.FC<Props> = ({ article, cart, onAddToCart, onClose }) => {
  const imageUrl = getImageUrl(article.bildUrl, fallbackImage);
  const defaultUnit = unitFromModus(article.erfassungsModus);
  const cartItem = cart.find(i => i.artikel === article.id);

  const [menge, setMenge] = useState(cartItem?.menge || 1);
  const [einheit, setEinheit] = useState<string>(cartItem?.einheit || defaultUnit);

  useEffect(() => {
    if (cartItem) {
      setMenge(cartItem.menge || 1);
      setEinheit(cartItem.einheit || defaultUnit);
    }
  }, [article.id]);

  const handleAdd = () => {
    if (menge < 0.1) return;
    const pos: ArtikelPositionResource = {
      artikel: article.id!,
      artikelName: article.name,
      menge,
      einheit: einheit as any,
      einzelpreis: article.preis,
      gesamtpreis: round2((article.preis || 0) * menge),
    } as any;
    onAddToCart(pos);
    onClose();
  };

  return (
    <>
      <div className="ms-sheet-backdrop" onClick={onClose} />
      <div className="ms-sheet" style={{ maxHeight: '70vh' }}>
        <div className="ms-sheet-handle" />
        <div className="ms-sheet-header">
          <h3 className="ms-sheet-title">{article.name}</h3>
          <button className="ms-sheet-close" onClick={onClose}>&times;</button>
        </div>
        <div className="ms-sheet-body">
          <img
            src={imageUrl}
            alt={article.name}
            style={{ width: '100%', borderRadius: '16px', aspectRatio: '16/10', objectFit: 'cover', marginBottom: '16px' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--ms-primary)' }}>
              {formatCurrency(article.preis)}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--ms-muted)' }}>
              pro {defaultUnit}
            </span>
          </div>

          {/* Menge */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Menge</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="ms-qty-btn" onClick={() => setMenge(Math.max(0.5, menge - 0.5))}>−</button>
              <input
                type="number"
                value={menge}
                onChange={e => setMenge(Math.max(0, parseFloat(e.target.value) || 0))}
                style={{
                  width: '80px', textAlign: 'center', border: '1.5px solid #e2e8f0',
                  borderRadius: '10px', padding: '8px', fontSize: '1rem', fontWeight: 600
                }}
              />
              <button className="ms-qty-btn" onClick={() => setMenge(round2(menge + 0.5))}>+</button>
            </div>
          </div>

          {/* Einheit */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Einheit</label>
            <select
              value={einheit}
              onChange={e => setEinheit(e.target.value)}
              className="ms-sort-select"
              style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem' }}
            >
              <option value="kg">Kg</option>
              <option value="stück">Stück</option>
              <option value="kiste">Kiste</option>
              <option value="karton">Karton</option>
            </select>
          </div>
        </div>

        <div className="ms-sheet-footer">
          <button className="ms-btn-primary" onClick={handleAdd} disabled={menge < 0.1}>
            {cartItem ? 'Warenkorb aktualisieren' : 'In den Warenkorb'}
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileProductDetail;
