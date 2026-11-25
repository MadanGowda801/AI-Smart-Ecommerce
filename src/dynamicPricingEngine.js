/**
 * Smart Dynamic Pricing and Personalized Discount Engine
 *
 * AUTHORITATIVE CALCULATION ORDER (strictly enforced & documented):
 *   Step 1 — Trusted Merchandise Subtotal:
 *            Consolidate line items and sum (unitPrice × quantity) using integer-paise
 *            precision so floating-point drift cannot occur. Unavailable or invalid-quantity
 *            items are excluded. Compute per-rule eligible item subtotals when a promotion
 *            is scoped to specific categories or product IDs.
 *   Step 2 — Automatic Cart-Tier Promotion:
 *            Evaluate active, date-valid (`validFrom <= now <= validUntil`) tier promotions
 *            against the eligible subtotal. Select at most ONE tier (highest discount) so
 *            duplicate tier discounts can never stack.
 *   Step 3 — Coupon / Promo Code Validation & Discount:
 *            Reject duplicate or multi-coupon submissions (at most one coupon code per order).
 *            Verify coupon existence, `active` flag, validity window (`validFrom`..`validUntil`),
 *            first-order eligibility (when permitted user order history is present), product/
 *            category eligibility, and minimum subtotal (`minOrder`). Compute fixed (`flat`),
 *            percentage (`percent`, capped at `maxDiscount` on eligible subtotal), or
 *            `free_shipping` benefit.
 *   Step 4 — Stacking Rules & Maximum Discount Cap:
 *            - If the validated coupon has `stackable === false`, do NOT stack with the automatic
 *              tier discount; apply whichever single promotion yields the larger rupee discount.
 *            - If `stackable === true`, combine `tierDiscount + couponDiscount`.
 *            - Cap total discounts at `MAX_DISCOUNT_PERCENT_CAP` (35% of merchandise subtotal)
 *              and never exceed `subtotal`. Guarantee `discountedSubtotal >= 0`.
 *   Step 5 — Shipping Fee Calculation:
 *             Evaluated after merchandise subtotal verification:
 *            - `sameday`: ₹199
 *            - `express`: ₹99
 *            - `standard`: ₹0 if cart is empty, if `freeShippingEnabled` and pre-discount
 *              `subtotal >= FREE_SHIPPING_THRESHOLD` (₹999), or if a validated `free_shipping`
 *              coupon is active; otherwise ₹99 (`STANDARD_SHIPPING_FEE`).
 *   Step 6 — Applicable Tax (GST) Calculation:
 *            5% GST computed on `discountedSubtotal` (`subtotal - totalDiscount`), rounded
 *            deterministically without floating-point error (`0` when cart is empty).
 *   Step 7 — Final Payable Total:
 *            `grandTotal = max(0, discountedSubtotal + shippingFee + tax)` and exact integer
 *            `amountInPaise = Math.round(grandTotal * 100)` for payment gateway verification.
 */

export const CALCULATION_ORDER = Object.freeze([
  '1_trusted_merchandise_subtotal',
  '2_automatic_tier_promotion',
  '3_coupon_validation_and_discount',
  '4_stacking_rules_and_discount_cap',
  '5_shipping_fee_calculation',
  '6_applicable_gst_tax_on_discounted_subtotal',
  '7_final_non_negative_total'
]);

export const FREE_SHIPPING_THRESHOLD = 999;
export const STANDARD_SHIPPING_FEE = 99;
export const EXPRESS_SHIPPING_FEE = 99;
export const SAMEDAY_SHIPPING_FEE = 199;
export const GST_RATE_PERCENT = 5;
export const MAX_DISCOUNT_PERCENT_CAP = 35; // Maximum 35% total discount across all rules

export const SHIPPING_CONFIG = Object.freeze({
  freeShippingEnabled: true,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  fees: Object.freeze({
    standard: STANDARD_SHIPPING_FEE,
    express: EXPRESS_SHIPPING_FEE,
    sameday: SAMEDAY_SHIPPING_FEE
  })
});

// Known InsForge seeded category UUID -> canonical category slug mapping
export const CATEGORY_ID_TO_SLUG = Object.freeze({
  'c0000000-0000-0000-0000-000000000001': 'electronics',
  'c0000000-0000-0000-0000-000000000002': 'smartphones',
  'c0000000-0000-0000-0000-000000000003': 'audio',
  'c0000000-0000-0000-0000-000000000004': 'smart-home',
  'c0000000-0000-0000-0000-000000000005': 'accessories',
  'c0000000-0000-0000-0000-000000000006': 'gaming',
  'cat-electronics': 'electronics',
  'cat-mobiles': 'smartphones',
  'cat-audio': 'audio',
  'cat-smarthome': 'smart-home',
  'cat-accessories': 'accessories',
  'cat-gaming': 'gaming'
});

