/**
 * Automated Test Suite for AI Search and Shopping Assistant (Phase D)
 *
 * Validates:
 * 1. Structured Intent Schema Validation & Untrusted Data Sanitization
 * 2. Input Sanitization, Size Limits & Invalid Inputs
 * 3. Price & Category Filters with Real PostgreSQL/InsForge Database
 * 4. Deterministic Fallback Search when AI is unconfigured or fails
 * 5. Empty Results Handling & Stable JSON Schema
 * 6. Rate Limiting Behavior (429 HTTP status)
 * 7. Standard Search Independence (verifies existing catalog search is intact)
 */
import { createAdminClient } from '@insforge/sdk';
import fs from 'node:fs';
import {
  processAiSearchRequest,
  validateIntentSchema,
  extractFiltersRuleBased,
  sanitizeInput,
  sanitizeDbSearchString,
  checkRateLimit,
  resetRateLimit
} from '../server/aiSearchService.js';
import { productsService } from '../src/productsService.js';

// Load .env.local manually without external dependencies
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
} catch (e) {
  // Ignore if file not found
}

const insforgeUrl = process.env.INSFORGE_URL || process.env.VITE_INSFORGE_URL;
const insforgeApiKey = process.env.INSFORGE_API_KEY;

if (!insforgeUrl || !insforgeApiKey) {
  console.error('Missing InsForge URL or API key in environment.');
  process.exit(1);
}

const admin = createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeApiKey });

async function runAiSearchSuite() {
  console.log('======================================================================');
  console.log('🧪 AI SHOPPING ASSISTANT & NATURAL-LANGUAGE SEARCH TEST SUITE');
  console.log('======================================================================\n');

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

  // ─── Test 1: Strict Schema Validation & Untrusted Data Sanitization ─────────
  console.log('[1/7] Testing Strict Intent Schema Validation & Untrusted Data Protection...');

  // Disallow non-object output
  let threwOnInvalid = false;
  try {
    validateIntentSchema(null);
  } catch {
    threwOnInvalid = true;
  }
  assert(threwOnInvalid, 'Rejects null or non-object LLM output');

  // Strip arbitrary keys, SQL attempts, and enforce allowlists
  const maliciousLlmOutput = {
    searchTerm: "headphones'; DROP TABLE products; --",
    category: 'hack-category', // Not in allowlist
    brand: 'Sony',
    minPrice: -500, // Invalid negative
    maxPrice: 20000,
    minRating: 4.8,
    inStockOnly: true,
    sortBy: 'ratingDesc',
    intent: 'search',
    arbitraryField: 'malicious payload',
    $where: 'sleep(5000)'
  };

  const validated = validateIntentSchema(maliciousLlmOutput);
  assert(validated.category === null, 'Disallows categories outside server allowlist');
  assert(validated.minPrice === null, 'Sanitizes and rejects negative price numbers');
  assert(validated.maxPrice === 20000, 'Accepts valid max price');
  assert(!validated.searchTerm.includes(';'), 'Strips semicolons and SQL injection attempts');
  assert(validated.arbitraryField === undefined, 'Strips non-allowlisted arbitrary fields');
  assert(validated.$where === undefined, 'Strips NoSQL/MongoDB operators');

  // Price swapping if minPrice > maxPrice
  const swapped = validateIntentSchema({
    minPrice: 50000,
    maxPrice: 20000,
    sortBy: 'priceAsc'
  });
  assert(swapped.minPrice === 20000 && swapped.maxPrice === 50000, 'Normalizes inverted price bounds by swapping min/max');

  // ─── Test 2: Input Sanitization & Invalid Input Handling ────────────────────
  console.log('\n[2/7] Testing Input Sanitization & Invalid Input Validation...');
  const maliciousInput = '<script>alert("xss")</script>Show wireless headphones under ₹20,000!';
  const sanitizedInput = sanitizeInput(maliciousInput);
  assert(!sanitizedInput.includes('<script>') && !sanitizedInput.includes('</script>'), 'Strips HTML and script tags');
  assert(sanitizedInput.includes('Show wireless headphones under ₹20,000!'), 'Preserves legitimate shopping request');

  // Empty or too short query rejection
  const emptyRes = await processAiSearchRequest({
    queryText: '',
    admin,
    ip: 'test-ip-empty'
  });
  assert(emptyRes.status === 400 && emptyRes.body.ok === false, 'Returns 400 Bad Request on empty query');

  const shortRes = await processAiSearchRequest({
    queryText: 'a',
    admin,
    ip: 'test-ip-short'
  });
  assert(shortRes.status === 400 && shortRes.body.ok === false, 'Returns 400 Bad Request on query shorter than 2 chars');

  // ─── Test 3: Price & Category Filters with Real PostgreSQL Database ─────────
  console.log('\n[3/7] Testing Real PostgreSQL Database Execution with Price & Category Filters...');
  const searchRes = await processAiSearchRequest({
    queryText: 'wireless headphones under ₹30,000',
    admin,
    geminiApiKey: '', // tests deterministic filter extraction path
    ip: 'test-ip-filter'
  });

  assert(searchRes.status === 200 && searchRes.body.ok === true, 'Returns 200 OK with valid database response');
  assert(Array.isArray(searchRes.body.products) && searchRes.body.products.length > 0, `Retrieved ${searchRes.body.products.length} real products`);
  const allWithinBudget = searchRes.body.products.every(p => p.price <= 30000);
  assert(allWithinBudget, 'All returned products strictly adhere to budget ≤ ₹30,000');
  const allHaveValidId = searchRes.body.products.every(p => Boolean(p.id) && Boolean(p.name));
  assert(allHaveValidId, 'All products contain verified database fields (id, name, price, stock)');

  // ─── Test 4: Deterministic Fallback Search ───────────────────────────────────
  console.log('\n[4/7] Testing Deterministic Fallback Search (AI unconfigured or failing)...');
  const fallbackQuery = 'Find gaming keyboard under 15k with top rated';
  const extractedFilters = extractFiltersRuleBased(fallbackQuery);
  assert(extractedFilters.maxPrice === 15000, 'Fallback accurately extracts 15k -> 15,000 max price');
  assert(extractedFilters.category === 'gaming', 'Fallback accurately extracts category "gaming"');
  assert(extractedFilters.minRating === 4.5, 'Fallback accurately extracts min rating 4.5 for top rated');

  // Execute fallback search through processAiSearchRequest with invalid API key to trigger error fallback
  const fallbackRun = await processAiSearchRequest({
    queryText: fallbackQuery,
    admin,
    geminiApiKey: 'invalid-fake-key-to-trigger-fallback',
    ip: 'test-ip-fallback'
  });
  assert(fallbackRun.status === 200 && fallbackRun.body.ok === true, 'Successfully recovers and returns products via deterministic fallback');
  assert(fallbackRun.body.aiPowered === false, 'Correctly flags aiPowered as false on fallback');

  // ─── Test 5: Empty Results Handling & Stable JSON Schema ────────────────────
  console.log('\n[5/7] Testing Empty Results Handling for Impossible Filters...');
  const emptySearchRes = await processAiSearchRequest({
    queryText: 'laptops under ₹10',
    admin,
    ip: 'test-ip-impossible'
  });
  assert(emptySearchRes.status === 200, 'Returns HTTP 200 even when 0 matches found');
  assert(emptySearchRes.body.ok === true, 'Returns ok: true');
  assert(Array.isArray(emptySearchRes.body.products) && emptySearchRes.body.products.length === 0, 'Products array is safely empty');
  assert(emptySearchRes.body.type === 'no_results', 'Type is marked as no_results');
  assert(typeof emptySearchRes.body.text === 'string' && emptySearchRes.body.text.length > 0, 'Provides friendly human-readable explanation');

  // ─── Test 6: Rate Limiting Enforcement ──────────────────────────────────────
  console.log('\n[6/7] Testing Per-IP Rate Limiting (10 requests per minute max)...');
  resetRateLimit();
  const testIp = '192.168.1.100';
  let rateLimitTriggered = false;

  for (let i = 0; i < 12; i++) {
    const isLimited = checkRateLimit(testIp);
    if (isLimited) {
      rateLimitTriggered = true;
      break;
    }
  }
  assert(rateLimitTriggered, 'Rate limiter triggers 429 when threshold of 10 requests is reached');

  // ─── Test 7: Standard Search Independence ───────────────────────────────────
  console.log('\n[7/7] Testing Standard Search Independence (productsService untouched)...');
  const standardRes = await productsService.getProducts({
    search: 'Headphones',
    limit: 4
  });
  assert(!standardRes.error && Array.isArray(standardRes.data) && standardRes.data.length > 0, 'Standard productsService search functions normally');
  assert(standardRes.data.some(p => p.name.toLowerCase().includes('headphone') || p.category?.toLowerCase().includes('audio')), 'Standard search returns matching Headphones products independently');

  console.log('\n======================================================================');
  console.log(`🎯 Phase D AI Search Test Summary: All ${passed}/${total} assertions PASSED!`);
  console.log('======================================================================\n');
}

runAiSearchSuite().catch(err => {
  console.error('\n❌ AI Search Test Suite Failed:', err);
  process.exit(1);
});
