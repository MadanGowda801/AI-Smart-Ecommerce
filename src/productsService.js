import insforge from './insforge.js';
import { CATEGORIES, INITIAL_PRODUCTS, LEGACY_TEST_PRODUCTS } from './mockData.js';

/**
 * Currency Formatter for Indian Rupees (₹ INR)
 */
export const formatINR = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Validates 3D model URLs:
 * Must be HTTPS, from a trusted 3D CDN/host or have a valid GLB/GLTF extension.
 */
export const isValid3dModelUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const trustedHosts = [
      'modelviewer.dev',
      'raw.githubusercontent.com',
      'cdn.jsdelivr.net',
      'insforge.app',
      'unpkg.com',
      'github.com'
    ];
    const isTrustedHost = trustedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));
    const has3dExt = /\.(glb|gltf)($|\?)/i.test(parsed.pathname);
    return isTrustedHost || has3dExt;
  } catch {
    return false;
  }
};

/**
 * Normalizes raw database product records into rich frontend models
 * with computed pricing, categories, image fallbacks, and feature tags.
 */
export const normalizeProduct = (p, categoryNameMap = {}) => {
  if (!p) return null;

  const categoryName =
    p.categories?.name ||
    categoryNameMap[p.category_id] ||
    p.category ||
    'Electronics';

  const categorySlug =
    p.categories?.slug ||
    p.categorySlug ||
    categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const rawPrice = Number(p.price || 0);
  const rawDiscount = Number(p.discount ?? p.discountPercent ?? 0);
  const rawStock = Number(p.stock ?? 20);
  const rawRating = Number(p.rating || 4.5);
  const rawReviews = Number(p.review_count ?? p.reviewsCount ?? 0);

  const primaryImage =
    p.image ||
    p.image_url ||
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80';

  const computedOriginalPrice =
    p.originalPrice && Number(p.originalPrice) > rawPrice
      ? Number(p.originalPrice)
      : rawDiscount > 0
      ? Math.round(rawPrice / (1 - rawDiscount / 100))
      : rawPrice;

  // Derive dynamic highlights and specs if not present
  const defaultHighlights = [
    'Official brand warranty with door-to-door repair support',
    'Verified authentic hardware certified by InsForge catalog',
    'Express priority dispatch in tamper-proof ESD packaging'
  ];

  const defaultSpecs = {
    Brand: p.brand || 'Premium Hardware',
    Category: categoryName,
    Availability: rawStock > 0 ? (rawStock <= 5 ? `Only ${rawStock} Left` : 'In Stock') : 'Sold Out',
    Rating: `${rawRating} / 5.0 (${rawReviews} reviews)`,
    Warranty: '1 Year Domestic Manufacturer Warranty'
  };

  // Determine promotional flags
  const isFeatured = p.is_featured ?? p.isFeatured ?? (rawRating >= 4.7 || rawPrice > 50000);
  const isPopular = p.is_popular ?? p.isPopular ?? (rawReviews > 200 || rawStock < 15);
  const isAiRecommended = p.is_ai_recommended ?? p.isAiRecommended ?? (rawRating >= 4.8);

  const aiReason =
    p.ai_reason ||
    p.aiReason ||
    (rawRating >= 4.8
      ? 'Top rated flagship with exceptional customer satisfaction and build quality.'
      : 'Excellent balance of everyday reliability, efficiency, and market value.');

  return {
    ...p,
    id: p.id,
    name: p.name || 'Unnamed Product',
    slug: p.slug || p.id,
    brand: p.brand || 'SmartShop',
    category: categoryName,
    categoryId: p.category_id || p.categoryId || `cat-${categorySlug}`,
    categorySlug,
    price: rawPrice,
    originalPrice: computedOriginalPrice,
    discountPercent: rawDiscount,
    stock: rawStock,
    inStock: rawStock > 0,
    rating: rawRating,
    reviewsCount: rawReviews,
    image: primaryImage,
    imageUrl: p.image_url || primaryImage,
    image_url: p.image_url || primaryImage,
    imageKey: p.image_key || null,
    image_key: p.image_key || null,
    images: Array.isArray(p.images) && p.images.length > 0 ? p.images : [primaryImage],
    description: p.description || 'Premium smart e-commerce hardware with high reliability and performance.',
    highlights: p.highlights || defaultHighlights,
    specs: p.specs || defaultSpecs,
    isFeatured,
    isPopular,
    isAiRecommended,
    aiReason,
    // Feature 2: 3D/WebAR viewer — null for products without a model
    model3dUrl: p.model_3d_url || p.model3dUrl || null,
  };
};

