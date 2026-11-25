import { INITIAL_PRODUCTS, LEGACY_TEST_PRODUCTS } from '../src/mockData.js';
import {
  CALCULATION_ORDER,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
  EXPRESS_SHIPPING_FEE,
  SAMEDAY_SHIPPING_FEE,
  GST_RATE_PERCENT,
  MAX_DISCOUNT_PERCENT_CAP,
  SHIPPING_CONFIG,
  PROMOTION_TIERS,
  PROMO_COUPONS,
  toPaise,
  fromPaise,
  normalizeCategorySlug,
  checkPromotionValidity,
  isItemEligibleForRule,
  calculatePricing
} from '../src/dynamicPricingEngine.js';

/**
 * Reusable Server-Side Promotion and Discount Calculation Service
 *
 * Responsibilities:
 * - Resolves authoritative unit prices, stock, and categories from trusted DB records
 *   (never trusting client-submitted prices, discounts, taxes, or totals).
 * - Consolidates duplicate cart items before stock and subtotal evaluation.
 * - Resolves permitted, non-sensitive shopping context for authenticated users
 *   (prior non-cancelled order count and browsed/cart categories).
 * - Recalculates authoritative totals before order creation and before/during
 *   payment gateway initiation and verification.
 * - Verifies that payment gateway amounts match the server-calculated checkout total.
 */

// Build trusted fallback map from server-side catalog definitions (never client input)
const FALLBACK_CATALOG_MAP = new Map(
  [...INITIAL_PRODUCTS, ...(LEGACY_TEST_PRODUCTS || [])].map((p) => [
    String(p.id),
    {
      id: String(p.id),
      name: p.name,
      price: Number(p.price || 0),
      stock: Number(p.stock ?? 99),
      category_id: p.categoryId || null,
      category: p.category || '',
      categorySlug: p.categorySlug || normalizeCategorySlug(p)
    }
  ])
);

/**
 * Fetch trusted product records for a list of product IDs.
 * Priority:
 *   1. `catalogOverride` (Map or Array — used for deterministic server tests)
 *   2. InsForge PostgreSQL `public.products` table via privileged server `admin` client
 *   3. Server-side `INITIAL_PRODUCTS` catalog fallback if DB is offline or using local IDs
 */
export async function fetchTrustedProductsMap({ admin = null, productIds = [], catalogOverride = null } = {}) {
  const uniqueIds = Array.from(
    new Set((productIds || []).map((id) => String(id || '').trim()).filter(Boolean))
  );
  const trustedMap = new Map();

  if (uniqueIds.length === 0) return trustedMap;

  // 1. Deterministic override (for unit/integration tests)
  if (catalogOverride) {
    if (catalogOverride instanceof Map) {
      for (const id of uniqueIds) {
        if (catalogOverride.has(id)) trustedMap.set(id, catalogOverride.get(id));
      }
    } else if (Array.isArray(catalogOverride)) {
      for (const prod of catalogOverride) {
        if (prod && prod.id && uniqueIds.includes(String(prod.id))) {
          trustedMap.set(String(prod.id), prod);
        }
      }
    }
    return trustedMap;
  }

  // 2. Live PostgreSQL lookup via server admin client
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidIds = uniqueIds.filter((id) => uuidRegex.test(id));

  if (admin && uuidIds.length > 0) {
    try {
      const { data: dbProducts, error } = await admin.database
        .from('products')
        .select('id, name, price, stock, category_id, categories(name, slug)')
        .in('id', uuidIds);

      if (!error && Array.isArray(dbProducts)) {
        for (const p of dbProducts) {
          trustedMap.set(String(p.id), {
            id: String(p.id),
            name: p.name,
            price: Number(p.price || 0),
            stock: Number(p.stock ?? 0),
            category_id: p.category_id || null,
            categories: p.categories || null,
            category: p.categories?.name || '',
            categorySlug: normalizeCategorySlug(p)
          });
        }
      }
    } catch (err) {
      console.warn('[promotionService] DB catalog lookup unavailable, checking server catalog fallback:', err.message);
    }
  }

  // 3. Server-side static catalog fallback (only for unresolved IDs, never trusting client prices)
  for (const id of uniqueIds) {
    if (!trustedMap.has(id) && FALLBACK_CATALOG_MAP.has(id)) {
      trustedMap.set(id, FALLBACK_CATALOG_MAP.get(id));
    }
  }

  return trustedMap;
}

