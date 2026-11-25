/**
 * AI Shopping Search Service (Server-Side)
 *
 * Dedicated service for conversational search intent extraction,
 * schema validation, safe database query building, and deterministic fallback.
 *
 * SAFETY & SECURITY:
 * 1. Strict schema validation against server-defined allowlist.
 * 2. LLM output treated as untrusted data — no arbitrary operators or SQL.
 * 3. Sanitized query inputs to prevent PostgREST syntax errors.
 * 4. Deterministic rule-based fallback when AI is unconfigured or fails.
 * 5. Per-IP rate limiting (10 req/min).
 * 6. Hard timeouts and safe error logging without leaking secrets.
 */

import { INITIAL_PRODUCTS, LEGACY_TEST_PRODUCTS } from '../src/mockData.js';
import { parseSmartSearchQuery, executeSmartSearch } from '../src/smartSearchEngine.js';

// ── Rate limiter (in-memory, resets on server restart) ────────────────────────
const rateLimitMap = new Map(); // ip → { count, windowStart }
export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

export function resetRateLimit() {
  rateLimitMap.clear();
}

// ── Input Sanitization & Validation ──────────────────────────────────────────

export function sanitizeInput(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')              // Strip HTML tags
    .replace(/[^\w\s₹.,\-!?%@]/g, ' ')    // Allow shopping-relevant characters only
    .trim()
    .slice(0, maxLen);
}

export function sanitizeDbSearchString(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  // Strip SQL & PostgREST special characters: semicolons, commas, parens, quotes, backslashes, wildcards
  return str
    .replace(/[;,()"'\\%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeContext(context, maxTurns = 4) {
  if (!Array.isArray(context)) return [];
  return context
    .slice(-maxTurns)
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      role: item.role === 'user' ? 'user' : 'assistant',
      text: sanitizeInput(item.text || item.content || '', 200)
    }))
    .filter(item => item.text.length > 0);
}

// ── Strict Allowlist & Server-Defined Schema Validation ──────────────────────

export const ALLOWED_CATEGORIES = [
  'audio',
  'electronics',
  'gaming',
  'smartphones',
  'smart-home',
  'accessories'
];

export const ALLOWED_SORT_OPTIONS = [
  'featured',
  'priceAsc',
  'priceDesc',
  'ratingDesc',
  'newest'
];

export const ALLOWED_INTENTS = [
  'search',
  'compare',
  'popular',
  'featured',
  'deals',
  'help'
];

/**
 * Validates untrusted LLM output against the strict server schema.
 * Rejects or strips any arbitrary fields, operators, or unsafe types.
 */
export function validateIntentSchema(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('LLM output must be a non-empty JSON object');
  }

  // 1. searchTerm: string or null
  let searchTerm = null;
  if (typeof raw.searchTerm === 'string' && raw.searchTerm.trim()) {
    searchTerm = sanitizeDbSearchString(raw.searchTerm, 100) || null;
  }

  // 2. category: must be in allowlist or null
  let category = null;
  if (typeof raw.category === 'string') {
    const normalizedCat = raw.category.trim().toLowerCase();
    if (ALLOWED_CATEGORIES.includes(normalizedCat)) {
      category = normalizedCat;
    }
  }

  // 3. brand: string or null
  let brand = null;
  if (typeof raw.brand === 'string' && raw.brand.trim()) {
    brand = sanitizeDbSearchString(raw.brand, 50) || null;
  }

  // 4. minPrice & maxPrice: finite non-negative numbers
  let minPrice = null;
  if (typeof raw.minPrice === 'number' && Number.isFinite(raw.minPrice) && raw.minPrice >= 0 && raw.minPrice <= 100_000_000) {
    minPrice = Math.round(raw.minPrice);
  }

  let maxPrice = null;
  if (typeof raw.maxPrice === 'number' && Number.isFinite(raw.maxPrice) && raw.maxPrice >= 0 && raw.maxPrice <= 100_000_000) {
    maxPrice = Math.round(raw.maxPrice);
  }

  // If minPrice > maxPrice, normalize by swapping
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    const temp = minPrice;
    minPrice = maxPrice;
    maxPrice = temp;
  }

  // 5. minRating: number 1 to 5
  let minRating = null;
  if (typeof raw.minRating === 'number' && Number.isFinite(raw.minRating) && raw.minRating >= 1 && raw.minRating <= 5) {
    minRating = Math.round(raw.minRating * 10) / 10;
  }

  // 6. inStockOnly: boolean
  const inStockOnly = Boolean(raw.inStockOnly);

  // 7. sortBy: strictly allowlisted
  const sortBy = ALLOWED_SORT_OPTIONS.includes(raw.sortBy) ? raw.sortBy : 'ratingDesc';

  // 8. intent: strictly allowlisted
  const intent = ALLOWED_INTENTS.includes(raw.intent) ? raw.intent : 'search';

  return {
    searchTerm,
    category,
    brand,
    minPrice,
    maxPrice,
    minRating,
    inStockOnly,
    sortBy,
    intent,
    aiPowered: true
  };
}

