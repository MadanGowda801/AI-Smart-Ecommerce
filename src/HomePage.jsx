import React, { useState, useEffect, useMemo } from 'react';
import HeroBanner from './HeroBanner';
import FeatureGrid from './FeatureGrid';
import ReadinessArchitecture from './ReadinessArchitecture';
import ProductCard from './ProductCard';
import { useProducts } from './ProductsContext';
import { useNavigation } from './NavigationContext';
import { useRecommendations } from './RecommendationContext';
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  Grid,
  Tag,
  Copy,
  Check,
  Clock,
  Flame,
  Award,
  Zap,
  RefreshCw
} from 'lucide-react';

const SPECIAL_OFFERS = [
  {
    id: 'offer-smart10',
    badge: 'SITEWIDE AI DEAL',
    title: 'Flat 10% OFF + Stackable Tier Discount',
    desc: 'Applicable across all 60 products. Stacks automatically with Silver/Gold/Platinum cart tiers!',
    code: 'SMART10',
    gradient: 'linear-gradient(135deg, rgba(13, 148, 136, 0.28) 0%, rgba(11, 22, 25, 0.96) 100%)',
    borderColor: 'rgba(20, 184, 166, 0.45)',
    accentColor: '#5eead4',
    categoryQuery: null
  },
  {
    id: 'offer-techfest',
    badge: 'FLAGSHIP FESTIVAL',
    title: 'Instant ₹1,500 OFF on Laptops & 5G Phones',
    desc: 'Upgrade to AeroBook, CreatorBook 16, or FoldX 5G on orders above ₹15,000.',
    code: 'TECHFEST',
    gradient: 'linear-gradient(135deg, rgba(217, 119, 6, 0.25) 0%, rgba(11, 22, 25, 0.96) 100%)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    accentColor: '#fcd34d',
    categoryQuery: 'Electronics & Laptops'
  },
  {
    id: 'offer-audio15',
    badge: 'AUDIO SPECIAL',
    title: '15% OFF Studio Headphones & ANC Earbuds',
    desc: 'Save on SonicPods Pro ANC, StudioWave Headphones, and Dolby SoundBar 2.1.',
    code: 'AUDIO15',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(11, 22, 25, 0.96) 100%)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
    accentColor: '#6ee7b7',
    categoryQuery: 'Audio & Headphones'
  }
];