export const PROMOTION_TIERS = [
  {
    id: 'tier_platinum',
    type: 'flat',
    minSubtotal: 25000,
    discount: 2500,
    active: true,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    eligibleCategories: null,
    eligibleProductIds: null,
    label: 'Platinum VIP Privilege (₹2,500 Instant OFF)',
    shortReward: '₹2,500 VIP Discount'
  },
  {
    id: 'tier_gold',
    type: 'flat',
    minSubtotal: 10000,
    discount: 750,
    active: true,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    eligibleCategories: null,
    eligibleProductIds: null,
    label: 'Gold Super Saver (₹750 Instant OFF)',
    shortReward: '₹750 Instant Discount'
  },
  {
    id: 'tier_silver',
    type: 'flat',
    minSubtotal: 5000,
    discount: 250,
    active: true,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    eligibleCategories: null,
    eligibleProductIds: null,
    label: 'Silver Cart Bonus (₹250 Instant OFF)',
    shortReward: '₹250 Instant Discount'
  }
];

export const PROMO_COUPONS = [
  {
    code: 'SMART10',
    type: 'percent',
    discountPercent: 10,
    maxDiscount: 1500,
    minOrder: 999,
    active: true,
    stackable: true,
    firstOrderOnly: false,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    eligibleCategories: null,
    eligibleProductIds: null,
    description: '10% instant discount up to ₹1,500 on orders above ₹999'
  },
  {
    code: 'FIRSTBUY',
    type: 'flat',
    flatDiscount: 300,
    minOrder: 1499,
    active: true,
    stackable: true,
    firstOrderOnly: true,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    eligibleCategories: null,
    eligibleProductIds: null,
    description: 'Flat ₹300 OFF for first-time purchases above ₹1,499'
  },
  {
    code: 'TECHFEST',
    type: 'percent',
    discountPercent: 15,
    maxDiscount: 3000,
    minOrder: 4999,
    active: true,
    stackable: true,
    firstOrderOnly: false,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    eligibleCategories: null,
    eligibleProductIds: null,
    description: '15% instant discount up to ₹3,000 on tech purchases above ₹4,999'
  },
  {
    code: 'AUDIO15',
    type: 'percent',
    discountPercent: 15,
    maxDiscount: 2000,
    minOrder: 1999,
    active: true,
    stackable: true,
    firstOrderOnly: false,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    eligibleCategories: ['audio'],
    eligibleCategoryLabel: 'Audio & Headphones',
    eligibleProductIds: null,
    description: '15% OFF up to ₹2,000 on Audio & Headphones items above ₹1,999'
  },
  {
    code: 'AURA20',
    type: 'percent',
    discountPercent: 20,
    maxDiscount: 5000,
    minOrder: 9999,
    active: true,
    stackable: false, // Exclusive offer: does not stack with automatic cart-tier discounts
    firstOrderOnly: false,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    eligibleCategories: null,
    eligibleProductIds: null,
    description: 'Exclusive 20% OFF up to ₹5,000 on orders above ₹9,999 (non-stackable)'
  },
  {
    code: 'FREESHIP',
    type: 'free_shipping',
    minOrder: 499,
    active: true,
    stackable: true,
    firstOrderOnly: false,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    eligibleCategories: null,
    eligibleProductIds: null,
    description: 'Free Standard Delivery on orders above ₹499'
  },
  {
    code: 'EXPIRED50',
    type: 'percent',
    discountPercent: 50,
    maxDiscount: 5000,
    minOrder: 1000,
    active: false,
    stackable: false,
    firstOrderOnly: false,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: '2026-09-30T23:59:59Z',
    eligibleCategories: null,
    eligibleProductIds: null,
    description: 'Expired promotional coupon'
  }
];

// ─── Precision & Eligibility Helpers ──────────────────────────────────────────

/**
 * Convert an INR amount into exact integer paise, rejecting NaN/Infinity/negatives.
 */
export function toPaise(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round((num + Number.EPSILON) * 100);
}

/**
 * Convert integer paise back to clean 2-decimal INR number without float artifacts.
 */
export function fromPaise(paise) {
  const safe = Math.max(0, Math.round(Number(paise) || 0));
  return Number((safe / 100).toFixed(2));
}

function formatAmountText(amount) {
  const clean = fromPaise(toPaise(amount));
  const hasDecimals = Math.round(clean * 100) % 100 !== 0;
  return clean.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  });
}

/**
 * Normalize an item's category into a canonical lowercase slug.
 */