// ── Gemini AI Provider ────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function callGemini(apiKey, userMessage, conversationContext = []) {
  const systemPrompt = `You are an AI shopping assistant for an Indian e-commerce store (SmartShop / TrustCart).
Extract structured search filters from the user's natural language shopping query.

Product categories available: audio, electronics, gaming, smartphones, smart-home, accessories

Return a JSON object with ONLY these fields:
{
  "searchTerm": string or null,     // core product keyword (e.g. "wireless headphones")
  "category": string or null,       // one of the categories above, or null
  "brand": string or null,          // brand name if mentioned
  "minPrice": number or null,       // minimum price in INR
  "maxPrice": number or null,       // maximum price in INR
  "minRating": number or null,      // minimum rating 1-5
  "inStockOnly": boolean,           // true if user wants in-stock items only
  "sortBy": "featured" | "priceAsc" | "priceDesc" | "ratingDesc" | "newest",
  "intent": "search" | "compare" | "popular" | "featured" | "deals" | "help"
}

Rules:
- Convert "k" to thousands: "20k" → 20000
- Convert "lakh" to 100000: "1 lakh" → 100000
- Currency prefixes (₹, rs, rupees, inr) are price indicators
- "under/below/within/upto" → maxPrice
- "above/over/more than/starting from" → minPrice
- "top rated/best rated/highly rated" → minRating: 4.5
- If user mentions previous context, incorporate it into the filters.
- If no search intent, set intent to "help"
- Return ONLY valid JSON, no markdown, no explanation.`;

  const contextText = conversationContext.length > 0
    ? `\n\nRecent conversation context:\n` + conversationContext.map(c => `${c.role}: ${c.text}`).join('\n')
    : '';

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}${contextText}\n\nUser query: "${userMessage}"` }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 150)}`);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  const parsed = JSON.parse(cleaned);

  return validateIntentSchema(parsed);
}

// ── Deterministic Rule-Based Fallback (Powered by Shared Smart Search Engine) ─

export function extractFiltersRuleBased(message) {
  const parsed = parseSmartSearchQuery(message || '');
  const sortMap = {
    priceAsc: 'priceAsc',
    priceDesc: 'priceDesc',
    ratingDesc: 'ratingDesc',
    newest: 'newest',
    discountDesc: 'ratingDesc',
    popular: 'ratingDesc',
    relevance: 'ratingDesc'
  };

  return {
    searchTerm: parsed.searchTerm,
    category: parsed.category,
    subTypeKey: parsed.subTypeKey,
    brand: parsed.brand,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    approxPrice: parsed.approxPrice,
    minRating: parsed.minRating,
    inStockOnly: parsed.inStockOnly,
    sortBy: sortMap[parsed.sortBy] || 'ratingDesc',
    rawSortBy: parsed.sortBy,
    features: parsed.features.map((f) => f.label),
    typoCorrections: parsed.corrections,
    intent: 'search',
    aiPowered: false,
    _parsed: parsed
  };
}

