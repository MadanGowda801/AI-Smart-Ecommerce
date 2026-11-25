import { createAdminClient } from '@insforge/sdk';
import {
  CALCULATION_ORDER,
  SHIPPING_CONFIG,
  GST_RATE_PERCENT,
  MAX_DISCOUNT_PERCENT_CAP,
  PROMOTION_TIERS,
  PROMO_COUPONS,
  checkPromotionValidity,
  calculateServerCartPricing,
  resolvePermittedUserContext
} from './promotionService.js';

/**
 * Vite Server Plugin: Smart Dynamic Pricing & Personalized Discount API
 *
 * Endpoints:
 *   GET  /api/pricing/promotions → Public active promotion & threshold configuration
 *   POST /api/pricing/calculate  → Validates cart items against trusted DB prices and
 *                                  calculates authoritative discounts, shipping, GST,
 *                                  personalized/standard offers, and threshold banners.
 */

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 256 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}

export default function pricingPlugin(env = {}) {
  const insforgeUrl =
    env.INSFORGE_URL ||
    process.env.INSFORGE_URL ||
    env.VITE_INSFORGE_URL ||
    process.env.VITE_INSFORGE_URL ||
    '';
  const insforgeApiKey = env.INSFORGE_API_KEY || process.env.INSFORGE_API_KEY || '';
  const catalogOverride = env.__CATALOG_OVERRIDE__ || null;

  const admin =
    env.__ADMIN_CLIENT__ ||
    (insforgeUrl && insforgeApiKey
      ? createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeApiKey })
      : null);

  const pricingMiddleware = async (req, res, next) => {
    const rawUrl = (req.url || '').split('?')[0];

    // 1. GET /api/pricing/promotions
    if (rawUrl === '/api/pricing/promotions' && req.method === 'GET') {
      const now = new Date();
      const activeTiers = PROMOTION_TIERS.filter((t) => checkPromotionValidity(t, now).valid).map((t) => ({
        id: t.id,
        type: t.type,
        minSubtotal: t.minSubtotal,
        discount: t.discount,
        validFrom: t.validFrom,
        validUntil: t.validUntil,
        label: t.label
      }));

      const activeCoupons = PROMO_COUPONS.filter((c) => checkPromotionValidity(c, now).valid).map((c) => ({
        code: c.code,
        type: c.type,
        discountPercent: c.discountPercent || null,
        flatDiscount: c.flatDiscount || null,
        maxDiscount: c.maxDiscount || null,
        minOrder: c.minOrder,
        stackable: c.stackable !== false,
        firstOrderOnly: Boolean(c.firstOrderOnly),
        eligibleCategories: c.eligibleCategories || null,
        validFrom: c.validFrom,
        validUntil: c.validUntil,
        description: c.description
      }));

      return sendJson(res, 200, {
        ok: true,
        calculationOrder: CALCULATION_ORDER,
        shippingConfig: SHIPPING_CONFIG,
        gstRatePercent: GST_RATE_PERCENT,
        maxDiscountPercentCap: MAX_DISCOUNT_PERCENT_CAP,
        tiers: activeTiers,
        coupons: activeCoupons
      });
    }

    // 2. POST /api/pricing/calculate
    if (rawUrl === '/api/pricing/calculate' && req.method === 'POST') {
      let body;
      try {
        body = await parseJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON request body.' });
      }

      const {
        items,
        subtotal,
        couponCode = null,
        couponCodes = null,
        shippingMethod = 'standard',
        strictCatalog = false,
        clientTotals = null
      } = body || {};

      try {
        const userContext = await resolvePermittedUserContext({
          admin,
          insforgeUrl,
          authHeader: req.headers?.authorization || ''
        });

        const result = await calculateServerCartPricing({
          admin,
          items,
          subtotal,
          couponCode,
          couponCodes,
          shippingMethod,
          userContext,
          clientTotals,
          strictCatalog: Boolean(strictCatalog),
          allowRawSubtotalFallback: !strictCatalog,
          catalogOverride
        });

        if (!result.ok) {
          return sendJson(res, 422, result);
        }

        return sendJson(res, 200, result);
      } catch (err) {
        console.error('[pricingPlugin] Calculation error:', err);
        return sendJson(res, 500, {
          ok: false,
          error: 'Unable to calculate server pricing right now.'
        });
      }
    }

    return next();
  };

  return {
    name: 'pricing-plugin',
    configureServer(server) {
      server.middlewares.use(pricingMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(pricingMiddleware);
    }
  };
}