export function normalizeCategorySlug(item = {}) {
  const catId = String(item.categoryId || item.category_id || '').trim().toLowerCase();
  if (catId && CATEGORY_ID_TO_SLUG[catId]) {
    return CATEGORY_ID_TO_SLUG[catId];
  }

  const rawSlug =
    item.categorySlug ||
    item.categories?.slug ||
    item.category?.slug ||
    '';
  if (rawSlug && typeof rawSlug === 'string') {
    const cleanSlug = rawSlug.trim().toLowerCase();
    if (CATEGORY_ID_TO_SLUG[cleanSlug]) return CATEGORY_ID_TO_SLUG[cleanSlug];
    return cleanSlug;
  }

  const rawName = String(
    item.categories?.name ||
    (typeof item.category === 'string' ? item.category : '') ||
    ''
  )
    .trim()
    .toLowerCase();

  if (!rawName) return '';
  if (rawName.includes('audio') || rawName.includes('headphone')) return 'audio';
  if (rawName.includes('electronic') || rawName.includes('laptop')) return 'electronics';
  if (rawName.includes('smartphone') || rawName.includes('mobile') || rawName.includes('wearable')) return 'smartphones';
  if (rawName.includes('smart home') || rawName.includes('iot')) return 'smart-home';
  if (rawName.includes('accessor') || rawName.includes('gadget')) return 'accessories';
  if (rawName.includes('gaming') || rawName.includes('display')) return 'gaming';
  return rawName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Check whether a promotion/coupon is valid at evaluation timestamp `now`.
 * Returns { valid: boolean, reason: 'inactive' | 'not_started' | 'expired' | null }
 */
export function checkPromotionValidity(promo, now = new Date()) {
  if (!promo) return { valid: false, reason: 'invalid' };

  const evalTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const safeEvalTime = Number.isFinite(evalTime) ? evalTime : Date.now();

  if (promo.validUntil) {
    const untilMs = new Date(promo.validUntil).getTime();
    if (Number.isFinite(untilMs) && safeEvalTime > untilMs) {
      return { valid: false, reason: 'expired' };
    }
  }

  if (promo.active === false) {
    return { valid: false, reason: 'expired' };
  }

  if (promo.validFrom) {
    const fromMs = new Date(promo.validFrom).getTime();
    if (Number.isFinite(fromMs) && safeEvalTime < fromMs) {
      return { valid: false, reason: 'not_started' };
    }
  }

  return { valid: true, reason: null };
}

/**
 * Check if a cart item matches a promotion's eligibleProducts / eligibleCategories filter.
 */
export function isItemEligibleForRule(item, rule) {
  if (!rule) return false;
  const hasCategoryFilter = Array.isArray(rule.eligibleCategories) && rule.eligibleCategories.length > 0;
  const hasProductFilter = Array.isArray(rule.eligibleProductIds) && rule.eligibleProductIds.length > 0;

  if (!hasCategoryFilter && !hasProductFilter) return true;

  const itemId = String(item.productId || item.id || '').trim();
  if (hasProductFilter && itemId && rule.eligibleProductIds.map(String).includes(itemId)) {
    return true;
  }

  if (hasCategoryFilter) {
    const itemSlug = normalizeCategorySlug(item);
    const normalizedAllowed = rule.eligibleCategories.map((c) =>
      normalizeCategorySlug({ categorySlug: c, category: c, categoryId: c })
    );
    if (itemSlug && normalizedAllowed.includes(itemSlug)) {
      return true;
    }
  }

  return false;
}

/**
 * Consolidate cart items by product ID to prevent duplicate-line-item manipulation,
 * excluding unavailable or non-positive-quantity items.
 */
export function normalizeAndConsolidateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const byId = new Map();
  let fallbackIdx = 0;

  for (const raw of items) {
    if (!raw || raw.isUnavailable) continue;
    const rawQty = Number(raw.quantity ?? 1);
    if (!Number.isFinite(rawQty) || rawQty <= 0) continue;
    const quantity = Math.max(1, Math.floor(rawQty));

    const unitPaise = toPaise(raw.trustedUnitPrice ?? raw.unitPrice ?? raw.price ?? 0);
    const key = String(raw.productId || raw.id || `line_${fallbackIdx++}`).trim();

    if (byId.has(key)) {
      const existing = byId.get(key);
      existing.quantity += quantity;
      existing.lineTotalPaise = existing.unitPaise * existing.quantity;
      existing.lineTotal = fromPaise(existing.lineTotalPaise);
    } else {
      const lineTotalPaise = unitPaise * quantity;
      byId.set(key, {
        id: key,
        productId: key,
        name: String(raw.name || raw.title || 'Product'),
        unitPrice: fromPaise(unitPaise),
        unitPaise,
        quantity,
        lineTotalPaise,
        lineTotal: fromPaise(lineTotalPaise),
        categorySlug: normalizeCategorySlug(raw),
        category: raw.category || raw.categories?.name || '',
        categoryId: raw.categoryId || raw.category_id || null
      });
    }
  }

  return Array.from(byId.values());
}

/**
 * Compute discount amount in INR for a given rule and eligible subtotal.
 */
