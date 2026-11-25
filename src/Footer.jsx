import React from 'react';
import { ShoppingBag, ShieldCheck, Truck, Headphones, RotateCcw, Heart } from 'lucide-react';
import { useNavigation } from './NavigationContext';

export function Footer() {
  const { navigate } = useNavigation();

  return (
    <footer className="footer" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-footer)', marginTop: '5rem' }}>
      {/* Trust & Value Bar */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '2.5rem 0', background: 'rgba(255, 255, 255, 0.015)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
                <Truck size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.2rem' }}>Free Express Shipping</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>On all orders above ₹999 across India</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', flexShrink: 0 }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.2rem' }}>100% Genuine Hardware</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Official brand warranty with serial check</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--gold-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold-light)', flexShrink: 0 }}>
                <RotateCcw size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.2rem' }}>7 Days Easy Replacement</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Doorstep inspection & instant resolution</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-accent)', flexShrink: 0 }}>
                <Headphones size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.2rem' }}>24/7 AI Shopping Help</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Conversational AI and voice assistant</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="container" style={{ padding: '3.5rem 1.5rem 2.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2.5rem' }}>
          {/* Brand Info */}
          <div style={{ gridColumn: 'span 1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem', cursor: 'pointer' }} onClick={() => navigate('home')}>
              <div className="brand-icon" style={{ width: '34px', height: '34px' }}>
                <ShoppingBag size={18} />
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                <span>Trust</span>
                <span className="gradient-text">Cart</span>
                <span style={{ fontSize: '0.72rem', marginLeft: '5px', background: 'var(--accent-gradient)', color: '#fff', padding: '1px 6px', borderRadius: '4px', verticalAlign: 'middle', fontWeight: 700 }}>AI</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Intelligent Shopping for the Modern Generation. Real-time AI agent assistance, verified catalog price tracking, and authentic product trust analysis backed by InsForge BaaS.
            </p>
            <div style={{ display: 'inline-block', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', fontSize: '0.75rem', color: 'var(--text-accent)', fontWeight: 600 }}>
              TrustCart AI 2026
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: '#fff', letterSpacing: '0.02em' }}>
              Customer Navigation
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <li>
                <button onClick={() => navigate('home')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Storefront Home
                </button>
              </li>
              <li>
                <button onClick={() => navigate('products')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  All Products Catalog
                </button>
              </li>
              <li>
                <button onClick={() => navigate('categories')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Browse Categories
                </button>
              </li>
              <li>
                <button onClick={() => navigate('cart')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Shopping Cart
                </button>
              </li>
              <li>
                <button onClick={() => navigate('wishlist')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Saved Wishlist
                </button>
              </li>
            </ul>
          </div>

          {/* Orders & Account */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: '#fff', letterSpacing: '0.02em' }}>
              Orders & Account
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <li>
                <button onClick={() => navigate('order-tracking')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Visual Order Tracking
                </button>
              </li>
              <li>
                <button onClick={() => navigate('orders')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Order History & Invoices
                </button>
              </li>
              <li>
                <button onClick={() => navigate('profile')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  User Profile & Addresses
                </button>
              </li>
              <li>
                <button onClick={() => navigate('notifications')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Notifications & Price Alerts
                </button>
              </li>
              <li>
                <button onClick={() => navigate('login')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Sign In / Register
                </button>
              </li>
            </ul>
          </div>

          {/* Admin & Infrastructure */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: '#f59e0b', letterSpacing: '0.02em' }}>
              Admin & Architecture
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <li>
                <button onClick={() => navigate('admin-dashboard')} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                  Admin Dashboard
                </button>
              </li>
              <li>
                <button onClick={() => navigate('admin-products')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Product Management
                </button>
              </li>
              <li>
                <button onClick={() => navigate('admin-inventory')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Inventory Tracking
                </button>
              </li>
              <li>
                <button onClick={() => navigate('admin-orders')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Order Management
                </button>
              </li>
              <li>
                <button onClick={() => navigate('admin-sales-analytics')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  Sales & Customer Analytics
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Accepted Payment Methods & Disclaimer */}
        <div style={{ marginTop: '3rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Secure Payments Accepted in India:</span>
            {['UPI (GPay / PhonePe)', 'RuPay', 'Visa / Mastercard', 'Net Banking', 'Cash on Delivery'].map((m) => (
              <span
                key={m}
                style={{
                  fontSize: '0.7rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)'
                }}
              >
                {m}
              </span>
            ))}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
            © 2026 Smart E-Commerce Shopping. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
