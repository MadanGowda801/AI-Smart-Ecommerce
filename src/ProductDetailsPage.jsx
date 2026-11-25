import React, { useState, useEffect, useRef } from 'react';
import {
  Star,
  Heart,
  ShoppingCart,
  Zap,
  ArrowLeft,
  ChevronRight,
  Shield,
  Truck,
  RotateCcw,
  Package,
  Plus,
  Minus,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  Bell,
  TrendingDown,
  Box,
  Image,
  Users,
  Scale
} from 'lucide-react';
import { useProducts } from './ProductsContext';
import { useCart } from './CartContext';
import { useWishlist } from './WishlistContext';
import { useNavigation } from './NavigationContext';
import { useCompare } from './CompareContext';
import Breadcrumb from './Breadcrumb';
import ProductCard from './ProductCard';
import productsService, { formatINR, isValid3dModelUrl } from './productsService';
import { useRecommendations } from './RecommendationContext';
import priceTrackerService from './priceTrackerService';
import PriceHistoryChart from './PriceHistoryChart';
import SetPriceAlertModal from './SetPriceAlertModal';
import coShoppingService from './coShoppingService';
import Interactive3DViewer from './Interactive3DViewer';

export function ProductDetailsPage() {
  const { params, navigate } = useNavigation();
  const { getProductById, getProductReviews, products, addReview, isLoading: contextLoading } = useProducts();
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isInCompare, toggleCompare, openCompare } = useCompare();
  const { trackProductView, trackProductRating, getSimilarProducts } = useRecommendations();

  const productId = params?.id;

  const [product, setProduct] = useState(() => getProductById(productId));
  const [loading, setLoading] = useState(!product && Boolean(productId));
  const [fetchError, setFetchError] = useState(null);

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [viewMode, setViewMode] = useState(() => (params?.view === '3d' ? '3d' : '2d')); // '2d' | '3d'
  const [model3dError, setModel3dError] = useState(false);

  useEffect(() => {
    if (params?.view === '3d') {
      setViewMode('3d');
    }
  }, [params?.view, productId]);
  const [activeTab, setActiveTab] = useState('description');
  const [reviewForm, setReviewForm] = useState({ author: '', rating: 5, comment: '' });
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [priceHistoryData, setPriceHistoryData] = useState(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [addedToCoShop, setAddedToCoShop] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  // Sync or fetch product directly if accessed via deep link or not yet in context
  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      if (!productId) {
        setLoading(false);
        return;
      }

      // Check context first
      const contextProd = getProductById(productId);
      if (contextProd) {
        setProduct(contextProd);
        setLoading(false);
        setFetchError(null);
        return;
      }

      // Fetch from InsForge database directly
      setLoading(true);
      setFetchError(null);
      try {
        const { data, error } = await productsService.getProductById(productId);
        if (cancelled) return;
        if (error || !data) {
          setFetchError(error?.message || 'Product not found');
          setProduct(null);
        } else {
          setProduct(data);
          setFetchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err.message || 'Failed to fetch product from database');
          setProduct(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [productId, getProductById, products]);

  const reviews = product ? getProductReviews(product.id) : [];
  const inWishlist = product ? isInWishlist(product.id) : false;
  const inCompare = product ? isInCompare(product.id) : false;

  // Track product_view in InsForge user_activity, Recently Viewed & Co-Shopping live co-browsing
  useEffect(() => {
    if (product?.id) {
      try {
        const prev = JSON.parse(localStorage.getItem('smartshop_recently_viewed') || '[]');
        const next = [product.id, ...(Array.isArray(prev) ? prev.filter((id) => id !== product.id) : [])].slice(0, 8);
        localStorage.setItem('smartshop_recently_viewed', JSON.stringify(next));
        window.dispatchEvent(new Event('smartshop_recently_viewed_updated'));
      } catch {
        // non-blocking
      }
      try {
        trackProductView(product.id, product.categoryId || product.category_id);
      } catch {
        // non-blocking
      }
      try {
        coShoppingService.syncViewingProduct(product);
      } catch {
        // non-blocking
      }
    }
    return () => {
      try {
        coShoppingService.syncViewingProduct(null);
      } catch {
        // non-blocking
      }
    };
  }, [product?.id, product?.categoryId, product?.category_id, trackProductView]);

  // Load dynamic AI Similar Products
  const [similarProducts, setSimilarProducts] = useState([]);
  useEffect(() => {
    let cancelled = false;
    if (product?.id) {
      getSimilarProducts(product.id, { limit: 4 }).then((res) => {
        if (!cancelled && res && res.length > 0) {
          setSimilarProducts(res);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [product?.id, getSimilarProducts]);

  // Load verified catalog price history
  useEffect(() => {
    let cancelled = false;
    if (product?.id) {
      priceTrackerService.getPriceHistory(product.id).then(({ data, error }) => {
        if (!cancelled) {
          if (data) {
            setPriceHistoryData(data);
          } else {
            setPriceHistoryData({
              records: [],
              hasSufficientData: false,
              count: 0,
              lowestPrice: product.price,
              highestPrice: product.price,
              currentPrice: product.price,
              priceDropPercent: 0,
              message: 'No verified price history records currently exist for this item in our catalog.'
            });
          }
        }
      }).catch((err) => {
        if (!cancelled) {
          setPriceHistoryData({
            records: [],
            hasSufficientData: false,
            count: 0,
            lowestPrice: product.price,
            highestPrice: product.price,
            currentPrice: product.price,
            priceDropPercent: 0,
            message: 'No verified price history records currently exist for this item in our catalog.'
          });
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.price, product?.originalPrice]);

  const relatedProducts = product
    ? products
        .filter((p) => p.category === product.category && p.id !== product.id)
        .slice(0, 4)
    : [];

  const handleAddToCart = () => {
    if (!product || product.stock <= 0) return;
    addItem(product, quantity);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 1800);
  };

  const handleBuyNow = () => {
    if (!product || product.stock <= 0) return;
    addItem(product, quantity);
    navigate('checkout');
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!reviewForm.author.trim() || !reviewForm.comment.trim() || !product) return;
    addReview({ ...reviewForm, productId: product.id });
    // Track product_rating activity in InsForge user_activity
    trackProductRating(product.id, reviewForm.rating);
    setReviewForm({ author: '', rating: 5, comment: '' });
    setReviewSubmitted(true);
    setTimeout(() => setReviewSubmitted(false), 3000);
  };

  // 11. Loading State
  if (loading || (contextLoading && !product && !fetchError)) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
        <div style={{ height: '24px', width: '240px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '2rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }} className="product-detail-grid">
          <div style={{ height: '420px', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ height: '24px', width: '30%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
            <div style={{ height: '40px', width: '90%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
            <div style={{ height: '30px', width: '50%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
            <div style={{ height: '100px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
          </div>
        </div>
      </div>
    );
  }

  // 12 & 13. Error / Not Found State
  if (fetchError || !product) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>Product Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '480px', margin: '0 auto 2rem' }}>
          {fetchError || 'The requested product could not be found in the InsForge database.'}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => navigate('products')}>
            <ArrowLeft size={16} /> Browse All Products
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={15} /> Reload Page
          </button>
        </div>
      </div>
    );
  }

  const images = product.images && product.images.length > 0 ? product.images : [product.image];
  const hasValid3dModel = Boolean(product.model3dUrl && isValid3dModelUrl(product.model3dUrl));

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb
        items={[
          { label: 'Products', path: 'products' },
          { label: product.category, path: 'products', query: { category: product.category } },
          { label: product.name.substring(0, 36) + '...' }
        ]}
      />

      {/* Main Product Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '3rem' }} className="product-detail-grid">
        {/* Left: Large Product Image Gallery + 3D Product Viewer */}
        <div>
          {/* View mode tabs — shown when product has a validated 3D model */}
          {hasValid3dModel && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                onClick={() => { setViewMode('2d'); setModel3dError(false); }}
                style={{
                  flex: 1,
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${viewMode === '2d' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  background: viewMode === '2d' ? 'var(--accent-soft)' : 'var(--bg-card)',
                  color: viewMode === '2d' ? 'var(--text-accent)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <Image size={14} /> 2D Image Gallery
              </button>
              <button
                onClick={() => setViewMode('3d')}
                style={{
                  flex: 1,
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${viewMode === '3d' ? '#10b981' : 'var(--border-subtle)'}`,
                  background: viewMode === '3d' ? 'rgba(16,185,129,0.16)' : 'var(--bg-card)',
                  color: viewMode === '3d' ? '#34d399' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <Box size={14} /> 3D Product Viewer
              </button>
            </div>
          )}

          {/* 3D Product Viewer */}
          {hasValid3dModel && viewMode === '3d' && (
            <Interactive3DViewer product={product} />
          )}

          {/* 2D Large Product Image & Gallery */}
          {(viewMode === '2d' || !hasValid3dModel) && (
            <div
              style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1rem',
                height: '440px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <img
                src={images[selectedImage] || product.image}
                alt={product.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://placehold.co/800x600/1e293b/6366f1?text=${encodeURIComponent((product.name || 'Product').substring(0, 24))}`;
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {product.discountPercent > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '0.3rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)'
                  }}
                >
                  {product.discountPercent}% OFF
                </span>
              )}
              {hasValid3dModel && (
                <button
                  onClick={() => setViewMode('3d')}
                  style={{
                    position: 'absolute',
                    bottom: '14px',
                    right: '14px',
                    background: 'var(--accent-gradient)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    padding: '0.45rem 0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: 'var(--shadow-glow)',
                  }}
                >
                  <Box size={14} /> View in 3D
                </button>
              )}
            </div>
          )}

          {/* Product Gallery Thumbnails */}
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '4px' }}>
              {images.map((img, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedImage(i);
                    setViewMode('2d');
                  }}
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: selectedImage === i ? '2px solid #6366f1' : '1px solid var(--border-subtle)',
                    flexShrink: 0,
                    opacity: selectedImage === i ? 1 : 0.7,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <img
                    src={img}
                    alt={`${product.name} Gallery ${i + 1}`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = product.image;
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Brand & Category */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
              {product.brand}
            </span>
            <span
              onClick={() => navigate('products', { query: { category: product.category } })}
              style={{ fontSize: '0.78rem', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
            >
              {product.category}
            </span>
            {product.isAiRecommended && (
              <span style={{ fontSize: '0.78rem', fontWeight: 600, background: 'rgba(236,72,153,0.15)', color: '#f472b6', padding: '0.2rem 0.6rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={11} /> AI Pick
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.2 }}>{product.name}</h1>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={16}
                  fill={s <= Math.round(product.rating) ? '#fbbf24' : 'none'}
                  stroke={s <= Math.round(product.rating) ? '#fbbf24' : 'var(--text-subtle)'}
                />
              ))}
            </div>
            <span style={{ fontWeight: 700, color: '#fbbf24' }}>{product.rating}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({product.reviewsCount} customer reviews)</span>
          </div>

          {/* Price (INR) */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
              {formatINR(product.price)}
            </span>
            {product.originalPrice > product.price && (
              <>
                <span style={{ fontSize: '1.2rem', color: 'var(--text-subtle)', textDecoration: 'line-through' }}>
                  {formatINR(product.originalPrice)}
                </span>
                <span style={{ fontSize: '1rem', color: 'var(--success)', fontWeight: 700 }}>
                  {product.discountPercent}% OFF
                </span>
              </>
            )}
          </div>

          {/* Smart Price Tracker Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <button
              id="details-track-price-btn"
              onClick={() => {
                setActiveTab('price-tracker');
                const el = document.getElementById('product-tabs-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <TrendingDown size={13} color="#818cf8" />
              Verified Price History
            </button>
            <button
              id="details-set-alert-btn"
              onClick={() => setIsAlertModalOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-light)',
                color: '#cbd5e1',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Bell size={13} />
              Set Target Price Alert
            </button>
          </div>

          {/* 9. Stock Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: product.stock > 10 ? 'var(--success)' : product.stock > 0 ? '#f59e0b' : '#ef4444'
              }}
            />
            <span style={{ color: product.stock > 10 ? 'var(--success)' : product.stock > 0 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
              {product.stock > 10
                ? `In Stock (${product.stock} units ready to ship)`
                : product.stock > 0
                ? `Hurry! Only ${product.stock} units left in stock`
                : 'Currently Out of Stock'}
            </span>
          </div>

          {/* Quantity Selector */}
          {product.stock > 0 && (
            <div>
              <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>
                Quantity
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', width: 'fit-content', overflow: 'hidden' }}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '0.55rem 0.9rem', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                >
                  <Minus size={15} />
                </button>
                <span style={{ padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '1rem', minWidth: '48px', textAlign: 'center', borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '0.55rem 0.9rem', cursor: quantity >= product.stock ? 'not-allowed' : 'pointer', opacity: quantity >= product.stock ? 0.5 : 1, fontSize: '1.1rem', lineHeight: 1 }}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              style={{ flex: '1 1 150px', padding: '0.8rem', fontSize: '0.95rem' }}
            >
              {addedToCart ? (
                <>
                  <Check size={17} /> Added to Cart!
                </>
              ) : (
                <>
                  <ShoppingCart size={17} /> Add to Cart
                </>
              )}
            </button>

            <button
              className="btn"
              onClick={handleBuyNow}
              disabled={product.stock === 0}
              style={{
                flex: '1 1 150px',
                padding: '0.8rem',
                fontSize: '0.95rem',
                background: product.stock === 0 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                cursor: product.stock === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Zap size={17} /> Buy Now
            </button>

            <button
              onClick={() => {
                coShoppingService.addToSharedCart(product, quantity);
                setAddedToCoShop(true);
                setTimeout(() => setAddedToCoShop(false), 2000);
              }}
              style={{
                padding: '0.8rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: addedToCoShop ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all var(--transition-fast)'
              }}
              title="Add item to collaborative co-shopping bag with friends"
            >
              <Users size={16} />
              {addedToCoShop ? 'Added to Co-Shop!' : 'Add to Co-Shop'}
            </button>

            <button
              onClick={() => {
                if (!product) return;
                toggleCompare(product);
              }}
              style={{
                padding: '0.8rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: inCompare ? 'var(--accent-gradient)' : 'var(--accent-soft)',
                border: inCompare ? '1px solid transparent' : '1px solid var(--accent-border)',
                color: inCompare ? '#ffffff' : 'var(--text-accent)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all var(--transition-fast)'
              }}
              title={inCompare ? 'Remove from AI Comparison' : 'Add this product to AI Comparison'}
              id="details-add-to-compare-btn"
            >
              {inCompare ? <Check size={16} /> : <Scale size={16} />}
              {inCompare ? 'In Comparison' : 'Add to Comparison'}
            </button>

            {inCompare && (
              <button
                onClick={openCompare}
                style={{
                  padding: '0.8rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--gold-soft)',
                  border: '1px solid var(--gold-border)',
                  color: 'var(--accent-gold-light)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}
                title="Open AI Compare Drawer"
              >
                <Sparkles size={15} /> Open Compare
              </button>
            )}

            <button
              onClick={() => toggleWishlist(product)}
              style={{
                padding: '0.8rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: inWishlist ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.05)',
                border: inWishlist ? '1px solid #ec4899' : '1px solid var(--border-light)',
                color: inWishlist ? '#ec4899' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)'
              }}
              title={inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Heart size={18} fill={inWishlist ? '#ec4899' : 'none'} />
            </button>
          </div>

          {/* Value Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
            {[
              { icon: Truck, title: 'Free Express Shipping', desc: 'Orders above ₹999' },
              { icon: Shield, title: 'Official Warranty', desc: '1 Year Brand Covered' },
              { icon: RotateCcw, title: '7-Day Return', desc: 'Hassle-free replacement' }
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <Icon size={18} color="var(--accent-primary)" />
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs: Description, Highlights, Specs, Price Tracker, Reviews */}
      <div id="product-tabs-section" className="card-glass" style={{ borderRadius: 'var(--radius-lg)', padding: '1.75rem', marginBottom: '3.5rem' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem', gap: '1.5rem', overflowX: 'auto' }}>
          {[
            { id: 'description', label: 'Description' },
            { id: 'highlights', label: 'Highlights' },
            { id: 'specs', label: 'Specifications' },
            { id: 'price-tracker', label: 'Price Tracker' },
            { id: 'reviews', label: `Reviews (${reviews.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.95rem',
                padding: '0.5rem 0.25rem 0.75rem',
                cursor: 'pointer',
                marginBottom: '-1px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Description */}
        {activeTab === 'description' && (
          <div style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.95rem' }}>
            <p style={{ marginBottom: '1rem' }}>{product.description}</p>
            {product.aiReason && (
              <div style={{ padding: '1rem', background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={20} color="#ec4899" />
                <span style={{ fontSize: '0.875rem', color: '#c7d2fe' }}>
                  <strong>Smart Recommendation Verdict:</strong> {product.aiReason}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Highlights */}
        {activeTab === 'highlights' && (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
            {(product.highlights || []).map((h, i) => (
              <li key={i} style={{ fontSize: '0.9rem' }}>{h}</li>
            ))}
          </ul>
        )}

        {/* Tab 3: Specs */}
        {activeTab === 'specs' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {Object.entries(product.specs || {}).map(([k, v]) => (
              <div key={k} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600, marginTop: '0.2rem' }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Reviews */}
        {activeTab === 'reviews' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }} className="review-split">
              {/* Existing Reviews */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Customer Feedback</h3>
                {reviews.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {reviews.map((r) => (
                      <div key={r.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.author}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{r.date}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', marginBottom: '0.5rem' }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={12} fill={s <= r.rating ? '#fbbf24' : 'none'} stroke={s <= r.rating ? '#fbbf24' : 'var(--text-subtle)'} />
                          ))}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>"{r.comment}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-subtle)', fontSize: '0.9rem' }}>No reviews yet. Be the first to review this product!</p>
                )}
              </div>

              {/* Add Review Form */}
              <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Write a Review</h3>

                {reviewSubmitted && (
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', color: '#34d399', fontSize: '0.85rem' }}>
                    ✓ Thank you! Your review has been published.
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Your Name</label>
                  <input
                    type="text"
                    required
                    value={reviewForm.author}
                    onChange={(e) => setReviewForm({ ...reviewForm, author: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    style={{ width: '100%', padding: '0.6rem 0.9rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Rating</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setReviewForm({ ...reviewForm, rating: s })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <Star size={22} fill={s <= reviewForm.rating ? '#fbbf24' : 'none'} stroke={s <= reviewForm.rating ? '#fbbf24' : 'var(--text-subtle)'} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Review Details</label>
                  <textarea
                    rows={4}
                    required
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    placeholder="Share your experience with sound quality, battery life, design..."
                    style={{ width: '100%', padding: '0.6rem 0.9rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.875rem', resize: 'vertical' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                  Submit Review
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab: Price Tracker */}
        {activeTab === 'price-tracker' && (
          <div>
            <PriceHistoryChart
              priceHistoryData={priceHistoryData}
              onOpenSetAlert={() => setIsAlertModalOpen(true)}
              currentProduct={product}
            />
          </div>
        )}
      </div>

      {/* Related Products from Database */}
      {relatedProducts.length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>
            More in <span className="gradient-text">{product.category}</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* AI Recommendation: Similar Products */}
      {similarProducts.length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ec4899', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            <Sparkles size={14} color="#ec4899" />
            <span>AI Match Engine</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Similar Products You Might Like
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Hardware alternatives ranked by hardware category, brand affinity, and customer satisfaction.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {similarProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Set Target Price Alert Modal */}
      <SetPriceAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        product={product}
        onAlertCreated={() => {
          // Alert created successfully
        }}
      />
    </div>
  );
}

export default ProductDetailsPage;
