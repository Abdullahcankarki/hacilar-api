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
  cartQty?: number;
};

const MobileProductCard: React.FC<Props> = ({
  article, isFavorite, onToggleFavorite, onTap, onQuickAdd, cartQty
}) => {
  const imageUrl = getImageUrl(article.bildUrl, fallbackImage);
  const unit = unitFromModus(article.erfassungsModus);

  return (
    <div className="ms-card" onClick={onTap}>
      <img src={imageUrl} alt={article.name} className="ms-card-img" loading="lazy" />
      <div className="ms-card-body">
        <p className="ms-card-name">{article.name}</p>
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
            <button
              className={`ms-btn-add ${cartQty ? 'in-cart' : ''}`}
              onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
              aria-label="In den Warenkorb"
            >
              <i className="ci-plus" />
              {cartQty ? <span className="ms-btn-add-badge">{cartQty}</span> : null}
            </button>
          ) : (
            <span style={{ fontSize: '0.7rem', color: '#e53e3e', fontWeight: 600 }}>Ausverkauft</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileProductCard;