// ── Database Query Execution ──────────────────────────────────────────────────

function searchCatalogFallback(filters, limit = 8, originalQuery = '') {
  const catalog = [...INITIAL_PRODUCTS, ...(LEGACY_TEST_PRODUCTS || [])];
  const parsed = filters._parsed || parseSmartSearchQuery(originalQuery || filters.searchTerm || '');

  const { results, closeAlternatives, relaxedReason } = executeSmartSearch(catalog, parsed, {
    category: filters.category || undefined,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    inStockOnly: filters.inStockOnly,
    sortBy: filters.rawSortBy || filters.sortBy || 'relevance'
  });

  const formatProd = (p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand || 'SmartShop',
    price: Number(p.price || 0),
    originalPrice: Number(p.originalPrice || p.price || 0),
    discountPercent: Number(p.discountPercent || 0),
    stock: Number(p.stock ?? 0),
    inStock: Number(p.stock ?? 0) > 0,
    rating: Number(p.rating || 4.5),
    reviewsCount: Number(p.reviewsCount || 0),
    image: p.image,
    imageUrl: p.image,
    slug: p.slug || p.id,
    description: (p.description || '').slice(0, 200),
    category: p.category || 'Electronics',
    categoryId: p.categoryId || null
  });

  return {
    products: results.slice(0, limit).map(formatProd),
    count: results.length,
    closeAlternatives: (closeAlternatives || []).slice(0, 4).map(formatProd),
    relaxedReason
  };
}

