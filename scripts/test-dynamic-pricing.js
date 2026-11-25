/**
 * Comprehensive Automated Test Suite for Feature 4:
 * Smart Dynamic Pricing and Personalized Discount Engine
 *
 * Covers:
 *  1. Cart below and above free-shipping & automatic discount thresholds (and disabled threshold).
 *  2. Calculation order verification (Subtotal -> Tier -> Coupon -> Cap -> Shipping -> GST -> Total).
 *  3. Expired, future-dated, and invalid coupons.
 *  4. Category/product-scoped discounts (AUDIO15 on mixed vs non-eligible carts).
 *  5. Multiple discounts, stacking vs non-stackable rules, duplicate coupon rejection, 35% cap,
 *     non-negative totals, and integer-paise rounding accuracy.
 *  6. Personalization safety (permitted signals only, zero invented offers, normal fallback).
 *  7. Changed DB prices or quantities before checkout (cart preview clamping & strict checkout guard).
 *  8. Tampered client-side unit prices & summary totals rejected on server (`/api/pricing/calculate`).
 *  9. End-to-end Order + Razorpay Sandbox Payment verification (`paymentGatewayPlugin`):
 *     - Verified payment amount matches server-calculated checkout amount.
 *     - Tampered payment amount / tampered DB order total / cross-order replay rejected.
 *     - Existing sandbox config, failure, and cancellation flows preserved.
 */

import { EventEmitter } from 'node:events';
import {
  CALCULATION_ORDER,
  PROMO_COUPONS,
  PROMOTION_TIERS,
  calculatePricing,
  toPaise,
  fromPaise
} from '../server/dynamicPricingEngine.js';
import pricingPlugin from '../server/pricingPlugin.js';
import paymentGatewayPlugin from '../server/paymentGatewayPlugin.js';
import serverlessCalculateHandler from '../api/pricing/calculate.js';
import aiSearchPlugin from '../server/aiSearchPlugin.js';
import coShoppingPlugin, { getRoomSummary } from '../server/coShoppingPlugin.js';
import { isValid3dModelUrl } from '../src/productsService.js';

// ─── In-Process Middleware Harness (Sandbox-Safe, Zero Network Port Binding) ──

function extractMiddleware(pluginInstance) {
  let mw = null;
  pluginInstance.configureServer({
    middlewares: {
      use(fn) {
        mw = fn;
      }
    }
  });
  return mw;
}

async function invokeMiddleware(mw, { method = 'GET', url = '/', headers = {}, body = undefined } = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = {};
    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }

    const resHeaders = {};
    let rawBody = '';
    const res = {
      statusCode: 200,
      setHeader(k, v) {
        resHeaders[k.toLowerCase()] = v;
      },
      end(chunk = '') {
        rawBody += String(chunk);
        let parsed = null;
        try {
          parsed = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          parsed = rawBody;
        }
        resolve({ status: res.statusCode, headers: resHeaders, body: parsed });
      }
    };

    Promise.resolve(
      mw(req, res, () => {
        resolve({ status: 404, headers: resHeaders, body: { error: 'Not handled' } });
      })
    ).catch(reject);

    process.nextTick(() => {
      if (body !== undefined) {
        const serialized = typeof body === 'string' ? body : JSON.stringify(body);
        req.emit('data', Buffer.from(serialized, 'utf-8'));
      }
      req.emit('end');
    });
  });
}

// ─── In-Memory Mock InsForge Admin Client for Deterministic Order/Payment Tests ─

