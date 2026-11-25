import React from 'react';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import { ShieldAlert, ArrowRight, KeyRound, Sparkles, Store } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';

/**
 * AdminRoute: Gates administrative management consoles
 * 
 * - Verifies that the current InsForge authenticated user has role === 'admin'
 * - Blocks unauthenticated visitors and standard customer accounts
 * - Prompts to sign in via the dedicated Admin Control Center
 */
export default function AdminRoute({ children }) {
  const { user, isAdmin, loading, loginAsAdmin } = useAuth();
  const { navigate } = useNavigation();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');

  const handleQuickLogin = async () => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await loginAsAdmin();
      if (!res.success) {
        setLoginError(res.error || 'Failed to authenticate admin account.');
      }
    } catch (err) {
      setLoginError(err.message || 'Error authenticating admin account.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading || isLoggingIn) {
    return (
      <div style={{ padding: '3rem 2rem', maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem', width: '40px', height: '40px', border: '3px solid rgba(245,158,11,0.2)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
            {isLoggingIn ? 'Authenticating Admin Session...' : 'Verifying Admin Privileges...'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {isLoggingIn ? 'Connecting to InsForge with verified admin credentials' : 'Validating InsForge role & permissions'}
          </p>
        </div>
        <SkeletonLoader type="card" count={2} />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.08) 0%, #0b0f19 70%)' }}>
        <div className="card-glass" style={{ maxWidth: '480px', width: '100%', padding: '2.5rem', textAlign: 'center', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', marginBottom: '1.25rem' }}>
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f59e0b' }}>
            Administrator Access Required
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '2rem' }}>
            {user ? (
              <>You are signed in as <strong>{user.email}</strong>, which does not have administrator privileges. Please switch to an admin account.</>
            ) : (
              <>This section contains store operations, inventory management, and sensitive sales analytics. Please log in with admin credentials.</>
            )}
          </p>

          {loginError && (
            <div style={{ padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.85rem' }}>
              {loginError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('admin-login')}
              style={{ justifyContent: 'center', padding: '0.8rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <KeyRound size={16} /> Admin Portal Sign In <ArrowRight size={16} />
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => navigate('home')}
              style={{ justifyContent: 'center', padding: '0.8rem' }}
            >
              <Store size={16} /> Return to Customer Store
            </button>

            <div style={{ marginTop: '0.75rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                onClick={handleQuickLogin}
                disabled={isLoggingIn}
                style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'underline', fontWeight: 600 }}
              >
                <Sparkles size={14} color="#f59e0b" /> One-Click Sign In as System Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