function computeRuleDiscountRupees(rule, eligibleSubtotal) {
  if (!rule || eligibleSubtotal <= 0) return 0;
  if (rule.type === 'flat' || (rule.discount !== undefined && !rule.type)) {
    const flatVal = Number(rule.flatDiscount ?? rule.discount ?? 0);
    return Math.min(eligibleSubtotal, Math.max(0, flatVal));
  }
  if (rule.type === 'percent') {
    const pct = Math.max(0, Number(rule.discountPercent || 0));
    const rawPctDiscount = Math.round((eligibleSubtotal * pct) / 100);
    const maxCap = Number.isFinite(Number(rule.maxDiscount)) && Number(rule.maxDiscount) > 0
      ? Number(rule.maxDiscount)
      : rawPctDiscount;
    return Math.min(eligibleSubtotal, Math.min(maxCap, rawPctDiscount));
  }
  return 0;
}

/**
 * Evaluate permitted, rule-configured personalized offer for the shopper.
 *
 * PERSONALIZATION SAFETY GUARANTEES:
 * - Uses ONLY permitted shopping signals (`isAuthenticated`, `priorOrderCount`,
 *   `preferredCategories`, and current cart items/categories).
 * - NEVER invents a promotion or promises an unconfigured discount: every offer
 *   must exist in `couponsConfig`, be active, and pass validity date checks.
 * - Returns `null` when no personalized offer is eligible so normal promotions display.
 */
export function evaluatePersonalizedOffer({
  consolidatedItems = [],
  subtotal = 0,
  appliedCouponCode = null,
  currentTotalDiscount = 0,
  tierDiscount = 0,
  maxAllowableDiscount = 0,
  userContext = null,
  couponsConfig = PROMO_COUPONS,
  now = new Date()
}) {
  if (!subtotal || subtotal <= 0) return null;

  const cleanApplied = appliedCouponCode ? String(appliedCouponCode).trim().toUpperCase() : null;
  const isAuthenticated = Boolean(userContext?.isAuthenticated);
  const priorOrderCount =
    typeof userContext?.priorOrderCount === 'number' ? userContext.priorOrderCount : null;
  const preferredCategories = Array.isArray(userContext?.preferredCategories)
    ? userContext.preferredCategories.map((c) => normalizeCategorySlug({ categorySlug: c, category: c })).filter(Boolean)
    : [];

  const findValidCoupon = (code) => {
    const match = couponsConfig.find((c) => c.code === code);
    if (!match) return null;
    const validity = checkPromotionValidity(match, now);
    return validity.valid ? match : null;
  };

  // 1. First-time authenticated shopper offer (configured coupon: FIRSTBUY)
  if (isAuthenticated && priorOrderCount === 0 && cleanApplied !== 'FIRSTBUY') {
    const firstBuy = findValidCoupon('FIRSTBUY');
    if (firstBuy && subtotal >= firstBuy.minOrder) {
      const rawDiscount = computeRuleDiscountRupees(firstBuy, subtotal);
      const projectedTotal = Math.min(subtotal, Math.min(maxAllowableDiscount, (firstBuy.stackable !== false ? tierDiscount : 0) + rawDiscount));
      if (projectedTotal > currentTotalDiscount) {
        return {
          code: firstBuy.code,
          title: 'First-Order Welcome Offer',
          description: firstBuy.description,
          potentialSavings: projectedTotal - currentTotalDiscount,
          couponDiscount: rawDiscount,
          minOrder: firstBuy.minOrder,
          isPersonalized: true,
          reason: 'Eligible on your first order',
          message: `Welcome offer unlocked: Apply code ${firstBuy.code} for ₹${formatAmountText(rawDiscount)} OFF your first order.`
        };
      }
    }
  }

  // 2. Category-relevant offer based on cart items / permitted category preference (AUDIO15)
  if (consolidatedItems.length > 0 && cleanApplied !== 'AUDIO15') {
    const audioPromo = findValidCoupon('AUDIO15');
    if (audioPromo) {
      const audioSubtotalPaise = consolidatedItems
        .filter((it) => isItemEligibleForRule(it, audioPromo))
        .reduce((acc, it) => acc + it.lineTotalPaise, 0);
      const audioSubtotal = fromPaise(audioSubtotalPaise);

      const hasAudioAffinity =
        audioSubtotal > 0 && (isAuthenticated || preferredCategories.includes('audio') || consolidatedItems.some((it) => it.categorySlug === 'audio'));

      if (hasAudioAffinity && audioSubtotal >= audioPromo.minOrder) {
        const rawDiscount = computeRuleDiscountRupees(audioPromo, audioSubtotal);
        const projectedTotal = Math.min(subtotal, Math.min(maxAllowableDiscount, (audioPromo.stackable !== false ? tierDiscount : 0) + rawDiscount));
        if (projectedTotal > currentTotalDiscount) {
          return {
            code: audioPromo.code,
            title: 'Audio Category Offer',
            description: audioPromo.description,
            potentialSavings: projectedTotal - currentTotalDiscount,
            couponDiscount: rawDiscount,
            minOrder: audioPromo.minOrder,
            isPersonalized: true,
            reason: 'Matched to Audio & Headphones in your cart',
            message: `Audio gear offer: Apply code ${audioPromo.code} for 15% OFF eligible Audio items (save ₹${formatAmountText(projectedTotal - currentTotalDiscount)}).`
          };
        }
      }
    }
  }

  // 3. Returning authenticated member high-value cart offer (AURA20)
  if (isAuthenticated && priorOrderCount !== null && priorOrderCount > 0 && cleanApplied !== 'AURA20') {
    const auraPromo = findValidCoupon('AURA20');
    if (auraPromo && subtotal >= auraPromo.minOrder) {
      const rawDiscount = computeRuleDiscountRupees(auraPromo, subtotal);
      const projectedTotal = Math.min(subtotal, Math.min(maxAllowableDiscount, rawDiscount)); // non-stackable
      if (projectedTotal > currentTotalDiscount) {
        return {
          code: auraPromo.code,
          title: 'Member Exclusive Offer',
          description: auraPromo.description,
          potentialSavings: projectedTotal - currentTotalDiscount,
          couponDiscount: rawDiscount,
          minOrder: auraPromo.minOrder,
          isPersonalized: true,
          reason: 'Available for returning members on orders ₹9,999+',
          message: `Member offer: Apply code ${auraPromo.code} for 20% OFF (save ₹${formatAmountText(projectedTotal - currentTotalDiscount)}).`
        };
      }
    }
  }

  return null;
}

