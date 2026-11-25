import React from 'react';
import {
  Truck,
  Sparkles,
  Tag,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader,
  X
} from 'lucide-react';
import { formatINR } from './productsService.js';

/**
 * Responsive Promotion & Personalized Discount Banner
 *
 * Truthfulness & Personalization Guarantees:
 * - Displays the free-shipping threshold banner (e.g. "Add ₹300 more to qualify for free shipping")
 *   ONLY when `pricing.freeShippingEnabled` is true and a valid threshold applies.
 * - Updates reactively whenever cart items, quantities, coupon, or shipping method change.
 * - Renders `personalizedOffer` ONLY when an active, date-valid configured promotion matches
 *   permitted shopping signals; otherwise shows normal `availablePromotions`.
 * - Includes explicit loading, error (with Retry), and catalog price-adjustment notices.
 */
export function PromotionBanner({
  pricing,
  isLoading = false,
  error = null,
  onRetry = null,
  priceAdjustments = [],
  onDismissPriceAdjustments = null,
  onApplyCode = null,
  appliedCoupon = null,
  compact = false
}) {
  if (!pricing && !isLoading && !error) return null;

  const subtotal = Number(pricing?.subtotal || 0);
  const nextTier = pricing?.nextTierIncentive || null;
  const activeTier = pricing?.activeTier || null;
  const personalizedOffer = pricing?.personalizedOffer || null;
  const availablePromotions = Array.isArray(pricing?.availablePromotions)
    ? pricing.availablePromotions
    : [];
  const freeShippingEnabled = Boolean(pricing?.freeShippingEnabled);
  const freeShippingThreshold = pricing?.freeShippingThreshold;
  const qualifiesForFreeShipping = Boolean(pricing?.qualifiesForFreeShipping);
  const shippingMethod = pricing?.shippingMethod || 'standard';
  const appliedCode = (
    pricing?.validatedCoupon?.code ||
    appliedCoupon?.code ||
    ''
  ).toUpperCase();

  const showFreeShippingProgress =
    freeShippingEnabled &&
    Number(freeShippingThreshold) > 0 &&
    shippingMethod === 'standard' &&
    nextTier?.type === 'free_shipping';

  const showFreeShippingUnlocked =
    subtotal > 0 &&
    shippingMethod === 'standard' &&
    qualifiesForFreeShipping &&
    (freeShippingEnabled || pricing?.freeShippingFromCoupon);

  // When no personalized offer is eligible, pick up to 2 unapplied normal promotions
  const normalOffersToShow = !personalizedOffer
    ? availablePromotions.filter((p) => !p.isApplied).slice(0, compact ? 1 : 2)
    : [];

  return (
    <div
      role="region"
      aria-label="Promotions and savings"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '0.6rem' : '0.75rem',
        width: '100%'
      }}
    >
      {/* 1. Error State with Retry */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                background: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fecaca',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <RefreshCw size={11} /> Retry
            </button>
          )}
        </div>
      )}

      {/* 2. Catalog Price Sync Notice (if DB price changed before checkout) */}
      {Array.isArray(priceAdjustments) && priceAdjustments.length > 0 && (
        <div
          role="status"
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fde68a',
            fontSize: '0.76rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', lineHeight: 1.4 }}>
            <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Live price update:</strong>{' '}
              {priceAdjustments
                .map(
                  (adj) =>
                    `${adj.name} updated to ${formatINR(adj.trustedPrice)}`
                )
                .join('; ')}
              . Totals have been recalculated.
            </div>
          </div>
          {onDismissPriceAdjustments && (
            <button
              type="button"
              onClick={onDismissPriceAdjustments}
              aria-label="Dismiss price notice"
              style={{
                background: 'none',
                border: 'none',
                color: '#fcd34d',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* 3. Threshold Progress Banner (Free Shipping or Next Configured Cart Tier) */}
      {subtotal > 0 && (showFreeShippingProgress || showFreeShippingUnlocked || nextTier || activeTier) && (
        <div
          style={{
            padding: compact ? '0.75rem 0.85rem' : '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: showFreeShippingProgress
              ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(99, 102, 241, 0.12))'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.09), rgba(99, 102, 241, 0.11))',
            border: showFreeShippingProgress
              ? '1px solid rgba(56, 189, 248, 0.3)'
              : '1px solid rgba(99, 102, 241, 0.28)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          {/* Top Status Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.35 }}>
              {showFreeShippingProgress ? (
                <>
                  <Truck size={15} color="#38bdf8" style={{ flexShrink: 0 }} />
                  <span>{nextTier.message}</span>
                </>
              ) : showFreeShippingUnlocked ? (
                <>
                  <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
                  <span style={{ color: '#6ee7b7' }}>
                    {pricing?.freeShippingFromCoupon
                      ? `Free Standard Shipping unlocked with ${appliedCode}!`
                      : 'You qualify for FREE Standard Shipping!'}
                  </span>
                </>
              ) : activeTier ? (
                <>
                  <Sparkles size={15} color="#10b981" style={{ flexShrink: 0 }} />
                  <span style={{ color: '#6ee7b7' }}>{activeTier.label} applied!</span>
                </>
              ) : nextTier ? (
                <>
                  <Sparkles size={15} color="#818cf8" style={{ flexShrink: 0 }} />
                  <span>{nextTier.message}</span>
                </>
              ) : null}
            </div>

            {isLoading && (
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Loader size={11} className="spin" /> Syncing...
              </span>
            )}
          </div>

          {/* Secondary Tier Progress when Free Shipping is already unlocked */}
          {!showFreeShippingProgress && nextTier && (showFreeShippingUnlocked || activeTier) && (
            <div style={{ fontSize: '0.75rem', color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: '0.4rem', lineHeight: 1.35 }}>
              <Sparkles size={13} color="#818cf8" style={{ flexShrink: 0 }} />
              <span>{nextTier.message}</span>
            </div>
          )}

          {/* Progress Bar */}
          {nextTier && typeof nextTier.progressPercent === 'number' && (
            <div
              aria-hidden="true"
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.08)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(4, nextTier.progressPercent))}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: showFreeShippingProgress
                    ? 'linear-gradient(90deg, #38bdf8, #6366f1)'
                    : 'linear-gradient(90deg, #10b981, #6366f1)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. Personalized Offer (ONLY when permitted shopping signals match an active configured offer) */}
      {subtotal > 0 && personalizedOffer && onApplyCode && appliedCode !== personalizedOffer.code && (
        <div
          style={{
            padding: compact ? '0.7rem 0.85rem' : '0.8rem 0.95rem',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(99, 102, 241, 0.12))',
            border: '1px solid rgba(236, 72, 153, 0.32)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.6rem'
          }}
        >
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', fontWeight: 700, color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Sparkles size={12} /> {personalizedOffer.title}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#f1f5f9', marginTop: '0.2rem', lineHeight: 1.35 }}>
              {personalizedOffer.message}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onApplyCode(personalizedOffer.code)}
            style={{
              background: 'rgba(236, 72, 153, 0.2)',
              border: '1px solid rgba(236, 72, 153, 0.45)',
              color: '#fbcfe8',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.7rem',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            Apply {personalizedOffer.code}
          </button>
        </div>
      )}

      {/* 5. Normal Promotions Fallback (shown when no personalized offer is eligible) */}
      {subtotal > 0 && !personalizedOffer && normalOffersToShow.length > 0 && onApplyCode && !appliedCode && (
        <div
          style={{
            padding: compact ? '0.65rem 0.8rem' : '0.75rem 0.9rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem'
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Tag size={11} color="#818cf8" /> Available Promotions
          </div>
          {normalOffersToShow.map((promo) => (
            <div
              key={promo.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                flexWrap: 'wrap',
                fontSize: '0.75rem'
              }}
            >
              <div style={{ color: 'var(--text-muted)', flex: '1 1 160px', lineHeight: 1.35 }}>
                <strong style={{ color: '#c7d2fe' }}>{promo.code}</strong>: {promo.description}
              </div>
              {promo.isEligibleNow ? (
                <button
                  type="button"
                  onClick={() => onApplyCode(promo.code)}
                  style={{
                    background: 'rgba(99, 102, 241, 0.16)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: '#c7d2fe',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.22rem 0.55rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  Apply
                </button>
              ) : (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
                  Add {formatINR(promo.neededSubtotal)} more
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PromotionBanner;

