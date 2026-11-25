import React, { useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, X, ArrowUpDown, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { useProducts } from './ProductsContext';
import { useNavigation } from './NavigationContext';
import ProductCard from './ProductCard';
import Breadcrumb from './Breadcrumb';
import EmptyState from './EmptyState';
import { useRecommendations } from './RecommendationContext';
import { Sparkles } from 'lucide-react';
import { executeSmartSearch } from './smartSearchEngine';
import { formatINR } from './productsService';

const SEARCH_PAGE_SIZE = 12;

export function SearchResultsPage() {
  const { products, categories, isLoading, error, refreshProducts } = useProducts();
  const { query: navQuery, navigate } = useNavigation();
  const { trackSearch, sections, recommendations } = useRecommendations();

  const [localQuery, setLocalQuery] = useState(navQuery?.q || '');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState('all');
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(Boolean(navQuery?.q));

  useEffect(() => {
    if (navQuery?.q !== undefined) {
      setLocalQuery(navQuery.q);
      setHasSearched(Boolean(navQuery.q));
      setCurrentPage(1);
      if (navQuery.q.trim()) {
        trackSearch(navQuery.q.trim());
      }
    }
  }, [navQuery?.q, trackSearch]);

  const smartSearchOutput = useMemo(() => {
    if (!localQuery.trim()) {
      return { parsed: null, results: [], closeAlternatives: [], relaxedReason: null };
    }

    // Translate sidebar price radio into min/max bounds (intersecting cleanly with parsed query bounds)
    let sidebarMin = undefined;
    let sidebarMax = undefined;
    if (priceRange === 'under10k') sidebarMax = 9999;
    if (priceRange === '10kTo30k') { sidebarMin = 10000; sidebarMax = 30000; }
    if (priceRange === '30kTo100k') { sidebarMin = 30000; sidebarMax = 100000; }
    if (priceRange === 'above100k') sidebarMin = 100001;

    return executeSmartSearch(products, localQuery, {
      category: selectedCategory !== 'All' ? selectedCategory : undefined,
      minPrice: sidebarMin,
      maxPrice: sidebarMax,
      minRating: minRating > 0 ? minRating : undefined,
      inStockOnly,
      sortBy
    });
  }, [localQuery, products, selectedCategory, priceRange, minRating, inStockOnly, sortBy]);

  const searchResults = smartSearchOutput.results;
  const parsedIntent = smartSearchOutput.parsed;
  const closeAlternatives = smartSearchOutput.closeAlternatives || [];
  const relaxedReason = smartSearchOutput.relaxedReason;

  const totalPages = Math.ceil(searchResults.length / SEARCH_PAGE_SIZE) || 1;
  const activePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedResults = useMemo(() => {
    const start = (activePage - 1) * SEARCH_PAGE_SIZE;
    return searchResults.slice(start, start + SEARCH_PAGE_SIZE);
  }, [searchResults, activePage]);

  const handleSearch = (e) => {
    e.preventDefault();
    setHasSearched(true);
    setCurrentPage(1);
    const clean = localQuery.trim();
    if (clean) {
      trackSearch(clean);
    }
    navigate('search', { query: { q: clean } });
  };

  const clearFilters = () => {
    setSelectedCategory('All');
    setPriceRange('all');
    setMinRating(0);
    setInStockOnly(false);
    setSortBy('relevance');
    setCurrentPage(1);
  };

  const popularSearches = [
    'Laptops under 60 k',
    'Best laptops',
    '5G phones under 35k',
    'ANC headphones',
    'Gaming monitor 165Hz',
    'Smart home cameras',
    'Mechanical keyboard',
    'Power bank 20000mAh'
  ];

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb items={[{ label: 'Search Results' }]} />

      {/* Big Search Bar */}
      <div style={{ maxWidth: '720px', margin: '0 auto 2.5rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, textAlign: 'center', marginBottom: '1.25rem' }}>
          {localQuery ? (
            <>Search Results for "<span className="gradient-text">{localQuery}</span>"</>
          ) : (
            <>Search <span className="gradient-text">Database Products</span></>
          )}
        </h1>

        <form onSubmit={handleSearch} style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder='Try "laptops under 60 k", "best laptops", "5G phone with 6000mAh battery", "ANC earbuds"...'
            style={{
              width: '100%',
              padding: '0.9rem 6.5rem 0.9rem 3rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-full)',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ position: 'absolute', right: '6px', top: '6px', bottom: '6px', padding: '0 1.25rem', borderRadius: 'var(--radius-full)', fontSize: '0.875rem' }}
          >
            Search
          </button>
        </form>

        {/* Popular Searches */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginBottom: '0.75rem' }}>Quick database keywords:</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {popularSearches.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setLocalQuery(s);
                  setHasSearched(true);
                  setCurrentPage(1);
                  navigate('search', { query: { q: s } });
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-muted)',
                  padding: '0.3rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            marginBottom: '1.5rem',
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
            <span style={{ fontSize: '0.875rem' }}>Database query notice: {error}</span>
          </div>
          <button
            onClick={refreshProducts}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '4px' }}
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Results Section */}
      {hasSearched && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '2rem' }} className="catalog-layout">
          {/* Filter Sidebar */}
          <aside className="card-glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SlidersHorizontal size={16} color="var(--accent-primary)" />
                <span>Refine Results</span>
              </div>
              {(selectedCategory !== 'All' || priceRange !== 'all' || minRating > 0 || inStockOnly) && (
                <button
                  onClick={clearFilters}
                  style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Category */}
            <div>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
                Category
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {['All', ...categories.map((c) => c.name)].map((c) => (
                  <button
                    key={c}
                    onClick={() => { setSelectedCategory(c); setCurrentPage(1); }}
                    style={{
                      background: selectedCategory === c ? 'rgba(99,102,241,0.18)' : 'none',
                      border: 'none',
                      color: selectedCategory === c ? '#fff' : 'var(--text-muted)',
                      textAlign: 'left',
                      padding: '0.4rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.83rem',
                      fontWeight: selectedCategory === c ? 700 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
                Price Range
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                {[
                  { id: 'all', label: 'Any Price' },
                  { id: 'under10k', label: 'Under ₹10,000' },
                  { id: '10kTo30k', label: '₹10,000 – ₹30,000' },
                  { id: '30kTo100k', label: '₹30,000 – ₹1,00,000' },
                  { id: 'above100k', label: 'Above ₹1,00,000' }
                ].map((r) => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="sr-price"
                      checked={priceRange === r.id}
                      onChange={() => { setPriceRange(r.id); setCurrentPage(1); }}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
                Rating
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                {[{ val: 0, label: 'All ratings' }, { val: 4.5, label: '4.5★ & above' }, { val: 4.8, label: '4.8★ & above' }].map((r) => (
                  <label key={r.val} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="sr-rating"
                      checked={minRating === r.val}
                      onChange={() => { setMinRating(r.val); setCurrentPage(1); }}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Stock */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem', cursor: 'pointer', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => { setInStockOnly(e.target.checked); setCurrentPage(1); }}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span>In Stock Only</span>
            </label>
          </aside>

          {/* Results column */}
          <div>
            {/* AI Parsed Search Understanding Banner */}
            {parsedIntent && parsedIntent.isNaturalLanguage && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.45rem',
                  fontSize: '0.78rem'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--text-accent)', marginRight: '4px' }}>
                  <Sparkles size={14} color="var(--accent-gold-light)" /> AI Understood:
                </span>
                {parsedIntent.corrections?.length > 0 && (
                  <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--accent-gold-light)', fontWeight: 700 }}>
                    Typo fixed: {parsedIntent.corrections.map((c) => `"${c.from}" → "${c.to}"`).join(', ')}
                  </span>
                )}
                {parsedIntent.subTypeKey && (
                  <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'rgba(20,184,166,0.18)', color: '#fff', fontWeight: 600 }}>
                    Product: {parsedIntent.subTypeKey.replace('_', ' ')}
                  </span>
                )}
                {!parsedIntent.subTypeKey && parsedIntent.category && (
                  <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'rgba(20,184,166,0.18)', color: '#fff', fontWeight: 600 }}>
                    Category: {parsedIntent.category}
                  </span>
                )}
                {parsedIntent.minPrice && parsedIntent.maxPrice ? (
                  <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'var(--success-bg)', color: '#34d399', fontWeight: 700 }}>
                    Budget: {formatINR(parsedIntent.minPrice)} – {formatINR(parsedIntent.maxPrice)}
                  </span>
                ) : parsedIntent.maxPrice ? (
                  <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'var(--success-bg)', color: '#34d399', fontWeight: 700 }}>
                    Under {formatINR(parsedIntent.maxPrice)}
                  </span>
                ) : parsedIntent.minPrice ? (
                  <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'var(--success-bg)', color: '#34d399', fontWeight: 700 }}>
                    Above {formatINR(parsedIntent.minPrice)}
                  </span>
                ) : null}
                {parsedIntent.brand && (
                  <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600 }}>
                    Brand: {parsedIntent.brand}
                  </span>
                )}
                {parsedIntent.features?.map((f) => (
                  <span key={f.key} style={{ padding: '2px 8px', borderRadius: '999px', background: 'rgba(56,189,248,0.16)', color: '#7dd3fc', fontWeight: 600 }}>
                    Feature: {f.label}
                  </span>
                ))}
                {parsedIntent.sortReason && (
                  <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Sorted by: {parsedIntent.sortReason}
                  </span>
                )}
              </div>
            )}

            {/* Sort bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                padding: '0.65rem 1rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: '#fff' }}>{searchResults.length}</strong> results found for "{localQuery}"
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  color: '#fff',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="relevance">Most Relevant</option>
                <option value="priceAsc">Price: Low to High</option>
                <option value="priceDesc">Price: High to Low</option>
                <option value="ratingDesc">Top Rated</option>
                <option value="newest">Newest</option>
              </select>
            </div>

            {isLoading && products.length === 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card-glass" style={{ height: '340px', borderRadius: 'var(--radius-lg)', opacity: 0.6, animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : paginatedResults.length > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                  {paginatedResults.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={activePage === 1}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', opacity: activePage === 1 ? 0.4 : 1 }}
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0 0.5rem' }}>
                      Page {activePage} of {totalPages}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={activePage === totalPages}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', opacity: activePage === totalPages ? 0.4 : 1 }}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            ) : closeAlternatives.length > 0 ? (
              <div>
                <div
                  style={{
                    marginBottom: '1.25rem',
                    padding: '1rem 1.2rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--warning-bg)',
                    border: '1px solid var(--gold-border)',
                    color: 'var(--accent-gold-light)',
                    fontSize: '0.88rem',
                    fontWeight: 600
                  }}
                >
                  {relaxedReason}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                  {closeAlternatives.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No Matching Products Found"
                description={`We couldn't find any products matching "${localQuery}". Try queries like "Laptops under 60 k", "5G phones", "ANC headphones", or browse our 6 categories.`}
                actionLabel="Browse Full Catalog"
                actionPath="products"
              />
            )}
          </div>
        </div>
      )}

      {/* AI Recommendation: Based on Your Searches or Recommended For You */}
      {((sections?.basedOnSearches && sections.basedOnSearches.length > 0) || (recommendations && recommendations.length > 0)) && (
        <section style={{ marginTop: '4rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            <Sparkles size={14} color="#38bdf8" />
            <span>AI Intent Match</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            {sections?.basedOnSearches && sections.basedOnSearches.length > 0 ? 'Based on Your Searches' : 'Recommended For You'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Personalized hardware recommendations with verified live availability.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {((sections?.basedOnSearches && sections.basedOnSearches.length > 0) ? sections.basedOnSearches : recommendations).slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default SearchResultsPage;