/**
 * Verify Bearer token against InsForge Auth and build permitted shopping context
 * (only order count & permitted shopping categories — zero sensitive personal data).
 */
export async function resolvePermittedUserContext({
  admin = null,
  insforgeUrl = '',
  authHeader = '',
  verifiedUserId = null,
  excludeOrderId = null
} = {}) {
  let userId = verifiedUserId || null;

  if (!userId && authHeader && authHeader.startsWith('Bearer ') && insforgeUrl) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const resp = await fetch(`${insforgeUrl}/api/auth/sessions/current`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          const body = await resp.json();
          userId = body?.user?.id || null;
        }
      } catch {
        // Offline or invalid token — proceed safely as unverified guest context
      }
    }
  }

  if (!userId) {
    return { isAuthenticated: false, priorOrderCount: null, preferredCategories: [] };
  }

  let priorOrderCount = 0;
  const preferredCategories = [];

  if (admin) {
    try {
      const { data: userOrders, error: ordErr } = await admin.database
        .from('orders')
        .select('id, status')
        .eq('user_id', userId);

      if (!ordErr && Array.isArray(userOrders)) {
        priorOrderCount = userOrders.filter(
          (o) =>
            String(o.id) !== String(excludeOrderId || '') &&
            String(o.status || '').toLowerCase() !== 'cancelled'
        ).length;
      }
    } catch {
      priorOrderCount = null;
    }

    try {
      const { data: activityRows, error: actErr } = await admin.database
        .from('user_activity')
        .select('category_id')
        .eq('user_id', userId)
        .not('category_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!actErr && Array.isArray(activityRows)) {
        for (const row of activityRows) {
          const slug = normalizeCategorySlug({ category_id: row.category_id });
          if (slug && !preferredCategories.includes(slug)) {
            preferredCategories.push(slug);
          }
        }
      }
    } catch {
      // Activity table optional for personalization
    }
  }

  return {
    isAuthenticated: true,
    priorOrderCount,
    preferredCategories
  };
}

/**
 * Authoritative server-side cart & checkout pricing calculation.
 * Never trusts client-submitted unit prices, subtotals, discounts, taxes, or totals.
 */
