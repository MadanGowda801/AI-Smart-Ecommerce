import React from 'react';
import { Truck, Lock, LogIn } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';

/**
 * Role-Based Route Guard for Delivery Personnel Dashboard.
 * Strictly blocks unauthenticated users and customer accounts from viewing
 * assigned delivery records.
 */
export function DeliveryRoute({ children }) {
  const { user, loading, isDeliveryPersonnel, isAdmin } = useAuth();
  const { navigate } = useNavigation();

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Verifying delivery personnel credentials…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', maxWidth: '520px', textAlign: 'center' }}>
        <div className="card-glass" style={{ padding: '2.5rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: 'var(--accent-primary)' }}>
            <Truck size={26} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Delivery Personnel Login Required</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Sign in with an authorized Delivery Personnel account (e.g. <strong>delivery@smartshop.in</strong>) to view your assigned deliveries.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('login')} style={{ width: '100%' }}>
            <LogIn size={16} /> Sign In to Delivery Portal
          </button>
        </div>
      </div>
    );
  }

  if (!isDeliveryPersonnel && !isAdmin) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', maxWidth: '520px', textAlign: 'center' }}>
        <div className="card-glass" style={{ padding: '2.5rem', borderColor: 'rgba(239, 68, 68, 0.35)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#f87171' }}>
            <Lock size={26} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Access Restricted</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            This dashboard is restricted to authorized Delivery Personnel. Customer accounts cannot view other customers' delivery assignments.
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('home')}>
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  return children;
}

export default DeliveryRoute;

