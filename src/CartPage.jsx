import React, { useState, useEffect } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Tag, ArrowRight, ShoppingBag, X, AlertTriangle, AlertCircle, RefreshCw, CheckCircle2, Sparkles, Heart } from 'lucide-react';
import { useCart } from './CartContext';
import { useWishlist } from './WishlistContext';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import { useRecommendations } from './RecommendationContext';
import Breadcrumb from './Breadcrumb';
import EmptyState from './EmptyState';
import ProductCard from './ProductCard';
import PromotionBanner from './PromotionBanner';
import { formatINR } from './productsService';

export function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    removeUnavailableItems,
    hasUnavailableItems,
    unavailableCount,
    isLoading,
    error,
    refreshCart,
    subtotal,
    shippingFee,
    discountAmount,
    tierDiscount,
    activeTier,
    couponDiscount,
    discountCapped,
    pricing,
    isPricingLoading,
    pricingError,
    priceAdjustments,
    dismissPriceAdjustments,
    refreshPricing,
    tax,
    grandTotal,
    appliedCoupon,
    couponError,
    applyCoupon,
    removeCoupon
  } = useCart();

  const { user } = useAuth();
  const { addToWishlist } = useWishlist();
  const { navigate } = useNavigation();
  const { getCartRecommendations, recommendations } = useRecommendations();
  const [couponCode, setCouponCode] = useState('');
  const [checkoutWarning, setCheckoutWarning] = useState('');
  const [cartRecommendations, setCartRecommendations] = useState([]);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState(null);
  const [confirmClearCart, setConfirmClearCart] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cartProdIds = items.map((i) => i.productId || i.id);
    getCartRecommendations(cartProdIds, { limit: 4 }).then((res) => {
      if (!cancelled && res && res.length > 0) {
        setCartRecommendations(res);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [items, getCartRecommendations]);

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    if (couponCode.trim()) {
      applyCoupon(couponCode);
    }
  };

  const handleProceedToCheckout = () => {
    if (hasUnavailableItems) {
      setCheckoutWarning('Please remove unavailable items from your cart before proceeding to checkout.');
      return;
    }
    setCheckoutWarning('');
    if (!user) {
      navigate('login');
    } else {
      navigate('checkout');
    }
  };

  // Loading state
  if (isLoading && items.length === 0) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
        <Breadcrumb items={[{ label: 'Shopping Cart' }]} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-glass" style={{ height: '110px', opacity: 0.6, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
        <Breadcrumb items={[{ label: 'Shopping Cart' }]} />
        <EmptyState
          icon={ShoppingCart}
          title="Your Cart is Empty"
          description="Add items from our catalog to start shopping. All your items are persisted directly in our database when signed in."
          actionLabel="Explore Live Products"
          actionPath="products"
        />

        {recommendations.length > 0 && (
          <section style={{ marginTop: '3.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
              <Sparkles size={14} color="#ec4899" />
              <span>Recommended For You</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>
              Popular Picks to Get You Started
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Handpicked electronics and accessories ready for immediate dispatch.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {recommendations.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb items={[{ label: 'Shopping Cart' }]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            Shopping <span className="gradient-text">Cart</span>
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
              ({items.length} item{items.length !== 1 ? 's' : ''})
            </span>
          </h1>
          {user && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
              Synced with InsForge Cloud DB for <strong>{user.email}</strong>
            </p>
          )}
        </div>

        <button
          onClick={() => setConfirmClearCart(true)}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s ease'
          }}
        >
          <Trash2 size={15} /> Clear Cart
        </button>
      </div>

      {/* Error Banner */}
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
            <span style={{ fontSize: '0.875rem' }}>Database sync error: {error}</span>
          </div>
          <button onClick={refreshCart} className="btn btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', gap: '4px' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Unavailable Items Notice Banner */}
      {hasUnavailableItems && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={18} color="#f59e0b" />
            <span style={{ fontSize: '0.875rem' }}>
              <strong>{unavailableCount}</strong> item{unavailableCount > 1 ? 's' : ''} in your cart is currently out of stock and excluded from the total.
            </span>
          </div>
          <button
            onClick={removeUnavailableItems}
            style={{
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fcd34d',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Remove Unavailable Items
          </button>
        </div>
      )}

      {checkoutWarning && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '0.85rem 1.25rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <AlertCircle size={16} color="#ef4444" />
          <span>{checkoutWarning}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'flex-start' }} className="cart-layout">
        {/* Cart Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => {
            const isOutOfStock = item.isUnavailable || (item.stock !== undefined && item.stock <= 0);
            const maxAllowed = Number(item.stock ?? 99);

            return (
              <div
                key={item.id}
                className="card-glass"
                style={{
                  padding: '1.25rem',
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr auto',
                  gap: '1.25rem',
                  alignItems: 'center',
                  border: isOutOfStock ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-subtle)',
                  background: isOutOfStock ? 'rgba(239, 68, 68, 0.03)' : undefined
                }}
              >
                {/* Product Image */}
                <div
                  onClick={() => navigate('product-details', { params: { id: item.id || item.productId } })}
                  style={{ width: '90px', height: '90px', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', flexShrink: 0, position: 'relative' }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isOutOfStock ? 0.6 : 1 }}
                  />
                  {isOutOfStock && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase' }}>Sold Out</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {item.category}
                    </span>
                    {isOutOfStock ? (
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                        Unavailable
                      </span>
                    ) : item.stock <= 5 ? (
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                        Only {item.stock} left in stock
                      </span>
                    ) : null}
                  </div>

                  <h3
                    onClick={() => navigate('product-details', { params: { id: item.id || item.productId } })}
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      cursor: 'pointer',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: isOutOfStock ? 'var(--text-muted)' : undefined
                    }}
                  >
                    {item.name}
                  </h3>

                  {/* Quantity Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {!isOutOfStock ? (
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        <button
                          onClick={() => {
                            if (item.quantity <= 1) {
                              setConfirmRemoveItem(item);
                            } else {
                              updateQuantity(item.id, item.quantity - 1);
                            }
                          }}
                          style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '0.35rem 0.65rem', cursor: 'pointer', lineHeight: 1 }}
                          title={item.quantity <= 1 ? 'Remove item' : 'Decrease quantity'}
                        >
                          <Minus size={13} />
                        </button>
                        <span style={{ padding: '0.35rem 0.85rem', fontWeight: 700, fontSize: '0.9rem', borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= maxAllowed}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            color: '#fff',
                            padding: '0.35rem 0.65rem',
                            cursor: item.quantity >= maxAllowed ? 'not-allowed' : 'pointer',
                            opacity: item.quantity >= maxAllowed ? 0.35 : 1,
                            lineHeight: 1
                          }}
                          title={item.quantity >= maxAllowed ? `Stock limit of ${maxAllowed} reached` : 'Increase quantity'}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#f87171' }}>Cannot increase (out of stock)</span>
                    )}

                    <button
                      onClick={() => setConfirmRemoveItem(item)}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600 }}
                      title="Remove item"
                    >
                      <X size={14} /> Remove
                    </button>
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: isOutOfStock ? 'var(--text-muted)' : undefined }}>
                    {formatINR(item.price * item.quantity)}
                  </div>
                  {item.quantity > 1 && !isOutOfStock && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                      {formatINR(item.price)} × {item.quantity}
                    </div>
                  )}
                  {item.originalPrice && item.originalPrice > item.price && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textDecoration: 'line-through' }}>
                      {formatINR(item.originalPrice * item.quantity)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Continue Shopping */}
          <button
            onClick={() => navigate('products')}
            style={{ background: 'none', border: '1px dashed var(--border-light)', color: 'var(--text-muted)', padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all var(--transition-fast)' }}
          >
            <ShoppingBag size={16} /> Continue Shopping
          </button>
        </div>

        {/* Order Summary */}
        <div className="card-glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Order Summary</h3>

          {/* Responsive Promotion & Personalized Discount Banner */}
          <PromotionBanner
            pricing={pricing}
            isLoading={isPricingLoading}
            error={pricingError}
            onRetry={refreshPricing}
            priceAdjustments={priceAdjustments}
            onDismissPriceAdjustments={dismissPriceAdjustments}
            appliedCoupon={appliedCoupon}
            onApplyCode={(code) => {
              setCouponCode('');
              applyCoupon(code);
            }}
          />

          {/* Coupon Code */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>
              Promo / Coupon Code
            </label>
            {appliedCoupon ? (
              <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.875rem' }}>
                  <Tag size={13} style={{ display: 'inline', marginRight: '0.35rem' }} />
                  {appliedCoupon.code} applied!
                </span>
                <button onClick={removeCoupon} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} title="Remove coupon">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="e.g. SMART10, FIRSTBUY, AUDIO15"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
                <button type="submit" className="btn btn-secondary" style={{ padding: '0.55rem 0.85rem', fontSize: '0.825rem' }}>
                  Apply
                </button>
              </form>
            )}
            {couponError && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.35rem' }}>{couponError}</div>}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal ({items.filter(i => !i.isUnavailable).length} available items)</span>
              <span style={{ fontWeight: 600 }}>{formatINR(subtotal)}</span>
            </div>

            {/* Instant Tier Discount */}
            {tierDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#10b981' }}>
                <span>{activeTier?.label?.split('(')[0]?.trim() || 'Tier Discount'}</span>
                <span style={{ fontWeight: 600 }}>-{formatINR(tierDiscount)}</span>
              </div>
            )}

            {/* Coupon Discount */}
            {(couponDiscount > 0 || pricing?.freeShippingFromCoupon) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--success)' }}>
                <span>Coupon ({appliedCoupon?.code || pricing?.validatedCoupon?.code})</span>
                <span style={{ fontWeight: 600 }}>
                  {pricing?.freeShippingFromCoupon && couponDiscount === 0
                    ? 'FREE Shipping'
                    : `-${formatINR(couponDiscount)}`}
                </span>
              </div>
            )}

            {discountCapped && (
              <div style={{ fontSize: '0.72rem', color: '#fbbf24' }}>
                Maximum 35% combined discount cap applied.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Shipping (Standard)</span>
              <span style={{ fontWeight: 600, color: shippingFee === 0 ? 'var(--success)' : undefined }}>
                {shippingFee === 0 ? 'FREE' : formatINR(shippingFee)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Applicable Taxes (GST 5%)</span>
              <span style={{ fontWeight: 600 }}>{formatINR(tax)}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>Final Total</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                {isPricingLoading ? <span style={{ opacity: 0.75 }}>{formatINR(grandTotal)}</span> : formatINR(grandTotal)}
              </div>
              <div style={{ fontSize: '0.72rem', color: discountAmount > 0 ? 'var(--success)' : 'var(--text-subtle)' }}>
                {discountAmount > 0 ? `You save ${formatINR(discountAmount)} on this order` : 'Includes all applicable taxes'}
              </div>
            </div>
          </div>

          <button
            onClick={handleProceedToCheckout}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', justifyContent: 'center', marginTop: '0.5rem' }}
          >
            <span>Proceed to Checkout</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </div>

      {/* AI Recommendation: Frequently Paired With Your Cart */}
      {(cartRecommendations.length > 0 || recommendations.length > 0) && (
        <section style={{ marginTop: '4rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a855f7', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            <Sparkles size={14} color="#a855f7" />
            <span>AI Cart Pairing</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            Frequently Paired With Your Cart
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Complementary cables, cases, accessories, and upgrades selected for your cart items.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {(cartRecommendations.length > 0 ? cartRecommendations : recommendations).slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Confirmation Modal: Remove Single Product from Cart */}
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
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              borderRadius: '18px',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              background: 'rgba(15, 20, 35, 0.98)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', flexShrink: 0 }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                  Remove Product Confirmation
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Please confirm if you want to remove this product from your cart
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.25rem' }}>
              <img
                src={confirmRemoveItem.image}
                alt={confirmRemoveItem.name}
                style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {confirmRemoveItem.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {formatINR(confirmRemoveItem.price)} × {confirmRemoveItem.quantity} = <strong style={{ color: '#fff' }}>{formatINR(confirmRemoveItem.price * confirmRemoveItem.quantity)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
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
                    const idToRemove = confirmRemoveItem.id;
                    setConfirmRemoveItem(null);
                    removeItem(idToRemove);
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

              <button
                onClick={async () => {
                  const itemToMove = confirmRemoveItem;
                  setConfirmRemoveItem(null);
                  await addToWishlist(itemToMove);
                  await removeItem(itemToMove.id);
                }}
                style={{
                  width: '100%',
                  background: 'rgba(236, 72, 153, 0.1)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  color: '#f472b6',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Heart size={14} /> Move to Wishlist Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear Entire Cart */}
      {confirmClearCart && (
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
          onClick={() => setConfirmClearCart(false)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.85rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', flexShrink: 0 }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                  Clear Entire Cart?
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Remove all {items.length} product{items.length !== 1 ? 's' : ''} from your cart
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to remove all items from your shopping cart? This action will empty your cart immediately.
            </p>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={() => setConfirmClearCart(false)}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', padding: '0.65rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmClearCart(false);
                  clearCart();
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
                <Trash2 size={15} /> Yes, Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CartPage;
