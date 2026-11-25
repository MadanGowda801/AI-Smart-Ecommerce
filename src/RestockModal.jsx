import React, { useState, useEffect } from 'react';
import { Package, X, Check, AlertTriangle, Plus, ArrowUpRight } from 'lucide-react';
import { formatINR } from './mockData';

/**
 * RestockModal
 * 
 * Interactive warehouse restock modal for administrators:
 * - Displays current stock level with color-coded threshold tags
 * - Quick-add buttons (+5, +10, +25, +50, +100 units)
 * - Direct numeric input for exact target stock
 * - Live diff preview (+X units added)
 * - Persists directly to InsForge PostgreSQL database
 */
export default function RestockModal({ product, isOpen, onClose, onRestockSuccess }) {
  if (!isOpen || !product) return null;

  const currentStock = Number(product.stock ?? 0);
  const [targetStock, setTargetStock] = useState(currentStock);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setTargetStock(Number(product.stock ?? 0));
    setErrorMsg('');
    setSuccessMsg('');
  }, [product]);

  const diff = targetStock - currentStock;
  const isCritical = targetStock <= 5;
  const isLow = targetStock > 5 && targetStock <= 10;
  const statusColor = isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#10b981';
  const statusLabel = isCritical ? 'Critical (≤5)' : isLow ? 'Low Stock (≤10)' : 'Healthy In Stock';

  const handleQuickAdd = (increment) => {
    setTargetStock((prev) => Math.max(0, prev + increment));
  };

  const handleConfirmRestock = async () => {
    if (targetStock < 0 || isNaN(targetStock)) {
      setErrorMsg('Stock cannot be negative.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const res = await onRestockSuccess(product.id, targetStock);
      if (res && res.error) {
        setErrorMsg(res.error.message || 'Failed to update stock in InsForge DB.');
        setSaving(false);
        return;
      }

      setSuccessMsg(`Successfully updated stock for ${product.name} to ${targetStock} units!`);
      setTimeout(() => {
        setSaving(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('[RestockModal] Error:', err);
      setErrorMsg(err.message || 'An error occurred while updating stock.');
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="card-glass"
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '20px',
          background: 'linear-gradient(145deg, #181824 0%, #10101a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Package size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Restock Product Units</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Immediate warehouse replenishment & catalog update
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Product Details Card */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <img
              src={product.image || product.image_url}
              alt={product.name}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '8px',
                objectFit: 'cover',
                background: '#12121c',
                flexShrink: 0
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {product.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>{product.category}</span>
                <span>•</span>
                <span>{formatINR(product.price)}</span>
                <span>•</span>
                <code style={{ fontSize: '0.72rem', color: '#a5b4fc' }}>ID: {product.id?.slice(0, 10)}...</code>
              </div>
            </div>
          </div>
        </div>

        {/* Current vs New Stock Stats */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Current Warehouse Stock
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px' }}>
                {currentStock} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>units</span>
              </div>
            </div>

            <div style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 600 }}>
                  New Stock Target
                </span>
                {diff !== 0 && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: diff > 0 ? '#10b981' : '#f87171'
                  }}>
                    {diff > 0 ? `+${diff}` : diff} units
                  </span>
                )}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#818cf8', marginTop: '4px' }}>
                {targetStock} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>units</span>
              </div>
            </div>
          </div>

          {/* Direct Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Set Target Stock Units Directly:
            </label>
            <input
              type="number"
              min="0"
              value={targetStock}
              onChange={(e) => setTargetStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontSize: '1.1rem',
                fontWeight: 700
              }}
            />
          </div>

          {/* Quick Increment Buttons */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Quick Warehouse Additions:
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[5, 10, 25, 50, 100].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => handleQuickAdd(inc)}
                  style={{
                    flex: '1 1 auto',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                    e.currentTarget.style.borderColor = '#6366f1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }}
                >
                  <Plus size={14} /> {inc}
                </button>
              ))}
            </div>
          </div>

          {/* Status Alert Banner */}
          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: `${statusColor}15`,
            border: `1px solid ${statusColor}35`,
            color: statusColor,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <span>New Status Level: <strong>{statusLabel}</strong></span>
            {targetStock > 0 && <span>Available on Storefront</span>}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <Check size={16} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn btn-secondary"
            style={{ padding: '10px 18px', fontSize: '0.88rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmRestock}
            disabled={saving}
            className="btn btn-primary"
            style={{
              padding: '10px 24px',
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {saving ? (
              <>
                <div style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }} />
                Saving to InsForge...
              </>
            ) : (
              <>
                <Check size={16} /> Confirm Restock ({targetStock} units)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
