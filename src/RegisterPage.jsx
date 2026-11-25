import React, { useState } from 'react';
import { Eye, EyeOff, ShoppingBag, Check, AlertCircle, Sparkles, ArrowRight, ShieldCheck, Mail } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import insforge from './insforge';
import { sanitizeMobileInput, validateMobileNumber } from './phoneUtils';

export function RegisterPage() {
  const { register, refreshUser } = useAuth();
  const { navigate } = useNavigation();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Email verification state (if backend ever requires OTP code)
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const updateField = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    // Validate 10-digit mobile number if provided
    if (form.phone.trim()) {
      const phoneErr = validateMobileNumber(form.phone, false);
      if (phoneErr) {
        setError(phoneErr);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        password: form.password
      });

      if (result.success) {
        if (result.requireEmailVerification) {
          setVerificationRequired(true);
          setSuccessMsg(`A 6-digit verification code was sent to ${form.email}.`);
        } else {
          setSuccessMsg('Account created successfully on InsForge! Redirecting...');
          setTimeout(() => {
            navigate('home');
          }, 800);
        }
      } else {
        setError(result.error || 'Registration failed. Please check your information.');
      }
    } catch (err) {
      setError('Connection to InsForge failed. Please check your network.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setIsVerifying(true);
    setError('');

    try {
      const { data, error: verifyErr } = await insforge.auth.verifyEmail({
        email: form.email.trim(),
        otp: otpCode.trim()
      });

      if (verifyErr) {
        setError(verifyErr.message || 'Invalid or expired verification code.');
      } else {
        setSuccessMsg('Email verified and signed in! Redirecting...');
        await refreshUser();
        setTimeout(() => {
          navigate('home');
        }, 800);
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const benefits = [
    'Real-time InsForge user session and secure storage',
    'AI-powered product recommendations & shopping assistant',
    'Track orders with real-time visual 6-stage timeline',
    'Manage Indian shipping addresses & payment profiles',
    'Exclusive members coupon codes (SMART10, AURA20)'
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 140px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: '3rem', width: '100%', maxWidth: '960px', alignItems: 'center' }} className="register-grid">

        {/* Left: Benefits */}
        <div className="register-benefits">
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div className="brand-icon">
                <ShoppingBag size={20} />
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                <span>Smart</span><span className="gradient-text">Shop</span>
              </div>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2 }}>
              Join India's Smartest<br />
              <span className="gradient-text">Intelligent E-Commerce</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: 1.6 }}>
              Register your account powered by InsForge's Postgres cloud architecture with instant session management.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {benefits.map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={13} color="var(--success)" />
                </div>
                <span>{b}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Protected by Postgres Row Level Security (RLS) & industry standard Argon2/Bcrypt hashing.
            </span>
          </div>
        </div>

        {/* Right: Register Form or Code Verification Form */}
        <div className="card-glass" style={{ padding: '2rem' }}>
          {verificationRequired ? (
            <div>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', marginBottom: '1rem' }}>
                <Mail size={24} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.35rem' }}>Verify Email</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Enter the 6-digit verification code sent to <strong>{form.email}</strong>.
              </p>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    style={{ width: '100%', padding: '0.85rem', textAlign: 'center', letterSpacing: '0.35rem', fontSize: '1.3rem', fontWeight: 700, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', outline: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || otpCode.length < 6}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.8rem' }}
                >
                  {isVerifying ? 'Verifying Code...' : 'Complete Registration'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.35rem' }}>Create Account</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Join SmartShop with your email address
              </p>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', color: '#10b981', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  <Check size={16} style={{ flexShrink: 0 }} />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="e.g. Vikram Sharma"
                    required
                    disabled={isSubmitting}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={isSubmitting}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      <span>Mobile Number (10 digits only)</span>
                      {form.phone && (
                        <span style={{ fontSize: '0.72rem', color: form.phone.length === 10 ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                          {form.phone.length}/10 digits
                        </span>
                      )}
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.phone}
                      onChange={(e) => updateField('phone', sanitizeMobileInput(e.target.value))}
                      onKeyDown={(e) => {
                        if (form.phone.length >= 10 && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                          if (/^\d$/.test(e.key)) {
                            e.preventDefault();
                          }
                        }
                      }}
                      placeholder="10 digits only (e.g. 9876543210)"
                      disabled={isSubmitting}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      City (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="e.g. Bengaluru"
                      disabled={isSubmitting}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      disabled={isSubmitting}
                      style={{ width: '100%', padding: '0.65rem 2.5rem 0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    placeholder="Re-enter password"
                    required
                    disabled={isSubmitting}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.5rem', opacity: isSubmitting ? 0.7 : 1 }}
                >
                  {isSubmitting ? 'Registering with InsForge...' : 'Register Account'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Already registered? </span>
                <button
                  type="button"
                  onClick={() => navigate('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