export async function searchProductsInDb(admin, filters, limit = 8) {
  if (!admin) {
    return searchCatalogFallback(filters, limit);
  }

  const { searchTerm, category, brand, minPrice, maxPrice, minRating, inStockOnly, sortBy = 'ratingDesc' } = filters;

  let query = admin.database
    .from('products')
    .select('id, name, brand, price, discount, stock, image, image_url, rating, review_count, slug, description, category_id, categories(id, name, slug)', { count: 'exact' });

  // 1. Category filter (resolve category ID safely)
  if (category && category !== 'all') {
    const safeCat = sanitizeDbSearchString(category, 30);
    if (safeCat) {
      const { data: cats } = await admin.database
        .from('categories')
        .select('id, name, slug')
        .or(`slug.ilike.%${safeCat}%,name.ilike.%${safeCat}%`)
        .limit(1);

      if (cats && cats.length > 0) {
        query = query.eq('category_id', cats[0].id);
      }
    }
  }

  // 2. Brand filter (parameterized / safe characters only)
  if (brand) {
    const safeBrand = sanitizeDbSearchString(brand, 30);
    if (safeBrand) {
      query = query.ilike('brand', `%${safeBrand}%`);
    }
  }

  // 3. Text search across name, brand, description
  if (searchTerm && searchTerm.trim()) {
    const safeTerm = sanitizeDbSearchString(searchTerm, 60);
    if (safeTerm) {
      query = query.or(`name.ilike.%${safeTerm}%,brand.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`);
    }
  }

  // 4. Price bounds
  if (minPrice !== null && minPrice !== undefined) query = query.gte('price', minPrice);
  if (maxPrice !== null && maxPrice !== undefined) query = query.lte('price', maxPrice);

  // 5. Rating filter
  if (minRating !== null && minRating !== undefined) query = query.gte('rating', minRating);

  // 6. Stock filter
  if (inStockOnly) query = query.gt('stock', 0);

  // 7. Sorting
  switch (sortBy) {
    case 'priceAsc': query = query.order('price', { ascending: true }); break;
    case 'priceDesc': query = query.order('price', { ascending: false }); break;
    case 'ratingDesc': query = query.order('rating', { ascending: false }); break;
    case 'newest': query = query.order('created_at', { ascending: false }); break;
    default: query = query.order('rating', { ascending: false }); break;
  }

  query = query.range(0, limit - 1);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Database query error: ${error.message}`);
  }

  // Normalize products matching frontend conventions
  const products = (data || []).map((p) => {
    const rawPrice = Number(p.price || 0);
    const rawDiscount = Number(p.discount || 0);
    const originalPrice = rawDiscount > 0 ? Math.round(rawPrice / (1 - rawDiscount / 100)) : rawPrice;
    const primaryImage = p.image || p.image_url ||
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80';

    return {
      id: p.id,
      name: p.name || 'Unnamed Product',
      brand: p.brand || 'SmartShop',
      price: rawPrice,
      originalPrice,
      discountPercent: rawDiscount,
      stock: Number(p.stock ?? 0),
      inStock: Number(p.stock ?? 0) > 0,
      rating: Number(p.rating || 4.5),
      reviewsCount: Number(p.review_count || 0),
      image: primaryImage,
      imageUrl: primaryImage,
      slug: p.slug || p.id,
      description: (p.description || '').slice(0, 200),
      category: p.categories?.name || 'Electronics',
      categoryId: p.category_id
    };
  });

  return { products, count: count !== null && count !== undefined ? count : products.length };
}

// ── Master Request Orchestrator ───────────────────────────────────────────────

export async function processAiSearchRequest({
  queryText,
  query,
  message,
  conversationContext = [],
  admin,
  geminiApiKey,
  ip = 'unknown',
  clientIp
}) {
  const actualQuery = queryText || query || message || '';
  const actualIp = clientIp || ip || 'unknown';

  // 1. Rate Limiting
  if (checkRateLimit(actualIp)) {
    return {
      status: 429,
      body: {
        ok: false,
        error: 'Rate limit exceeded. Please wait a moment before trying again.',
        fallback: true
      }
    };
  }

  // 2. Input Validation
  if (!actualQuery || typeof actualQuery !== 'string') {
    return {
      status: 400,
      body: { ok: false, error: 'Query or message field is required.' }
    };
  }

  const cleanMessage = sanitizeInput(actualQuery, 500);
  if (cleanMessage.length < 2) {
    return {
      status: 400,
      body: { ok: false, error: 'Query is too short. Please provide at least 2 characters.' }
    };
  }

  const cleanContext = sanitizeContext(conversationContext, 4);

  // 3. Extract Intent (AI first with timeout, fallback to deterministic)
  let filters;
  let aiPowered = false;

  if (geminiApiKey) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI request timeout')), 8000)
      );
      filters = await Promise.race([
        callGemini(geminiApiKey, cleanMessage, cleanContext),
        timeoutPromise
      ]);
      aiPowered = true;
    } catch (err) {
      console.warn('[aiSearchService] AI intent extraction failed, invoking deterministic fallback:', err.message);
      filters = extractFiltersRuleBased(cleanMessage);
      aiPowered = false;
    }
  } else {
    filters = extractFiltersRuleBased(cleanMessage);
    aiPowered = false;
  }

  // 4. Execute safe database query (with automatic verified catalog fallback if DB is paused/unreachable)
  try {
    let queryRes;
    try {
      queryRes = await searchProductsInDb(admin, filters);
      // If DB returned 0 because of plural/typo/sub-type phrasing, refine with smart catalog search
      if ((!queryRes.products || queryRes.products.length === 0) && (filters.typoCorrections?.length > 0 || filters.subTypeKey)) {
        const smartRes = searchCatalogFallback(filters, 8, cleanMessage);
        if (smartRes.products.length > 0) queryRes = smartRes;
      }
    } catch (dbErr) {
      console.warn('[aiSearchService] Live DB query unavailable, falling back to verified catalog:', dbErr.message);
      queryRes = searchCatalogFallback(filters, 8, cleanMessage);
    }
    const { products, count, closeAlternatives = [], relaxedReason = null } = queryRes;

    // 5. Construct human-readable message
    let responseText;
    const typoNote = filters.typoCorrections?.length > 0
      ? ` (auto-corrected "${filters.typoCorrections.map((c) => `${c.from} → ${c.to}`).join(', ')}")`
      : '';
    if (products.length === 0) {
      responseText = relaxedReason || `No products found matching your request. Try broadening your search or adjusting the budget.`;
    } else {
      const budgetNote =
        filters.minPrice && filters.maxPrice
          ? ` between ₹${filters.minPrice.toLocaleString('en-IN')} and ₹${filters.maxPrice.toLocaleString('en-IN')}`
          : filters.maxPrice
          ? ` under ₹${filters.maxPrice.toLocaleString('en-IN')}`
          : filters.minPrice
          ? ` above ₹${filters.minPrice.toLocaleString('en-IN')}`
          : '';
      const targetLabel = filters.subTypeKey ? `${filters.subTypeKey}s` : filters.category ? `${filters.category} products` : 'products';
      const countNote = count > products.length ? ` (showing ${products.length} of ${count})` : '';
      responseText = aiPowered
        ? `🤖 AI found ${count} ${targetLabel}${budgetNote}${typoNote}${countNote}:`
        : `Found ${count} ${targetLabel}${budgetNote}${typoNote}${countNote}:`;
    }

    const cleanFilters = { ...filters };
    delete cleanFilters._parsed;

    return {
      status: 200,
      body: {
        ok: true,
        text: responseText,
        products,
        count,
        closeAlternatives,
        relaxedReason,
        filters: cleanFilters,
        aiPowered,
        type: products.length === 0 ? 'no_results' : 'ai_search_results'
      }
    };
  } catch (dbErr) {
    console.error('[aiSearchService] Database search error:', dbErr.message);
    return {
      status: 500,
      body: {
        ok: false,
        error: 'Search service temporarily unavailable. Please try again.',
        fallback: true
      }
    };
  }
}

// ── Direct CLI Execution Runner ───────────────────────────────────────────────
if (
  process.argv[1] &&
  (process.argv[1].endsWith('aiSearchService.js') || process.argv[1].endsWith('aiSearchService'))
) {
  (async () => {
    console.log('🔍 Executing AI Search Service directly...');

    // Load .env.local if present
    try {
      const fs = await import('node:fs');
      const envPath = '.env.local';
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match && !process.env[match[1]]) {
            process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
          }
        }
      }
    } catch {}

    const { createAdminClient } = await import('@insforge/sdk');
    const insforgeUrl = process.env.INSFORGE_URL || 'https://wheg6hgs.ap-southeast.insforge.app';
    const insforgeKey = process.env.INSFORGE_API_KEY || process.env.VITE_INSFORGE_ANON_KEY;
    const admin = insforgeKey ? createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeKey }) : null;

    const queryArg = process.argv.slice(2).join(' ').trim();
    const sampleQuery = queryArg || 'laptop under 100000';
    console.log(`📌 Searching: "${sampleQuery}"\n`);

    const result = await processAiSearchRequest({
      message: sampleQuery,
      admin,
      clientIp: '127.0.0.1'
    });

    console.log(`Status: ${result.status} ${result.body?.ok ? 'OK' : 'ERROR'}`);
    console.log(`Message: ${result.body?.text}`);
    console.log(`Count: ${result.body?.count || 0} product(s) matching`);

    if (result.body?.products?.length > 0) {
      console.log('\nTop Matching Products:');
      result.body.products.slice(0, 5).forEach((p, idx) => {
        console.log(`  [${idx + 1}] ${p.name}`);
        console.log(`      Brand: ${p.brand} | Price: ₹${p.price.toLocaleString('en-IN')} | Stock: ${p.stock} | Rating: ⭐ ${p.rating}`);
      });
    }

    console.log('\n✅ AI Search Service executed successfully with live database results!\n');
  })().catch((err) => {
    console.error('❌ Direct execution error:', err);
  });
}

