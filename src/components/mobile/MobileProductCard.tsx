import React from 'react';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { ArtikelResource, ArtikelPositionResource } from '@/Resources';
import { getImageUrl } from '@/utils/imageUtils';
import { formatCurrency, unitFromModus, round2 } from '@/utils/cartHelpers';
import fallbackImage from '@/Cartzilla/assets/img/shop/grocery/10.png';

type Props = {
  article: ArtikelResource;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onTap: () => void;
  onQuickAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  cartQty?: number;
};

const MobileProductCard: React.FC<Props> = ({
  article, isFavorite, onToggleFavorite, onTap, onQuickAdd, onIncrement, onDecrement, cartQty
}) => {
  const imageUrl = getImageUrl(article.bildUrl, fallbackImage);
  const unit = unitFromModus(article.erfassungsModus);

  return (
    <div className="ms-card">
      <div onClick={onTap}>
        <img src={imageUrl} alt={article.name} className="ms-card-img" loading="lazy" />
      </div>
      <div className="ms-card-body">
        <p className="ms-card-name" onClick={onTap}>{article.name}</p>
        <div className="ms-card-price">
          {formatCurrency(article.preis)}
          <span className="ms-card-unit">/{unit}</span>
        </div>
        <div className="ms-card-actions">
          <button
            className={`ms-btn-fav ${isFavorite ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            aria-label="Favorit"
          >
            {isFavorite ? <AiFillHeart /> : <AiOutlineHeart />}
          </button>
          {!article.ausverkauft ? (
            cartQty ? (
              <div className="ms-inline-qty" onClick={e => e.stopPropagation()}>
                <button className="ms-inline-qty-btn" onClick={onDecrement}>−</button>
                <span className="ms-inline-qty-val">{cartQty}</span>
                <button className="ms-inline-qty-btn" onClick={onIncrement}>+</button>
              </div>
            ) : (
              <button
                className="ms-btn-add"
                onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
                aria-label="In den Warenkorb"
              >
                <i className="ci-plus" />
              </button>
            )
          ) : (
            <span style={{ fontSize: '0.7rem', color: '#e53e3e', fontWeight: 600 }}>Ausverkauft</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileProductCard;
