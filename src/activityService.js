import insforge from './insforge.js';

/**
 * Valid activity types for user behavior tracking
 */
export const ACTIVITY_TYPES = {
  PRODUCT_VIEW: 'product_view',
  CATEGORY_VIEW: 'category_view',
  SEARCH: 'search',
  PRODUCT_CLICK: 'product_click',
  ADD_TO_CART: 'add_to_cart',
  WISHLIST_ADD: 'wishlist_add',
  PURCHASE: 'purchase',
  PRODUCT_RATING: 'product_rating'
};

// Activity action weights for the recommendation scoring engine
export const ACTIVITY_WEIGHTS = {
  [ACTIVITY_TYPES.PURCHASE]: 15,
  [ACTIVITY_TYPES.ADD_TO_CART]: 10,
  [ACTIVITY_TYPES.WISHLIST_ADD]: 8,
  [ACTIVITY_TYPES.PRODUCT_RATING]: 6,
  [ACTIVITY_TYPES.PRODUCT_CLICK]: 3,
  [ACTIVITY_TYPES.PRODUCT_VIEW]: 2,
  [ACTIVITY_TYPES.CATEGORY_VIEW]: 2,
  [ACTIVITY_TYPES.SEARCH]: 4
};

// In-memory anti-spam deduplication cache (e.g. rapid multiple views of the same product)
const recentTrackingCache = new Map();

/**
 * Activity Tracking Service
 * Logs authenticated user interactions into the InsForge `user_activity` table.
 */
export const activityService = {
  /**
   * Core tracking function
   */
  async trackActivity({ userId, activityType, productId = null, categoryId = null, searchTerm = null }) {
    if (!userId) {
      // Gracefully ignore tracking for unauthenticated visitors (handled by cold-start)
      return { success: false, reason: 'unauthenticated' };
    }

    if (!Object.values(ACTIVITY_TYPES).includes(activityType)) {
      console.warn(`[activityService] Invalid activity type: ${activityType}`);
      return { success: false, reason: 'invalid_type' };
    }

    // Deduplicate rapid repeat events within 5 seconds (e.g. repeated page renders)
    const cacheKey = `${userId}:${activityType}:${productId || ''}:${categoryId || ''}:${searchTerm || ''}`;
    const now = Date.now();
    if (recentTrackingCache.has(cacheKey)) {
      const lastTime = recentTrackingCache.get(cacheKey);
      if (now - lastTime < 5000) {
        return { success: true, deduped: true };
      }
    }
    recentTrackingCache.set(cacheKey, now);

    try {
      const payload = {
        user_id: userId,
        activity_type: activityType,
        product_id: productId || null,
        category_id: categoryId || null,
        search_term: searchTerm ? searchTerm.trim() : null
      };

      const { data, error } = await insforge.database
        .from('user_activity')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[activityService.trackActivity] DB error:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('[activityService.trackActivity] Exception:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Fetch recent activity history for a user
   */
  async getUserActivity(userId, limit = 100) {
    if (!userId) return { data: [], error: null };

    try {
      const { data, error } = await insforge.database
        .from('user_activity')
        .select('id, user_id, product_id, category_id, activity_type, search_term, created_at, products(id, name, brand, price, rating, category_id, categories(id, name, slug))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[activityService.getUserActivity] Error:', error);
        return { data: [], error };
      }

      return { data: data || [], error: null };
    } catch (err) {
      console.error('[activityService.getUserActivity] Exception:', err);
      return { data: [], error: err };
    }
  },

  // Helper shortcuts for common events
  trackProductView(userId, productId, categoryId) {
    return this.trackActivity({ userId, activityType: ACTIVITY_TYPES.PRODUCT_VIEW, productId, categoryId });
  },

  trackProductClick(userId, productId, categoryId) {
    return this.trackActivity({ userId, activityType: ACTIVITY_TYPES.PRODUCT_CLICK, productId, categoryId });
  },

  trackCategoryView(userId, categoryId) {
    return this.trackActivity({ userId, activityType: ACTIVITY_TYPES.CATEGORY_VIEW, categoryId });
  },

  trackSearch(userId, searchTerm) {
    if (!searchTerm || !searchTerm.trim()) return Promise.resolve({ success: false });
    return this.trackActivity({ userId, activityType: ACTIVITY_TYPES.SEARCH, searchTerm: searchTerm.trim() });
  },

  trackAddToCart(userId, productId, categoryId) {
    return this.trackActivity({ userId, activityType: ACTIVITY_TYPES.ADD_TO_CART, productId, categoryId });
  },

  trackWishlistAdd(userId, productId, categoryId) {
    return this.trackActivity({ userId, activityType: ACTIVITY_TYPES.WISHLIST_ADD, productId, categoryId });
  },

  trackPurchase(userId, productId, categoryId) {
    return this.trackActivity({ userId, activityType: ACTIVITY_TYPES.PURCHASE, productId, categoryId });
  },

  trackProductRating(userId, productId, rating) {
    return this.trackActivity({ userId, activityType: ACTIVITY_TYPES.PRODUCT_RATING, productId });
  }
};

export default activityService;
