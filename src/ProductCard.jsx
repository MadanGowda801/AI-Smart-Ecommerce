import React, { useState } from 'react';
import { Star, ShoppingCart, Heart, Sparkles, Check, Scale } from 'lucide-react';
import { useCart } from './CartContext';
import { useWishlist } from './WishlistContext';
import { useNavigation } from './NavigationContext';
import { useRecommendations } from './RecommendationContext';
import { useCompare } from './CompareContext';
import { formatINR } from './productsService';

export function ProductCard({ product }) {
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { navigate } = useNavigation();
  const { trackProductClick, trackAddToCart, trackWishlistAdd } = useRecommendations();
  const { isInCompare, toggleCompare } = useCompare();
  const [isAdded, setIsAdded] = useState(false);

  const inWishlist = isInWishlist(product.id);
  const inCompare = isInCompare(product.id);

  const handleToggleCompare = (e) => {
    e.stopPropagation();
    toggleCompare(product);
  };

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addItem(product, 1);
    try {
      trackAddToCart(product.id, product.categoryId);
    } catch {
      // non-blocking
    }
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  };

  const handleToggleWishlist = (e) => {
    e.stopPropagation();
    if (!inWishlist) {
      try {
        trackWishlistAdd(product.id, product.categoryId);
      } catch {
        // non-blocking
      }
    }
    toggleWishlist(product);
  };

  const handleCardClick = () => {
    try {
      trackProductClick(product.id, product.categoryId);
    } catch {
      // non-blocking
    }
    try {
      const prev = JSON.parse(localStorage.getItem('smartshop_recently_viewed') || '[]');
      const next = [product.id, ...(Array.isArray(prev) ? prev.filter((id) => id !== product.id) : [])].slice(0, 8);
      localStorage.setItem('smartshop_recently_viewed', JSON.stringify(next));
      window.dispatchEvent(new Event('smartshop_recently_viewed_updated'));
    } catch {
      // non-blocking
    }
    navigate('product-details', { params: { id: product.id } });
  };

  const matchPercent = product.matchPercentage || (product.recommendationScore ? Math.round(product.recommendationScore * 100) : null);

  return (
    <div
      className="card-glass product-card"
      onClick={handleCardClick}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        transition: 'transform var(--transition-normal), border-color var(--transition-normal), box-shadow var(--transition-normal)',
        padding: '1rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)'
      }}
    >
      {/* Top Badges & Wishlist Button */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '200px', marginBottom: '0.85rem', background: 'rgba(255,255,255,0.02)' }}>
        <img
          src={product.image || (product.images && product.images[0])}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `https://placehold.co/600x400/1e293b/6366f1?text=${encodeURIComponent((product.name || 'Product').substring(0,20))}`;
          }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
          className="product-img-hover"
        />

        {/* Badges */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {product.discountPercent > 0 && (
            <span
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)'
              }}
            >
              {product.discountPercent}% OFF
            </span>
          )}

          {matchPercent ? (
            <span
              style={{
                background: 'var(--accent-gradient)',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                boxShadow: 'var(--shadow-glow)'
              }}
            >
              <Sparkles size={10} color="#fcd34d" />
              {matchPercent}% Match
            </span>
          ) : product.isAiRecommended ? (
            <span
              style={{
                background: 'var(--accent-gradient)',
                backdropFilter: 'blur(6px)',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '0.15rem 0.45rem',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <Sparkles size={10} color="#fcd34d" />
              AI Pick
            </span>
          ) : null}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
          title={inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: inWishlist ? 'rgba(236, 72, 153, 0.25)' : 'rgba(10, 12, 20, 0.75)',
            backdropFilter: 'blur(8px)',
            border: inWishlist ? '1px solid #ec4899' : '1px solid var(--border-subtle)',
            color: inWishlist ? '#ec4899' : '#cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Heart size={16} fill={inWishlist ? '#ec4899' : 'none'} />
        </button>

        {/* Stock warning */}
        {product.stock <= 0 ? (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(239, 68, 68, 0.9)',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 700,
              textAlign: 'center',
              padding: '0.2rem'
            }}
          >
            Out of Stock
          </div>
        ) : product.stock <= 5 ? (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(245, 158, 11, 0.9)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              textAlign: 'center',
              padding: '0.15rem'
            }}
          >
            Only {product.stock} left in stock
          </div>
        ) : null}
      </div>

      {/* Product Category & ID */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.category || 'Hardware'}
        </span>
        <span
          style={{
            fontSize: '0.68rem',
            color: 'var(--text-accent)',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-border)',
            padding: '0.1rem 0.4rem',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontWeight: 700,
            flexShrink: 0
          }}
        >
          {product.id}
        </span>
      </div>

      {/* Product Name */}
      <h3
        style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: '#f1f5f9',
          lineHeight: 1.35,
          marginBottom: '0.4rem',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: '2.6em'
        }}
      >
        {product.name}
      </h3>

      {/* Rating & Reviews */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            padding: '0.15rem 0.4rem',
            borderRadius: 'var(--radius-sm)',
            color: '#facc15',
            fontSize: '0.75rem',
            fontWeight: 700
          }}
        >
          <Star size={11} fill="#facc15" />
          <span>{Number(product.rating || 4.5).toFixed(1)}</span>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
          ({product.reviewsCount || product.review_count || 0})
        </span>
      </div>

      {/* Explainable Recommendation Reason */}
      {product.recommendationReason && (
        <div
          title={product.recommendationReason}
          style={{
            fontSize: '0.72rem',
            color: '#a5b4fc',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.22)',
            padding: '0.25rem 0.5rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <Sparkles size={11} color="#818cf8" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {product.recommendationReason}
          </span>
        </div>
      )}

      {/* Price section & Add to Cart button */}
      <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            {formatINR(product.price)}
          </div>
          {product.originalPrice && product.originalPrice > product.price && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', textDecoration: 'line-through' }}>
              {formatINR(product.originalPrice)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={handleToggleCompare}
            className={`btn-compare-card ${inCompare ? 'active' : ''}`}
            title={inCompare ? 'Remove from AI Comparison' : 'Add to AI Comparison'}
            aria-label={inCompare ? `Remove ${product.name} from comparison` : `Compare ${product.name}`}
          >
            {inCompare ? <Check size={12} /> : <Scale size={12} />}
            <span>{inCompare ? 'Comparing' : 'Compare'}</span>
          </button>

          <button
            onClick={handleAddToCart}
            className={`btn ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
            disabled={product.stock <= 0}
            style={{
              padding: '0.45rem 0.78rem',
              fontSize: '0.8rem',
              background: isAdded ? 'var(--success-bg)' : undefined,
              borderColor: isAdded ? 'rgba(16, 185, 129, 0.4)' : undefined,
              color: isAdded ? 'var(--success)' : undefined
            }}
            title={product.stock <= 0 ? 'Out of Stock' : 'Add to Shopping Cart'}
          >
            {isAdded ? (
              <>
                <Check size={14} />
                <span>Added!</span>
              </>
            ) : (
              <>
                <ShoppingCart size={14} />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
