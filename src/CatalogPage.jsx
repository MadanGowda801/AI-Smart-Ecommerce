import React, { useState } from 'react';
import { Search, SlidersHorizontal, ShoppingCart, Star, Heart } from 'lucide-react';
import { useCart } from './CartContext';

const DEMO_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Aura Sound Pro Wireless ANC Headphones',
    category: 'Electronics',
    price: 249.99,
    rating: 4.8,
    reviewsCount: 124,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    stock: 45,
  },
  {
    id: 'prod-2',
    name: 'Titanium Smart Watch Series 7',
    category: 'Wearables',
    price: 399.0,
    rating: 4.9,
    reviewsCount: 88,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    stock: 22,
  },
  {
    id: 'prod-3',
    name: 'Minimalist Mechanical Keyboard RGB',
    category: 'Accessories',
    price: 139.5,
    rating: 4.7,
    reviewsCount: 65,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    stock: 18,
  },
  {
    id: 'prod-4',
    name: 'Ultra-Fast GaN 100W Charging Station',
    category: 'Electronics',
    price: 69.99,
    rating: 4.6,
    reviewsCount: 210,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
    stock: 80,
  },
];

const CATEGORIES = ['All', 'Electronics', 'Wearables', 'Accessories'];

export function CatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { addItem } = useCart();
  const [addedId, setAddedId] = useState(null);

  const filtered = DEMO_PRODUCTS.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAddToCart = (product) => {
    addItem(product, 1);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1500);
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <span className="feature-tag">Live Catalog Storefront</span>
          <h1 style={{ fontSize: '2.25rem', marginTop: '0.4rem' }}>
            Explore Smart <span className="gradient-text">Products</span>
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Search, filter, and add items with persistent state and InsForge RLS protection.
          </p>
        </div>

        {/* Search input */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Search gadgets, watches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem 0.65rem 2.25rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 1rem', fontSize: '0.825rem' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
        {filtered.map((prod) => (
          <div key={prod.id} className="card-glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '180px', marginBottom: '1rem' }}>
              <img
                src={prod.image}
                alt={prod.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  background: 'rgba(10, 12, 20, 0.75)',
                  backdropFilter: 'blur(8px)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#a5b4fc',
                }}
              >
                {prod.category}
              </span>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 600, minHeight: '2.5rem', lineHeight: 1.3 }}>
              {prod.name}
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.5rem 0', fontSize: '0.8rem', color: '#fbbf24' }}>
              <Star size={14} fill="#fbbf24" stroke="none" />
              <span style={{ fontWeight: 700 }}>{prod.rating}</span>
              <span style={{ color: 'var(--text-subtle)' }}>({prod.reviewsCount} reviews)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '1rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                ${prod.price.toFixed(2)}
              </div>
              <button
                className={`btn ${addedId === prod.id ? 'btn-secondary' : 'btn-primary'}`}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                onClick={() => handleAddToCart(prod)}
              >
                <ShoppingCart size={15} />
                <span>{addedId === prod.id ? 'Added!' : 'Add to Cart'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CatalogPage;
