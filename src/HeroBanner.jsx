import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShoppingBag,
  Bot,
  Mic,
  Search,
  ShieldCheck,
  Zap,
  Truck,
  Star
} from 'lucide-react';
import { useNavigation } from './NavigationContext';
import { useProducts } from './ProductsContext';
import { formatINR } from './productsService';

const AI_QUICK_PROMPTS = [
  'Laptops under 60 k',
  'Best laptops',
  '5G Smartphones',
  'ANC Wireless Earbuds',
  'Smart Home Cameras',
  'Gaming Monitors'
];

export function HeroBanner({ onExplore, onOpenVoice, onOpenChat }) {
  const { navigate } = useNavigation();
  const { products } = useProducts();
  const [heroSearch, setHeroSearch] = useState('');

  // Pick 3 real flagship products from catalog for the right-side hero visual showcase
  const spotlightProducts = React.useMemo(() => {
    const picks = ['EL-004', 'SW-003', 'AH-002', 'GD-003']
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean);
    return picks.length > 0 ? picks : products.slice(0, 4);
  }, [products]);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (heroSearch.trim()) {
      navigate('search', { query: { q: heroSearch.trim() } });
    } else {
      navigate('products');
    }
  };

  return (
    <section className="hero-section">
      <div className="container">
        <div
          className="hero-split-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 0.85fr',
            gap: '2.5rem',
            alignItems: 'center',
            padding: '2.5rem',
            borderRadius: '26px',
            background: 'var(--bg-hero-gradient)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Ambient Decorative Glow */}
          <div
            style={{
              position: 'absolute',
              top: '-120px',
              right: '-100px',
              width: '380px',
              height: '380px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(20, 184, 166, 0.24) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}
          />

          {/* Left Column: Headline, AI Search Bar, Quick Prompts & CTAs */}
          <div style={{ position: 'relative', zIndex: 2, textAlign: 'left' }}>
            <div className="hero-pill">
              <Sparkles size={15} color="var(--accent-gold-light)" />
              <span>2026 NEXT-GEN AI SHOPPING PLATFORM</span>
            </div>

            <h1 className="hero-title" style={{ margin: '0 0 1rem', maxWidth: '680px' }}>
              Smarter Shopping Powered by{' '}
              <span className="gradient-text">Conversational AI</span>
            </h1>

            <p className="hero-description" style={{ margin: '0 0 1.6rem', maxWidth: '600px' }}>
              Discover 60+ verified electronics, flagship 5G smartphones, studio audio, smart home IoT,
              and gaming gear with natural-language AI search, dynamic tier discounts, and instant dispatch.
            </p>

            {/* AI-Powered Product Search Bar */}
            <form
              onSubmit={handleHeroSearch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--accent-border)',
                borderRadius: '16px',
                padding: '0.45rem 0.55rem 0.45rem 1.1rem',
                boxShadow: 'var(--shadow-md), var(--shadow-glow)',
                marginBottom: '0.9rem',
                maxWidth: '620px'
              }}
            >
              <Search size={19} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                placeholder='Ask AI or search: "AeroBook laptop", "ANC earbuds under ₹5000"...'
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.92rem',
                  outline: 'none',
                  minWidth: 0
                }}
              />
              <button
                type="button"
                onClick={onOpenVoice}
                title="Voice Search Assistant"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'var(--gold-soft)',
                  border: '1px solid var(--gold-border)',
                  color: 'var(--accent-gold-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <Mic size={16} />
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  padding: '0.6rem 1.15rem',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  flexShrink: 0
                }}
              >
                <Sparkles size={15} />
                <span>AI Search</span>
              </button>
            </form>

            {/* Quick AI Prompt Pills */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                flexWrap: 'wrap',
                marginBottom: '1.75rem'
              }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Try AI Search:
              </span>
              {AI_QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => navigate('search', { query: { q: prompt } })}
                  style={{
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-accent)',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '999px',
                    fontSize: '0.73rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="hero-cta-group" style={{ justifyContent: 'flex-start' }}>
              <button className="btn btn-primary" onClick={onExplore}>
                <ShoppingBag size={17} />
                <span>Shop All 60 Products</span>
                <ArrowRight size={17} />
              </button>

              <button className="btn btn-secondary" onClick={onOpenChat}>
                <Bot size={17} color="var(--accent-primary)" />
                <span>AI Shopping Assistant</span>
              </button>

              <button className="btn btn-secondary" onClick={() => navigate('categories')}>
                <span>Explore Categories</span>
              </button>
            </div>

            {/* Trust Metrics Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, auto)',
                gap: '1.5rem',
                marginTop: '2rem',
                paddingTop: '1.35rem',
                borderTop: '1px solid var(--border-subtle)',
                maxWidth: '540px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                  <Zap size={17} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>60+ Flagships</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>6 Tech Departments</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                  <ShieldCheck size={17} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>100% Authentic</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>1-Yr Brand Warranty</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--gold-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold-light)' }}>
                  <Truck size={17} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>Free Express</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Orders above ₹999</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Flagship Product Showcase Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
              position: 'relative',
              zIndex: 2
            }}
          >
            {spotlightProducts.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate('product-details', { params: { id: item.id } })}
                style={{
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '18px',
                  padding: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <div
                  style={{
                    height: '125px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'rgba(255,255,255,0.03)'
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      background: 'var(--accent-gradient)',
                      color: '#fff',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '6px'
                    }}
                  >
                    {item.discountPercent || 15}% OFF
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-accent)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {item.category}
                  </div>
                  <div
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '2px'
                    }}
                  >
                    {item.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {formatINR(item.price)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', color: 'var(--accent-gold-light)', fontWeight: 700 }}>
                      <Star size={11} fill="#fcd34d" /> {item.rating}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroBanner;