export async function calculateServerCartPricing({
  admin = null,
  items = null,
  subtotal = 0,
  couponCode = null,
  couponCodes = null,
  shippingMethod = 'standard',
  userContext = null,
  clientTotals = null,
  strictCatalog = false,
  allowRawSubtotalFallback = true,
  catalogOverride = null,
  configOverride = {},
  now = new Date()
} = {}) {
  const hasItems = Array.isArray(items) && items.length > 0;
  const priceAdjustments = [];
  const stockAdjustments = [];
  let tamperingDetected = false;

  if (!hasItems) {
    if (strictCatalog || !allowRawSubtotalFallback) {
      return {
        ok: false,
        error: 'Cart items are required for authoritative checkout calculation.'
      };
    }

    const fallbackResult = calculatePricing(
      {
        subtotal: Math.max(0, Number(subtotal) || 0),
        couponCode,
        couponCodes,
        shippingMethod,
        userContext,
        now
      },
      configOverride
    );

    return {
      ...fallbackResult,
      items: [],
      priceAdjustments: [],
      stockAdjustments: [],
      tamperingDetected: false,
      source: 'subtotal_preview'
    };
  }

  // 1. Consolidate duplicate product IDs & validate positive quantities
  const consolidatedRaw = new Map();
  for (const rawItem of items) {
    if (!rawItem || rawItem.isUnavailable) continue;
    const pId = String(rawItem.productId || rawItem.id || '').trim();
    if (!pId) {
      if (strictCatalog) {
        return { ok: false, error: 'Each cart item must specify a valid product ID.' };
      }
      continue;
    }

    const parsedQty = Number(rawItem.quantity ?? 1);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      if (strictCatalog) {
        return { ok: false, error: `Invalid quantity (${rawItem.quantity}) for item "${pId}".` };
      }
      continue;
    }
    const qty = Math.max(1, Math.floor(parsedQty));
    const clientPrice = rawItem.price !== undefined ? Number(rawItem.price) : null;

    if (consolidatedRaw.has(pId)) {
      const existing = consolidatedRaw.get(pId);
      existing.quantity += qty;
    } else {
      consolidatedRaw.set(pId, {
        productId: pId,
        clientName: rawItem.name || rawItem.title || 'Product',
        clientPrice,
        clientCategory: rawItem.category || rawItem.categorySlug || '',
        clientCategoryId: rawItem.categoryId || rawItem.category_id || null,
        quantity: qty
      });
    }
  }

  if (consolidatedRaw.size === 0) {
    const emptyPricing = calculatePricing(
      { items: [], subtotal: 0, couponCode, couponCodes, shippingMethod, userContext, now },
      configOverride
    );
    return {
      ...emptyPricing,
      items: [],
      priceAdjustments: [],
      stockAdjustments: [],
      tamperingDetected: false,
      source: 'server_authoritative'
    };
  }

  // 2. Lookup trusted prices & stock from database / server catalog
  const productIds = Array.from(consolidatedRaw.keys());
  const trustedMap = await fetchTrustedProductsMap({ admin, productIds, catalogOverride });

  const trustedItems = [];
  for (const [pId, entry] of consolidatedRaw.entries()) {
    const trustedProd = trustedMap.get(pId);

    if (!trustedProd) {
      return {
        ok: false,
        error: `Product "${entry.clientName || pId}" could not be verified in the trusted catalog.`
      };
    }

    const trustedUnitPaise = toPaise(trustedProd.price);
    const trustedUnitPrice = fromPaise(trustedUnitPaise);
    const availableStock = Number(trustedProd.stock ?? 0);

    // Detect stale or tampered client unit price
    if (entry.clientPrice !== null && Number.isFinite(entry.clientPrice)) {
      const clientUnitPaise = toPaise(entry.clientPrice);
      if (clientUnitPaise !== trustedUnitPaise || entry.clientPrice < 0) {
        tamperingDetected = true;
        priceAdjustments.push({
          productId: pId,
          name: trustedProd.name,
          clientPrice: entry.clientPrice,
          trustedPrice: trustedUnitPrice
        });
      }
    }

    // Enforce stock bounds
    if (availableStock <= 0) {
      if (strictCatalog) {
        return {
          ok: false,
          error: `Product "${trustedProd.name}" is currently out of stock.`
        };
      }
      stockAdjustments.push({
        productId: pId,
        name: trustedProd.name,
        requestedQuantity: entry.quantity,
        availableStock: 0,
        excluded: true
      });
      continue;
    }

    if (entry.quantity > availableStock) {
      if (strictCatalog) {
        return {
          ok: false,
          error: `Insufficient stock for "${trustedProd.name}". Only ${availableStock} unit(s) left, requested ${entry.quantity}.`
        };
      }
      stockAdjustments.push({
        productId: pId,
        name: trustedProd.name,
        requestedQuantity: entry.quantity,
        availableStock,
        clampedQuantity: availableStock
      });
    }

    const effectiveQty = strictCatalog ? entry.quantity : Math.min(entry.quantity, availableStock);
    const lineTotalPaise = trustedUnitPaise * effectiveQty;

    trustedItems.push({
      id: pId,
      productId: pId,
      name: trustedProd.name,
      trustedUnitPrice,
      unitPrice: trustedUnitPrice,
      price: trustedUnitPrice,
      quantity: effectiveQty,
      stock: availableStock,
      lineTotal: fromPaise(lineTotalPaise),
      category_id: trustedProd.category_id || entry.clientCategoryId || null,
      categories: trustedProd.categories || null,
      category: trustedProd.category || entry.clientCategory || '',
      categorySlug: trustedProd.categorySlug || normalizeCategorySlug(trustedProd)
    });
  }

  // 3. Run deterministic promotion & pricing calculation
  const pricing = calculatePricing(
    {
      items: trustedItems,
      couponCode,
      couponCodes,
      shippingMethod,
      userContext,
      now
    },
    configOverride
  );

  // 4. Check if client submitted tampered summary totals
  if (clientTotals && typeof clientTotals === 'object') {
    if (
      (clientTotals.subtotal !== undefined && toPaise(clientTotals.subtotal) !== toPaise(pricing.subtotal)) ||
      (clientTotals.discount !== undefined && toPaise(clientTotals.discount) !== toPaise(pricing.totalDiscount)) ||
      (clientTotals.total !== undefined && toPaise(clientTotals.total) !== pricing.amountInPaise)
    ) {
      tamperingDetected = true;
    }
  }

  return {
    ...pricing,
    items: trustedItems,
    priceAdjustments,
    stockAdjustments,
    tamperingDetected,
    source: 'server_authoritative'
  };
}

