import insforge from './insforge.js';
import {
  calculatePricing,
  CALCULATION_ORDER,
  SHIPPING_CONFIG,
  PROMOTION_TIERS,
  PROMO_COUPONS,
  checkPromotionValidity
} from './dynamicPricingEngine.js';

/**
 * Client-Side Pricing & Promotion Service
 *
 * Synchronizes cart and checkout pricing with the authoritative server-side
 * promotion service (`POST /api/pricing/calculate`), attaching the authenticated
 * user's session token when signed in so permitted personalization rules
 * (such as first-order eligibility) and live database prices are evaluated
 * server-side.
 *
 * Falls back cleanly to deterministic local `calculatePricing` only when offline
 * or running in a static-only preview without an active API server, while
 * surfacing real server validation errors (HTTP 4xx/5xx).
 */

async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { data: sessionData } = await insforge.auth.getCurrentSession();
    const token = sessionData?.session?.accessToken;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Proceed unauthenticated if session lookup is unavailable
  }
  return headers;
}

function isAbortError(err) {
  return err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('aborted');
}

export const pricingService = {
  /**
   * Request authoritative server-side pricing & promotion calculation.
   *
   * @param {Object} params
   * @param {Array}  params.items
   * @param {string|null} [params.couponCode]
   * @param {string} [params.shippingMethod='standard']
   * @param {Object|null} [params.userContext] - Fallback permitted context when offline
   * @param {Object|null} [params.clientTotals] - Optional client totals for integrity check
   * @param {boolean} [params.strictCatalog=false]
   * @param {AbortSignal} [params.signal]
   */
  async calculateCartPricing({
    items = [],
    couponCode = null,
    shippingMethod = 'standard',
    userContext = null,
    clientTotals = null,
    strictCatalog = false,
    signal = undefined
  } = {}) {
    const availableItems = Array.isArray(items)
      ? items.filter((i) => i && !i.isUnavailable && Number(i.quantity ?? 1) > 0)
      : [];

    if (availableItems.length === 0) {
      const emptyPricing = calculatePricing({
        items: [],
        subtotal: 0,
        couponCode,
        shippingMethod,
        userContext
      });
      return {
        data: {
          ...emptyPricing,
          items: [],
          priceAdjustments: [],
          stockAdjustments: [],
          tamperingDetected: false,
          source: 'empty_cart'
        },
        error: null,
        isServerVerified: true
      };
    }

    try {
      const headers = await getAuthHeaders();
      if (signal?.aborted) {
        return { aborted: true, data: null, error: null, isServerVerified: false };
      }

      const payloadItems = availableItems.map((it) => ({
        id: it.productId || it.id,
        productId: it.productId || it.id,
        name: it.name,
        price: Number(it.price || 0),
        quantity: Number(it.quantity || 1),
        category: it.category || '',
        categorySlug: it.categorySlug || '',
        categoryId: it.categoryId || it.category_id || null
      }));

      const res = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          items: payloadItems,
          couponCode: couponCode || null,
          shippingMethod: shippingMethod || 'standard',
          clientTotals: clientTotals || undefined,
          strictCatalog: Boolean(strictCatalog)
        })
      });

      const body = await res.json().catch(() => null);

      if (!res.ok || !body || body.ok === false) {
        return {
          data: null,
          error: body?.error || `Unable to verify live promotions (HTTP ${res.status}).`,
          isServerVerified: false
        };
      }

      return {
        data: body,
        error: null,
        isServerVerified: true
      };
    } catch (err) {
      if (isAbortError(err) || signal?.aborted) {
        return { aborted: true, data: null, error: null, isServerVerified: false };
      }

      // Network / static fallback when API endpoint is unreachable
      const fallback = calculatePricing({
        items: availableItems,
        couponCode,
        shippingMethod,
        userContext
      });

      return {
        data: {
          ...fallback,
          items: availableItems,
          priceAdjustments: [],
          stockAdjustments: [],
          tamperingDetected: false,
          source: 'local_fallback'
        },
        error: null,
        isServerVerified: false
      };
    }
  },

  /**
   * Fetch active promotion configuration from the server (with local fallback).
   */
  async getPromotionsConfig({ signal = undefined } = {}) {
    try {
      const res = await fetch('/api/pricing/promotions', { signal });
      if (res.ok) {
        const body = await res.json();
        if (body?.ok) return { data: body, error: null };
      }
    } catch (err) {
      if (isAbortError(err)) return { aborted: true, data: null, error: null };
    }

    const now = new Date();
    return {
      data: {
        ok: true,
        calculationOrder: CALCULATION_ORDER,
        shippingConfig: SHIPPING_CONFIG,
        tiers: PROMOTION_TIERS.filter((t) => checkPromotionValidity(t, now).valid),
        coupons: PROMO_COUPONS.filter((c) => checkPromotionValidity(c, now).valid)
      },
      error: null
    };
  }
};

export default pricingService;

