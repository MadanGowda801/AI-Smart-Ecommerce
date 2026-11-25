/**
 * Comprehensive Automated Verification Suite: AI Smart Product Comparison System
 *
 * Tests all core functional, accuracy, category-spec, weighted scoring, budget enforcement,
 * real-time DB revalidation, AI failure fallback, HTTP middleware, and security guarantees.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import {
  processCompareProductsRequest,
  processCompareRecommendRequest,
  resetCompareRateLimit
} from '../server/compareService.js';
import comparePlugin from '../server/comparePlugin.js';
import {
  SUGGESTED_PREFERENCE_OPTIONS,
  NOT_AVAILABLE_LABEL,
  CATEGORY_MANUAL_FIELDS
} from '../src/compareConstants.js';

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  resetCompareRateLimit();
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}\n   → ${err.message}`);
    failed++;
  }
}

function invokeMiddleware(middleware, { method = 'POST', url = '/api/compare/products', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = new Readable({
      read() {
        if (body !== null) {
          this.push(typeof body === 'string' ? body : JSON.stringify(body));
        }
        this.push(null);
      }
    });
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json' };
    req.socket = { remoteAddress: '127.0.0.1' };

    let statusCode = 200;
    let rawData = '';
    const headers = {};
    const res = {
      set statusCode(code) { statusCode = code; },
      get statusCode() { return statusCode; },
      setHeader(k, v) { headers[k.toLowerCase()] = v; },
      end(chunk) {
        if (chunk) rawData += chunk.toString();
        let json = null;
        try { json = JSON.parse(rawData); } catch {}
        resolve({ status: statusCode, headers, raw: rawData, json });
      }
    };

    middleware(req, res, () => resolve({ status: 404, skipped: true })).catch(reject);
  });
}

console.log('='.repeat(74));
console.log('  AI Smart Product Comparison System — Automated Verification Suite');
console.log('='.repeat(74));

// 1. One product cannot generate a comparison
await runTest('1. One product is rejected (min 2 required)', async () => {
  const res = await processCompareProductsRequest({ productIds: ['EL-001'], admin: null });
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, 'MIN_PRODUCTS_REQUIRED');
});

// 2. Two products can be compared
await runTest('2. Two products generate a valid side-by-side comparison matrix', async () => {
  const res = await processCompareProductsRequest({ productIds: ['EL-001', 'EL-004'], admin: null });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.matrix.products.length, 2);
  assert.ok(res.body.matrix.rows.length >= 15);
  assert.deepEqual(res.body.matrix.lowestPriceIds, ['EL-001']);
});

// 3. Five products can be compared
await runTest('3. Five products can be compared simultaneously', async () => {
  const ids = ['SW-001', 'SW-002', 'SW-003', 'SW-004', 'SW-005'];
  const res = await processCompareProductsRequest({ productIds: ids, admin: null });
  assert.equal(res.status, 200);
  assert.equal(res.body.matrix.products.length, 5);
  assert.deepEqual(res.body.matrix.lowestPriceIds, ['SW-003']);
});

// 4. Sixth product is blocked
await runTest('4. Sixth product is blocked (max 5 enforced)', async () => {
  const ids = ['SW-001', 'SW-002', 'SW-003', 'SW-004', 'SW-005', 'SW-006'];
  const res = await processCompareProductsRequest({ productIds: ids, admin: null });
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, 'MAX_PRODUCTS_EXCEEDED');
});

// 5. Duplicate products prevented
await runTest('5. Duplicate products are prevented / deduplicated safely', async () => {
  const dupOnly = await processCompareProductsRequest({ productIds: ['EL-001', 'EL-001'], admin: null });
  assert.equal(dupOnly.status, 400);
  assert.equal(dupOnly.body.code, 'MIN_PRODUCTS_REQUIRED');

  const dupMixed = await processCompareProductsRequest({ productIds: ['EL-001', 'EL-002', 'el-001'], admin: null });
  assert.equal(dupMixed.status, 200);
  assert.equal(dupMixed.body.hadDuplicatesRemoved, true);
  assert.equal(dupMixed.body.matrix.products.length, 2);
});

// 6. Invalid product handling
await runTest('6. Invalid / non-existent product ID returns 404 cleanly', async () => {
  const res = await processCompareProductsRequest({ productIds: ['EL-001', 'FAKE-999'], admin: null });
  assert.equal(res.status, 404);
  assert.equal(res.body.ok, false);
  assert.deepEqual(res.body.invalidIds, ['FAKE-999']);
});

// 7. Category-specific specs & "Not Available" for missing fields
await runTest('7. Audio comparison shows audio-only specs (no laptop RAM/CPU/Camera) & Not Available for missing fields', async () => {
  const res = await processCompareProductsRequest({ productIds: ['AH-002', 'AH-003'], admin: null });
  assert.equal(res.status, 200);
  const rowKeys = res.body.matrix.rows.map((r) => r.key);
  assert.ok(rowKeys.includes('audioDrivers'), 'Should include Audio Drivers row');
  assert.ok(rowKeys.includes('noiseCancellation'), 'Should include Noise Cancellation row');
  assert.ok(!rowKeys.includes('processor'), 'Must NOT show laptop Processor for headphones');
  assert.ok(!rowKeys.includes('ram'), 'Must NOT show laptop RAM for headphones');
  assert.ok(!rowKeys.includes('camera'), 'Must NOT show smartphone Camera for headphones');

  // Weight is not in AH-002 / AH-003 catalog text -> must be strictly "Not Available"
  const weightRow = res.body.matrix.rows.find((r) => r.key === 'weight');
  assert.ok(weightRow);
  assert.deepEqual(weightRow.values, [NOT_AVAILABLE_LABEL, NOT_AVAILABLE_LABEL]);
});

await runTest('8. Smart Home comparison shows smart-home-only specs (no smartphone RAM/Processor)', async () => {
  const res = await processCompareProductsRequest({ productIds: ['SH-004', 'SH-005'], admin: null });
  assert.equal(res.status, 200);
  const rowKeys = res.body.matrix.rows.map((r) => r.key);
  assert.ok(rowKeys.includes('voiceAssistant'));
  assert.ok(rowKeys.includes('smartFeatures'));
  assert.ok(rowKeys.includes('waterResistance'));
  assert.ok(!rowKeys.includes('ram'), 'Must NOT show smartphone RAM for smart-home products');
  assert.ok(!rowKeys.includes('processor'), 'Must NOT show smartphone Processor for smart-home products');
});

// 9. All 8 suggested preference options work & weights sum to 100%
await runTest('9. All 8 suggested preference options exist, process cleanly, and keep weights summing to 100%', async () => {
  assert.equal(SUGGESTED_PREFERENCE_OPTIONS.length, 8);
  const allOptionsPayload = SUGGESTED_PREFERENCE_OPTIONS.map((opt) => ({
    id: opt.id,
    subOptions: [opt.subOptions[0].id]
  }));

  const res = await processCompareRecommendRequest({
    productIds: ['SW-001', 'SW-002', 'SW-003'],
    preferences: { selectedOptions: allOptionsPayload, manual: {} },
    admin: null
  });
  assert.equal(res.status, 200);
  const weightSum = Object.values(res.body.scoring.weights).reduce((a, b) => a + b, 0);
  assert.equal(weightSum, 100, `Expected weight sum 100, got ${weightSum}`);
  assert.ok(res.body.recommendation.bestProduct.overallScore >= 0 && res.body.recommendation.bestProduct.overallScore <= 100);
});

// 10. Strict budget respect (does NOT blindly pick most expensive flagship)
await runTest('10. AI recommendation strictly respects user budget instead of picking most expensive item', async () => {
  // SW-003 (₹18,999), SW-002 (₹39,999), SW-005 (₹89,999) with ₹20,000 manual + Option 1 budget
  const res = await processCompareRecommendRequest({
    productIds: ['SW-002', 'SW-003', 'SW-005'],
    preferences: {
      selectedOptions: [{ id: 'budget_friendly', subOptions: ['under_20000'] }],
      manual: { maxBudget: '20000', primaryUsage: 'Daily usage and photography' }
    },
    admin: null
  });
  assert.equal(res.status, 200);
  assert.equal(
    res.body.recommendation.bestProduct.productId,
    'SW-003',
    `Expected budget-fitting SW-003 (₹18,999) to win over ₹39,999 and ₹89,999 phones, got ${res.body.recommendation.bestProduct.productId}`
  );
  assert.ok(res.body.recommendation.runnerUp, 'Should include runner-up');
  assert.ok(res.body.recommendation.finalVerdict.includes('20,000'), 'Final verdict should reference user budget');
});

// 11. Manual specification inputs + combined preferences
await runTest('11. Manual specification inputs (RAM, brand, usage) combine with suggested preferences accurately', async () => {
  // EL-001 (AeroBook 14, AeroTech, 16GB RAM, ₹58,990) vs EL-004 (CreatorBook 16, AeroTech, 32GB DDR5, ₹94,990) vs EL-005 (VoltPC, ₹42,990)
  const res = await processCompareRecommendRequest({
    productIds: ['EL-001', 'EL-004', 'EL-005'],
    preferences: {
      selectedOptions: [
        { id: 'best_performance', subOptions: ['professional_performance'] },
        { id: 'camera_display', subOptions: ['high_resolution', 'high_refresh_rate'] }
      ],
      manual: {
        preferredBrand: 'AeroTech',
        minRam: '32GB',
        primaryUsage: '4K studio workstation video editing'
      }
    },
    admin: null
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.recommendation.bestProduct.productId, 'EL-004');
  assert.ok(res.body.recommendation.advantages.length >= 2);
  assert.ok(res.body.recommendation.disadvantages.length >= 1);
  assert.ok(res.body.recommendation.whyBest.length > 20);
  assert.ok(res.body.recommendation.priceValueAnalysis.length > 20);
  assert.equal(res.body.recommendation.otherProducts.length, 2);
  assert.ok(res.body.recommendation.disclaimer.toLowerCase().includes('not official'));
});

// 12. AI service failure fallback
await runTest('12. AI service failure triggers deterministic weighted fallback while keeping table & 8 sections working', async () => {
  const res = await processCompareRecommendRequest({
    productIds: ['GD-001', 'GD-002', 'GD-003'],
    preferences: {
      selectedOptions: [{ id: 'gaming_entertainment', subOptions: ['gaming_high_refresh'] }],
      manual: { maxBudget: '20000' }
    },
    admin: null,
    simulateAiFailure: true
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.fallbackUsed, true);
  assert.equal(res.body.aiEnhanced, false);
  assert.ok(res.body.aiNotice.toLowerCase().includes('unavailable') || res.body.aiNotice.toLowerCase().includes('deterministic'));
  assert.ok(res.body.matrix.rows.length > 10);
  assert.equal(res.body.recommendation.bestProduct.productId, 'GD-001'); // 165Hz QHD at ₹18,999 under ₹20k
  assert.ok(res.body.recommendation.runnerUp.productId);
  assert.ok(res.body.recommendation.finalVerdict.length > 20);
});

// 13. Real-time live database revalidation (mock updated InsForge DB price/stock/rating)
await runTest('13. Real-time product revalidation uses latest live InsForge DB prices, stock & specs', async () => {
  const mockAdmin = {
    database: {
      from() {
        return {
          select() {
            return {
              in: async (_col, names) => ({
                data: [
                  {
                    id: 'db-uuid-el-001',
                    name: 'AeroBook 14 Laptop',
                    brand: 'AeroTech',
                    price: 49990, // Live price drop from 58990 -> 49990!
                    discount: 28,
                    stock: 7,
                    rating: 4.9,
                    review_count: 500,
                    description: 'Ultra-lightweight 14-inch aluminium laptop with 16GB RAM, 512GB NVMe SSD, FHD+ IPS display, Intel Core Ultra 7 processor, and 14-hour battery life.',
                    categories: { id: 'cat-electronics', name: 'Electronics & Laptops', slug: 'electronics' }
                  }
                ].filter((row) => names.includes(row.name)),
                error: null
              })
            };
          }
        };
      }
    }
  };

  const res = await processCompareProductsRequest({
    productIds: ['EL-001', 'EL-002'],
    admin: mockAdmin
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.dataSource, 'hybrid');
  const liveEl001 = res.body.matrix.products.find((p) => p.id === 'EL-001');
  assert.equal(liveEl001.price, 49990, 'Must reflect updated live DB price ₹49,990');
  assert.equal(liveEl001.stock, 7, 'Must reflect updated live DB stock 7');
  assert.equal(liveEl001.verifiedSpecs.processor, 'Intel Core Ultra 7', 'Must extract live DB processor');
});

// 14. HTTP Middleware plugin test (POST /api/compare/products, POST /api/compare/recommend, XSS sanitization, 405)
await runTest('14. Vite server comparePlugin HTTP endpoints validate methods, JSON, and sanitize input', async () => {
  let middleware = null;
  const plugin = comparePlugin({ __ADMIN_CLIENT__: null, GEMINI_API_KEY: '' });
  plugin.configureServer({ middlewares: { use: (fn) => { middleware = fn; } } });
  assert.ok(typeof middleware === 'function');

  // 405 on GET
  const getRes = await invokeMiddleware(middleware, { method: 'GET', url: '/api/compare/products' });
  assert.equal(getRes.status, 405);

  // 400 on invalid JSON
  const badJson = await invokeMiddleware(middleware, { method: 'POST', url: '/api/compare/products', body: '{bad-json' });
  assert.equal(badJson.status, 400);

  // 200 on POST /api/compare/recommend with HTML/XSS injection attempt in manual fields
  const recRes = await invokeMiddleware(middleware, {
    method: 'POST',
    url: '/api/compare/recommend',
    body: {
      productIds: ['AH-001', 'AH-002'],
      preferences: {
        selectedOptions: [{ id: 'best_overall_value', subOptions: ['best_specs_for_price'] }],
        manual: {
          primaryUsage: '<script>alert(1)</script>Commute with ANC',
          otherRequirements: '<img src=x onerror=alert(2)> Hi-Res audio'
        }
      }
    }
  });
  assert.equal(recRes.status, 200);
  assert.equal(recRes.json.ok, true);
  assert.ok(!JSON.stringify(recRes.json).includes('<script>'), 'HTML tags must be stripped from sanitized inputs');
  assert.ok(!JSON.stringify(recRes.json).includes('<img'), 'HTML tags must be stripped from sanitized inputs');
});

// 15. Security & UI Requirements Static Integrity Check
await runTest('15. Frontend files contain zero exposed API secrets and include all required UI headings & options', async () => {
  const widgetSrc = fs.readFileSync('src/CompareFloatingWidget.jsx', 'utf8');
  const ctxSrc = fs.readFileSync('src/CompareContext.jsx', 'utf8');
  const svcSrc = fs.readFileSync('src/compareService.js', 'utf8');
  const cardSrc = fs.readFileSync('src/ProductCard.jsx', 'utf8');
  const detailsSrc = fs.readFileSync('src/ProductDetailsPage.jsx', 'utf8');
  const combinedFrontend = widgetSrc + ctxSrc + svcSrc + cardSrc + detailsSrc;

  assert.ok(!combinedFrontend.includes('GEMINI_API_KEY'), 'Frontend must never reference GEMINI_API_KEY');
  assert.ok(!combinedFrontend.includes('INSFORGE_API_KEY'), 'Frontend must never reference INSFORGE_API_KEY');
  assert.ok(!combinedFrontend.includes('generativelanguage.googleapis.com'), 'Frontend must not call Gemini directly');

  // Verify exact UI titles & controls
  assert.ok(widgetSrc.includes('AI Compare Products'), 'Floating button label must exist');
  assert.ok(widgetSrc.includes('What matters most to you?'), 'Section 5 heading must exist');
  assert.ok(widgetSrc.includes('Enter Your Own Requirements'), 'Section 6 heading must exist');
  assert.ok(widgetSrc.includes('Generate AI Recommendation'), 'Section 7 button must exist');
  assert.ok(widgetSrc.includes('BEST PRODUCT FOR YOU'), 'Section 8 winner heading must exist');
  assert.ok(widgetSrc.includes('WHY THIS PRODUCT IS BEST'), 'Section 8 why best heading must exist');
  assert.ok(widgetSrc.includes('ADVANTAGES'), 'Section 8 advantages heading must exist');
  assert.ok(widgetSrc.includes('DISADVANTAGES'), 'Section 8 disadvantages heading must exist');
  assert.ok(widgetSrc.includes('PRICE AND VALUE ANALYSIS'), 'Section 8 price/value heading must exist');
  assert.ok(widgetSrc.includes('OTHER PRODUCTS'), 'Section 8 other products heading must exist');
  assert.ok(widgetSrc.includes('RUNNER-UP'), 'Section 8 runner-up heading must exist');
  assert.ok(widgetSrc.includes('FINAL VERDICT'), 'Section 8 final verdict heading must exist');
  assert.ok(cardSrc.includes('Compare'), 'ProductCard must have Compare button');
  assert.ok(detailsSrc.includes('Add to Comparison'), 'ProductDetailsPage must have Add to Comparison button');

  // Category-specific manual fields schema check
  assert.ok(!CATEGORY_MANUAL_FIELDS.audio.includes('minRam'), 'Audio manual form must not show RAM input');
  assert.ok(!CATEGORY_MANUAL_FIELDS['smart-home'].includes('minRam'), 'Smart Home manual form must not show RAM input');
  assert.ok(CATEGORY_MANUAL_FIELDS.smartphones.includes('cameraRequirements'), 'Smartphones manual form must show camera input');
});

console.log('='.repeat(74));
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log('='.repeat(74));

if (failed > 0) {
  process.exit(1);
}

