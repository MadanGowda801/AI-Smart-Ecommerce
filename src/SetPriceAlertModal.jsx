import React, { useState } from 'react';
import { X, Bell, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import priceTrackerService from './priceTrackerService';
import { formatINR } from './productsService';

export function SetPriceAlertModal({ isOpen, onClose, product, onAlertCreated }) {
  const { user } = useAuth();
  const { navigate } = useNavigation();

  const effectiveUser = user || (() => {
    try {
      const stored = localStorage.getItem('smartshop_active_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  const currentPrice = Number(product?.price || 0);

  const [targetPrice, setTargetPrice] = useState(() => Math.round(currentPrice * 0.9));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen || !product) return null;

  const handlePercentageSelect = (percent) => {
    const discounted = Math.round(currentPrice * (1 - percent / 100));
    setTargetPrice(discounted);
    setErrorMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentUser = user || (() => {
      try {
        const stored = localStorage.getItem('smartshop_active_user');
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    })();

    if (!currentUser) {
      navigate('login');
      onClose();
      return;
    }

    const numericTarget = Number(targetPrice);
    if (!numericTarget || numericTarget <= 0) {
      setErrorMsg('Target price must be greater than ₹0.');
      return;
    }

    if (numericTarget >= currentPrice) {
      setErrorMsg(`Target price must be lower than the current price of ${formatINR(currentPrice)}.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, updated, error } = await priceTrackerService.setPriceAlert({
        productId: product.id,
        targetPrice: numericTarget,
        currentPrice,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to save price alert. Please try again.');
      } else {
        setSuccessMsg(
          updated
            ? `Price alert updated! Target price set to ${formatINR(numericTarget)}.`
            : `Price alert set! You will be notified as soon as verified catalog price reaches ${formatINR(numericTarget)}.`
        );
        if (typeof onAlertCreated === 'function') {
          onAlertCreated(data);
        }
        setTimeout(() => {
          onClose();
          setSuccessMsg(null);
        }, 1800);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unexpected error setting price alert.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="set-price-alert-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        id="set-price-alert-modal-dialog"
        style={{
          background: 'rgba(17, 24, 39, 0.98)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '440px',
          padding: '1.5rem',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                Set Target Price Alert
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Smart Price Tracker · InsForge Verified
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Product Snapshot */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '1.25rem' }}>
          <img
            src={product.image || product.imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200'}
            alt={product.name}
            style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{product.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Current Price:</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#818cf8' }}>{formatINR(currentPrice)}</span>
            </div>
          </div>
        </div>

        {!effectiveUser ? (
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '1rem' }}>
              Please sign in to save this product and receive price drop alerts.
            </p>
            <button
              onClick={() => {
                onClose();
                navigate('login');
              }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.65rem' }}
            >
              Sign In to Track Price
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Quick Percentage Chips */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Quick Discount Target:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[5, 10, 15, 20].map((pct) => {
                  const val = Math.round(currentPrice * (1 - pct / 100));
                  const isSelected = targetPrice === val;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handlePercentageSelect(pct)}
                      style={{
                        background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${isSelected ? '#818cf8' : 'rgba(255, 255, 255, 0.08)'}`,
                        color: isSelected ? '#fff' : '#cbd5e1',
                        borderRadius: '8px',
                        padding: '6px 0',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      -{pct}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Price Numeric Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Your Target Price (₹ INR):
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>₹</span>
                <input
                  type="number"
                  min="1"
                  max={currentPrice - 1}
                  value={targetPrice}
                  onChange={(e) => {
                    setTargetPrice(e.target.value);
                    setErrorMsg(null);
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>
              {targetPrice < currentPrice && (
                <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '4px' }}>
                  Target discount: {Math.round(((currentPrice - targetPrice) / currentPrice) * 100)}% off current price (saves {formatINR(currentPrice - targetPrice)})
                </div>
              )}
            </div>

            {/* Error / Success Feedback */}
            {errorMsg && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', padding: '8px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1rem' }}>
                <AlertCircle size={14} />
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', borderRadius: '8px', padding: '8px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1rem' }}>
                <CheckCircle2 size={14} />
                {successMsg}
              </div>
            )}

            {/* Submit CTA */}
            <button
              id="submit-price-alert-btn"
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.88rem', fontWeight: 700, gap: '6px' }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Saving Target Alert...
                </>
              ) : (
                <>
                  <Bell size={16} />
                  Activate Price Alert
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default SetPriceAlertModal;
