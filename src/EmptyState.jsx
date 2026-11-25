import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useNavigation } from './NavigationContext';

export function EmptyState({
  icon: Icon = ShoppingBag,
  title = 'No items found',
  description = 'Looks like there is nothing to display here right now.',
  actionLabel = 'Explore Products',
  actionPath = 'products',
  onAction
}) {
  const { navigate } = useNavigation();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionPath) {
      navigate(actionPath);
    }
  };

  return (
    <div
      className="card-glass"
      style={{
        padding: '3.5rem 1.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '520px',
        margin: '2rem auto',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#818cf8',
          marginBottom: '1.25rem'
        }}
      >
        <Icon size={28} />
      </div>

      <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '380px', marginBottom: '1.75rem', lineHeight: 1.5 }}>
        {description}
      </p>

      {actionLabel && (
        <button className="btn btn-primary" onClick={handleAction}>
          <span>{actionLabel}</span>
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

export default EmptyState;