/**
 * List normal (non-personalized) active, valid promotions that apply or are available.
 */
export function getStandardPromotions({
  subtotal = 0,
  consolidatedItems = [],
  appliedCouponCode = null,
  couponsConfig = PROMO_COUPONS,
  now = new Date()
}) {
  const cleanApplied = appliedCouponCode ? String(appliedCouponCode).trim().toUpperCase() : null;
  const standardCodes = ['SMART10', 'TECHFEST', 'FREESHIP'];
  const list = [];

  for (const code of standardCodes) {
    const promo = couponsConfig.find((c) => c.code === code);
    if (!promo) continue;
    const validity = checkPromotionValidity(promo, now);
    if (!validity.valid) continue;

    let eligibleSubtotal = subtotal;
    if (consolidatedItems.length > 0 && (promo.eligibleCategories || promo.eligibleProductIds)) {
      const paise = consolidatedItems
        .filter((it) => isItemEligibleForRule(it, promo))
        .reduce((acc, it) => acc + it.lineTotalPaise, 0);
      eligibleSubtotal = fromPaise(paise);
    }

    const isEligibleNow = subtotal > 0 && eligibleSubtotal >= promo.minOrder;
    list.push({
      code: promo.code,
      type: promo.type,
      description: promo.description,
      minOrder: promo.minOrder,
      validUntil: promo.validUntil || null,
      isApplied: cleanApplied === promo.code,
      isEligibleNow,
      neededSubtotal: isEligibleNow ? 0 : fromPaise(Math.max(0, toPaise(promo.minOrder) - toPaise(eligibleSubtotal)))
    });
  }

  return list;
}

/**
 * Calculates authoritative pricing, tiered discounts, coupon promotions, shipping,
 * GST tax, personalized/standard offers, and truthful threshold banners.
 *
 * @param {Object} options
 * @param {Array}  [options.items] - Optional cart items (if provided, subtotal & eligibility derive from items)
 * @param {number} [options.subtotal=0] - Cart subtotal in INR (used when `items` is not provided)
 * @param {string} [options.couponCode] - Optional single promo code
 * @param {Array}  [options.couponCodes] - Optional array to detect/reject multi-coupon stacking
 * @param {string} [options.shippingMethod='standard'] - 'standard' | 'express' | 'sameday'
 * @param {Object} [options.userContext] - Optional permitted shopping context ({ isAuthenticated, priorOrderCount, preferredCategories })
 * @param {Date|string|number} [options.now] - Evaluation timestamp (defaults to current time)
 * @param {Object} [configOverride] - Optional promotion configuration override for testing
 * @returns {Object} Comprehensive authoritative pricing breakdown
 */
