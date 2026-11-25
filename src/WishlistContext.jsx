import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { useNotifications } from './NotificationContext';
import wishlistService from './wishlistService';
import activityService from './activityService';
import recommendationService from './recommendationService';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { addItem } = useCart();
  const { sendNotification } = useNotifications();

  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  // 1. Fetch Wishlist from InsForge Database when user logs in
  const fetchWishlist = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: wishErr } = await wishlistService.getWishlist(userId);
      if (wishErr) {
        console.warn('[WishlistContext] Offline fallback active:', wishErr.message || wishErr);
        setError(null);
      } else if (Array.isArray(data) && data.length > 0) {
        setWishlistItems(data);
      }
    } catch (err) {
      console.warn('[WishlistContext] Offline fallback active:', err.message);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // 2. Check if a product is in the wishlist
  const isInWishlist = useCallback(
    (productId) => {
      if (!productId) return false;
      return wishlistItems.some((item) => item.id === productId || item.productId === productId);
    },
    [wishlistItems]
  );

  // 3. Add to Wishlist (preventing duplicates)
  const addToWishlist = useCallback(
    async (product) => {
      if (!product || !product.id) return { success: false };

      if (isInWishlist(product.id)) {
        return { success: true, isDuplicate: true };
      }

      // Optimistic UI update
      setWishlistItems((prev) => [
        ...prev,
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          category: product.category,
          price: Number(product.price || 0),
          originalPrice: Number(product.originalPrice || product.price || 0),
          image: product.image || (product.images && product.images[0]),
          rating: Number(product.rating || 4.5),
          stock: Number(product.stock ?? 0),
          inStock: Number(product.stock ?? 0) > 0,
          createdAt: new Date().toISOString()
        }
      ]);

      // Synchronize with InsForge database if user is authenticated
      if (userId) {
        try {
          const res = await wishlistService.addToWishlist(userId, product.id);
          if (res?.error) {
            console.warn('[WishlistContext.addToWishlist] DB sync warning (kept in local state):', res.error);
          }
        } catch (err) {
          console.warn('[WishlistContext.addToWishlist] DB sync exception (kept in local state):', err);
        }

        // Track wishlist_add activity for AI recommendation engine
        activityService.trackWishlistAdd(userId, product.id, product.categoryId || product.category_id).catch(() => {});
        recommendationService.invalidateCache(userId);
      }

      if (sendNotification) {
        sendNotification({
          title: 'Product Added to Wishlist',
          message: `"${product.name}" has been saved to your wishlist.`,
          type: 'system',
          variant: 'wishlist',
          image: product.image || (product.images && product.images[0]),
          actionLabel: 'View Wishlist',
          link_page: 'wishlist'
        }).catch(() => {});
      }

      return { success: true };
    },
    [userId, isInWishlist, sendNotification]
  );

  // 4. Remove from Wishlist
  const removeFromWishlist = useCallback(
    async (productId, options = {}) => {
      if (!productId) return;

      const removedItem = wishlistItems.find((item) => item.id === productId || item.productId === productId);

      // Optimistic UI update
      setWishlistItems((prev) => prev.filter((item) => item.id !== productId && item.productId !== productId));

      // Synchronize with InsForge database
      if (userId) {
        try {
          const res = await wishlistService.removeFromWishlist(userId, productId);
          if (res?.error) {
            console.warn('[WishlistContext.removeFromWishlist] DB sync warning:', res.error);
          }
        } catch (err) {
          console.warn('[WishlistContext.removeFromWishlist] DB sync exception:', err);
        }
      }

      if (removedItem && !options?.silent && sendNotification) {
        sendNotification({
          title: 'Product Removed from Wishlist',
          message: `"${removedItem.name}" was removed from your wishlist.`,
          type: 'system',
          variant: 'removed',
          image: removedItem.image
        }).catch(() => {});
      }
    },
    [userId, wishlistItems, sendNotification]
  );

  // 5. Toggle Wishlist
  const toggleWishlist = useCallback(
    async (product) => {
      if (!product || !product.id) return;
      if (isInWishlist(product.id)) {
        await removeFromWishlist(product.id);
      } else {
        await addToWishlist(product);
      }
    },
    [isInWishlist, removeFromWishlist, addToWishlist]
  );

  // 6. Move product from Wishlist to Cart
  const moveToCart = useCallback(
    async (product) => {
      if (!product || !product.id) return;

      // 1. Add to cart
      const cartResult = await addItem(product, 1);
      if (cartResult?.success) {
        // 2. Remove from wishlist silently since addItem already notified
        await removeFromWishlist(product.id, { silent: true });
      }
      return cartResult;
    },
    [addItem, removeFromWishlist]
  );

  const value = {
    wishlistItems,
    wishlistCount: wishlistItems.length,
    isLoading,
    error,
    refreshWishlist: fetchWishlist,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    moveToCart
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}

export default WishlistContext;
