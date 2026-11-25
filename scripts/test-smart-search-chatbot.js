/**
 * Comprehensive Automated Verification Suite:
 * Smart Search Engine + Upgraded AI Shopping Chatbot + /api/ai-search Backend
 */

import assert from 'node:assert/strict';
import { INITIAL_PRODUCTS } from '../src/mockData.js';
import { normalizeProduct } from '../src/productsService.js';
import { parseSmartSearchQuery, executeSmartSearch } from '../src/smartSearchEngine.js';
import { aiChatService } from '../src/aiChatService.js';
import { processAiSearchRequest, resetRateLimit } from '../server/aiSearchService.js';

const catalog = INITIAL_PRODUCTS.map((p) => normalizeProduct(p));

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  resetRateLimit();
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}\n   → ${err.message}`);
    failed++;
  }
}

console.log('='.repeat(74));
console.log('  Smart Search Engine & AI Shopping Chatbot — Verification Suite');
console.log('='.repeat(74));

// ── Part A: Smart Search Engine (Frontend Search Bar + Catalog Search) ───────

await runTest('1. "laptops under 60 k" (space before k) returns ONLY laptops ≤ ₹60,000', () => {
  const { parsed, results } = executeSmartSearch(catalog, 'laptops under 60 k');
  assert.equal(parsed.maxPrice, 60000, `Expected maxPrice 60000, got ${parsed.maxPrice}`);
  assert.equal(parsed.subTypeKey, 'laptop');
  assert.ok(results.length >= 2, `Expected >=2 laptops under 60k, got ${results.length}`);
  assert.ok(results.every((p) => p.price <= 60000), 'All results must be ≤ ₹60,000');
  assert.ok(results.every((p) => /laptop/i.test(p.name)), `Expected only laptops, got: ${results.map((p) => p.name).join(', ')}`);
});

await runTest('2. "best laptos" auto-corrects typo (laptos → laptop) & sorts top rated first', () => {
  const { parsed, results } = executeSmartSearch(catalog, 'best laptos');
  assert.ok(parsed.corrections.some((c) => c.from === 'laptos' && c.to === 'laptop'));
  assert.equal(parsed.subTypeKey, 'laptop');
  assert.equal(parsed.sortBy, 'ratingDesc');
  assert.ok(results.length >= 5);
  assert.equal(results[0].id, 'EL-004', `Expected top-rated CreatorBook 16 (4.9★) first, got ${results[0].name}`);
});

await runTest('3. Price range "phones between 20 k and 40 k" returns exact in-range smartphones', () => {
  const { parsed, results } = executeSmartSearch(catalog, 'phones between 20 k and 40 k');
  assert.equal(parsed.minPrice, 20000);
  assert.equal(parsed.maxPrice, 40000);
  assert.ok(results.length >= 2);
  assert.ok(results.every((p) => p.price >= 20000 && p.price <= 40000));
});

await runTest('4. Feature-specific "5g phone with 6000mah battery" ranks MaxView 5G #1', () => {
  const { results } = executeSmartSearch(catalog, '5g phone with 6000mah battery');
  assert.ok(results.length >= 1);
  assert.equal(results[0].id, 'SW-004');
});

await runTest('5. Use-case + spec "student laptop with 16gb ram" returns AeroBook 14 Laptop', () => {
  const { results } = executeSmartSearch(catalog, 'student laptop with 16gb ram');
  assert.ok(results.length >= 1);
  assert.ok(results.some((p) => p.id === 'EL-001'));
});

await runTest('6. Feature + budget "hedphones with anc under 10 k" (typo + ANC + price) works', () => {
  const { parsed, results } = executeSmartSearch(catalog, 'hedphones with anc under 10 k');
  assert.equal(parsed.maxPrice, 10000);
  assert.ok(results.length >= 1);
  assert.ok(results.every((p) => p.price <= 10000));
  assert.ok(results.some((p) => p.id === 'AH-003' || p.id === 'AH-002'));
});

await runTest('7. Sort-specific "cheapest smartphone" sorts lowest price smartphone first', () => {
  const { parsed, results } = executeSmartSearch(catalog, 'cheapest smartphone');
  assert.equal(parsed.sortBy, 'priceAsc');
  assert.ok(results.length >= 3);
  assert.equal(results[0].id, 'SW-003');
  assert.ok(results[0].price <= results[1].price);
});

await runTest('8. Gaming feature "gaming monitor 165hz" returns 27-inch 165Hz Gaming Monitor #1', () => {
  const { results } = executeSmartSearch(catalog, 'gaming monitor 165hz');
  assert.ok(results.length >= 1);
  assert.equal(results[0].id, 'GD-001');
});

await runTest('9. Category + feature "waterproof speker" (typo + feature) returns waterproof speakers', () => {
  const { results } = executeSmartSearch(catalog, 'waterproof speker');
  assert.ok(results.length >= 1);
  assert.ok(results.some((p) => p.id === 'AH-006' || p.id === 'AH-007'));
});

await runTest('10. Hero prompt "Smart Home Cameras" returns security cameras & video doorbell', () => {
  const { results } = executeSmartSearch(catalog, 'Smart Home Cameras');
  assert.ok(results.length >= 2);
  assert.ok(results.some((p) => p.id === 'SH-004'));
});

await runTest('11. Impossible budget "laptops under 20 k" returns 0 exact matches + affordable closeAlternatives', () => {
  const { results, closeAlternatives, relaxedReason } = executeSmartSearch(catalog, 'laptops under 20 k');
  assert.equal(results.length, 0);
  assert.ok(closeAlternatives.length >= 2);
  assert.equal(closeAlternatives[0].id, 'EL-005', 'Closest affordable laptop should be Everyday Laptop 15 (₹42,990)');
  assert.ok(relaxedReason.includes('20,000'));
});

// ── Part B: Upgraded AI Shopping Chatbot ─────────────────────────────────────

await runTest('12. Chatbot handles "laptops under 60 k" with real laptops, filters, and reasons', async () => {
  const res = await aiChatService.sendMessage('laptops under 60 k');
  assert.ok(res.products.length >= 2, `Expected >=2 laptops, got ${res.products.length}`);
  assert.ok(res.products.every((p) => p.price <= 60000 && /laptop/i.test(p.name)));
  assert.equal(res.structuredFilters?.budget?.max, 60000);
});

await runTest('13. Chatbot handles typo query "best laptos" accurately', async () => {
  const res = await aiChatService.sendMessage('best laptos');
  assert.ok(res.products.length >= 5);
  assert.ok(res.text.includes('laptos') && res.text.includes('laptop'));
  assert.equal(res.products[0].id, 'EL-004');
});

await runTest('14. Chatbot supports multi-turn follow-up memory ("show laptops" -> "under 60 k")', async () => {
  const turn1 = await aiChatService.sendMessage('show laptops');
  assert.ok(turn1.products.length >= 5);
  const history = [
    { role: 'user', text: 'show laptops' },
    { role: 'assistant', ...turn1 }
  ];
  const turn2 = await aiChatService.sendMessage('under 60 k', history);
  assert.ok(turn2.products.length >= 2);
  assert.ok(turn2.products.every((p) => p.price <= 60000 && /laptop/i.test(p.name)));
});

await runTest('15. Chatbot answers product details Q&A ("tell me about AeroBook 14")', async () => {
  const res = await aiChatService.sendMessage('tell me about AeroBook 14');
  assert.equal(res.type, 'product_info');
  assert.equal(res.products[0].id, 'EL-001');
  assert.ok(res.text.includes('58,990'));
});

await runTest('16. Chatbot answers active coupons, shipping, return policy, and payment methods', async () => {
  const coupons = await aiChatService.sendMessage('active discount coupons');
  assert.equal(coupons.type, 'coupons');
  assert.ok(coupons.text.includes('SMART10') && coupons.text.includes('TECHFEST'));

  const shipping = await aiChatService.sendMessage('what is your shipping policy?');
  assert.equal(shipping.type, 'policy_shipping');
  assert.ok(shipping.text.includes('999'));

  const returns = await aiChatService.sendMessage('return and warranty policy');
  assert.equal(returns.type, 'policy_returns');
  assert.ok(returns.text.includes('7-Day'));

  const payment = await aiChatService.sendMessage('what payment methods do you accept?');
  assert.equal(payment.type, 'policy_payment');
  assert.ok(payment.text.includes('UPI') && payment.text.includes('Razorpay'));
});

await runTest('17. Chatbot handles wishlist, orders, comparison, and courtesy replies', async () => {
  const wish = await aiChatService.sendMessage('show my wishlist', [], {
    wishlistItems: [catalog[0]]
  });
  assert.equal(wish.type, 'wishlist_items');
  assert.equal(wish.products.length, 1);

  const ord = await aiChatService.sendMessage('track my orders', [], {
    user: { name: 'Rohan' },
    orders: [{ id: 'ORD-8492', status: 'out_for_delivery', total_amount: 59315, created_at: '2026-11-08T10:30:00Z' }]
  });
  assert.equal(ord.type, 'orders');
  assert.ok(ord.text.includes('ORD-8492'));

  const comp = await aiChatService.sendMessage('compare AeroBook 14 and CreatorBook 16');
  assert.equal(comp.type, 'comparison');
  assert.equal(comp.products.length, 2);
  assert.equal(comp.action?.type, 'compare_available');

  const thanks = await aiChatService.sendMessage('thank you');
  assert.equal(thanks.type, 'courtesy');
});

// ── Part C: Backend /api/ai-search Endpoint Parity ───────────────────────────

await runTest('18. Backend /api/ai-search handles "laptops under 60 k" and "best laptos" accurately', async () => {
  const r1 = await processAiSearchRequest({ queryText: 'laptops under 60 k', admin: null, ip: 'test-1' });
  assert.equal(r1.status, 200);
  assert.ok(r1.body.products.length >= 2);
  assert.ok(r1.body.products.every((p) => p.price <= 60000 && /laptop/i.test(p.name)));

  const r2 = await processAiSearchRequest({ queryText: 'best laptos', admin: null, ip: 'test-2' });
  assert.equal(r2.status, 200);
  assert.ok(r2.body.products.length >= 5);
  assert.equal(r2.body.products[0].id, 'EL-004');
});

console.log('='.repeat(74));
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log('='.repeat(74));

if (failed > 0) process.exit(1);