export function calculatePricing(
  {
    items = null,
    subtotal = 0,
    couponCode = null,
    couponCodes = null,
    shippingMethod = 'standard',
    userContext = null,
    now = new Date()
  } = {},
  configOverride = {}
) {
  const tiersConfig = Array.isArray(configOverride.promotionTiers)
    ? configOverride.promotionTiers
    : PROMOTION_TIERS;
  const couponsConfig = Array.isArray(configOverride.promoCoupons)
    ? configOverride.promoCoupons
    : PROMO_COUPONS;
  const freeShippingEnabled =
    configOverride.freeShippingEnabled !== undefined
      ? Boolean(configOverride.freeShippingEnabled)
      : SHIPPING_CONFIG.freeShippingEnabled;
  const freeShippingThreshold =
    configOverride.freeShippingThreshold !== undefined
      ? configOverride.freeShippingThreshold
      : SHIPPING_CONFIG.freeShippingThreshold;
  const maxDiscountCapPercent =
    configOverride.maxDiscountPercentCap !== undefined
      ? Math.max(0, Math.min(100, Number(configOverride.maxDiscountPercentCap)))
      : MAX_DISCOUNT_PERCENT_CAP;
  const gstRatePercent =
    configOverride.gstRatePercent !== undefined
      ? Math.max(0, Number(configOverride.gstRatePercent))
      : GST_RATE_PERCENT;

  const cleanShippingMethod = ['standard', 'express', 'sameday'].includes(
    String(shippingMethod || 'standard').toLowerCase()
  )
    ? String(shippingMethod || 'standard').toLowerCase()
    : 'standard';

  // ── STEP 1: Trusted Merchandise Subtotal (Paise-Precision) ────────────────
  const hasItemsArray = Array.isArray(items);
  const consolidatedItems = hasItemsArray ? normalizeAndConsolidateItems(items) : [];
  const subtotalPaise = hasItemsArray
    ? consolidatedItems.reduce((acc, it) => acc + it.lineTotalPaise, 0)
    : toPaise(subtotal);
  const cleanSubtotal = fromPaise(subtotalPaise);

  const getRuleEligibleSubtotal = (rule) => {
    if (!hasItemsArray) {
      // When called with bare subtotal only, rules scoped strictly to specific categories/products
      // cannot verify item eligibility unless items are present:
      const hasStrictScope =
        (Array.isArray(rule.eligibleCategories) && rule.eligibleCategories.length > 0) ||
        (Array.isArray(rule.eligibleProductIds) && rule.eligibleProductIds.length > 0);
      return hasStrictScope ? 0 : cleanSubtotal;
    }
    const eligiblePaise = consolidatedItems
      .filter((it) => isItemEligibleForRule(it, rule))
      .reduce((acc, it) => acc + it.lineTotalPaise, 0);
    return fromPaise(eligiblePaise);
  };

  // ── STEP 2: Automatic Cart-Tier Promotion (Single Best Active Tier) ───────
  const validTiers = tiersConfig
    .filter((t) => checkPromotionValidity(t, now).valid)
    .sort((a, b) => Number(b.minSubtotal || 0) - Number(a.minSubtotal || 0));

  let matchedTier = null;
  let rawTierDiscount = 0;
  for (const tier of validTiers) {
    const eligSub = getRuleEligibleSubtotal(tier);
    if (eligSub >= Number(tier.minSubtotal || 0) && eligSub > 0) {
      const candidateDiscount = computeRuleDiscountRupees(tier, eligSub);
      if (candidateDiscount > rawTierDiscount) {
        matchedTier = tier;
        rawTierDiscount = candidateDiscount;
      }
    }
  }

  // ── STEP 3: Coupon / Promo Code Validation & Calculation ──────────────────
  let rawCouponDiscount = 0;
  let couponError = null;
  let validatedCoupon = null;
  let duplicateCouponRejected = false;
  let freeShippingFromCoupon = false;

  // Detect duplicate / multiple coupon codes passed via array or comma/plus delimiter
  let candidateCodes = [];
  if (Array.isArray(couponCodes) && couponCodes.length > 0) {
    candidateCodes = couponCodes.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean);
  } else if (Array.isArray(couponCode)) {
    candidateCodes = couponCode.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean);
  } else if (typeof couponCode === 'string' && couponCode.trim() !== '') {
    const rawStr = couponCode.trim();
    if (/[,;+|]|\s+/.test(rawStr)) {
      candidateCodes = rawStr.split(/[,;+|\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
    } else {
      candidateCodes = [rawStr.toUpperCase()];
    }
  }

  if (candidateCodes.length > 1) {
    duplicateCouponRejected = true;
    const uniqueCodes = Array.from(new Set(candidateCodes));
    if (uniqueCodes.length === 1) {
      couponError = `Duplicate coupon "${uniqueCodes[0]}" cannot be applied multiple times.`;
    } else {
      couponError = 'Only one coupon code can be applied per order. Multiple coupons cannot be stacked.';
    }
  } else if (candidateCodes.length === 1) {
    const cleanCode = candidateCodes[0];
    const match = couponsConfig.find((c) => c.code === cleanCode);
    const activeCodeHints = couponsConfig
      .filter((c) => checkPromotionValidity(c, now).valid)
      .slice(0, 4)
      .map((c) => c.code)
      .join(', ');

    if (!match) {
      couponError = `Coupon "${cleanCode}" is invalid.${activeCodeHints ? ` Valid codes: ${activeCodeHints}` : ''}`;
    } else {
      const validity = checkPromotionValidity(match, now);
      if (!validity.valid) {
        if (validity.reason === 'not_started') {
          couponError = `Coupon "${cleanCode}" is not active yet.`;
        } else {
          couponError = `Coupon "${cleanCode}" has expired and is no longer valid.`;
        }
      } else if (
        match.firstOrderOnly &&
        userContext &&
        typeof userContext.priorOrderCount === 'number' &&
        userContext.priorOrderCount > 0
      ) {
        couponError = `Coupon "${cleanCode}" is valid only on your first order.`;
      } else if (cleanSubtotal <= 0) {
        couponError = `Add eligible items to your cart before applying "${cleanCode}".`;
      } else {
        const hasScope =
          (Array.isArray(match.eligibleCategories) && match.eligibleCategories.length > 0) ||
          (Array.isArray(match.eligibleProductIds) && match.eligibleProductIds.length > 0);
        const eligibleSubtotal = getRuleEligibleSubtotal(match);

        if (hasScope && eligibleSubtotal <= 0) {
          const scopeLabel = match.eligibleCategoryLabel || (match.eligibleCategories || []).join(', ') || 'eligible products';
          couponError = `Coupon "${cleanCode}" requires ${scopeLabel} items in your cart.`;
        } else if (eligibleSubtotal < Number(match.minOrder || 0)) {
          const scopePrefix = hasScope && match.eligibleCategoryLabel ? `eligible ${match.eligibleCategoryLabel} ` : '';
          couponError = `Coupon "${cleanCode}" requires a minimum ${scopePrefix}order of ₹${formatAmountText(match.minOrder)}.`;
        } else {
          validatedCoupon = match;
          if (match.type === 'free_shipping') {
            freeShippingFromCoupon = true;
            rawCouponDiscount = 0;
          } else {
            rawCouponDiscount = computeRuleDiscountRupees(match, eligibleSubtotal);
          }
        }
      }
    }
  }

  // ── STEP 4: Stacking Rules & Anti-Abuse Discount Cap (Max 35%) ────────────
  let effectiveTierDiscount = rawTierDiscount;
  let combinedBeforeCap = rawTierDiscount + rawCouponDiscount;
  let stackingMode = 'none';

  if (cleanSubtotal <= 0) {
    effectiveTierDiscount = 0;
    rawCouponDiscount = 0;
    combinedBeforeCap = 0;
  } else if (validatedCoupon && validatedCoupon.stackable === false) {
    // Non-stackable coupon: apply whichever single promotion yields greater savings
    if (rawCouponDiscount >= rawTierDiscount) {
      effectiveTierDiscount = 0;
      combinedBeforeCap = rawCouponDiscount;
      stackingMode = 'exclusive_coupon';
    } else {
      // Automatic tier alone is strictly better than the non-stackable coupon
      effectiveTierDiscount = rawTierDiscount;
      combinedBeforeCap = rawTierDiscount;
      stackingMode = 'tier_preferred_over_non_stackable_coupon';
    }
  } else if (rawTierDiscount > 0 && rawCouponDiscount > 0) {
    stackingMode = 'tier_plus_coupon';
  } else if (rawTierDiscount > 0) {
    stackingMode = 'tier_only';
  } else if (rawCouponDiscount > 0 || freeShippingFromCoupon) {
    stackingMode = 'coupon_only';
  }

  const maxAllowableDiscount = cleanSubtotal > 0
    ? Math.round((cleanSubtotal * maxDiscountCapPercent) / 100)
    : 0;

  const totalDiscountPaise = Math.min(
    subtotalPaise,
    Math.min(toPaise(combinedBeforeCap), toPaise(maxAllowableDiscount))
  );
  const totalDiscount = fromPaise(totalDiscountPaise);

  // Ensure line-level breakdown always sums cleanly to `totalDiscount`
  const tierDiscountPaise = Math.min(totalDiscountPaise, toPaise(effectiveTierDiscount));
  const tierDiscount = fromPaise(tierDiscountPaise);
  const couponDiscountPaise = Math.max(0, totalDiscountPaise - tierDiscountPaise);
  const couponDiscount = fromPaise(couponDiscountPaise);

  const discountedSubtotalPaise = Math.max(0, subtotalPaise - totalDiscountPaise);
  const discountedSubtotal = fromPaise(discountedSubtotalPaise);

  // ── STEP 5: Shipping Fee Calculation ──────────────────────────────────────
  const hasConfiguredFreeShipping =
    freeShippingEnabled &&
    Number.isFinite(Number(freeShippingThreshold)) &&
    Number(freeShippingThreshold) > 0;

  const qualifiesForFreeShipping =
    cleanSubtotal > 0 &&
    ((hasConfiguredFreeShipping && cleanSubtotal >= Number(freeShippingThreshold)) || freeShippingFromCoupon);

  let shippingFee = 0;
  if (cleanSubtotal <= 0) {
    shippingFee = 0;
  } else if (cleanShippingMethod === 'sameday') {
    shippingFee = SAMEDAY_SHIPPING_FEE;
  } else if (cleanShippingMethod === 'express') {
    shippingFee = EXPRESS_SHIPPING_FEE;
  } else {
    shippingFee = qualifiesForFreeShipping ? 0 : STANDARD_SHIPPING_FEE;
  }
  const shippingFeePaise = toPaise(shippingFee);

  // ── STEP 6: Applicable GST Tax Calculation (on Discounted Subtotal) ───────
  const taxRupees = cleanSubtotal > 0 ? Math.round((discountedSubtotal * gstRatePercent) / 100) : 0;
  const taxPaise = toPaise(taxRupees);
  const tax = fromPaise(taxPaise);

  // ── STEP 7: Authoritative Non-Negative Grand Total ────────────────────────
  const grandTotalPaise = Math.max(0, discountedSubtotalPaise + shippingFeePaise + taxPaise);
  const grandTotal = fromPaise(grandTotalPaise);

  // ── Truthful Next-Tier / Free-Shipping Incentive Banner ───────────────────
  let nextTierIncentive = null;
  if (cleanSubtotal > 0) {
    if (
      hasConfiguredFreeShipping &&
      cleanShippingMethod === 'standard' &&
      !qualifiesForFreeShipping &&
      cleanSubtotal < Number(freeShippingThreshold)
    ) {
      const neededPaise = Math.max(0, toPaise(freeShippingThreshold) - subtotalPaise);
      const needed = fromPaise(neededPaise);
      nextTierIncentive = {
        type: 'free_shipping',
        needed,
        targetSubtotal: Number(freeShippingThreshold),
        progressPercent: Math.min(99, Math.max(1, Math.round((cleanSubtotal / Number(freeShippingThreshold)) * 100))),
        reward: 'Free Standard Shipping',
        message: `Add ₹${formatAmountText(needed)} more to qualify for free shipping`
      };
    } else {
      // Find lowest active valid tier above current subtotal
      const ascendingTiers = [...validTiers].sort(
        (a, b) => Number(a.minSubtotal || 0) - Number(b.minSubtotal || 0)
      );
      const nextTier = ascendingTiers.find((t) => cleanSubtotal < Number(t.minSubtotal || 0));
      if (nextTier) {
        const target = Number(nextTier.minSubtotal);
        const needed = fromPaise(Math.max(0, toPaise(target) - subtotalPaise));
        nextTierIncentive = {
          type: nextTier.id,
          needed,
          targetSubtotal: target,
          progressPercent: Math.min(99, Math.max(1, Math.round((cleanSubtotal / target) * 100))),
          reward: nextTier.shortReward || `₹${formatAmountText(nextTier.discount)} Instant Discount`,
          message: `Add ₹${formatAmountText(needed)} more to qualify for ${nextTier.label}!`
        };
      }
    }
  }

  // ── Permitted Personalized Offer & Normal Promotions ──────────────────────
  const appliedCodeForOffers = validatedCoupon ? validatedCoupon.code : null;
  const personalizedOffer = evaluatePersonalizedOffer({
    consolidatedItems,
    subtotal: cleanSubtotal,
    appliedCouponCode: appliedCodeForOffers,
    currentTotalDiscount: totalDiscount,
    tierDiscount: rawTierDiscount,
    maxAllowableDiscount,
    userContext,
    couponsConfig,
    now
  });

  const availablePromotions = getStandardPromotions({
    subtotal: cleanSubtotal,
    consolidatedItems,
    appliedCouponCode: appliedCodeForOffers,
    couponsConfig,
    now
  });

  return {
    ok: true,
    calculationOrder: CALCULATION_ORDER,
    subtotal: cleanSubtotal,
    discountedSubtotal,
    tierDiscount,
    rawTierDiscount,
    activeTier:
      matchedTier && tierDiscount > 0
        ? {
            id: matchedTier.id,
            label: matchedTier.label,
            discount: tierDiscount,
            minSubtotal: matchedTier.minSubtotal
          }
        : null,
    couponDiscount,
    rawCouponDiscount,
    validatedCoupon: validatedCoupon
      ? {
          code: validatedCoupon.code,
          type: validatedCoupon.type,
          stackable: validatedCoupon.stackable !== false,
          description: validatedCoupon.description
        }
      : null,
    couponError,
    duplicateCouponRejected,
    stackingMode,
    totalDiscount,
    discountCapped: combinedBeforeCap > maxAllowableDiscount && cleanSubtotal > 0,
    maxAllowableDiscount,
    maxDiscountCapPercent,
    shippingFee,
    shippingMethod: cleanShippingMethod,
    freeShippingEnabled: hasConfiguredFreeShipping,
    freeShippingThreshold: hasConfiguredFreeShipping ? Number(freeShippingThreshold) : null,
    qualifiesForFreeShipping,
    freeShippingFromCoupon,
    tax,
    taxRatePercent: gstRatePercent,
    grandTotal,
    amountInPaise: grandTotalPaise,
    nextTierIncentive,
    personalizedOffer,
    availablePromotions
  };
}

export default calculatePricing;
