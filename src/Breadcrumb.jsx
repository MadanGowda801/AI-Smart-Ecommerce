import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useNavigation } from './NavigationContext';

export function Breadcrumb({ items = [] }) {
  const { navigate } = useNavigation();

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.825rem',
        color: 'var(--text-muted)',
        margin: '0.75rem 0 1.5rem',
        flexWrap: 'wrap'
      }}
    >
      <button
        onClick={() => navigate('home')}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          cursor: 'pointer',
          padding: 0,
          fontSize: 'inherit'
        }}
      >
        <Home size={14} />
        <span>Home</span>
      </button>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight size={13} color="var(--text-subtle)" />
            {isLast || !item.path ? (
              <span style={{ color: isLast ? 'var(--text-main)' : 'inherit', fontWeight: isLast ? 600 : 400 }}>
                {item.label}
              </span>
            ) : (
              <button
                onClick={() => navigate(item.path, { params: item.params, query: item.query })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 'inherit'
                }}
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;
