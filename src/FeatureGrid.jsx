import React from 'react';
import {
  ShoppingBag,
  Search,
  UserCheck,
  ShoppingCart,
  CreditCard,
  Truck,
  Bell,
  Star,
  Sparkles,
  Bot,
  Mic,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';
import { useNavigation } from './NavigationContext';

const MODULES = [
  {
    icon: ShoppingBag,
    title: 'Catalog & Categories',
    tag: 'Core Storefront',
    desc: 'Structured hierarchical categories, rich multi-attribute product catalog, tags, and stock inventory.',
    route: 'products',
  },
  {
    icon: Search,
    title: 'Search & Multi-Filtering',
    tag: 'Discovery',
    desc: 'Instant keyword search, price range filtering, category scoping, rating sorting, and availability toggles.',
    route: 'products',
  },
  {
    icon: UserCheck,
    title: 'User Auth & Profiles',
    tag: 'InsForge Auth',
    desc: 'Secure signup, email verification, passwordless OTP, profile avatar uploads, and saved delivery addresses.',
    route: 'login',
  },
  {
    icon: ShoppingCart,
    title: 'Cart & Wishlist',
    tag: 'Shopping State',
    desc: 'Persistent client shopping cart, quantity controls, real-time total calculations, and custom user wishlists.',
    route: 'cart',
  },
  {
    icon: CreditCard,
    title: 'Checkout & Payments',
    tag: 'BaaS Transactions',
    desc: 'Multi-step checkout flow, address confirmation, and integration with InsForge Stripe/Razorpay payment records.',
    route: 'checkout',
  },
  {
    icon: Truck,
    title: 'Orders & Tracking',
    tag: 'Fulfillment',
    desc: 'Historical order lookup, automated status progressions (Pending, Processing, Shipped, Delivered), and item details.',
    route: 'order-tracking',
  },
  {
    icon: Bell,
    title: 'Order Notifications',
    tag: 'Real-time & Email',
    desc: 'System notification alerts, order confirmation notifications, and InsForge built-in transactional emails.',
    route: 'notifications',
  },
  {
    icon: Star,
    title: 'Product Reviews & Ratings',
    tag: 'Social Proof',
    desc: 'Verified buyer reviews, 5-star ratings, user comments, and aggregated product score computations.',
    route: 'products',
  },
  {
    icon: Sparkles,
    title: 'AI Recommendations',
    tag: 'OpenRouter AI',
    desc: 'Smart product suggestions, category affinities, and personalized dynamic cross-sells powered by AI models.',
    route: 'products',
  },
  {
    icon: Bot,
    title: 'AI Shopping Chatbot',
    tag: 'Conversational',
    desc: 'Interactive shopping assistant for product discovery, sizing advice, price inquiries, and order FAQs.',
    action: 'chat',
  },
  {
    icon: Mic,
    title: 'Voice Shopping Interface',
    tag: 'Voice Commerce',
    desc: 'Speech-driven product search, voice cart additions, and hands-free navigation using Speech Recognition.',
    action: 'voice',
  },
  {
    icon: LayoutDashboard,
    title: 'Admin & Inventory Suite',
    tag: 'Back-Office',
    desc: 'Admin dashboard with product creation, stock updates, order status management, and sales analytics charts.',
    route: 'admin-dashboard',
  },
];

export function FeatureGrid({ onOpenChat, onOpenVoice }) {
  const { navigate } = useNavigation();

  const handleModuleClick = (mod) => {
    if (mod.action === 'chat') {
      onOpenChat?.();
    } else if (mod.action === 'voice') {
      onOpenVoice?.();
    } else if (mod.route) {
      navigate(mod.route);
    }
  };

  return (
    <section style={{ margin: '3rem 0' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="feature-tag">Interactive Architecture</span>
          <h2 style={{ marginTop: '0.75rem', fontSize: '2.25rem' }}>
            Smart E-Commerce <span className="gradient-text">Architectural Modules</span>
          </h2>
          <p style={{ maxWidth: '600px', margin: '0.5rem auto 0', color: 'var(--text-muted)' }}>
            12 integrated full-stack modules. Click any module card below to launch and explore its live features.
          </p>
        </div>

        <div className="features-grid">
          {MODULES.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div
                key={idx}
                className="feature-card"
                onClick={() => handleModuleClick(mod)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '';
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="feature-icon-wrapper">
                      <Icon size={24} />
                    </div>
                    <span className="feature-tag">{mod.tag}</span>
                  </div>
                  <div>
                    <h3 className="feature-title" style={{ marginTop: '0.75rem' }}>{mod.title}</h3>
                    <p className="feature-desc" style={{ marginTop: '0.4rem', color: 'var(--text-muted)' }}>
                      {mod.desc}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '1.25rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    color: 'var(--accent-primary)',
                    fontWeight: 600
                  }}
                >
                  <span>Launch Module</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FeatureGrid;
