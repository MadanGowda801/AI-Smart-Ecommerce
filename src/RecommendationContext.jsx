import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import recommendationService from './recommendationService';
import activityService, { ACTIVITY_TYPES } from './activityService';

const RecommendationContext = createContext(null);

export function RecommendationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || null;

  const [recommendations, setRecommendations] = useState([]);
  const [sections, setSections] = useState({
    recommendedForYou: [],
    becauseYouViewed: [],
    basedOnSearches: [],
    similarProducts: [],
    popularProducts: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch recommendations for current user (or cold start)
  const loadRecommendations = useCallback(
    async (force = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await recommendationService.getPersonalizedRecommendations(userId, {
          limit: 8,
          forceRefresh: force
        });

        if (result?.recommendations) {
          setRecommendations(result.recommendations);
          setSections(result.sections || {});
        }
      } catch (err) {
        console.error('[RecommendationContext] Load error:', err);
        setError(err.message || 'Failed to load recommendations');
      } finally {
        setIsLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // 2. Track activity & intelligently refresh recommendations in background
  const track = useCallback(
    async (activityType, { productId = null, categoryId = null, searchTerm = null } = {}) => {
      if (!userId) return;

      try {
        const res = await activityService.trackActivity({
          userId,
          activityType,
          productId,
          categoryId,
          searchTerm
        });

        if (res?.success && !res?.deduped) {
          // Invalidate cache for user and reload in background
          recommendationService.invalidateCache(userId);
          // Debounced background refresh
          loadRecommendations(true);
        }
      } catch (err) {
        console.warn('[RecommendationContext.track] Tracking warning:', err.message);
      }
    },
    [userId, loadRecommendations]
  );

  const trackProductView = useCallback(
    (productId, categoryId) => {
      return track(ACTIVITY_TYPES.PRODUCT_VIEW, { productId, categoryId });
    },
    [track]
  );

  const trackProductClick = useCallback(
    (productId, categoryId) => {
      return track(ACTIVITY_TYPES.PRODUCT_CLICK, { productId, categoryId });
    },
    [track]
  );

  const trackCategoryView = useCallback(
    (categoryId) => {
      return track(ACTIVITY_TYPES.CATEGORY_VIEW, { categoryId });
    },
    [track]
  );

  const trackSearch = useCallback(
    (searchTerm) => {
      return track(ACTIVITY_TYPES.SEARCH, { searchTerm });
    },
    [track]
  );

  const trackAddToCart = useCallback(
    (productId, categoryId) => {
      return track(ACTIVITY_TYPES.ADD_TO_CART, { productId, categoryId });
    },
    [track]
  );

  const trackWishlistAdd = useCallback(
    (productId, categoryId) => {
      return track(ACTIVITY_TYPES.WISHLIST_ADD, { productId, categoryId });
    },
    [track]
  );

  const trackPurchase = useCallback(
    (productId, categoryId) => {
      return track(ACTIVITY_TYPES.PURCHASE, { productId, categoryId });
    },
    [track]
  );

  const trackProductRating = useCallback(
    (productId, rating) => {
      return track(ACTIVITY_TYPES.PRODUCT_RATING, { productId });
    },
    [track]
  );

  const value = {
    recommendations,
    sections,
    isLoading,
    error,
    refreshRecommendations: () => loadRecommendations(true),
    track,
    trackProductView,
    trackProductClick,
    trackCategoryView,
    trackSearch,
    trackAddToCart,
    trackWishlistAdd,
    trackPurchase,
    trackProductRating,
    getSimilarProducts: (prodId, opts) => recommendationService.getSimilarProducts(prodId, opts),
    getCartRecommendations: (prodIds, opts) => recommendationService.getCartRecommendations(prodIds, opts)
  };

  return <RecommendationContext.Provider value={value}>{children}</RecommendationContext.Provider>;
}

export function useRecommendations() {
  const context = useContext(RecommendationContext);
  if (!context) {
    throw new Error('useRecommendations must be used within a RecommendationProvider');
  }
  return context;
}

export default RecommendationContext;