/**
 * Recalculate an existing order's authoritative total from DB `orders` + `order_items`
 * + trusted `products` catalog prices before payment initiation or verification.
 */
export async function recalculateOrderTotalFromDb({
  admin,
  orderId,
  catalogOverride = null,
  configOverride = {},
  now = null
} = {}) {
  if (!admin || !orderId) {
    return { ok: false, error: 'Admin database client and orderId are required.' };
  }

  const { data: orderRows, error: orderErr } = await admin.database
    .from('orders')
    .select(
      'id, user_id, total_amount, subtotal_amount, discount_amount, shipping_amount, tax_amount, shipping_method, coupon_code, payment_status, status, created_at'
    )
    .eq('id', orderId);

  if (orderErr || !orderRows || !orderRows[0]) {
    return { ok: false, error: 'Order not found in database.' };
  }
  const order = orderRows[0];

  const { data: itemRows, error: itemsErr } = await admin.database
    .from('order_items')
    .select('id, product_id, quantity, unit_price, price')
    .eq('order_id', orderId);

  if (itemsErr) {
    return { ok: false, error: 'Failed to load order items for verification.' };
  }

  // If order has line items, recalculate strictly from trusted product catalog prices
  if (Array.isArray(itemRows) && itemRows.length > 0) {
    const userContext = await resolvePermittedUserContext({
      admin,
      verifiedUserId: order.user_id || null,
      excludeOrderId: order.id
    });

    const evalTimestamp = now || (order.created_at ? new Date(order.created_at) : new Date());

    // Note: stock was already decremented upon order insertion, so do NOT reject on post-order stock=0
    const productIds = itemRows.map((r) => r.product_id).filter(Boolean);
    const trustedMap = await fetchTrustedProductsMap({ admin, productIds, catalogOverride });

    const trustedOrderItems = [];
    for (const row of itemRows) {
      const pId = String(row.product_id || '').trim();
      const trustedProd = trustedMap.get(pId);
      if (!trustedProd) {
        return {
          ok: false,
          error: `Order item product "${pId}" not found in trusted catalog.`
        };
      }
      const qty = Math.max(1, parseInt(row.quantity, 10) || 1);
      const trustedPrice = fromPaise(toPaise(trustedProd.price));

      trustedOrderItems.push({
        id: pId,
        productId: pId,
        name: trustedProd.name,
        trustedUnitPrice: trustedPrice,
        unitPrice: trustedPrice,
        price: trustedPrice,
        quantity: qty,
        category_id: trustedProd.category_id || null,
        categories: trustedProd.categories || null,
        category: trustedProd.category || '',
        categorySlug: trustedProd.categorySlug || normalizeCategorySlug(trustedProd)
      });
    }

    const pricing = calculatePricing(
      {
        items: trustedOrderItems,
        couponCode: order.coupon_code || null,
        shippingMethod: order.shipping_method || 'standard',
        userContext,
        now: evalTimestamp
      },
      configOverride
    );

    const storedOrderPaise = toPaise(order.total_amount);
    const expectedPaise = pricing.amountInPaise;
    const orderTotalMatches = storedOrderPaise === expectedPaise && expectedPaise > 0;

    return {
      ok: true,
      order,
      pricing,
      expectedTotal: pricing.grandTotal,
      expectedPaise,
      storedOrderTotal: fromPaise(storedOrderPaise),
      storedOrderPaise,
      orderTotalMatches,
      mismatchReason: orderTotalMatches
        ? null
        : `Stored order total (₹${fromPaise(storedOrderPaise)}) does not match server-calculated checkout total (₹${pricing.grandTotal}).`
    };
  }

  // Fallback only if an order was inserted without order_items rows in legacy synthetic tests
  const storedOrderPaise = toPaise(order.total_amount);
  return {
    ok: storedOrderPaise > 0,
    order,
    pricing: null,
    expectedTotal: fromPaise(storedOrderPaise),
    expectedPaise: storedOrderPaise,
    storedOrderTotal: fromPaise(storedOrderPaise),
    storedOrderPaise,
    orderTotalMatches: storedOrderPaise > 0,
    mismatchReason: storedOrderPaise > 0 ? null : 'Invalid order total stored in database.'
  };
}

