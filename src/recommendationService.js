import insforge from './insforge.js';
import productsService from './productsService.js';
import { ACTIVITY_TYPES, ACTIVITY_WEIGHTS } from './activityService.js';

// In-memory cache: userId -> { timestamp, data }
const recommendationCache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * AI-Based Recommendation Engine
 * Computes multi-signal personalized recommendation scores using:
 * 1. Category preference
 * 2. Product interactions (views, clicks, ratings)
 * 3. Search terms (tokenized keyword intent)
 * 4. Cart history (items currently or previously in cart)
 * 5. Wishlist history (saved wishlist preferences)
 * 6. Purchase history (previous orders & purchase activities)
 * 7. Product popularity (sales velocity, reviews count, featured status)
 * 8. Product rating (verified user score / 5.0)
 * 9. Product availability (in-stock filtering)
 */
export const recommendationService = {
  /**
   * Main recommendation pipeline: computes scored and explainable product recommendations
   */
  async getPersonalizedRecommendations(userId, { limit = 8, forceRefresh = false } = {}) {
    // 1. Check in-memory cache
    const cacheKey = `user:${userId || 'guest'}:limit:${limit}`;
    const now = Date.now();
    if (!forceRefresh && recommendationCache.has(cacheKey)) {
      const cached = recommendationCache.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    try {
      // 2. Fetch all live catalog products from database
      const { data: allProducts, error: prodErr } = await productsService.getProducts({ limit: 100 });
      if (prodErr || !allProducts || allProducts.length === 0) {
        return { recommendations: [], sections: {}, error: prodErr };
      }

      // Filter by availability (Signal 9: Product availability)
      const availableProducts = allProducts.filter((p) => (p.stock ?? 0) > 0);

      // 3. If user is not logged in, apply Cold-Start Strategy
      if (!userId) {
        const coldStart = this.computeColdStartRecommendations(availableProducts, limit);
        recommendationCache.set(cacheKey, { timestamp: now, data: coldStart });
        return coldStart;
      }

      // 4. Fetch user activities from InsForge database (with graceful offline fallback)
      let activities = [];
      let cartItems = [];
      let wishItems = [];
      let userOrders = [];

      try {
        const [actRes, cartRes, wishRes, ordRes] = await Promise.all([
          insforge.database
            .from('user_activity')
            .select('activity_type, product_id, category_id, search_term, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(200),
          insforge.database
            .from('cart_items')
            .select('product_id')
            .eq('user_id', userId),
          insforge.database
            .from('wishlist_items')
            .select('product_id')
            .eq('user_id', userId),
          insforge.database
            .from('orders')
            .select('id, order_items(product_id)')
            .eq('user_id', userId)
            .limit(20)
        ]);
        activities = actRes?.data || [];
        cartItems = cartRes?.data || [];
        wishItems = wishRes?.data || [];
        userOrders = ordRes?.data || [];
      } catch {
        // Offline fallback: use cold-start recommendations
      }

      // Check if user has any recorded activity or history
      const hasPurchases = userOrders && userOrders.some((o) => o.order_items && o.order_items.length > 0);
      const hasActivity = (activities && activities.length > 0) || (cartItems && cartItems.length > 0) || (wishItems && wishItems.length > 0) || hasPurchases;

      // 5. If user has no interaction history, apply Cold-Start Strategy
      if (!hasActivity) {
        const coldStart = this.computeColdStartRecommendations(availableProducts, limit);
        recommendationCache.set(cacheKey, { timestamp: now, data: coldStart });
        return coldStart;
      }

      // 6. Build Multi-Signal User Interest Profile
      const categoryWeights = {};
      const brandWeights = {};
      const interactedProductIds = new Set();
      const viewedCategoryNames = new Map(); // catId -> category display name
      const recentSearchTerms = [];
      const purchasedProductIds = new Set();
      const purchasedCategoryIds = new Set();

      // Collect order items from orders table
      if (userOrders) {
        userOrders.forEach((o) => {
          (o.order_items || []).forEach((item) => {
            if (item.product_id) purchasedProductIds.add(item.product_id);
          });
        });
      }

      // Cart & Wishlist product IDs
      const cartProductIds = new Set((cartItems || []).map((c) => c.product_id));
      const wishlistProductIds = new Set((wishItems || []).map((w) => w.product_id));

      // Process user activity logs
      (activities || []).forEach((act) => {
        const weight = ACTIVITY_WEIGHTS[act.activity_type] || 1;

        if (act.product_id) {
          interactedProductIds.add(act.product_id);
        }

        if (act.activity_type === ACTIVITY_TYPES.PURCHASE) {
          if (act.product_id) purchasedProductIds.add(act.product_id);
          if (act.category_id) purchasedCategoryIds.add(act.category_id);
        }

        if (act.category_id) {
          categoryWeights[act.category_id] = (categoryWeights[act.category_id] || 0) + weight;
        }

        if (act.activity_type === ACTIVITY_TYPES.SEARCH && act.search_term) {
          const clean = act.search_term.trim().toLowerCase();
          if (clean && !recentSearchTerms.includes(clean)) {
            recentSearchTerms.push(clean);
          }
        }
      });

      // Factor Cart, Wishlist, and Purchases into brand & category affinities
      availableProducts.forEach((p) => {
        if (purchasedProductIds.has(p.id)) {
          purchasedCategoryIds.add(p.categoryId);
          categoryWeights[p.categoryId] = (categoryWeights[p.categoryId] || 0) + 15;
          brandWeights[p.brand] = (brandWeights[p.brand] || 0) + 8;
        }
        if (cartProductIds.has(p.id)) {
          interactedProductIds.add(p.id);
          categoryWeights[p.categoryId] = (categoryWeights[p.categoryId] || 0) + 10;
          brandWeights[p.brand] = (brandWeights[p.brand] || 0) + 5;
        }
        if (wishlistProductIds.has(p.id)) {
          interactedProductIds.add(p.id);
          categoryWeights[p.categoryId] = (categoryWeights[p.categoryId] || 0) + 8;
          brandWeights[p.brand] = (brandWeights[p.brand] || 0) + 4;
        }
        if (categoryWeights[p.categoryId]) {
          viewedCategoryNames.set(p.categoryId, p.category);
        }
      });

      // Normalize maximum category weight
      const maxCatWeight = Math.max(1, ...Object.values(categoryWeights));

      // Determine user's top favorite category
      let favoriteCategoryId = null;
      let favoriteCategoryName = '';
      let highestCatWeight = 0;
      Object.entries(categoryWeights).forEach(([catId, w]) => {
        if (w > highestCatWeight) {
          highestCatWeight = w;
          favoriteCategoryId = catId;
          favoriteCategoryName = viewedCategoryNames.get(catId) || '';
        }
      });

      // 7. Calculate Recommendation Scores across all 9 signals
      const scoredProducts = availableProducts.map((p) => {
        // Signal 1: Category Preference Score (0.0 to 1.0) - 30% Weight
        const catWeight = categoryWeights[p.categoryId] || 0;
        const catScore = catWeight / maxCatWeight;

        // Signal 3: Search Terms Relevance (0.0 to 1.0) - 20% Weight
        let searchScore = 0;
        let matchedSearchTerm = null;
        const pText = `${p.name} ${p.brand} ${p.category} ${p.description}`.toLowerCase();

        for (const term of recentSearchTerms) {
          const keywords = term.split(/\s+/).filter(Boolean);
          const matches = keywords.filter((k) => pText.includes(k)).length;
          if (matches > 0) {
            const score = matches / keywords.length;
            if (score > searchScore) {
              searchScore = score;
              matchedSearchTerm = term;
            }
          }
        }

        // Signal 2: Product Interactions (views, clicks, ratings) - 15% Weight
        let interactionScore = 0;
        if (interactedProductIds.has(p.id)) interactionScore += 0.5;
        if (brandWeights[p.brand]) interactionScore += Math.min(0.5, brandWeights[p.brand] / 20);
        interactionScore = Math.min(1.0, interactionScore);

        // Signals 4 & 5: Cart History & Wishlist History - 15% Weight
        let cartWishlistScore = 0;
        if (cartProductIds.has(p.id)) cartWishlistScore += 0.6;
        if (wishlistProductIds.has(p.id)) cartWishlistScore += 0.4;
        cartWishlistScore = Math.min(1.0, cartWishlistScore);

        // Signal 6: Purchase History (0.0 to 1.0) - 10% Weight
        let purchaseScore = 0;
        if (purchasedCategoryIds.has(p.categoryId)) purchaseScore += 0.6;
        if (purchasedProductIds.has(p.id)) purchaseScore += 0.4;
        purchaseScore = Math.min(1.0, purchaseScore);

        // Signals 7 & 8: Product Popularity & Product Rating - 10% Weight
        const ratingNorm = Math.min(1.0, (p.rating || 4.2) / 5.0);
        const popularityNorm = Math.min(1.0, ((p.reviewsCount || 0) * 1.5 + (p.isFeatured ? 50 : 0)) / 250);
        const qualityScore = ratingNorm * 0.6 + popularityNorm * 0.4;

        // Composite Recommendation Score (0.0 to 1.0)
        // 30% Category + 20% Search + 15% Interaction + 15% Cart/Wishlist + 10% Purchase + 10% Rating/Popularity
        let rawScore =
          catScore * 0.30 +
          searchScore * 0.20 +
          interactionScore * 0.15 +
          cartWishlistScore * 0.15 +
          purchaseScore * 0.10 +
          qualityScore * 0.10;

        // Extra boost for flagship items
        if (p.isFeatured) rawScore = Math.min(1.0, rawScore + 0.04);

        const finalScore = parseFloat(Math.min(0.9999, Math.max(0.1200, rawScore)).toFixed(4));

        // Generate Explainable Recommendation Reason
        let reason = '';
        if (matchedSearchTerm && searchScore >= 0.4) {
          reason = `Based on your recent searches`;
        } else if (purchaseScore >= 0.5) {
          reason = `Similar to products you purchased`;
        } else if (p.categoryId === favoriteCategoryId && catScore >= 0.4) {
          reason = `Popular in your favorite category`;
        } else if (catScore >= 0.3) {
          reason = `Because you viewed ${p.category}`;
        } else if (cartProductIds.has(p.id) || cartWishlistScore >= 0.5) {
          reason = `Pairs well with items in your cart`;
        } else if (brandWeights[p.brand] > 3) {
          reason = `Top pick from ${p.brand} based on your browsing`;
        } else if (p.rating >= 4.8) {
          reason = `Highly rated customer favorite (★ ${p.rating})`;
        } else {
          reason = `Popular in ${p.category}`;
        }

        return {
          ...p,
          recommendationScore: finalScore,
          recommendationReason: reason,
          matchPercentage: Math.round(finalScore * 100)
        };
      });

      // Sort descending by score
      scoredProducts.sort((a, b) => b.recommendationScore - a.recommendationScore);

      // Top recommendations
      const topRecommendations = scoredProducts.slice(0, limit);

      // Build Specialized Sections
      // Section 1: "Recommended For You"
      const recommendedForYou = topRecommendations;

      // Section 2: "Because You Viewed" (products matching viewed categories)
      const becauseYouViewed = scoredProducts
        .filter((p) => p.recommendationReason.startsWith('Because you viewed') || viewedCategoryNames.has(p.categoryId))
        .slice(0, 6);

      // Section 3: "Based on Your Searches" (items matching recent search queries)
      const basedOnSearches = scoredProducts
        .filter((p) => p.recommendationReason.startsWith('Based on your recent search') || recentSearchTerms.some((t) => p.name.toLowerCase().includes(t) || p.category.toLowerCase().includes(t)))
        .slice(0, 6);

      // Section 4: "Similar Products" (items matching user's top category / purchased brand)
      const similarProducts = scoredProducts
        .filter((p) => (favoriteCategoryId ? p.categoryId === favoriteCategoryId : true))
        .slice(0, 6)
        .map((p) => ({
          ...p,
          recommendationReason: favoriteCategoryName ? `Alternative in ${favoriteCategoryName}` : p.recommendationReason
        }));

      // Section 5: "Popular Products" (highest rated & high reviewsCount)
      const popularProducts = [...availableProducts]
        .sort((a, b) => (b.rating * 100 + b.reviewsCount) - (a.rating * 100 + a.reviewsCount))
        .slice(0, 6)
        .map((p) => ({
          ...p,
          recommendationScore: 0.9200,
          recommendationReason: `Trending flagship with ★ ${p.rating} (${p.reviewsCount} reviews)`,
          matchPercentage: 92
        }));

      const result = {
        recommendations: topRecommendations,
        sections: {
          recommendedForYou,
          becauseYouViewed: becauseYouViewed.length > 0 ? becauseYouViewed : topRecommendations.slice(0, 6),
          basedOnSearches: basedOnSearches.length > 0 ? basedOnSearches : [],
          similarProducts: similarProducts.length > 0 ? similarProducts : topRecommendations.slice(0, 6),
          popularProducts
        },
        hasUserActivity: true,
        userTopCategory: favoriteCategoryId
      };

      // Persist top recommendations asynchronously to InsForge database
      this.persistRecommendationsToDatabase(userId, topRecommendations).catch((err) =>
        console.warn('[recommendationService] Background persist warning:', err.message)
      );

      recommendationCache.set(cacheKey, { timestamp: now, data: result });
      return result;
    } catch (err) {
      console.error('[recommendationService.getPersonalizedRecommendations] Exception:', err);
      const fallback = this.computeColdStartRecommendations([], limit);
      return fallback;
    }
  },

  /**
   * Cold-Start Recommendation Strategy for new users or visitors with no activity
   * Leverages:
   * - Popular products (rating + reviews)
   * - Highly rated products
   * - Category popularity diversity
   */
  computeColdStartRecommendations(allProducts = [], limit = 8) {
    if (!allProducts || allProducts.length === 0) {
      return {
        recommendations: [],
        sections: {
          recommendedForYou: [],
          becauseYouViewed: [],
          basedOnSearches: [],
          similarProducts: [],
          popularProducts: []
        },
        isColdStart: true,
        hasUserActivity: false
      };
    }

    // Sort by rating, reviews, and featured status
    const sorted = [...allProducts]
      .filter((p) => (p.stock ?? 0) > 0)
      .sort((a, b) => {
        const scoreA = (a.rating || 4) * 0.7 + (a.isFeatured ? 1 : 0) + (a.reviewsCount || 0) * 0.002;
        const scoreB = (b.rating || 4) * 0.7 + (b.isFeatured ? 1 : 0) + (b.reviewsCount || 0) * 0.002;
        return scoreB - scoreA;
      });

    // Ensure category diversity across top items
    const pickedCategories = new Set();
    const diversePicks = [];
    const remainingPicks = [];

    sorted.forEach((p) => {
      if (!pickedCategories.has(p.categoryId) && diversePicks.length < limit) {
        pickedCategories.add(p.categoryId);
        diversePicks.push(p);
      } else {
        remainingPicks.push(p);
      }
    });

    const finalPicks = [...diversePicks, ...remainingPicks].slice(0, limit).map((p, idx) => {
      const score = parseFloat((0.95 - idx * 0.02).toFixed(4));
      return {
        ...p,
        recommendationScore: score,
        recommendationReason: p.rating >= 4.8 ? `Top rated flagship with ★ ${p.rating}` : `Popular customer choice in ${p.category}`,
        matchPercentage: Math.round(score * 100)
      };
    });

    const popularSlice = sorted.slice(0, 6).map((p) => ({
      ...p,
      recommendationScore: 0.9200,
      recommendationReason: `Popular across all categories (★ ${p.rating})`,
      matchPercentage: 92
    }));

    return {
      recommendations: finalPicks,
      sections: {
        recommendedForYou: finalPicks,
        becauseYouViewed: finalPicks.slice(0, 6).map((p) => ({
          ...p,
          recommendationReason: `Popular in ${p.category}`
        })),
        basedOnSearches: [],
        similarProducts: finalPicks.slice(0, 6).map((p) => ({
          ...p,
          recommendationReason: `Trending alternative in ${p.category}`
        })),
        popularProducts: popularSlice
      },
      isColdStart: true,
      hasUserActivity: false
    };
  },

  /**
   * Similar Products Recommender: for Product Details or Related sections
   */
  async getSimilarProducts(productId, { limit = 4 } = {}) {
    if (!productId) return [];

    try {
      const { data: currentProduct } = await productsService.getProductById(productId);
      if (!currentProduct) return [];

      const { data: allProducts } = await productsService.getProducts({ limit: 100 });
      if (!allProducts) return [];

      const similar = allProducts
        .filter((p) => p.id !== productId && (p.stock ?? 0) > 0)
        .map((p) => {
          let simScore = 0;

          // Same category
          if (p.categoryId === currentProduct.categoryId || p.category === currentProduct.category) {
            simScore += 0.50;
          }

          // Same brand
          if (p.brand && currentProduct.brand && p.brand.toLowerCase() === currentProduct.brand.toLowerCase()) {
            simScore += 0.25;
          }

          // Similar price tier (within 40% range)
          const priceRatio = Math.min(p.price, currentProduct.price) / Math.max(p.price, currentProduct.price);
          simScore += priceRatio * 0.15;

          // Product rating quality
          simScore += ((p.rating || 4.5) / 5) * 0.10;

          const finalScore = parseFloat(Math.min(0.99, simScore).toFixed(4));

          let reason = '';
          if (p.categoryId === currentProduct.categoryId && p.brand === currentProduct.brand) {
            reason = `More from ${p.brand} in ${p.category}`;
          } else if (p.categoryId === currentProduct.categoryId) {
            reason = `Alternative in ${p.category}`;
          } else {
            reason = `Similar premium hardware`;
          }

          return {
            ...p,
            recommendationScore: finalScore,
            recommendationReason: reason,
            matchPercentage: Math.round(finalScore * 100)
          };
        })
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, limit);

      return similar;
    } catch (err) {
      console.error('[recommendationService.getSimilarProducts] Error:', err);
      return [];
    }
  },

  /**
   * Cart Recommendations: Suggest complementary items for current cart contents
   */
  async getCartRecommendations(cartProductIds = [], { limit = 4 } = {}) {
    try {
      const { data: allProducts } = await productsService.getProducts({ limit: 100 });
      if (!allProducts) return [];

      const cartSet = new Set(cartProductIds);
      const cartItems = allProducts.filter((p) => cartSet.has(p.id));
      const cartCategories = new Set(cartItems.map((c) => c.categoryId));

      const candidates = allProducts
        .filter((p) => !cartSet.has(p.id) && (p.stock ?? 0) > 0)
        .map((p) => {
          let score = 0;
          let reason = 'Frequently paired with cart items';

          // Complementary accessory category boost
          if (p.categorySlug === 'accessories' || p.category?.toLowerCase().includes('accessories')) {
            score += 0.40;
            reason = 'Essential accessory for your setup';
          }

          // In same or related category
          if (cartCategories.has(p.categoryId)) {
            score += 0.30;
          }

          // Product quality
          score += ((p.rating || 4.5) / 5) * 0.30;

          const finalScore = parseFloat(Math.min(0.98, score).toFixed(4));
          return {
            ...p,
            recommendationScore: finalScore,
            recommendationReason: reason,
            matchPercentage: Math.round(finalScore * 100)
          };
        })
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, limit);

      return candidates;
    } catch (err) {
      console.error('[recommendationService.getCartRecommendations] Error:', err);
      return [];
    }
  },

  /**
   * Persists recommendations to PostgreSQL database table
   */
  async persistRecommendationsToDatabase(userId, scoredItems = []) {
    if (!userId || !scoredItems || scoredItems.length === 0) return;

    try {
      const rows = scoredItems.map((item) => ({
        user_id: userId,
        product_id: item.id,
        score: item.recommendationScore,
        reason: item.recommendationReason
      }));

      await insforge.database
        .from('recommendations')
        .upsert(rows, { onConflict: 'user_id,product_id' });
    } catch (err) {
      // Non-fatal logging
      console.warn('[recommendationService.persistRecommendationsToDatabase] Persist warning:', err.message);
    }
  },

  /**
   * Invalidate user cache when an activity is tracked
   */
  invalidateCache(userId) {
    if (userId) {
      for (const key of recommendationCache.keys()) {
        if (key.startsWith(`user:${userId}:`)) {
          recommendationCache.delete(key);
        }
      }
    }
  }
};

export default recommendationService;