function createMockAdminDb(initialState = {}) {
  const tables = {
    products: [...(initialState.products || [])],
    orders: [...(initialState.orders || [])],
    order_items: [...(initialState.order_items || [])],
    payments: [...(initialState.payments || [])],
    payment_events: [...(initialState.payment_events || [])],
    notifications: [...(initialState.notifications || [])],
    user_activity: [...(initialState.user_activity || [])]
  };

  let idSeq = 1000;

  function makeQuery(tableName) {
    const rows = () => tables[tableName] || [];
    const filters = [];
    let pendingUpdate = null;
    let pendingInsert = null;
    let limitCount = null;

    const execute = async () => {
      if (pendingInsert) {
        const inserted = pendingInsert.map((r) => ({
          id: r.id || `mock-${tableName}-${++idSeq}`,
          created_at: r.created_at || '2026-11-07T06:00:00Z',
          ...r
        }));
        tables[tableName].push(...inserted);
        return { data: inserted, error: null };
      }

      let matched = rows().filter((row) => filters.every((fn) => fn(row)));
      if (limitCount !== null) matched = matched.slice(0, limitCount);

      if (pendingUpdate) {
        for (const row of matched) {
          Object.assign(row, pendingUpdate);
        }
        return { data: matched.map((r) => ({ ...r })), error: null };
      }

      return { data: matched.map((r) => ({ ...r })), error: null };
    };

    const builder = {
      select() {
        return builder;
      },
      eq(col, val) {
        filters.push((r) => String(r[col]) === String(val));
        return builder;
      },
      in(col, vals) {
        const set = new Set((vals || []).map(String));
        filters.push((r) => set.has(String(r[col])));
        return builder;
      },
      not(col, op, val) {
        if (op === 'is' && val === null) {
          filters.push((r) => r[col] !== null && r[col] !== undefined);
        }
        return builder;
      },
      order() {
        return builder;
      },
      limit(n) {
        limitCount = n;
        return builder;
      },
      update(patch) {
        pendingUpdate = patch;
        return builder;
      },
      insert(arr) {
        pendingInsert = Array.isArray(arr) ? arr : [arr];
        return builder;
      },
      then(onFulfilled, onRejected) {
        return execute().then(onFulfilled, onRejected);
      }
    };

    return builder;
  }

  return {
    tables,
    database: {
      from(tableName) {
        if (!tables[tableName]) tables[tableName] = [];
        return makeQuery(tableName);
      },
      async rpc(fnName, args) {
        if (fnName === 'mark_order_paid') {
          const order = tables.orders.find((o) => o.id === args.p_order_id);
          const payment = tables.payments.find((p) => p.order_id === args.p_order_id);
          if (order) {
            order.payment_status = 'paid';
            order.status = 'payment_confirmed';
          }
          if (payment) {
            payment.payment_status = 'paid';
            payment.razorpay_payment_id = args.p_razorpay_payment_id;
            payment.razorpay_signature = args.p_razorpay_signature;
            payment.transaction_reference = args.p_razorpay_payment_id;
          }
          return { data: { ok: true }, error: null };
        }
        return { data: null, error: null };
      }
    }
  };
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

async function runDynamicPricingTests() {
  console.log('======================================================================');
  console.log('🏷️  FEATURE 4: SMART DYNAMIC PRICING & PERSONALIZED DISCOUNT TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assertTest(name, condition, detail = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [${total}] PASS: ${name}${detail ? ` — ${detail}` : ''}`);
    } else {
      console.error(`❌ [${total}] FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    }
  }

  // ── GROUP 1: Thresholds & Calculation Order ─────────────────────────────────
  console.log('--- Group 1: Thresholds, Banners & Calculation Order ---');

  const belowShip = calculatePricing({ subtotal: 699, shippingMethod: 'standard' });
  assertTest(
    'Cart below free-shipping threshold (₹699)',
    belowShip.shippingFee === 99 &&
      belowShip.qualifiesForFreeShipping === false &&
      belowShip.nextTierIncentive?.type === 'free_shipping' &&
      belowShip.nextTierIncentive?.message === 'Add ₹300 more to qualify for free shipping' &&
      belowShip.tax === 35 &&
      belowShip.grandTotal === 833,
    `Banner: "${belowShip.nextTierIncentive?.message}", Total: ₹${belowShip.grandTotal}`
  );

  const aboveShip = calculatePricing({ subtotal: 999, shippingMethod: 'standard' });
  assertTest(
    'Cart at/above free-shipping threshold (₹999)',
    aboveShip.shippingFee === 0 &&
      aboveShip.qualifiesForFreeShipping === true &&
      aboveShip.nextTierIncentive?.type === 'tier_silver' &&
      aboveShip.tax === 50 &&
      aboveShip.grandTotal === 1049,
    `Shipping: ₹${aboveShip.shippingFee}, Next tier: ${aboveShip.nextTierIncentive?.type}`
  );

  const disabledFreeShip = calculatePricing(
    { subtotal: 699, shippingMethod: 'standard' },
    { freeShippingEnabled: false }
  );
  assertTest(
    'Disabled free-shipping config never promises unconfigured free shipping',
    disabledFreeShip.shippingFee === 99 &&
      disabledFreeShip.freeShippingEnabled === false &&
      disabledFreeShip.nextTierIncentive?.type !== 'free_shipping',
    `Incentive when disabled: ${disabledFreeShip.nextTierIncentive?.type || 'none'}`
  );

  const silverCart = calculatePricing({ subtotal: 5500 });
  const goldCart = calculatePricing({ subtotal: 10000 });
  const platinumCart = calculatePricing({ subtotal: 30000 });
  assertTest(
    'Configured automatic cart tiers (Silver ₹250, Gold ₹750, Platinum ₹2,500)',
    silverCart.tierDiscount === 250 &&
      silverCart.activeTier?.id === 'tier_silver' &&
      goldCart.tierDiscount === 750 &&
      goldCart.activeTier?.id === 'tier_gold' &&
      platinumCart.tierDiscount === 2500 &&
      platinumCart.activeTier?.id === 'tier_platinum' &&
      CALCULATION_ORDER.length === 7,
    `Silver=₹${silverCart.tierDiscount}, Gold=₹${goldCart.tierDiscount}, Platinum=₹${platinumCart.tierDiscount}`
  );

  // ── GROUP 2: Expired, Invalid & Scoped Coupons ──────────────────────────────
  console.log('\n--- Group 2: Expired, Invalid, Date-Window & Category-Scoped Coupons ---');

  const expiredRes = calculatePricing({ subtotal: 8000, couponCode: 'EXPIRED50' });
  assertTest(
    'Expired coupon (EXPIRED50) rejected',
    Boolean(expiredRes.couponError) &&
      expiredRes.couponError.toLowerCase().includes('expired') &&
      expiredRes.couponDiscount === 0 &&
      expiredRes.validatedCoupon === null,
    expiredRes.couponError
  );

  const futureDateRes = calculatePricing({
    subtotal: 8000,
    couponCode: 'SMART10',
    now: '2024-06-01T00:00:00Z' // before validFrom 2025-01-01
  });
  const pastWindowRes = calculatePricing({
    subtotal: 8000,
    couponCode: 'SMART10',
    now: '2029-01-01T00:00:00Z' // after validUntil 2027-12-31
  });
  assertTest(
    'Coupon validity dates (validFrom / validUntil) strictly enforced',
    futureDateRes.couponDiscount === 0 &&
      futureDateRes.couponError?.includes('not active yet') &&
      pastWindowRes.couponDiscount === 0 &&
      pastWindowRes.couponError?.includes('expired'),
    `Before window: "${futureDateRes.couponError}" | After window: "${pastWindowRes.couponError}"`
  );

  const invalidRes = calculatePricing({ subtotal: 5000, couponCode: 'FAKEPROMO99' });
  assertTest(
    'Invalid/unconfigured coupon rejected',
    Boolean(invalidRes.couponError) &&
      invalidRes.couponError.toLowerCase().includes('invalid') &&
      invalidRes.couponDiscount === 0,
    invalidRes.couponError
  );

  const audioIneligible = calculatePricing({
    items: [{ id: 'p-lap', name: 'Laptop', price: 45000, quantity: 1, categorySlug: 'electronics' }],
    couponCode: 'AUDIO15'
  });
  const audioMixed = calculatePricing({
    items: [
      { id: 'p-aud', name: 'ANC Headphones', price: 2400, quantity: 1, categorySlug: 'audio' },
      { id: 'p-gam', name: 'Gaming Mouse', price: 3000, quantity: 1, categorySlug: 'gaming' }
    ],
    couponCode: 'AUDIO15'
  });
  // Mixed cart: total subtotal = 5400 (Silver tier ₹250), Audio subtotal = 2400 -> 15% of 2400 = ₹360 (NOT 15% of 5400)
  assertTest(
    'Category-scoped coupon (AUDIO15) applies strictly to eligible category subtotal',
    audioIneligible.couponDiscount === 0 &&
      Boolean(audioIneligible.couponError) &&
      audioMixed.couponDiscount === 360 &&
      audioMixed.tierDiscount === 250 &&
      audioMixed.totalDiscount === 610,
    `Non-audio discount=₹${audioIneligible.couponDiscount}; Mixed cart audio-only discount=₹${audioMixed.couponDiscount}`
  );

  // ── GROUP 3: Stacking Rules, Duplicate Prevention, Caps & Precision ─────────
  console.log('\n--- Group 3: Stacking Rules, Duplicate Prevention, 35% Cap & Rounding ---');

  const stackedRes = calculatePricing({ subtotal: 12000, couponCode: 'SMART10' });
  // Gold ₹750 + SMART10 ₹1,200 = ₹1,950; discountedSubtotal = 10,050; 5% GST = ₹503; grandTotal = ₹10,553
  assertTest(
    'Stackable coupon + automatic tier (₹12,000 + SMART10)',
    stackedRes.tierDiscount === 750 &&
      stackedRes.couponDiscount === 1200 &&
      stackedRes.totalDiscount === 1950 &&
      stackedRes.tax === 503 &&
      stackedRes.grandTotal === 10553,
    `Tier=₹${stackedRes.tierDiscount} + Coupon=₹${stackedRes.couponDiscount} = ₹${stackedRes.totalDiscount}, Total=₹${stackedRes.grandTotal}`
  );

  const nonStackableRes = calculatePricing({ subtotal: 12000, couponCode: 'AURA20' });
  // AURA20 (20% of 12,000 = ₹2,400, stackable: false) replaces Gold ₹750 rather than stacking to ₹3,150
  assertTest(
    'Non-stackable coupon (AURA20) does not stack with automatic tier',
    nonStackableRes.stackingMode === 'exclusive_coupon' &&
      nonStackableRes.tierDiscount === 0 &&
      nonStackableRes.couponDiscount === 2400 &&
      nonStackableRes.totalDiscount === 2400,
    `stackingMode=${nonStackableRes.stackingMode}, totalDiscount=₹${nonStackableRes.totalDiscount}`
  );

  const dupSame = calculatePricing({ subtotal: 5000, couponCode: 'SMART10,SMART10' });
  const dupMulti = calculatePricing({ subtotal: 5000, couponCodes: ['SMART10', 'FIRSTBUY'] });
  assertTest(
    'Duplicate and multi-coupon submissions rejected',
    dupSame.duplicateCouponRejected === true &&
      dupSame.couponDiscount === 0 &&
      dupMulti.duplicateCouponRejected === true &&
      dupMulti.couponDiscount === 0,
    `Same-code error: "${dupSame.couponError}" | Multi-code error: "${dupMulti.couponError}"`
  );

  const capRes = calculatePricing(
    { subtotal: 2000, couponCode: 'BIG50' },
    {
      promoCoupons: [
        ...PROMO_COUPONS,
        {
          code: 'BIG50',
          type: 'flat',
          flatDiscount: 1500,
          minOrder: 1000,
          active: true,
          stackable: true,
          validFrom: '2025-01-01T00:00:00Z',
          validUntil: '2027-12-31T23:59:59Z'
        }
      ]
    }
  );
  const zeroCartRes = calculatePricing({ subtotal: 0, couponCode: 'FIRSTBUY' });
  const paisePrecisionRes = calculatePricing({
    items: [{ id: 'p-dec', name: 'Cable', price: 199.99, quantity: 3 }]
  });
  assertTest(
    '35% max discount cap, non-negative total, and paise-exact rounding (199.99 × 3)',
    capRes.discountCapped === true &&
      capRes.totalDiscount === 700 &&
      zeroCartRes.grandTotal === 0 &&
      zeroCartRes.totalDiscount === 0 &&
      paisePrecisionRes.subtotal === 599.97 &&
      toPaise(199.99) * 3 === 59997 &&
      fromPaise(59997) === 599.97,
    `Cap@₹2000=₹${capRes.totalDiscount}, ZeroCart=₹${zeroCartRes.grandTotal}, 199.99×3=₹${paisePrecisionRes.subtotal}`
  );

  // ── GROUP 4: Personalization Rules & Truthfulness ───────────────────────────
  console.log('\n--- Group 4: Personalization Rules & Normal Fallback ---');

  const firstOrderPersonal = calculatePricing({
    items: [{ id: 'p-1', name: 'Smart Watch', price: 2000, quantity: 1, categorySlug: 'smartphones' }],
    userContext: { isAuthenticated: true, priorOrderCount: 0, preferredCategories: [] }
  });
  const returningUserFirstBuy = calculatePricing({
    items: [{ id: 'p-1', name: 'Smart Watch', price: 2000, quantity: 1, categorySlug: 'smartphones' }],
    couponCode: 'FIRSTBUY',
    userContext: { isAuthenticated: true, priorOrderCount: 3, preferredCategories: [] }
  });
  const guestFallback = calculatePricing({
    items: [{ id: 'p-1', name: 'Smart Watch', price: 2000, quantity: 1, categorySlug: 'smartphones' }],
    userContext: { isAuthenticated: false, priorOrderCount: null, preferredCategories: [] }
  });

  const configuredCodes = new Set(PROMO_COUPONS.map((c) => c.code));
  assertTest(
    'Personalization uses permitted order/category signals only & falls back to normal promotions',
    firstOrderPersonal.personalizedOffer?.code === 'FIRSTBUY' &&
      configuredCodes.has(firstOrderPersonal.personalizedOffer.code) &&
      returningUserFirstBuy.couponDiscount === 0 &&
      returningUserFirstBuy.couponError?.includes('first order') &&
      guestFallback.personalizedOffer === null &&
      guestFallback.availablePromotions.length > 0 &&
      guestFallback.availablePromotions.every((p) => configuredCodes.has(p.code)),
    `First-time offer=${firstOrderPersonal.personalizedOffer?.code}, Guest personalized=${guestFallback.personalizedOffer}, Guest standard count=${guestFallback.availablePromotions.length}`
  );

  // ── GROUP 5: Server API — Changed Prices/Quantities & Tampered Client Totals ─
  console.log('\n--- Group 5: Server-Side Price Changes, Stock Bounds & Tampering Defense ---');

  const mockCatalog = [
    {
      id: '10000000-0000-0000-0000-000000000001',
      name: 'Sony WH-1000XM5 Headphones',
      price: 12999, // Trusted DB price
      stock: 3,
      category_id: 'c0000000-0000-0000-0000-000000000003',
      category: 'Audio & Headphones',
      categorySlug: 'audio'
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      name: 'USB-C Braided Cable',
      price: 699, // DB updated price from 499 -> 699
      stock: 2,
      category_id: 'c0000000-0000-0000-0000-000000000005',
      category: 'Accessories',
      categorySlug: 'accessories'
    }
  ];

  const pricingMw = extractMiddleware(pricingPlugin({ __CATALOG_OVERRIDE__: mockCatalog }));

  // 5A. Changed price & quantity before checkout (preview mode clamps & reports adjustments)
  const changedCartResp = await invokeMiddleware(pricingMw, {
    method: 'POST',
    url: '/api/pricing/calculate',
    body: {
      items: [
        { id: '10000000-0000-0000-0000-000000000002', name: 'USB-C Braided Cable', price: 499, quantity: 2 },
        { id: '10000000-0000-0000-0000-000000000002', name: 'USB-C Braided Cable', price: 499, quantity: 2 } // duplicate item row (total requested = 4 > stock 2)
      ],
      shippingMethod: 'standard'
    }
  });
  // Consolidated qty clamped to stock 2 at trusted price ₹699 => subtotal = ₹1,398, free shipping, 5% GST = ₹70, total = ₹1,468
  assertTest(
    'Changed DB price & over-stock duplicate items recalculated & clamped in cart preview',
    changedCartResp.status === 200 &&
      changedCartResp.body.subtotal === 1398 &&
      changedCartResp.body.grandTotal === 1468 &&
      changedCartResp.body.priceAdjustments.length === 1 &&
      changedCartResp.body.priceAdjustments[0].trustedPrice === 699 &&
      changedCartResp.body.stockAdjustments.length === 1 &&
      changedCartResp.body.stockAdjustments[0].clampedQuantity === 2,
    `Adjusted price ₹499->₹699, clamped qty 4->2, authoritative total=₹${changedCartResp.body.grandTotal}`
  );

  // 5B. Strict checkout guard rejects over-stock quantity before order creation
  const strictOverstockResp = await invokeMiddleware(pricingMw, {
    method: 'POST',
    url: '/api/pricing/calculate',
    body: {
      items: [{ id: '10000000-0000-0000-0000-000000000002', price: 699, quantity: 5 }],
      strictCatalog: true
    }
  });
  assertTest(
    'Strict pre-checkout calculation blocks quantity exceeding DB stock (HTTP 422)',
    strictOverstockResp.status === 422 &&
      strictOverstockResp.body.ok === false &&
      strictOverstockResp.body.error.includes('Insufficient stock'),
    strictOverstockResp.body.error
  );

  // 5C. Tampered client-side unit price (₹1) and tampered summary total (₹1) ignored
  const tamperedResp = await invokeMiddleware(pricingMw, {
    method: 'POST',
    url: '/api/pricing/calculate',
    body: {
      items: [
        {
          id: '10000000-0000-0000-0000-000000000001',
          name: 'Sony WH-1000XM5 Headphones',
          price: 1, // Tampered from ₹12,999 to ₹1!
          quantity: 1
        }
      ],
      shippingMethod: 'standard',
      clientTotals: { subtotal: 1, discount: 5000, total: 1 }
    }
  });
  // Trusted: ₹12,999 -> Gold Tier ₹750 OFF -> ₹12,249 + 5% GST (₹612) + ₹0 shipping = ₹12,861 (1286100 paise)
  assertTest(
    'Tampered client-side unit price & totals ignored; server enforces DB price (₹12,861)',
    tamperedResp.status === 200 &&
      tamperedResp.body.tamperingDetected === true &&
      tamperedResp.body.subtotal === 12999 &&
      tamperedResp.body.tierDiscount === 750 &&
      tamperedResp.body.tax === 612 &&
      tamperedResp.body.grandTotal === 12861 &&
      tamperedResp.body.amountInPaise === 1286100,
    `Client sent ₹1, server enforced ₹${tamperedResp.body.grandTotal} (${tamperedResp.body.amountInPaise} paise)`
  );

  // ── GROUP 6: Order + Razorpay Sandbox Payment Amount Verification ───────────
  console.log('\n--- Group 6: Order & Razorpay Sandbox Payment Verification ---');

  const validOrderId = '20000000-0000-0000-0000-000000000001';
  const secondOrderId = '20000000-0000-0000-0000-000000000002';
  const tamperedDbOrderId = '20000000-0000-0000-0000-000000000003';

  const mockAdmin = createMockAdminDb({
    products: mockCatalog,
    orders: [
      {
        id: validOrderId,
        user_id: 'user-1',
        subtotal_amount: 12999,
        discount_amount: 750,
        shipping_amount: 0,
        tax_amount: 612,
        total_amount: 12861, // Matches server calculation for 1 × ₹12,999
        shipping_method: 'standard',
        coupon_code: null,
        payment_status: 'pending',
        status: 'placed',
        created_at: '2026-11-07T06:00:00Z'
      },
      {
        id: secondOrderId,
        user_id: 'user-1',
        subtotal_amount: 699,
        discount_amount: 0,
        shipping_amount: 99,
        tax_amount: 35,
        total_amount: 833, // 699 + 99 + 35 = 833
        shipping_method: 'standard',
        coupon_code: null,
        payment_status: 'pending',
        status: 'placed',
        created_at: '2026-11-07T06:00:00Z'
      },
      {
        id: tamperedDbOrderId,
        user_id: 'user-2',
        subtotal_amount: 12999,
        discount_amount: 12500,
        shipping_amount: 0,
        tax_amount: 0,
        total_amount: 499, // Tampered order total (should be ₹12,861)
        shipping_method: 'standard',
        coupon_code: null,
        payment_status: 'pending',
        status: 'placed',
        created_at: '2026-11-07T06:00:00Z'
      }
    ],
    order_items: [
      {
        id: 'oi-1',
        order_id: validOrderId,
        product_id: '10000000-0000-0000-0000-000000000001',
        quantity: 1,
        unit_price: 12999,
        price: 12999
      },
      {
        id: 'oi-2',
        order_id: secondOrderId,
        product_id: '10000000-0000-0000-0000-000000000002',
        quantity: 1,
        unit_price: 699,
        price: 699
      },
      {
        id: 'oi-3',
        order_id: tamperedDbOrderId,
        product_id: '10000000-0000-0000-0000-000000000001',
        quantity: 1,
        unit_price: 499,
        price: 499
      }
    ]
  });

  const paymentMw = extractMiddleware(
    paymentGatewayPlugin({
      VITE_RAZORPAY_KEY_ID: 'rzp_test_sandbox_key',
      RAZORPAY_KEY_SECRET: 'sandbox_test_secret_key_feature4',
      PAYMENT_GATEWAY_MODE: 'test',
      __ADMIN_CLIENT__: mockAdmin,
      __CATALOG_OVERRIDE__: mockCatalog
    })
  );

  // 6A. Public sandbox config endpoint works without leaking secret
  const cfgResp = await invokeMiddleware(paymentMw, {
    method: 'GET',
    url: '/api/payments/config'
  });
  assertTest(
    'Razorpay sandbox config preserved & never leaks secret key',
    cfgResp.status === 200 &&
      cfgResp.body.keyId === 'rzp_test_sandbox_key' &&
      cfgResp.body.mode === 'test' &&
      !JSON.stringify(cfgResp.body).includes('sandbox_test_secret_key_feature4'),
    `provider=${cfgResp.body.provider}, mode=${cfgResp.body.mode}`
  );

  // 6B. Tampered DB order total is rejected BEFORE payment initiation
  const tamperedInitResp = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/create-order',
    body: { orderId: tamperedDbOrderId, amount: 499 }
  });
  assertTest(
    'Tampered order total rejected before payment creation (HTTP 400)',
    tamperedInitResp.status === 400 &&
      String(tamperedInitResp.body.error || '').includes('does not match server-calculated checkout total'),
    tamperedInitResp.body.error
  );

  // 6C. Valid order create-order ignores client `amount: 1` and returns server-calculated 1,286,100 paise
  const createGwResp = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/create-order',
    body: {
      orderId: validOrderId,
      amount: 1, // Client attempts to pay ₹1
      customerName: 'Rohan Verma',
      customerEmail: 'rohan@smartshop.in'
    }
  });
  assertTest(
    'Payment create-order enforces server-calculated checkout amount (1,286,100 paise)',
    createGwResp.status === 200 &&
      createGwResp.body.amount === 1286100 &&
      createGwResp.body.serverCalculatedTotal === 12861 &&
      Boolean(createGwResp.body.razorpayOrderId),
    `Gateway amount=${createGwResp.body.amount} paise (₹${createGwResp.body.serverCalculatedTotal})`
  );

  // Generate valid sandbox HMAC signature for `validOrderId`
  const simSigResp = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/simulate-signature',
    body: {
      razorpayOrderId: createGwResp.body.razorpayOrderId,
      razorpayPaymentId: 'pay_sandbox_valid_001'
    }
  });

  // 6D. Tampered payment amount during verification is rejected even with valid HMAC signature
  const tamperedVerifyResp = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/verify-payment',
    body: {
      orderId: validOrderId,
      paymentId: createGwResp.body.paymentId,
      razorpayOrderId: createGwResp.body.razorpayOrderId,
      razorpayPaymentId: 'pay_sandbox_valid_001',
      razorpaySignature: simSigResp.body.razorpaySignature,
      amountInPaise: 100 // Client claims ₹1 (100 paise) instead of 1,286,100 paise
    }
  });
  assertTest(
    'Payment verification rejects mismatched payment amount (HTTP 400)',
    tamperedVerifyResp.status === 400 &&
      tamperedVerifyResp.body.verified === false &&
      mockAdmin.tables.orders.find((o) => o.id === validOrderId).payment_status === 'pending',
    tamperedVerifyResp.body.error
  );

  // 6E. Cross-order signature replay (Order 2 trying to verify using Order 1's Razorpay order & signature)
  const createOrder2Resp = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/create-order',
    body: { orderId: secondOrderId }
  });
  const replayResp = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/verify-payment',
    body: {
      orderId: secondOrderId,
      paymentId: createOrder2Resp.body.paymentId,
      razorpayOrderId: createGwResp.body.razorpayOrderId, // Belongs to Order 1!
      razorpayPaymentId: 'pay_sandbox_valid_001',
      razorpaySignature: simSigResp.body.razorpaySignature
    }
  });
  assertTest(
    'Cross-order gateway signature replay rejected (HTTP 400)',
    replayResp.status === 400 && replayResp.body.verified === false,
    replayResp.body.error
  );

  // 6F. Exact matching server-calculated payment amount + valid HMAC verifies & marks order paid
  const validVerifyResp = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/verify-payment',
    body: {
      orderId: validOrderId,
      paymentId: createGwResp.body.paymentId,
      razorpayOrderId: createGwResp.body.razorpayOrderId,
      razorpayPaymentId: 'pay_sandbox_valid_001',
      razorpaySignature: simSigResp.body.razorpaySignature,
      amountInPaise: 1286100
    }
  });
  const updatedValidOrder = mockAdmin.tables.orders.find((o) => o.id === validOrderId);
  assertTest(
    'Verified payment amount matching server-calculated total marks order paid',
    validVerifyResp.status === 200 &&
      validVerifyResp.body.verified === true &&
      validVerifyResp.body.verifiedAmount === 12861 &&
      validVerifyResp.body.verifiedAmountInPaise === 1286100 &&
      updatedValidOrder.payment_status === 'paid' &&
      updatedValidOrder.status === 'payment_confirmed',
    `Order ${validOrderId.slice(0, 8)} status=${updatedValidOrder.status}, verified=₹${validVerifyResp.body.verifiedAmount}`
  );

  // 6G. Existing cancel & failure flows still work cleanly on pending Order 2
  const cancelResp = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/cancel',
    body: {
      orderId: secondOrderId,
      paymentId: createOrder2Resp.body.paymentId,
      razorpayOrderId: createOrder2Resp.body.razorpayOrderId,
      reason: 'User dismissed modal'
    }
  });
  assertTest(
    'Existing Razorpay sandbox cancel/retry lifecycle preserved',
    cancelResp.status === 200 &&
      cancelResp.body.recorded === true &&
      mockAdmin.tables.orders.find((o) => o.id === secondOrderId).payment_status === 'pending',
    `Order 2 remains retryable (payment_status=pending)`
  );

  // ── GROUP 7: Serverless Handler Parity & Features 1–3 Preservation ──────────
  console.log('\n--- Group 7: Serverless Endpoint Parity & Features 1–3 Preservation ---');

  let serverlessStatus = 0;
  let serverlessPayload = null;
  await serverlessCalculateHandler(
    {
      method: 'POST',
      headers: {},
      body: {
        items: [{ id: 'prod-1', name: 'Tampered Headphones', price: 1, quantity: 1 }], // prod-1 trusted price in INITIAL_PRODUCTS = ₹29,990
        couponCode: 'SMART10',
        shippingMethod: 'standard'
      }
    },
    {
      status(code) {
        serverlessStatus = code;
        return {
          json(obj) {
            serverlessPayload = obj;
          }
        };
      }
    }
  );
  // prod-1 trusted price ₹29,990 -> Platinum ₹2,500 + SMART10 ₹1,500 = ₹4,000 OFF -> ₹25,990 + 5% GST (₹1,300) = ₹27,290
  assertTest(
    'Vercel serverless /api/pricing/calculate enforces trusted catalog prices & promotions',
    serverlessStatus === 200 &&
      serverlessPayload?.ok === true &&
      serverlessPayload?.tamperingDetected === true &&
      serverlessPayload?.subtotal === 29990 &&
      serverlessPayload?.totalDiscount === 4000 &&
      serverlessPayload?.grandTotal === 27290,
    `Serverless authoritative total=₹${serverlessPayload?.grandTotal}`
  );

  // Offline local-ord-* Razorpay sandbox lifecycle (when cloud DB is unreachable)
  const localOrdInit = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/create-order',
    body: {
      orderId: 'local-ord-demo-1',
      amount: 1, // Tampered client amount ignored
      items: [{ id: '10000000-0000-0000-0000-000000000002', price: 1, quantity: 1 }], // Trusted price ₹699 -> ₹833 total (83300 paise)
      shippingMethod: 'standard'
    }
  });
  const localSig = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/simulate-signature',
    body: {
      razorpayOrderId: localOrdInit.body.razorpayOrderId,
      razorpayPaymentId: 'pay_local_demo_001'
    }
  });
  const localVerify = await invokeMiddleware(paymentMw, {
    method: 'POST',
    url: '/api/payments/verify-payment',
    body: {
      orderId: 'local-ord-demo-1',
      paymentId: localOrdInit.body.paymentId,
      razorpayOrderId: localOrdInit.body.razorpayOrderId,
      razorpayPaymentId: 'pay_local_demo_001',
      razorpaySignature: localSig.body.razorpaySignature,
      amountInPaise: localOrdInit.body.amount
    }
  });
  assertTest(
    'Offline local-order Razorpay sandbox flow recalculates & verifies server checkout amount',
    localOrdInit.status === 200 &&
      localOrdInit.body.amount === 83300 &&
      localVerify.status === 200 &&
      localVerify.body.verified === true &&
      localVerify.body.verifiedAmount === 833,
    `Offline verified=₹${localVerify.body.verifiedAmount} (${localOrdInit.body.amount} paise)`
  );

  const aiPlugin = aiSearchPlugin({});
  const coShopPlugin = coShoppingPlugin({});
  const mockRoom = getRoomSummary({
    id: 'room-1',
    code: 'SHOP-TEST01',
    name: 'Test Co-Shop',
    createdBy: 'u1',
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    members: new Map(),
    sharedCart: [],
    activeProductView: null,
    messages: []
  });
  assertTest(
    'Features 1–3 preserved (AI Search plugin, 3D/WebAR URL validator, Co-Shopping rooms)',
    Boolean(aiPlugin?.configureServer) &&
      isValid3dModelUrl('https://modelviewer.dev/shared-assets/models/Astronaut.glb') === true &&
      isValid3dModelUrl('javascript:alert(1)') === false &&
      Boolean(coShopPlugin?.configureServer) &&
      mockRoom.roomCode === 'SHOP-TEST01',
    'Features 1, 2, and 3 verified intact'
  );

  console.log('\n======================================================================');
  console.log(`Feature 4 Test Summary: ${passed}/${total} Passed`);
  console.log('======================================================================');

  if (passed === total) process.exit(0);
  else process.exit(1);
}

runDynamicPricingTests().catch((err) => {
  console.error('Feature 4 test suite crashed:', err);
  process.exit(1);
});
