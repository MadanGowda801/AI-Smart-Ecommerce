import React, { useState } from 'react';
import { Heart, ShoppingCart, Trash2, ArrowRight, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useWishlist } from './WishlistContext';
import { useCart } from './CartContext';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import Breadcrumb from './Breadcrumb';
import EmptyState from './EmptyState';
import { formatINR } from './productsService';

export function WishlistPage() {
  const { wishlistItems, removeFromWishlist, moveToCart, isLoading, error, refreshWishlist } = useWishlist();
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const [movingAll, setMovingAll] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [confirmRemoveItem, setConfirmRemoveItem] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleMoveAll = async () => {
    setMovingAll(true);
    let movedCount = 0;
    for (const item of wishlistItems) {
      if (item.stock > 0) {
        await moveToCart(item);
        movedCount++;
      }
    }
    setMovingAll(false);
    showToast(`Moved ${movedCount} item${movedCount !== 1 ? 's' : ''} to your cart!`);
  };

  const handleSingleMove = async (item) => {
    const res = await moveToCart(item);
    if (res?.success) {
      showToast(`Moved "${item.name}" to cart!`);
    } else {
      showToast(res?.error || 'Could not move item to cart');
    }
  };

  // Loading state
  if (isLoading && wishlistItems.length === 0) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
        <Breadcrumb items={[{ label: 'My Wishlist' }]} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-glass" style={{ height: '320px', opacity: 0.6, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (wishlistItems.length === 0) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
        <Breadcrumb items={[{ label: 'My Wishlist' }]} />
        <EmptyState
          icon={Heart}
          title="Your Wishlist is Empty"
          description="Save products you love to your wishlist. Everything is persisted directly in your database account."
          actionLabel="Explore Live Products"
          actionPath="products"
        />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb items={[{ label: 'My Wishlist' }]} />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1000,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-primary)',
            color: '#fff',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            animation: 'fadeIn 0.25s ease'
          }}
        >
          <CheckCircle2 size={18} color="#10b981" />
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            My <span className="gradient-text">Wishlist</span>
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
              ({wishlistItems.length} saved item{wishlistItems.length !== 1 ? 's' : ''})
            </span>
          </h1>
          {user && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
              Saved to InsForge Cloud DB for <strong>{user.email}</strong>
            </p>
          )}
        </div>

        <button
          className="btn btn-primary"
          onClick={handleMoveAll}
          disabled={movingAll || wishlistItems.every((i) => i.stock === 0)}
          style={{ fontSize: '0.875rem' }}
        >
          <ShoppingCart size={16} />
          <span>{movingAll ? 'Moving Items...' : 'Move All to Cart'}</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} color="#ef4444" />
            <span style={{ fontSize: '0.875rem' }}>Wishlist sync error: {error}</span>
          </div>
          <button onClick={refreshWishlist} className="btn btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', gap: '4px' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Wishlist Items Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.5rem' }}>
        {wishlistItems.map((item) => {
          const isOutOfStock = item.stock <= 0;

          return (
            <div
              key={item.id || item.productId}
              className="card-glass"
              style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              {/* Product Image */}
              <div
                onClick={() => navigate('product-details', { params: { id: item.id || item.productId } })}
                style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '180px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', position: 'relative' }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease', opacity: isOutOfStock ? 0.6 : 1 }}
                />
                {isOutOfStock && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase' }}>Sold Out</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  {item.category}
                </div>
                <h3
                  onClick={() => navigate('product-details', { params: { id: item.id || item.productId } })}
                  style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '0.5rem', cursor: 'pointer', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                  {item.name}
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatINR(item.price)}</span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', textDecoration: 'line-through', marginLeft: '0.5rem' }}>
                        {formatINR(item.originalPrice)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: !isOutOfStock ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                    {!isOutOfStock ? (item.stock <= 5 ? `Only ${item.stock} left` : 'In Stock') : 'Out of Stock'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSingleMove(item)}
                  disabled={isOutOfStock}
                  style={{ flex: 1, fontSize: '0.8rem', padding: '0.55rem', opacity: isOutOfStock ? 0.4 : 1, cursor: isOutOfStock ? 'not-allowed' : 'pointer' }}
                  title={isOutOfStock ? 'Product out of stock' : 'Move to Cart'}
                >
                  <ShoppingCart size={14} />
                  <span>{isOutOfStock ? 'Sold Out' : 'Move to Cart'}</span>
                </button>

                <button
                  onClick={() => setConfirmRemoveItem(item)}
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 0.75rem', color: 'var(--error)' }}
                  title="Remove from wishlist"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal: Remove from Wishlist */}
      {confirmRemoveItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(5, 8, 18, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease'
          }}
          onClick={() => setConfirmRemoveItem(null)}
        >
          <div
            className="card-glass"
            style={{
              maxWidth: '420px',
              width: '100%',
              padding: '1.5rem',
              borderRadius: '18px',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              background: 'rgba(15, 20, 35, 0.98)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
              Remove from Wishlist?
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Are you sure you want to remove <strong>{confirmRemoveItem.name}</strong> from your saved items?
            </p>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={() => setConfirmRemoveItem(null)}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', padding: '0.65rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const idToRemove = confirmRemoveItem.id || confirmRemoveItem.productId;
                  setConfirmRemoveItem(null);
                  removeFromWishlist(idToRemove);
                }}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '0.65rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={15} /> Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WishlistPage;
