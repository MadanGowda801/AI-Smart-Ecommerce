import React, { useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Clock,
  ShieldCheck,
  AlertCircle,
  Bell,
  CheckCircle,
  Calendar
} from 'lucide-react';
import { formatINR } from './productsService';

export function PriceHistoryChart({ priceHistoryData, onOpenSetAlert, currentProduct }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!priceHistoryData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading verified price history...
      </div>
    );
  }

  const { records = [], hasSufficientData, lowestPrice, highestPrice, currentPrice, priceDropPercent } = priceHistoryData;

  // Insufficient verified records state (strict compliance: never fabricate data)
  if (!hasSufficientData || records.length < 2) {
    return (
      <div
        id="price-history-insufficient"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.75rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'rgba(99, 102, 241, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#818cf8',
        }}>
          <Clock size={24} />
        </div>

        <div style={{ maxWidth: '420px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
            Insufficient Historical Price Records
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            This product was recently added to our catalog. TrustCart AI only visualizes authentic verified records from our database and does not fabricate historical price points or claim external market monitoring.
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.72rem',
          color: '#10b981',
          background: 'rgba(16, 185, 129, 0.1)',
          padding: '4px 10px',
          borderRadius: '20px',
          border: '1px solid rgba(16, 185, 129, 0.25)',
        }}>
          <ShieldCheck size={14} />
          Current Verified Catalog Price: {formatINR(currentProduct?.price || currentPrice || 0)}
        </div>

        {onOpenSetAlert && (
          <button
            id="set-alert-insufficient-btn"
            onClick={onOpenSetAlert}
            className="btn btn-primary"
            style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', gap: '0.4rem', marginTop: '0.5rem' }}
          >
            <Bell size={15} />
            Set Target Price Alert
          </button>
        )}
      </div>
    );
  }

  // ── Calculate SVG coordinates for verified price graph ──
  const width = 580;
  const height = 180;
  const paddingX = 45;
  const paddingY = 30;

  const minPrice = lowestPrice * 0.96;
  const maxPrice = highestPrice * 1.04;
  const priceRange = maxPrice - minPrice || 1;

  const points = records.map((record, index) => {
    const x = paddingX + (index / (records.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((record.price - minPrice) / priceRange) * (height - 2 * paddingY);
    return { ...record, x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath = `M ${points[0].x},${height - paddingY} ` +
    points.map((p) => `L ${p.x},${p.y}`).join(' ') +
    ` L ${points[points.length - 1].x},${height - paddingY} Z`;

  return (
    <div
      id="smart-price-tracker-card"
      style={{
        background: 'rgba(15, 20, 35, 0.75)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: '16px',
        padding: '1.5rem',
        backdropFilter: 'blur(16px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Card Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
              Smart Price Tracker
            </h3>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <ShieldCheck size={11} /> Verified Catalog Records
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Track recorded price movements across our verified catalog history.
          </p>
        </div>

        {onOpenSetAlert && (
          <button
            id="open-price-alert-modal-btn"
            onClick={onOpenSetAlert}
            className="btn btn-primary"
            style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', gap: '0.4rem' }}
          >
            <Bell size={14} />
            Set Target Price Alert
          </button>
        )}
      </div>

      {/* ── Key Metrics Badges ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.65rem 0.85rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>All-Time Low</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>{formatINR(lowestPrice)}</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.65rem 0.85rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>All-Time High</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>{formatINR(highestPrice)}</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.65rem 0.85rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Current Price</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#818cf8', marginTop: '2px' }}>{formatINR(currentPrice)}</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.65rem 0.85rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Recorded Data Points</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#cbd5e1', marginTop: '2px' }}>{records.length} Points</div>
        </div>
      </div>

      {/* ── Interactive SVG Price History Chart ── */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', maxHeight: '220px', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.12)" />

          {/* Y Axis Labels */}
          <text x={paddingX - 6} y={paddingY + 4} fill="#64748b" fontSize="9" textAnchor="end">{formatINR(highestPrice)}</text>
          <text x={paddingX - 6} y={height - paddingY + 3} fill="#64748b" fontSize="9" textAnchor="end">{formatINR(lowestPrice)}</text>

          {/* Area under curve */}
          <path d={areaPath} fill="url(#priceGradient)" />

          {/* Line curve */}
          <polyline
            fill="none"
            stroke="#818cf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />

          {/* Points */}
          {points.map((pt, i) => (
            <g key={pt.id || i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint(pt)}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredPoint?.id === pt.id ? 6 : 4}
                fill={hoveredPoint?.id === pt.id ? '#fff' : '#6366f1'}
                stroke="#818cf8"
                strokeWidth="2"
              />
            </g>
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '15px',
              background: 'rgba(20, 26, 46, 0.95)',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '0.74rem',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ color: '#818cf8', fontWeight: 800 }}>{hoveredPoint.formattedPrice}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>{hoveredPoint.formattedDate} · {hoveredPoint.formattedTime}</div>
          </div>
        )}
      </div>

      {/* ── Data Source Assurance Footer ── */}
      <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span>Authentic catalog price log from InsForge database.</span>
        <span>Dates range from {records[0]?.formattedDate} to {records[records.length - 1]?.formattedDate}.</span>
      </div>
    </div>
  );
}

export default PriceHistoryChart;
