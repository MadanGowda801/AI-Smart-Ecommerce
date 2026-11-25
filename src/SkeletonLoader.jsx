import React from 'react';

export function ProductSkeletonGrid({ count = 8 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card-glass animate-pulse"
          style={{ padding: '1rem', height: '360px', display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ height: '180px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.06)', marginBottom: '1rem' }} />
          <div style={{ height: '14px', width: '35%', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', marginBottom: '0.6rem' }} />
          <div style={{ height: '18px', width: '85%', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', marginBottom: '0.4rem' }} />
          <div style={{ height: '18px', width: '60%', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', marginBottom: '1rem' }} />
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ height: '24px', width: '70px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ height: '32px', width: '80px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.06)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeletonRows({ rows = 5, cols = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="animate-pulse"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: '1rem',
            padding: '1rem',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              style={{
                height: '16px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.06)',
                width: c === 0 ? '70%' : '50%'
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function SkeletonLoader({ type = 'card', count = 4, rows = 5, cols = 5 }) {
  if (type === 'table') {
    return <TableSkeletonRows rows={rows} cols={cols} />;
  }
  return <ProductSkeletonGrid count={count} />;
}