export function HomePage({ onOpenChat, onOpenVoice }) {
  const { products, categories } = useProducts();
  const { navigate } = useNavigation();
  const { recommendations, refreshRecommendations, isLoading: isRecLoading } = useRecommendations();

  const [trendingTab, setTrendingTab] = useState('trending'); // 'trending' | 'bestsellers' | 'toprated' | 'deals'
  const [copiedCode, setCopiedCode] = useState('');
  const [recentIds, setRecentIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('smartshop_recently_viewed') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const syncRecent = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('smartshop_recently_viewed') || '[]');
        if (Array.isArray(stored)) setRecentIds(stored);
      } catch {
        // ignore
      }
    };
    window.addEventListener('smartshop_recently_viewed_updated', syncRecent);
    return () => window.removeEventListener('smartshop_recently_viewed_updated', syncRecent);
  }, []);

  // 1. Trending & Best Sellers filtered products
  const displayedTrending = useMemo(() => {
    let list = [...products];
    if (trendingTab === 'bestsellers') {
      list = list.filter((p) => p.isPopular || p.reviewsCount >= 200);
    } else if (trendingTab === 'toprated') {
      list = list.filter((p) => p.rating >= 4.8).sort((a, b) => b.rating - a.rating);
    } else if (trendingTab === 'deals') {
      list = list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    } else {
      list = list.filter((p) => p.isFeatured || p.isPopular);
    }
    return (list.length >= 8 ? list : products).slice(0, 8);
  }, [products, trendingTab]);

  // 2. Personalized AI Recommendations (up to 4 cards)
  const personalizedProducts = useMemo(() => {
    if (recommendations && recommendations.length > 0) {
      return recommendations.slice(0, 4);
    }
    return products.filter((p) => p.isAiRecommended).slice(0, 4);
  }, [recommendations, products]);

  // 3. Recently Viewed Products
  const recentlyViewedProducts = useMemo(() => {
    const matched = recentIds
      .map((id) => products.find((p) => String(p.id) === String(id)))
      .filter(Boolean);
    if (matched.length > 0) return matched.slice(0, 4);
    // Default fallback showcase of recently browsed popular items
    return ['EL-001', 'SW-002', 'AH-003', 'GD-001']
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean);
  }, [recentIds, products]);

  const handleCopyCoupon = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2200);
  };

  const clearRecentlyViewed = () => {
    try {
      localStorage.removeItem('smartshop_recently_viewed');
      setRecentIds([]);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      {/* 1. Hero Banner with AI Search */}
      <HeroBanner
        onExplore={() => navigate('products')}
        onOpenChat={onOpenChat}
        onOpenVoice={onOpenVoice}
      />

      {/* 2. Shop by Category with Attractive Images */}
      <section className="container" style={{ margin: '2.5rem auto 3.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--text-accent)',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              <Grid size={14} />
              <span>6 Curated Tech Departments</span>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.2rem' }}>
              Explore by <span className="gradient-text">Category</span>
            </h2>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => navigate('categories')}
            style={{ fontSize: '0.84rem', padding: '0.55rem 1rem' }}
          >
            <span>All Categories</span>
            <ArrowRight size={15} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1.15rem'
          }}
        >
          {categories.map((cat) => {
            const count = products.filter(
              (p) => p.categoryId === cat.id || p.category === cat.name
            ).length;
            return (
              <div
                key={cat.id || cat.name}
                onClick={() => navigate('products', { query: { category: cat.name } })}
                className="card-glass"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  borderRadius: '18px',
                  position: 'relative',
                  height: '210px',
                  border: '1px solid rgba(148, 163, 184, 0.18)'
                }}
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.5s ease'
                  }}
                  className="product-img-hover"
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to top, rgba(6, 12, 14, 0.96) 0%, rgba(6, 12, 14, 0.45) 55%, transparent 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '1.1rem'
                  }}
                >
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'var(--accent-gradient)',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      marginBottom: '0.35rem'
                    }}
                  >
                    {count} Products
                  </span>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>
                    {cat.name}
                  </h3>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      color: 'var(--text-accent)',
                      fontWeight: 600,
                      marginTop: '4px'
                    }}
                  >
                    <span>Shop Now</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Trending Products & Best Sellers */}
      <section className="container" style={{ margin: '3.5rem auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '1.75rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--text-accent)',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              <TrendingUp size={14} />
              <span>Most Popular Hardware</span>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.2rem' }}>
              Trending & <span className="gradient-text">Best Sellers</span>
            </h2>
          </div>

          {/* Interactive Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {[
              { id: 'trending', label: 'Trending Now', icon: Flame },
              { id: 'bestsellers', label: 'Best Sellers', icon: Award },
              { id: 'toprated', label: 'Top Rated (4.8★+)', icon: Sparkles },
              { id: 'deals', label: 'Biggest Discounts', icon: Zap }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = trendingTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTrendingTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.5rem 0.95rem',
                    borderRadius: '12px',
                    background: active ? 'var(--accent-gradient)' : 'rgba(15, 23, 42, 0.75)',
                    border: active ? '1px solid transparent' : '1px solid rgba(148, 163, 184, 0.2)',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {displayedTrending.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('products')}
            style={{ padding: '0.75rem 1.75rem', fontSize: '0.9rem' }}
          >
            <span>Browse Full 60-Product Catalog</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* 4. Special Offers & Discount Banners */}
      <section className="container" style={{ margin: '3.5rem auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#38bdf8',
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}
          >
            <Tag size={14} />
            <span>Dynamic Pricing & Verified Coupons</span>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.2rem' }}>
            Special Offers & <span className="gradient-text">Instant Discounts</span>
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: '1.25rem'
          }}
        >
          {SPECIAL_OFFERS.map((offer) => (
            <div
              key={offer.id}
              style={{
                background: offer.gradient,
                border: `1px solid ${offer.borderColor}`,
                borderRadius: '20px',
                padding: '1.6rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem',
                boxShadow: '0 16px 36px rgba(2, 6, 23, 0.55)'
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.1)',
                    color: offer.accentColor,
                    marginBottom: '0.75rem'
                  }}
                >
                  {offer.badge}
                </span>
                <h3 style={{ fontSize: '1.22rem', fontWeight: 800, color: '#fff', marginBottom: '0.45rem' }}>
                  {offer.title}
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {offer.desc}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleCopyCoupon(offer.code)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(6, 9, 19, 0.75)',
                    border: '1px dashed rgba(148, 163, 184, 0.45)',
                    color: copiedCode === offer.code ? '#34d399' : '#ffffff',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    cursor: 'pointer'
                  }}
                >
                  {copiedCode === offer.code ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  <span>{copiedCode === offer.code ? 'COPIED!' : offer.code}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      'products',
                      offer.categoryQuery ? { query: { category: offer.categoryQuery } } : undefined
                    )
                  }
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '10px' }}
                >
                  <span>Shop Deal</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Personalized AI Product Recommendations */}
      <section className="container" style={{ margin: '3.5rem auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--text-accent)',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              <Sparkles size={14} color="var(--accent-gold-light)" />
              <span>AI Behavioral Recommendation Engine</span>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.2rem' }}>
              Personalized <span className="gradient-text">For You</span>
            </h2>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => refreshRecommendations()}
            disabled={isRecLoading}
            style={{ fontSize: '0.82rem', padding: '0.5rem 0.95rem' }}
          >
            <RefreshCw size={14} className={isRecLoading ? 'animate-spin' : ''} />
            <span>Refresh AI Picks</span>
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {personalizedProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* 6. Recently Viewed Products */}
      <section className="container" style={{ margin: '3.5rem auto 4rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#38bdf8',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              <Clock size={14} />
              <span>Your Browsing History</span>
            </div>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.2rem' }}>
              Recently <span className="gradient-text">Viewed Products</span>
            </h2>
          </div>

          {recentIds.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={clearRecentlyViewed}
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
            >
              Clear History
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {recentlyViewedProducts.map((p) => (
            <ProductCard key={`recent-${p.id}`} product={p} />
          ))}
        </div>
      </section>

      {/* Architecture & AI Feature Modules */}
      <ReadinessArchitecture />
      <FeatureGrid onOpenChat={onOpenChat} onOpenVoice={onOpenVoice} />
    </div>
  );
}

export default HomePage;
