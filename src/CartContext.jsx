import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import cartService from './cartService';
import activityService from './activityService';
import recommendationService from './recommendationService';
import { PROMO_COUPONS, calculatePricing } from './dynamicPricingEngine.js';
import pricingService from './pricingService.js';

const CartContext = createContext(null);
const GUEST_CART_STORAGE_KEY = 'smartshop_cart_items';

function loadStoredCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredCart(cartItems) {
  try {
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(cartItems || []));
  } catch {
    // ignore storage quota errors
  }
}

function buildCartSignature(availableItems, couponCode, userId) {
  const itemPart = (availableItems || [])
    .map((it) => `${it.productId || it.id}:${Number(it.price || 0)}:${Number(it.quantity || 1)}`)
    .sort()
    .join('|');
  return `${userId || 'guest'}::${couponCode || ''}::${itemPart}`;
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const userId = user?.id || null;

  const [items, setItemsState] = useState(() => loadStoredCart());
  const itemsRef = useRef(items);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  // Server-side promotion & pricing sync state
  const [serverPricingState, setServerPricingState] = useState({
    signature: '',
    data: null,
    isServerVerified: false
  });
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState(null);
  const [priceAdjustments, setPriceAdjustments] = useState([]);
  const [pricingRefreshNonce, setPricingRefreshNonce] = useState(0);

  const setItems = useCallback((updater) => {
    setItemsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const safeNext = Array.isArray(next) ? next : [];
      itemsRef.current = safeNext;
      saveStoredCart(safeNext);
      return safeNext;
    });
  }, []);

  const getLatestItems = useCallback(() => itemsRef.current, []);

  // 1. Fetch Cart from InsForge Database when user logs in (or load guest cart)
  const fetchCart = useCallback(async () => {
    if (!userId) {
      const stored = loadStoredCart();
      itemsRef.current = stored;
      setItemsState(stored);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // If there were guest items in localStorage, sync them first
      const guestItems = loadStoredCart();
      if (guestItems.length > 0) {
        await cartService.syncGuestCart(userId, guestItems).catch(() => {});
      }

      const { data, error: cartErr } = await cartService.getCart(userId);
      if (cartErr) {
        console.warn('[CartContext] Offline / DB fallback active:', cartErr.message || cartErr);
        setError(null);
      } else if (Array.isArray(data)) {
        if (data.length > 0 || guestItems.length === 0) {
          setItems(data);
        }
      }
    } catch (err) {
      console.warn('[CartContext] Offline / DB fallback active:', err.message);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, setItems]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // 2. Add Item to Cart
  const addItem = useCallback(
    async (product, quantity = 1) => {
      if (!product || !product.id) return { success: false, error: 'Invalid product' };

      const hasExplicitStock = product.stock !== undefined && product.stock !== null && product.stock !== '';
      const availableStock = hasExplicitStock ? Number(product.stock) : (product.inStock === false ? 0 : 99);
      if (availableStock <= 0) {
        return { success: false, error: 'Product is currently out of stock' };
      }

      const currentItems = itemsRef.current;
      const existing = currentItems.find((i) => i.id === product.id || i.productId === product.id);
      const currentQty = existing ? existing.quantity : 0;
      const targetQty = currentQty + quantity;

      if (targetQty > availableStock && currentQty >= availableStock) {
        return {
          success: false,
          error: `Cannot add more. Maximum available stock is ${availableStock}.`,
          clamped: true
        };
      }

      const clampedQtyToAdd = Math.min(quantity, Math.max(1, availableStock - currentQty));

      const addedEntry = {
        id: product.id,
        productId: product.id,
        name: product.name || product.title || 'Product',
        category: product.category || product.categories?.name || 'Electronics',
        categorySlug: product.categorySlug || product.categories?.slug || '',
        categoryId: product.categoryId || product.category_id || null,
        price: Number(product.price || 0),
        originalPrice: Number(product.originalPrice || product.price || 0),
        image: product.image || product.image_url || (product.images && product.images[0]) || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
        stock: availableStock,
        inStock: true,
        isUnavailable: false,
        quantity: existing ? Math.min(availableStock, existing.quantity + clampedQtyToAdd) : clampedQtyToAdd
      };

      // Optimistic UI update (also updates itemsRef.current synchronously)
      const nextItems = existing
        ? currentItems.map((i) =>
            i.id === product.id || i.productId === product.id ? { ...i, quantity: addedEntry.quantity } : i
          )
        : [...currentItems, addedEntry];

      itemsRef.current = nextItems;
      saveStoredCart(nextItems);
      setItemsState(nextItems);

      // Synchronize with InsForge database if user is authenticated
      if (userId) {
        try {
          const res = await cartService.addToCart(userId, { ...product, stock: availableStock }, clampedQtyToAdd);
          if (res.error) {
            console.warn('[CartContext.addItem] DB sync warning (kept in local cart):', res.error);
          }
        } catch (err) {
          console.warn('[CartContext.addItem] DB sync exception (kept in local cart):', err);
        }

        // Track add_to_cart behavior for AI recommendation engine
        activityService.trackAddToCart(userId, product.id, product.categoryId || product.category_id).catch(() => {});
        recommendationService.invalidateCache(userId);
      }

      // Trigger Product Added Confirmation Notification
      if (sendNotification) {
        sendNotification({
          title: 'Product Added to Cart',
          message: `"${addedEntry.name}" (Qty: ${addedEntry.quantity}) has been added to your shopping cart.`,
          type: 'system',
          variant: 'added',
          image: addedEntry.image,
          actionLabel: 'View Cart',
          link_page: 'cart'
        }).catch(() => {});
      }

      return { success: true, item: addedEntry, items: nextItems };
    },
    [userId, sendNotification]
  );

  // 3. Remove Item from Cart
  const removeItem = useCallback(
    async (productId) => {
      if (!productId) return { success: false, error: 'Product ID required' };

      const currentItems = itemsRef.current;
      const targetIdStr = String(productId);
      const removed = currentItems.find(
        (i) => String(i.id) === targetIdStr || String(i.productId) === targetIdStr || String(i.cartItemId) === targetIdStr
      );
      const nextItems = currentItems.filter(
        (i) => String(i.id) !== targetIdStr && String(i.productId) !== targetIdStr && String(i.cartItemId) !== targetIdStr
      );

      // Optimistic UI update
      itemsRef.current = nextItems;
      saveStoredCart(nextItems);
      setItemsState(nextItems);

      // Synchronize with InsForge database
      if (userId) {
        try {
          const dbProductId = removed?.productId || removed?.id || productId;
          const res = await cartService.removeFromCart(userId, dbProductId);
          if (res?.error) {
            console.warn('[CartContext.removeItem] DB sync warning:', res.error);
          }
        } catch (err) {
          console.warn('[CartContext.removeItem] DB sync exception:', err);
        }
      }

      // Trigger Product Removed Confirmation Notification
      if (removed && sendNotification) {
        sendNotification({
          title: 'Product Removed from Cart',
          message: `"${removed.name}" was removed from your shopping cart.`,
          type: 'system',
          variant: 'removed',
          image: removed.image,
          actionLabel: 'Browse Products',
          link_page: 'products'
        }).catch(() => {});
      }

      return { success: true, removed, items: nextItems };
    },
    [userId, sendNotification]
  );

  // 4. Update Item Quantity
  const updateQuantity = useCallback(
    async (productId, newQuantity) => {
      if (!productId) return;

      const currentItems = itemsRef.current;
      const targetIdStr = String(productId);
      const target = currentItems.find(
        (i) => String(i.id) === targetIdStr || String(i.productId) === targetIdStr
      );
      if (!target) return;

      // If quantity is 0 or less, remove item
      if (newQuantity <= 0) {
        return removeItem(productId);
      }

      const availableStock = Number(target.stock ?? 99);
      const clampedQty = Math.max(1, Math.min(availableStock, newQuantity));

      const nextItems = currentItems.map((i) =>
        String(i.id) === targetIdStr || String(i.productId) === targetIdStr ? { ...i, quantity: clampedQty } : i
      );

      itemsRef.current = nextItems;
      saveStoredCart(nextItems);
      setItemsState(nextItems);

      // Synchronize with InsForge database
      if (userId) {
        try {
          const res = await cartService.updateQuantity(userId, target.productId || target.id, clampedQty, availableStock);
          if (res?.error) {
            console.warn('[CartContext.updateQuantity] DB sync warning:', res.error);
          }
        } catch (err) {
          console.warn('[CartContext.updateQuantity] DB sync exception:', err);
        }
      }
    },
    [userId, removeItem]
  );

  // 5. Clear Entire Cart
  const clearCart = useCallback(async (options = {}) => {
    const prevCount = itemsRef.current.length;
    itemsRef.current = [];
    saveStoredCart([]);
    setItemsState([]);
    setAppliedCoupon(null);
    setCouponError('');
    setPriceAdjustments([]);
    setPricingError(null);

    if (userId) {
      try {
        const res = await cartService.clearCart(userId);
        if (res?.error) {
          console.warn('[CartContext.clearCart] DB sync warning:', res.error);
        }
      } catch (err) {
        console.warn('[CartContext.clearCart] DB sync exception:', err);
      }
    }

    if (prevCount > 0 && !options?.silent && sendNotification) {
      sendNotification({
        title: 'Shopping Cart Cleared',
        message: `Removed all ${prevCount} product${prevCount !== 1 ? 's' : ''} from your shopping cart.`,
        type: 'system',
        variant: 'removed',
        actionLabel: 'Browse Products',
        link_page: 'products'
      }).catch(() => {});
    }

    return { success: true, items: [] };
  }, [userId, sendNotification]);

  // 6. Remove all unavailable items
  const removeUnavailableItems = useCallback(async () => {
    const unavailable = itemsRef.current.filter((i) => i.isUnavailable);
    if (unavailable.length === 0) return;

    for (const item of unavailable) {
      await removeItem(item.id || item.productId);
    }
  }, [removeItem]);

  // 7. Coupon Actions — validated through the authoritative Dynamic Pricing Engine
  const applyCoupon = useCallback(
    (code) => {
      setCouponError('');
      const rawInput = String(code || '').trim();
      if (!rawInput) {
        setCouponError('Please enter a promo code.');
        return false;
      }

      // Prevent applying a second coupon on top of an already-applied coupon
      const cleanUpper = rawInput.toUpperCase();
      if (appliedCoupon?.code && appliedCoupon.code === cleanUpper) {
        setCouponError(`Duplicate coupon "${cleanUpper}" is already applied.`);
        return false;
      }

      const currentAvailable = itemsRef.current.filter((it) => !it.isUnavailable);
      const checkResult = calculatePricing({
        items: currentAvailable,
        couponCode: rawInput,
        shippingMethod: 'standard',
        userContext: { isAuthenticated: Boolean(userId) }
      });

      if (checkResult.couponError || !checkResult.validatedCoupon) {
        setCouponError(checkResult.couponError || 'Invalid promo code.');
        return false;
      }

      const fullConfig =
        PROMO_COUPONS.find((c) => c.code === checkResult.validatedCoupon.code) ||
        checkResult.validatedCoupon;

      setAppliedCoupon(fullConfig);
      setCouponError('');
      return true;
    },
    [appliedCoupon, userId]
  );

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponError('');
  }, []);

  const dismissPriceAdjustments = useCallback(() => {
    setPriceAdjustments([]);
  }, []);

  const refreshPricing = useCallback(() => {
    setPricingRefreshNonce((n) => n + 1);
  }, []);

  // 8. Calculations (Immediate Deterministic + Server-Synchronized Verification)
  const availableItems = useMemo(() => items.filter((i) => !i.isUnavailable), [items]);
  const unavailableItems = useMemo(() => items.filter((i) => i.isUnavailable), [items]);
  const totalCount = useMemo(() => items.reduce((acc, it) => acc + (it.quantity || 1), 0), [items]);

  const localPricing = useMemo(() => {
    return calculatePricing({
      items: availableItems,
      couponCode: appliedCoupon?.code || null,
      shippingMethod: 'standard',
      userContext: { isAuthenticated: Boolean(userId) }
    });
  }, [availableItems, appliedCoupon, userId]);

  // Auto-detach coupon if cart edits drop subtotal/category below coupon eligibility
  useEffect(() => {
    if (!isLoading && appliedCoupon && localPricing.couponError && !localPricing.validatedCoupon) {
      setAppliedCoupon(null);
      setCouponError(localPricing.couponError);
    }
  }, [isLoading, appliedCoupon, localPricing.couponError, localPricing.validatedCoupon]);

  const cartSignature = useMemo(
    () => buildCartSignature(availableItems, appliedCoupon?.code || '', userId),
    [availableItems, appliedCoupon, userId]
  );

  // Synchronize with authoritative server-side promotion service whenever cart/coupon/user changes
  useEffect(() => {
    if (availableItems.length === 0) {
      setIsPricingLoading(false);
      setPricingError(null);
      setServerPricingState({ signature: cartSignature, data: null, isServerVerified: true });
      return;
    }

    const controller = new AbortController();
    setIsPricingLoading(true);
    setPricingError(null);

    pricingService
      .calculateCartPricing({
        items: availableItems,
        couponCode: appliedCoupon?.code || null,
        shippingMethod: 'standard',
        userContext: { isAuthenticated: Boolean(userId) },
        signal: controller.signal
      })
      .then((res) => {
        if (res.aborted || controller.signal.aborted) return;

        if (res.error) {
          setPricingError(res.error);
          setIsPricingLoading(false);
          return;
        }

        if (res.data) {
          // If catalog prices changed on the server, sync cart items to trusted DB prices
          if (Array.isArray(res.data.priceAdjustments) && res.data.priceAdjustments.length > 0) {
            setPriceAdjustments(res.data.priceAdjustments);
            const priceMap = new Map(
              res.data.priceAdjustments.map((adj) => [String(adj.productId), Number(adj.trustedPrice)])
            );
            setItems((prev) =>
              prev.map((it) => {
                const key = String(it.productId || it.id);
                if (priceMap.has(key)) {
                  return { ...it, price: priceMap.get(key) };
                }
                return it;
              })
            );
          }

          // If DB stock changed since item was added, clamp/flag accordingly
          if (Array.isArray(res.data.stockAdjustments) && res.data.stockAdjustments.length > 0) {
            const stockMap = new Map(
              res.data.stockAdjustments.map((adj) => [String(adj.productId), adj])
            );
            setItems((prev) =>
              prev.map((it) => {
                const key = String(it.productId || it.id);
                const adj = stockMap.get(key);
                if (!adj) return it;
                if (adj.excluded || adj.availableStock <= 0) {
                  return { ...it, stock: 0, inStock: false, isUnavailable: true };
                }
                if (adj.clampedQuantity) {
                  return { ...it, stock: adj.availableStock, quantity: adj.clampedQuantity };
                }
                return it;
              })
            );
          }

          // If server-side user eligibility (e.g. firstOrderOnly check) invalidates coupon, surface it truthfully
          if (appliedCoupon && res.data.couponError && !res.data.validatedCoupon) {
            setAppliedCoupon(null);
            setCouponError(res.data.couponError);
          }

          setServerPricingState({
            signature: cartSignature,
            data: res.data,
            isServerVerified: Boolean(res.isServerVerified)
          });
        }
        setIsPricingLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsPricingLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [cartSignature, availableItems, appliedCoupon, userId, pricingRefreshNonce, setItems]);

  const activePricing =
    serverPricingState.signature === cartSignature && serverPricingState.data
      ? serverPricingState.data
      : localPricing;

  const subtotal = activePricing.subtotal;
  const tierDiscount = activePricing.tierDiscount;
  const activeTier = activePricing.activeTier;
  const couponDiscount = activePricing.couponDiscount;
  const discountAmount = activePricing.totalDiscount;
  const shippingFee = activePricing.shippingFee;
  const tax = activePricing.tax;
  const grandTotal = activePricing.grandTotal;
  const nextTierIncentive = activePricing.nextTierIncentive;
  const personalizedOffer = activePricing.personalizedOffer || null;
  const availablePromotions = activePricing.availablePromotions || [];
  const discountCapped = Boolean(activePricing.discountCapped);
  const qualifiesForFreeShipping = Boolean(activePricing.qualifiesForFreeShipping);
  const freeShippingThreshold = activePricing.freeShippingThreshold;
  const freeShippingEnabled = Boolean(activePricing.freeShippingEnabled);

  const value = {
    items,
    getLatestItems,
    availableItems,
    unavailableItems,
    hasUnavailableItems: unavailableItems.length > 0,
    unavailableCount: unavailableItems.length,
    isLoading,
    error,
    refreshCart: fetchCart,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    removeUnavailableItems,
    totalCount,
    subtotal,
    shippingFee,
    discountAmount,
    tierDiscount,
    activeTier,
    couponDiscount,
    nextTierIncentive,
    personalizedOffer,
    availablePromotions,
    discountCapped,
    qualifiesForFreeShipping,
    freeShippingThreshold,
    freeShippingEnabled,
    isPricingLoading,
    pricingError,
    priceAdjustments,
    dismissPriceAdjustments,
    refreshPricing,
    isServerVerified: serverPricingState.isServerVerified,
    pricing: activePricing,
    tax,
    grandTotal,
    appliedCoupon,
    couponError,
    applyCoupon,
    removeCoupon
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default CartContext;
