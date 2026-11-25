import React, { useState } from 'react';
import { Eye, EyeOff, ShoppingBag, ArrowRight, Shield, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';

export function LoginPage() {
  const { login, loading, loginAsCustomer, loginAsAdmin } = useAuth();
  const { navigate } = useNavigation();

  const [email, setEmail] = useState('customer@smartshop.in');
  const [password, setPassword] = useState('CustomerPassword123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        const isAdminUser = result.user?.role === 'admin' || email.toLowerCase().includes('admin');
        const isDeliveryUser = result.user?.role === 'delivery_personnel' || email.toLowerCase().includes('delivery@smartshop.in');
        setSuccessMsg(
          isAdminUser
            ? 'Admin authenticated! Redirecting to Management Console...'
            : isDeliveryUser
            ? 'Delivery Partner authenticated! Opening Delivery Dashboard...'
            : 'Signed in successfully! Redirecting...'
        );
        setTimeout(() => {
          if (isAdminUser) {
            navigate('admin-dashboard');
          } else if (isDeliveryUser) {
            navigate('delivery-dashboard');
          } else {
            navigate('home');
          }
        }, 500);
      } else {
        setError(result.error || 'Invalid email or password. Please verify and try again.');
      }
    } catch (err) {
      setError('Connection to InsForge authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickCustomer = () => {
    setEmail('customer@smartshop.in');
    setPassword('CustomerPassword123!');
    setError('');
  };

  const handleQuickAdmin = () => {
    setEmail('admin@smartshop.in');
    setPassword('AdminPassword123!');
    setError('');
  };

  const handleQuickDelivery = () => {
    setEmail('delivery@smartshop.in');
    setPassword('DeliveryPassword123!');
    setError('');
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 140px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        background: 'radial-gradient(ellipse at top left, rgba(20, 184, 166, 0.14) 0%, transparent 60%)'
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Logo & Heading */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: 'var(--shadow-glow)' }}>
            <ShoppingBag size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.35rem' }}>Welcome Back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Sign in with your verified InsForge account
          </p>
        </div>

        {/* Demo Fast-fill Badges */}
        <div style={{
          padding: '0.85rem 1rem',
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: '#a5b4fc',
          lineHeight: 1.5
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '6px', color: '#fff' }}>
            <Sparkles size={14} color="#ec4899" /> Real InsForge Cloud Test Accounts:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleQuickCustomer}
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Fill Demo Customer
            </button>
            <button
              type="button"
              onClick={handleQuickAdmin}
              style={{
                background: 'var(--gold-soft)',
                border: '1px solid var(--gold-border)',
                color: 'var(--accent-gold-light)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Fill Demo Admin
            </button>
            <button
              type="button"
              onClick={handleQuickDelivery}
              style={{
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-border)',
                color: 'var(--text-accent)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Fill Demo Delivery Agent
            </button>
          </div>
        </div>

        {/* Alert Notifications */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.75rem 1rem',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#10b981',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <div className="card-glass" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                disabled={isSubmitting}
                style={{ width: '100%', padding: '0.75rem 0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Password
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Min 6 characters
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '0.75rem 2.75rem 0.75rem 0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', marginTop: '0.5rem', opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? (
                <span>Authenticating with InsForge...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Registration & Admin links */}
          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Don't have an account? </span>
              <button
                type="button"
                onClick={() => navigate('register')}
                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Register Here
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate('admin-login')}
                style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Shield size={13} /> Admin Management Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
