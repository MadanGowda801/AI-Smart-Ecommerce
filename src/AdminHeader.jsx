import React from 'react';
import { Shield, Bell, RefreshCw, Store } from 'lucide-react';
import { useNavigation } from './NavigationContext';
import { useAuth } from './AuthContext';
import SystemStatusBadge from './SystemStatusBadge';

export function AdminHeader({ title, subtitle, actionButton }) {
  const { navigate } = useNavigation();
  const { user } = useAuth();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              padding: '0.2rem 0.5rem',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            Store Operations
          </span>
          <SystemStatusBadge />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {actionButton}

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('home')}
          style={{ padding: '0.5rem 0.9rem', fontSize: '0.825rem' }}
          title="Return to customer store"
        >
          <Store size={15} color="#10b981" />
          <span>Live Store</span>
        </button>
      </div>
    </div>
  );
}

export default AdminHeader;
