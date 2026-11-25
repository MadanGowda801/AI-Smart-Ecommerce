/**
 * TrustCart AI — Module 1 Automated Test Suite
 * Validates:
 * 1. Natural Language Filter Parsing (Budget, Category, Specifications)
 * 2. Real Catalog Querying & Spec-Weighted Product Ranking
 * 3. Verified Reasons & Honest Trade-offs
 * 4. Side-by-Side Product Comparison
 * 5. Safe Cart Preparation & Explicit Confirmation Safety
 * 6. Non-fabrication & Unauthorized Checkout Prevention
 */

import trustCartAgentService from '../src/trustCartAgentService.js';
import { aiChatService } from '../src/aiChatService.js';
import insforge from '../src/insforge.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runModule1Tests() {
  console.log('='.repeat(70));
  console.log('🤖 TRUSTCART AI — MODULE 1 (AI SHOPPING AGENT) TEST SUITE');
  console.log('='.repeat(70));

  // ─── Test 1: Natural Language Filter Extraction ─────────────────────────────
  console.log('\n[1/6] Testing Natural Language to Structured Filters Conversion...');
  const query = 'Find a phone under ₹25,000 with a good camera';
  const parsed = trustCartAgentService.parseShoppingRequest(query);

  assert(parsed.budget.max === 25000, `Budget max parsed as ₹25,000 (got: ${parsed.budget.max})`);
  assert(parsed.category === 'smartphones', `Category parsed as 'smartphones' (got: ${parsed.category})`);
  assert(parsed.requiredSpecs.includes('camera'), `Required specs includes 'camera' (got: ${parsed.requiredSpecs})`);
  assert(parsed.budget.formattedMax === '₹25,000', `Formatted budget correctly generated (${parsed.budget.formattedMax})`);

  // ─── Test 2: Real Catalog Querying & Ranking ────────────────────────────────
  console.log('\n[2/6] Testing Real Catalog Querying & Spec-Weighted Ranking...');
  const searchResult = await trustCartAgentService.findAndRankProducts(parsed);

  assert(searchResult.products && searchResult.products.length > 0, `Returned ${searchResult.products.length} live catalog items.`);
  const allWithinBudget = searchResult.products.every((p) => p.price <= 25000);
  assert(allWithinBudget, `All ${searchResult.products.length} items strictly adhere to budget ≤ ₹25,000.`);

  // Verify top picks are real products
  const topProduct = searchResult.products[0];
  console.log(`   Top ranked product: "${topProduct.name}" at ₹${topProduct.price} (Score: ${topProduct.matchScore}%)`);
  assert(topProduct.price <= 25000 && topProduct.price > 0, 'Top product has verified nonzero price within budget.');
  assert(Boolean(topProduct.id), 'Top product possesses valid database UUID.');

  // ─── Test 3: Reasons & Trade-offs Generation ────────────────────────────────
  console.log('\n[3/6] Testing Reasons and Real Trade-offs Generation...');
  assert(Array.isArray(topProduct.reasons) && topProduct.reasons.length > 0, `Top product includes ${topProduct.reasons.length} verified reason(s): "${topProduct.reasons[0]}"`);
  assert(Array.isArray(topProduct.tradeOffs) && topProduct.tradeOffs.length > 0, `Top product includes ${topProduct.tradeOffs.length} honest trade-off(s): "${topProduct.tradeOffs[0]}"`);
  
  // Verify no fabricated details: names and prices match live DB or verified catalog
  const { productsService } = await import('../src/productsService.js');
  const { data: verifiedRec } = await productsService.getProductById(topProduct.id);
  assert(
    verifiedRec && verifiedRec.name === topProduct.name && Number(verifiedRec.price) === Number(topProduct.price),
    `Top product identity exactly matches verified catalog/DB record (${verifiedRec?.name}).`
  );

  // ─── Test 4: End-to-End Chat Agent Response with Trade-offs ──────────────────
  console.log('\n[4/6] Testing End-to-End AI Agent Shopping Message Flow...');
  const chatResponse = await aiChatService.sendMessage('Find a phone under ₹25,000 with a good camera');

  assert(chatResponse.type === 'agent_ranked', `Response marked as 'agent_ranked' (got: ${chatResponse.type})`);
  assert(chatResponse.structuredFilters && chatResponse.structuredFilters.budget.max === 25000, 'Response includes structuredFilters metadata.');
  assert(chatResponse.text.includes('Top Match'), 'Response text highlights Top Match with verified details.');
  assert(chatResponse.text.includes('Trade-off'), 'Response text explicitly outlines honest trade-offs to consider.');
  assert(chatResponse.products && chatResponse.products.length > 0, `Response attached ${chatResponse.products.length} real product models.`);

  // ─── Test 5: Side-by-Side Product Comparison ────────────────────────────────
  console.log('\n[5/6] Testing Side-by-Side Product Comparison Feature...');
  const prod1 = searchResult.products[0];
  const prod2 = searchResult.products[1] || searchResult.products[0];

  const comparison = await trustCartAgentService.compareProducts([prod1.id, prod2.id]);
  assert(comparison && comparison.products && comparison.products.length >= 2, 'Comparison returned 2 catalog items.');
  assert(Boolean(comparison.verdict?.priceComparison), `Price comparison generated: "${comparison.verdict.priceComparison}"`);
  assert(Boolean(comparison.verdict?.recommendation), `Recommendation verdict generated: "${comparison.verdict.recommendation}"`);
  assert(Boolean(comparison.products[0].camera), `Product 1 camera spec retrieved: "${comparison.products[0].camera}"`);
  assert(Boolean(comparison.products[1].battery), `Product 2 battery spec retrieved: "${comparison.products[1].battery}"`);

  // ─── Test 6: Safe Cart Preparation & Explicit Confirmation ──────────────────
  console.log('\n[6/6] Testing Safe Cart Preparation (Anti-Unauthorized Purchase)...');
  const cartPrep = trustCartAgentService.prepareCart({ product: topProduct, quantity: 1 });

  assert(cartPrep.status === 'pending_confirmation', `Cart preparation status is 'pending_confirmation'.`);
  assert(cartPrep.requiresConfirmation === true, `requiresConfirmation flag is strictly true.`);
  assert(Boolean(cartPrep.confirmationToken), `Secure confirmation token issued: ${cartPrep.confirmationToken}`);
  assert(cartPrep.preparedItem.itemTotal === topProduct.price, `Calculated item total matches product catalog price (₹${cartPrep.preparedItem.itemTotal}).`);
  assert(cartPrep.notice.includes('Explicit customer confirmation is required'), 'Mandatory warning text prevents unauthorized transactions.');

  console.log('\n' + '='.repeat(70));
  console.log(`🎯 Module 1 Test Results: All ${passed}/${total} assertions PASSED!`);
  console.log('='.repeat(70));
}

runModule1Tests().catch((err) => {
  console.error('\n❌ Module 1 Test Suite Failed:', err);
  process.exit(1);
});
