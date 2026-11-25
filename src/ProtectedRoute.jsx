import React from 'react';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import { Lock, ArrowRight, ShieldAlert, Sparkles, UserPlus } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';

/**
 * ProtectedRoute: Gates customer pages (Profile, Orders, Order Details, Checkout)
 * 
 * - Shows loading state during initial InsForge session check
 * - Prompts unauthenticated users to sign in with real InsForge credentials
 * - Includes direct CTA to login and register pages
 */
export default function ProtectedRoute({ children, title = 'Authentication Required', message = 'Please sign in to your SmartShop account to access this page.' }) {
  const { user, loading, loginAsCustomer } = useAuth();
  const { navigate } = useNavigation();

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem', width: '40px', height: '40px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Verifying InsForge Session...</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Securely authenticating with cloud backend</p>
        </div>
        <SkeletonLoader type="card" count={2} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ minHeight: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div className="card-glass" style={{ maxWidth: '480px', width: '100%', padding: '2.5rem', textAlign: 'center', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.25)', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', marginBottom: '1.25rem' }}>
            <Lock size={30} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem' }}>{title}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '2rem' }}>
            {message}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('login')}
              style={{ justifyContent: 'center', padding: '0.8rem' }}
            >
              Sign In to Continue <ArrowRight size={16} />
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => navigate('register')}
              style={{ justifyContent: 'center', padding: '0.8rem' }}
            >
              <UserPlus size={16} /> Create Free Account
            </button>

            <div style={{ marginTop: '0.75rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                onClick={async () => {
                  await loginAsCustomer();
                }}
                style={{ background: 'none', border: 'none', color: '#a5b4fc', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
              >
                <Sparkles size={13} color="#ec4899" /> One-Click Sign In with Real Demo Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
