import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useProducts } from './ProductsContext';
import { useNavigation } from './NavigationContext';
import { useRecommendations } from './RecommendationContext';
import ProductCard from './ProductCard';
import Breadcrumb from './Breadcrumb';
import EmptyState from './EmptyState';
import { executeSmartSearch } from './smartSearchEngine';

const ITEMS_PER_PAGE = 12;

export function ProductsPage() {
  const { products, categories, isLoading, error, refreshProducts } = useProducts();
  const { query, navigate } = useNavigation();
  const { trackCategoryView, trackSearch } = useRecommendations();

  const [searchQuery, setSearchQuery] = useState(() => query?.q || '');
  const [selectedCategory, setSelectedCategory] = useState(() => query?.category || 'All');
  const [priceRange, setPriceRange] = useState('all'); // all, under10k, 10kTo30k, 30kTo100k, above100k
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('featured'); // featured, priceAsc, priceDesc, ratingDesc, newest
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Sync state if navigation query changes
  useEffect(() => {
    if (query?.category !== undefined) {
      setSelectedCategory(query.category || 'All');
      setCurrentPage(1);
      if (query.category !== 'All' && categories?.length > 0) {
        const cat = categories.find((c) => c.name?.toLowerCase() === query.category.toLowerCase());
        if (cat) {
          try {
            trackCategoryView(cat.id);
          } catch {}
        }
      }
    }
    if (query?.q !== undefined) {
      setSearchQuery(query.q || '');
      setCurrentPage(1);
      if (query.q.trim()) {
        try {
          trackSearch(query.q.trim());
        } catch {}
      }
    }
    if (query?.page) {
      setCurrentPage(parseInt(query.page, 10) || 1);
    }
  }, [query, categories, trackCategoryView, trackSearch]);

  // Reset page to 1 whenever any filter changes
  const handleCategoryChange = (catName) => {
    setSelectedCategory(catName);
    setCurrentPage(1);
    if (catName !== 'All' && categories?.length > 0) {
      const cat = categories.find((c) => c.name?.toLowerCase() === catName.toLowerCase());
      if (cat) {
        try {
          trackCategoryView(cat.id);
        } catch {}
      }
    }
    navigate('products', {
      query: {
        category: catName !== 'All' ? catName : undefined,
        q: searchQuery || undefined
      }
    });
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handlePriceChange = (val) => {
    setPriceRange(val);
    setCurrentPage(1);
  };

  const handleRatingChange = (val) => {
    setMinRating(val);
    setCurrentPage(1);
  };

  const handleStockChange = (val) => {
    setInStockOnly(val);
    setCurrentPage(1);
  };

  const handleSortChange = (val) => {
    setSortBy(val);
    setCurrentPage(1);
  };

  // Filter & Sort Products (Powered by Smart Natural-Language Search Engine)
  const filteredProducts = useMemo(() => {
    let sidebarMin = undefined;
    let sidebarMax = undefined;
    if (priceRange === 'under10k') sidebarMax = 9999;
    if (priceRange === '10kTo30k') { sidebarMin = 10000; sidebarMax = 30000; }
    if (priceRange === '30kTo100k') { sidebarMin = 30000; sidebarMax = 100000; }
    if (priceRange === 'above100k') sidebarMin = 100001;

    if (searchQuery.trim()) {
      const { results } = executeSmartSearch(products, searchQuery, {
        category: selectedCategory !== 'All' && selectedCategory !== 'all' ? selectedCategory : undefined,
        minPrice: sidebarMin,
        maxPrice: sidebarMax,
        minRating: minRating > 0 ? minRating : undefined,
        inStockOnly,
        sortBy: sortBy === 'featured' ? 'relevance' : sortBy
      });
      return results;
    }

    return products.filter((p) => {
      // 2. Category Filter
      if (selectedCategory !== 'All' && selectedCategory !== 'all') {
        const matchesCatName = p.category?.toLowerCase() === selectedCategory.toLowerCase();
        const matchesCatSlug = p.categorySlug?.toLowerCase() === selectedCategory.toLowerCase();
        const matchesCatId = p.categoryId === selectedCategory;
        if (!matchesCatName && !matchesCatSlug && !matchesCatId) {
          return false;
        }
      }

      // 3. Price Filter
      if (priceRange === 'under10k' && p.price >= 10000) return false;
      if (priceRange === '10kTo30k' && (p.price < 10000 || p.price > 30000)) return false;
      if (priceRange === '30kTo100k' && (p.price < 30000 || p.price > 100000)) return false;
      if (priceRange === 'above100k' && p.price <= 100000) return false;

      // 4. Rating Filter
      if (minRating > 0 && p.rating < minRating) return false;

      // 5. Stock Availability Filter
      if (inStockOnly && p.stock <= 0) return false;

      return true;
    }).sort((a, b) => {
      // 6. Sorting
      if (sortBy === 'priceAsc') return a.price - b.price;
      if (sortBy === 'priceDesc') return b.price - a.price;
      if (sortBy === 'ratingDesc') return b.rating - a.rating;
      if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return (b.rating || 0) - (a.rating || 0); // Default: Featured (top ratings first)
    });
  }, [products, searchQuery, selectedCategory, priceRange, minRating, inStockOnly, sortBy]);

  // 10. Pagination Calculation
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const activePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProducts = useMemo(() => {
    const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, activePage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('All');
    setPriceRange('all');
    setMinRating(0);
    setInStockOnly(false);
    setSortBy('featured');
    setCurrentPage(1);
    navigate('products');
  }, [navigate]);

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== 'All' ||
    priceRange !== 'all' ||
    minRating > 0 ||
    inStockOnly;

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb
        items={[
          { label: 'Catalog', path: 'products' },
          ...(selectedCategory !== 'All' ? [{ label: selectedCategory }] : [])
        ]}
      />

      {/* Header & Title */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        <div>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--accent-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            InsForge Live Catalog
          </span>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginTop: '0.25rem' }}>
            Products <span className="gradient-text">Catalog</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {isLoading ? (
              'Connecting to InsForge database...'
            ) : (
              <>
                Showing {totalItems > 0 ? (activePage - 1) * ITEMS_PER_PAGE + 1 : 0} –{' '}
                {Math.min(activePage * ITEMS_PER_PAGE, totalItems)} of {totalItems} verified products
                {products.length > totalItems ? ` (filtered from ${products.length} total)` : ''}
              </>
            )}
          </p>
        </div>

        {/* Search input & Mobile filter trigger */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-subtle)' }}
            />
            <input
              type="text"
              placeholder='Try "laptops under 60 k", "best laptops", "5G phone"...'
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 2.2rem 0.6rem 2.25rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer'
                }}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            className="btn btn-secondary mobile-filter-btn"
            onClick={() => setMobileFilterOpen((prev) => !prev)}
            style={{ padding: '0.6rem 0.9rem', fontSize: '0.85rem', gap: '0.4rem' }}
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* 13. Error State Banner */}
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
            <span style={{ fontSize: '0.875rem' }}>Failed to sync live data: {error}</span>
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

      {/* Layout: Sidebar Filters + Products Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: '2rem',
          alignItems: 'flex-start'
        }}
        className="catalog-layout"
      >
        {/* Filters Sidebar */}
        <aside
          className={`card-glass ${mobileFilterOpen ? 'mobile-filters-active' : ''}`}
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem' }}>
              <Filter size={16} color="var(--accent-primary)" />
              <span>Filters</span>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f43f5e',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Reset All
              </button>
            )}
          </div>

          {/* 5. Category Filter */}
          <div>
            <h4
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-subtle)'
              }}
            >
              Categories
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <button
                onClick={() => handleCategoryChange('All')}
                style={{
                  background: selectedCategory === 'All' ? 'var(--accent-soft-hover)' : 'none',
                  border: selectedCategory === 'All' ? '1px solid var(--accent-border)' : '1px solid transparent',
                  color: selectedCategory === 'All' ? '#fff' : 'var(--text-muted)',
                  textAlign: 'left',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: selectedCategory === 'All' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>All Categories</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{products.length}</span>
              </button>

              {categories.map((c) => {
                const count = products.filter(
                  (p) => p.categoryId === c.id || p.category === c.name
                ).length;
                const isSelected = selectedCategory === c.name;

                return (
                  <button
                    key={c.id}
                    onClick={() => handleCategoryChange(c.name)}
                    style={{
                      background: isSelected ? 'var(--accent-soft-hover)' : 'none',
                      border: isSelected ? '1px solid var(--accent-border)' : '1px solid transparent',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      textAlign: 'left',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{c.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Price Range Filter */}
          <div>
            <h4
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-subtle)'
              }}
            >
              Price Range (INR)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {[
                { id: 'all', label: 'All Prices' },
                { id: 'under10k', label: 'Under ₹10,000' },
                { id: '10kTo30k', label: '₹10,000 to ₹30,000' },
                { id: '30kTo100k', label: '₹30,000 to ₹1,00,000' },
                { id: 'above100k', label: 'Above ₹1,00,000' }
              ].map((r) => (
                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="priceRange"
                    checked={priceRange === r.id}
                    onChange={() => handlePriceChange(r.id)}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 7. Rating Filter */}
          <div>
            <h4
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-subtle)'
              }}
            >
              Minimum Rating
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {[
                { val: 0, label: 'Any Rating' },
                { val: 4.8, label: '★ 4.8 & above' },
                { val: 4.5, label: '★ 4.5 & above' }
              ].map((r) => (
                <label key={r.val} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="minRating"
                    checked={minRating === r.val}
                    onChange={() => handleRatingChange(r.val)}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 9. Stock Availability */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => handleStockChange(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
              />
              <span style={{ fontWeight: inStockOnly ? 600 : 400 }}>In Stock Only</span>
            </label>
          </div>
        </aside>

        {/* Right Section: Sort controls + Grid + Pagination */}
        <div>
          {/* 8. Top Sort Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.5rem',
              padding: '0.75rem 1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {selectedCategory !== 'All' ? (
                <span>
                  Filtering by: <strong style={{ color: '#fff' }}>{selectedCategory}</strong>
                </span>
              ) : (
                <span>All Departments</span>
              )}
              {searchQuery && (
                <span>
                  {' '}
                  matching "<strong style={{ color: '#a5b4fc' }}>{searchQuery}</strong>"
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <ArrowUpDown size={14} color="var(--text-subtle)" />
              <span style={{ color: 'var(--text-subtle)' }}>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  color: '#fff',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.825rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="featured">Featured / Top Rated</option>
                <option value="priceAsc">Price: Low to High</option>
                <option value="priceDesc">Price: High to Low</option>
                <option value="ratingDesc">Highest Rating</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>
          </div>

          {/* 11. Loading State */}
          {isLoading && products.length === 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="card-glass"
                  style={{
                    height: '360px',
                    borderRadius: 'var(--radius-lg)',
                    opacity: 0.6,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1rem',
                    gap: '1rem'
                  }}
                >
                  <div style={{ height: '180px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.05)' }} />
                  <div style={{ height: '16px', width: '60%', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
                  <div style={{ height: '24px', width: '90%', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
                  <div style={{ marginTop: 'auto', height: '32px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
                </div>
              ))}
            </div>
          ) : paginatedProducts.length > 0 ? (
            /* Product Grid */
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                {paginatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* 10. Pagination Controls */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1.5rem 0'
                  }}
                >
                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePageChange(activePage - 1)}
                    disabled={activePage === 1}
                    style={{
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.85rem',
                      opacity: activePage === 1 ? 0.4 : 1,
                      cursor: activePage === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    const isActive = pageNum === activePage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: 'var(--radius-md)',
                          background: isActive ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.05)',
                          border: isActive ? 'none' : '1px solid var(--border-subtle)',
                          color: '#fff',
                          fontWeight: isActive ? 700 : 500,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePageChange(activePage + 1)}
                    disabled={activePage === totalPages}
                    style={{
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.85rem',
                      opacity: activePage === totalPages ? 0.4 : 1,
                      cursor: activePage === totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            /* 12. Empty State */
            <EmptyState
              title="No Products Match Current Criteria"
              description="Try selecting a different department, widening price bounds, or resetting filters."
              actionLabel="Clear All Filters"
              onAction={clearAllFilters}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductsPage;
