import React from 'react';
import { ArrowRight, Tag, RefreshCw, AlertCircle } from 'lucide-react';
import { useProducts } from './ProductsContext';
import { useNavigation } from './NavigationContext';
import { useRecommendations } from './RecommendationContext';
import Breadcrumb from './Breadcrumb';

export function CategoriesPage() {
  const { categories, products, isLoading, error, refreshCategories } = useProducts();
  const { navigate } = useNavigation();
  const { trackCategoryView } = useRecommendations();

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb items={[{ label: 'All Categories' }]} />

      <div style={{ marginBottom: '2.5rem' }}>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          Browse Departments
        </span>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginTop: '0.25rem' }}>
          Shop by <span className="gradient-text">Category</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          Discover curated collections across {categories.length} departments with {products.length} live database products.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1rem 1.25rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} color="#ef4444" />
            <span style={{ fontSize: '0.875rem' }}>Error loading categories: {error}</span>
          </div>
          <button
            onClick={refreshCategories}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '4px' }}
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading state skeleton */}
      {isLoading && categories.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.75rem', marginBottom: '4rem' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card-glass" style={{ height: '320px', borderRadius: 'var(--radius-lg)', opacity: 0.6, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        /* Category Cards Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.75rem', marginBottom: '4rem' }}>
          {categories.map((cat) => {
            const catProductCount = products.filter(
              (p) => p.categoryId === cat.id || p.category === cat.name
            ).length;

            return (
              <div
                key={cat.id}
                className="card-glass"
                onClick={() => {
                  try {
                    trackCategoryView(cat.id);
                  } catch {}
                  navigate('products', { query: { category: cat.name } });
                }}
                style={{
                  cursor: 'pointer',
                  overflow: 'hidden',
                  padding: 0,
                  borderRadius: 'var(--radius-lg)',
                  transition: 'transform var(--transition-normal), box-shadow var(--transition-normal)',
                  border: '1px solid var(--border-subtle)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Banner Image */}
                <div style={{ height: '180px', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={cat.image}
                    alt={cat.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(10,12,20,0.85) 100%)' }} />
                  <div style={{ position: 'absolute', bottom: '12px', left: '16px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--accent-gradient)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                      {catProductCount > 0 ? `${catProductCount} ITEMS` : 'INSPECTION'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>{cat.name}</h3>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>{cat.description}</p>

                  {/* Subcategories */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {(cat.subcategories || ['Flagships', 'Best Sellers', 'Picks']).slice(0, 3).map((sub) => (
                      <span
                        key={sub}
                        style={{ fontSize: '0.7rem', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                      >
                        {sub}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                      {catProductCount} product{catProductCount !== 1 ? 's' : ''} available
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-accent)', fontWeight: 600, fontSize: '0.825rem' }}>
                      <span>Browse Products</span>
                      <ArrowRight size={15} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Navigation Tags */}
      <div style={{ textAlign: 'center', padding: '2.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <Tag size={18} color="var(--accent-gold-light)" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Popular Database Tags</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Apple Silicon', 'Sony Audio', 'Samsung 5G', 'Thunderbolt 4', 'Smart Home', 'OLED Gaming', 'Fast Charging', 'ANC Earbuds', 'Mechanical Keyboards', 'Ultra Laptops'].map((tag) => (
            <button
              key={tag}
              onClick={() => navigate('search', { query: { q: tag } })}
              style={{
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-border)',
                color: 'var(--text-accent)',
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CategoriesPage;