/**
 * Filter, sort, and paginate local fallback catalog when InsForge cloud is unreachable
 */
function filterFallbackProducts({
  category,
  search,
  minPrice,
  maxPrice,
  minRating,
  inStockOnly,
  sortBy = 'featured',
  page = 1,
  limit = 12
} = {}) {
  const allNormalized = INITIAL_PRODUCTS.map((p) => normalizeProduct(p));

  const filtered = allNormalized.filter((p) => {
    // 1. Category filter
    if (category && category !== 'All' && category !== 'all') {
      const target = String(category).trim().toLowerCase();
      const catName = (p.category || '').toLowerCase();
      const catSlug = (p.categorySlug || '').toLowerCase();
      const catId = String(p.categoryId || '').toLowerCase();
      const matchesCat =
        catName === target ||
        catSlug === target ||
        catId === target ||
        catName.includes(target) ||
        catSlug.includes(target);
      if (!matchesCat) return false;
    }

    // 2. Search filter
    if (search && String(search).trim()) {
      const cleaned = String(search).trim().toLowerCase();
      const words = cleaned.split(/\s+/).filter((w) => w.length >= 2);
      const hay = `${p.id || ''} ${p.sku || ''} ${p.name || ''} ${p.brand || ''} ${p.description || ''} ${p.category || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
      const matchesFull = hay.includes(cleaned);
      const matchesWords = words.length > 0 && words.some((w) => hay.includes(w));
      if (!matchesFull && !matchesWords) return false;
    }

    // 3. Price range filter
    if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
      if (p.price < Number(minPrice)) return false;
    }
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      if (p.price > Number(maxPrice)) return false;
    }

    // 4. Rating filter
    if (minRating && Number(minRating) > 0) {
      if (p.rating < Number(minRating)) return false;
    }

    // 5. Stock filter
    if (inStockOnly && p.stock <= 0) {
      return false;
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'priceAsc':
        return a.price - b.price;
      case 'priceDesc':
        return b.price - a.price;
      case 'ratingDesc':
        return b.rating - a.rating;
      case 'newest':
        return String(b.id).localeCompare(String(a.id));
      case 'featured':
      default:
        return b.rating - a.rating;
    }
  });

  const validPage = Math.max(1, parseInt(page, 10) || 1);
  const validLimit = Math.max(1, parseInt(limit, 10) || 12);
  const startIndex = (validPage - 1) * validLimit;
  const paginated = filtered.slice(startIndex, startIndex + validLimit);
  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / validLimit) || 1;

  return {
    data: paginated,
    count: totalCount,
    totalPages,
    currentPage: validPage,
    limit: validLimit,
    error: null,
    isFallback: true
  };
}

let cachedCategories = null;
let cachedCategoriesTimestamp = 0;
let insforgeOfflineUntil = 0; // Circuit breaker to avoid repeated 5s network timeouts when offline

function isOfflineCircuitOpen() {
  return Date.now() < insforgeOfflineUntil;
}

function markInsforgeOffline() {
  // Pause live DB attempts for 30s after a network fetch failure so UI stays instant
  insforgeOfflineUntil = Date.now() + 30000;
}

/**
 * Reusable InsForge Data-Access Service for Categories and Products
 */
export const productsService = {
  /**
   * 1. Fetch all categories catalog from InsForge database (with fallback to CATEGORIES)
   */
  async getCategories(forceRefresh = false) {
    if (!forceRefresh && cachedCategories && Date.now() - cachedCategoriesTimestamp < 60000) {
      return { data: cachedCategories, error: null };
    }
    if (isOfflineCircuitOpen()) {
      cachedCategories = CATEGORIES;
      cachedCategoriesTimestamp = Date.now();
      return { data: CATEGORIES, error: null, isFallback: true };
    }
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Categories query timeout')), 400)
      );
      const catPromise = insforge.database
        .from('categories')
        .select('id, name, slug, description, icon, image, created_at')
        .order('name', { ascending: true });

      const { data, error } = await Promise.race([catPromise, timeoutPromise]);

      if (error || !data || data.length === 0) {
        if (error) {
          markInsforgeOffline();
        }
        cachedCategories = cachedCategories || CATEGORIES;
        cachedCategoriesTimestamp = Date.now();
        return { data: cachedCategories, error: null, isFallback: true };
      }

      cachedCategories = data;
      cachedCategoriesTimestamp = Date.now();
      return { data: cachedCategories, error: null };
    } catch {
      markInsforgeOffline();
      cachedCategories = cachedCategories || CATEGORIES;
      cachedCategoriesTimestamp = Date.now();
      return { data: cachedCategories, error: null, isFallback: true };
    }
  },

  /**
   * 2. Fetch products with full filtering, sorting, search, and pagination
   */
  async getProducts(params = {}) {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      minRating,
      inStockOnly,
      sortBy = 'featured',
      page = 1,
      limit = 12
    } = params;

    if (isOfflineCircuitOpen()) {
      return filterFallbackProducts(params);
    }

    try {
      let query = insforge.database
        .from('products')
        .select('*, model_3d_url, categories(id, name, slug, icon, description)', { count: 'exact' });

      // Category filter (support category_id UUID, category name, or category slug)
      if (category && category !== 'All' && category !== 'all') {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);
        if (isUUID) {
          query = query.eq('category_id', category);
        } else {
          // Resolve category ID from categories catalog
          const { data: catList, isFallback } = await productsService.getCategories();
          if (isFallback) {
            return filterFallbackProducts(params);
          }
          const target = category.trim().toLowerCase();
          const matched = (catList || []).find(
            (c) => c.name?.toLowerCase() === target || c.slug?.toLowerCase() === target
          );

          if (matched) {
            query = query.eq('category_id', matched.id);
          } else {
            query = insforge.database
              .from('products')
              .select('*, categories!inner(id, name, slug, icon, description)', { count: 'exact' })
              .ilike('categories.name', `%${category}%`);
          }
        }
      }

      // Search filter across name, brand, and description
      if (search && search.trim()) {
        const cleaned = search.trim().replace(/[%_]/g, '');
        if (cleaned) {
          const words = cleaned.split(/\s+/).filter((w) => w.length >= 2);
          if (words.length > 1) {
            const conditions = [
              `name.ilike.%${cleaned}%`,
              `brand.ilike.%${cleaned}%`,
              `description.ilike.%${cleaned}%`,
              ...words.map((w) => `name.ilike.%${w}%,description.ilike.%${w}%`)
            ].join(',');
            query = query.or(conditions);
          } else {
            query = query.or(`name.ilike.%${cleaned}%,brand.ilike.%${cleaned}%,description.ilike.%${cleaned}%`);
          }
        }
      }

      // Price range filter
      if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
        query = query.gte('price', Number(minPrice));
      }
      if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
        query = query.lte('price', Number(maxPrice));
      }

      // Rating filter
      if (minRating && Number(minRating) > 0) {
        query = query.gte('rating', Number(minRating));
      }

      // Stock availability filter
      if (inStockOnly) {
        query = query.gt('stock', 0);
      }

      // Sorting
      switch (sortBy) {
        case 'priceAsc':
          query = query.order('price', { ascending: true });
          break;
        case 'priceDesc':
          query = query.order('price', { ascending: false });
          break;
        case 'ratingDesc':
          query = query.order('rating', { ascending: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'featured':
        default:
          query = query.order('rating', { ascending: false }).order('created_at', { ascending: true });
          break;
      }

      // Pagination
      const validPage = Math.max(1, parseInt(page, 10) || 1);
      const validLimit = Math.max(1, parseInt(limit, 10) || 12);
      const fromOffset = (validPage - 1) * validLimit;
      const toOffset = fromOffset + validLimit - 1;

      query = query.range(fromOffset, toOffset);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Product query timeout')), 400)
      );

      const { data, count, error } = await Promise.race([query, timeoutPromise]);

      if (error) {
        markInsforgeOffline();
        return filterFallbackProducts(params);
      }

      const normalized = (data || []).map((p) => normalizeProduct(p));
      if (normalized.length === 0 && !category && !search && !minPrice && !maxPrice && !minRating) {
        return filterFallbackProducts(params);
      }

      const totalCount = count !== null ? count : normalized.length;
      const totalPages = Math.ceil(totalCount / validLimit);

      return {
        data: normalized,
        count: totalCount,
        totalPages: totalPages || 1,
        currentPage: validPage,
        limit: validLimit,
        error: null
      };
    } catch {
      markInsforgeOffline();
      return filterFallbackProducts(params);
    }
  },

  /**
   * 3. Fetch single product details by ID with category info
   */
  async getProductById(id) {
    if (!id) return { data: null, error: new Error('Product ID is required') };

    const targetLower = String(id).trim().toLowerCase();
    const allLocal = [...INITIAL_PRODUCTS, ...(LEGACY_TEST_PRODUCTS || [])];
    const mockMatch = allLocal.find(
      (p) =>
        String(p.id).toLowerCase() === targetLower ||
        String(p.slug || '').toLowerCase() === targetLower
    );

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id).trim());
    if (!isUUID && mockMatch) {
      return { data: normalizeProduct(mockMatch), error: null };
    }

    if (isOfflineCircuitOpen()) {
      return {
        data: mockMatch ? normalizeProduct(mockMatch) : normalizeProduct(INITIAL_PRODUCTS[0]),
        error: null
      };
    }

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Product by ID timeout')), 400)
      );
      const queryPromise = insforge.database
        .from('products')
        .select('*, categories(id, name, slug, icon, description)')
        .eq('id', id)
        .single();

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error || !data) {
        if (mockMatch) {
          return { data: normalizeProduct(mockMatch), error: null };
        }
        return { data: null, error };
      }

      return { data: normalizeProduct(data), error: null };
    } catch (err) {
      markInsforgeOffline();
      if (mockMatch) {
        return { data: normalizeProduct(mockMatch), error: null };
      }
      return { data: null, error: err };
    }
  },

  /**
   * 4. Fetch related products in the same category
   */
  async getRelatedProducts(productId, categoryId, limit = 4) {
    const fallbackRelated = () => {
      const targetProd = INITIAL_PRODUCTS.find((p) => String(p.id).toLowerCase() === String(productId || '').toLowerCase());
      const targetCat = categoryId || targetProd?.categorySlug || targetProd?.category;
      const matches = INITIAL_PRODUCTS.filter((p) => {
        if (String(p.id).toLowerCase() === String(productId || '').toLowerCase()) return false;
        if (!targetCat) return true;
        const t = String(targetCat).toLowerCase();
        return (
          (p.categorySlug || '').toLowerCase().includes(t) ||
          (p.category || '').toLowerCase().includes(t)
        );
      });
      const list = matches.length > 0 ? matches : INITIAL_PRODUCTS.filter((p) => String(p.id) !== String(productId));
      return { data: list.slice(0, limit).map((p) => normalizeProduct(p)), error: null };
    };

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(productId || '').trim());
    if (isOfflineCircuitOpen() || !isUUID) {
      return fallbackRelated();
    }

    try {
      let query = insforge.database
        .from('products')
        .select('*, categories(id, name, slug, icon, description)')
        .limit(limit);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      if (productId) {
        query = query.neq('id', productId);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return fallbackRelated();
      }

      return { data: data.map((p) => normalizeProduct(p)), error: null };
    } catch {
      markInsforgeOffline();
      return fallbackRelated();
    }
  }
};

export default productsService;