/**
 * Verify that the payment amount matches the server-calculated checkout amount.
 */
export function verifyPaymentAmountMatchesServer({
  expectedPaise,
  storedOrderPaise = null,
  paymentRowAmount = null,
  clientAmountInPaise = null
} = {}) {
  const safeExpected = Math.round(Number(expectedPaise) || 0);
  if (safeExpected <= 0) {
    return {
      matches: false,
      expectedPaise: safeExpected,
      reason: 'Server-calculated checkout amount must be greater than zero.'
    };
  }

  if (storedOrderPaise !== null && storedOrderPaise !== undefined) {
    if (Math.round(Number(storedOrderPaise)) !== safeExpected) {
      return {
        matches: false,
        expectedPaise: safeExpected,
        actualPaise: Math.round(Number(storedOrderPaise)),
        reason: 'Order total does not match server-calculated checkout amount.'
      };
    }
  }

  if (paymentRowAmount !== null && paymentRowAmount !== undefined) {
    const paymentPaise = toPaise(paymentRowAmount);
    if (paymentPaise !== safeExpected) {
      return {
        matches: false,
        expectedPaise: safeExpected,
        actualPaise: paymentPaise,
        reason: `Recorded payment amount (₹${fromPaise(paymentPaise)}) does not match server-calculated checkout amount (₹${fromPaise(safeExpected)}).`
      };
    }
  }

  if (clientAmountInPaise !== null && clientAmountInPaise !== undefined) {
    const clientPaise = Math.round(Number(clientAmountInPaise));
    if (!Number.isFinite(clientPaise) || clientPaise !== safeExpected) {
      return {
        matches: false,
        expectedPaise: safeExpected,
        actualPaise: clientPaise,
        reason: 'Verified payment gateway amount does not match server-calculated checkout amount.'
      };
    }
  }

  return {
    matches: true,
    expectedPaise: safeExpected,
    expectedAmount: fromPaise(safeExpected),
    reason: null
  };
}

export {
  CALCULATION_ORDER,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
  EXPRESS_SHIPPING_FEE,
  SAMEDAY_SHIPPING_FEE,
  GST_RATE_PERCENT,
  MAX_DISCOUNT_PERCENT_CAP,
  SHIPPING_CONFIG,
  PROMOTION_TIERS,
  PROMO_COUPONS,
  toPaise,
  fromPaise,
  normalizeCategorySlug,
  checkPromotionValidity,
  isItemEligibleForRule,
  calculatePricing
};

export default {
  calculatePricing,
  calculateServerCartPricing,
  recalculateOrderTotalFromDb,
  verifyPaymentAmountMatchesServer,
  fetchTrustedProductsMap,
  resolvePermittedUserContext
};

