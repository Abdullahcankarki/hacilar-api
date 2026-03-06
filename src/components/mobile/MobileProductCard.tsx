import React, { useState } from 'react';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { ArtikelResource } from '@/Resources';
import { getImageUrl } from '@/utils/imageUtils';
import { formatCurrency, unitFromModus } from '@/utils/cartHelpers';
import fallbackImage from '@/Cartzilla/assets/img/shop/grocery/10.png';

type Props = {
  article: ArtikelResource;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onAddToCart: (menge: number) => void;
  cartQty?: number;
};

const MobileProductCard: React.FC<Props> = ({
  article, isFavorite, onToggleFavorite, onAddToCart, cartQty
}) => {
  const imageUrl = getImageUrl(article.bildUrl, fallbackImage);
  const unit = unitFromModus(article.erfassungsModus);
  const [menge, setMenge] = useState<string>(cartQty ? String(cartQty) : '0');

  const handleAdd = () => {
    const val = parseFloat(menge);
    if (!val || val <= 0) return;
    onAddToCart(val);
  };

  const inCart = !!cartQty;

  return (
    <div className="ms-card">
      <img src={imageUrl} alt={article.name} className="ms-card-img" loading="lazy" />
      <div className="ms-card-body">
        <div className="ms-card-top-row">
          <p className="ms-card-name">{article.name}</p>
          <button
            className={`ms-btn-fav ${isFavorite ? 'active' : ''}`}
            onClick={onToggleFavorite}
            aria-label="Favorit"
          >
            {isFavorite ? <AiFillHeart /> : <AiOutlineHeart />}
          </button>
        </div>
        <div className="ms-card-price">
          {formatCurrency(article.preis)}
          <span className="ms-card-unit">/{unit}</span>
        </div>
        {!article.ausverkauft ? (
          <div className="ms-card-add-row">
            <input
              type="number"
              className="ms-card-qty-input"
              value={menge}
              onChange={e => setMenge(e.target.value)}
              min="0.1"
              step="0.5"
              inputMode="decimal"
              placeholder="0"
            />
            <span className="ms-card-unit-label">{unit}</span>
            <button
              className={`ms-card-add-btn ${inCart ? 'in-cart' : ''}`}
              onClick={handleAdd}
            >
              {inCart ? '✓' : '🛒'}
            </button>
          </div>
        ) : (
          <span className="ms-card-sold-out">Ausverkauft</span>
        )}
      </div>
    </div>
  );
};

export default MobileProductCard;
