/**
 * AI Shopping Assistant Service
 *
 * A smart rule-based NLP engine that parses user intent,
 * queries the real InsForge product database, and returns
 * contextual, helpful responses with actual product data.
 *
 * Feature 1 Enhancement: When GEMINI_API_KEY is configured server-side,
 * the /api/ai-search endpoint is called first for general product queries.
 * The existing rule-based engine always acts as automatic fallback.
 *
 * No API key is exposed to the browser — Gemini is called server-side only.
 */

import { productsService, formatINR } from './productsService.js';
import insforge from './insforge.js';
import trustCartAgentService from './trustCartAgentService.js';
import { parseSmartSearchQuery, executeSmartSearch } from './smartSearchEngine.js';
import { INITIAL_COUPONS } from './mockData.js';

// ─── Intent classifier ─────────────────────────────────────────────────────────

const INTENT_PATTERNS = {
  search_budget: [
    /under\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr|bucks))?/i,
    /below\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr|bucks))?/i,
    /less\s*than\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr|bucks))?/i,
    /within\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr|bucks))?/i,
    /upto?\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr|bucks))?/i,
    /budget\s*(?:of\s*)?(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr|bucks))?/i,
    /(?:[₹rs]|rupees|inr)\s*(\d[\d,]*(?:k|lakh)?)\s*(?:or\s*)?(?:less|below|budget)/i,
    /(\d[\d,]*(?:k|lakh)?)\s*(?:rupees|rs|inr)?\s*(?:budget|or\s*less)/i,
  ],
  search_min_price: [
    /above\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr))?/i,
    /more\s*than\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr))?/i,
    /over\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr))?/i,
    /starting\s*(?:from)?\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr))?/i,
  ],
  search_price_range: [
    /(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)\s*(?:to|-)\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr))?/i,
    /between\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)\s*(?:and|to|-)\s*(?:[₹rs]|rupees|inr)?\s*(\d[\d,]*(?:k|lakh)?)(?:\s*(?:rupees|rs|inr))?/i,
  ],
  rating: [
    /rated?\s*(?:above|over|at\s*least)?\s*([3-5](?:\.\d)?)\s*(?:star|\/5)?/i,
    /([3-5](?:\.\d)?)\s*star\s*(?:and\s*above|or\s*higher|plus|\+)?/i,
    /minimum\s*rating\s*(?:of\s*)?([3-5](?:\.\d)?)/i,
    /top\s*rated/i,
    /best\s*rated/i,
    /highly\s*rated/i,
  ],
  compare: [/compare|vs\.?|versus|difference between|which is better/i],
  order_status: [/my\s*order|track\s*order|order\s*status|where\s*is\s*my/i],
  cart_inquiry: [/what.s in my cart|my cart|cart items|show cart/i],
  wishlist_inquiry: [/my wishlist|saved items|show wishlist/i],
  popular: [/popular|trending|best\s*seller|most\s*bought|top\s*product/i],
  featured: [/featured|recommend|suggestion|what.s good|what should i buy/i],
  discount: [/discount|offer|deal|sale|cheap|affordable|coupon/i],
  in_stock: [/in\s*stock|available|not?\s*out\s*of\s*stock/i],
  greeting: [/^(hi|hello|hey|hii|namaste|good\s*(morning|afternoon|evening)|howdy)[\s!.?]*$/i],
  help: [/help|what can you do|how do you work|what.s your capability|commands/i],
  categories: [/categor|department|section|type of products/i],
  all_products: [
    /^(?:show\s*)?(?:all|our)?\s*products?$/i,
    /^(?:browse|view|show|display)\s*(?:all\s*)?(?:products?|catalog|items?|inventory)$/i,
    /^all\s*(?:products?|items?|catalog)$/i,
    /\bshow\s*all\s*products?\b/i,
    /\beverything\b/i,
  ],
  navigate_search: [/show me|find me|search for|look for|i want|i need|i.m looking for/i],
};

// Known category keywords map → DB category slugs/names
const CATEGORY_KEYWORDS = {
  audio: ['audio', 'headphone', 'headphones', 'earphone', 'earphones', 'earbud', 'earbuds', 'airpod', 'airpods', 'headset', 'speaker', 'soundbar', 'wireless headphones'],
  electronics: ['electronics', 'laptop', 'laptops', 'notebook', 'macbook', 'pc', 'computer', 'ultrabook', 'gadget', 'tech'],
  gaming: ['gaming', 'game', 'playstation', 'ps5', 'xbox', 'keyboard', 'gaming keyboard', 'controller', 'console', 'switch'],
  smartphones: ['smartphone', 'smartphones', 'phone', 'mobile', 'iphone', 'android', 'watch', 'smartwatch', 'fitness band'],
  'smart-home': ['smart home', 'camera', 'security', 'purifier', 'echo', 'hue', 'lighting', 'iot'],
  accessories: ['accessories', 'charger', 'dock', 'cable', 'mouse', 'adapter', 'power bank', 'ssd'],
};

// Brand keywords
const BRAND_KEYWORDS = [
  'apple', 'samsung', 'sony', 'lg', 'oneplus', 'realme', 'redmi', 'xiaomi', 'oppo', 'vivo',
  'asus', 'acer', 'dell', 'hp', 'lenovo', 'microsoft', 'google', 'nokia', 'motorola',
  'jbl', 'boat', 'sennheiser', 'bose', 'audio-technica', 'skullcandy', 'philips',
  'canon', 'nikon', 'fujifilm', 'gopro', 'dji',
  'nike', 'adidas', 'puma', 'reebok',
  'logitech', 'razer', 'corsair', 'hyperx', 'steelseries',
  'anker', 'belkin', 'ugreen',
  'bajaj', 'havells', 'prestige', 'whirlpool', 'bosch', 'ifb',
];

// ─── Parser helpers ────────────────────────────────────────────────────────────

function parseNumber(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[,\s]/g, '').toLowerCase();
  if (cleaned.endsWith('k')) {
    const val = parseFloat(cleaned.slice(0, -1));
    return isNaN(val) ? null : Math.round(val * 1000);
  }
  if (cleaned.endsWith('l') || cleaned.endsWith('lakh')) {
    const val = parseFloat(cleaned.replace(/lakh|l/, ''));
    return isNaN(val) ? null : Math.round(val * 100000);
  }
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

function extractBudget(text) {
  const smart = parseSmartSearchQuery(text || '');
  return { min: smart.minPrice, max: smart.maxPrice, approx: smart.approxPrice };
}

function extractMinRating(text) {
  const smart = parseSmartSearchQuery(text || '');
  return smart.minRating;
}

function extractCategory(text) {
  const smart = parseSmartSearchQuery(text || '');
  return smart.category;
}

function extractBrand(text) {
  const smart = parseSmartSearchQuery(text || '');
  return smart.brand;
}

function extractSearchTerm(text) {
  const smart = parseSmartSearchQuery(text || '');
  return smart.searchTerm;
}

function detectIntent(text) {
  const intents = [];
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        intents.push(intent);
        break;
      }
    }
  }
  return intents;
}

// ─── Response generators ──────────────────────────────────────────────────────

function greetingResponse(userName) {
  const name = userName ? `, ${userName.split(' ')[0]}` : '';
  return {
    text: `Hello${name}! I am **TrustCart AI**, your Intelligent Shopping Assistant.\n\nI can help you with:\n• **Natural & Typo-Tolerant Search** (e.g. "Laptops under 60 k", "Best laptops for coding", "5G phones with fast charging")\n• **Feature & Price Filtering** (under/above/between budgets, RAM, battery, ANC, 4K, 165Hz, waterproof)\n• **Side-by-Side Comparison** ("Compare AeroBook 14 and CreatorBook 16" or "Compare top 2")\n• **Product Details & Specs** ("Tell me about Nova Pro 5G")\n• **Active Coupons, Shipping, Returns & Order Tracking**\n• **Cart & Wishlist Actions** (with explicit confirmation before checkout)\n\nWhat are you shopping for today?`,
    suggestions: [
      'Laptops under 60 k',
      'Best laptops for coding',
      '5G phones under 35k with good camera',
      'Active discount coupons',
    ],
    products: [],
    type: 'greeting',
  };
}

function helpResponse() {
  return {
    text: `**TrustCart AI Shopping Assistant Capabilities:**\n\n**1. Smart Natural-Language Search (Price + Features + Typo-Tolerant)**\n• "Laptops under 60 k" or "Best laptos"\n• "5G phones between 20k and 40k"\n• "Headphones with ANC under 8000"\n• "Gaming monitor 165Hz" or "Student laptop with 16GB RAM"\n\n**2. Follow-Up Refinements**\n• Say "under 50k instead", "cheaper ones", "top rated", or "specs of #1" after any search!\n\n**3. Smart Comparisons**\n• "Compare AeroBook 14 and ProBook 15" or "Compare top 2"\n\n**4. Coupons, Orders, Wishlist & Store Policies**\n• "Show discount coupons" · "My wishlist" · "Track my orders"\n• "Shipping & delivery info" · "Return & warranty policy"\n\nType any question or product request naturally!`,
    suggestions: [
      'Laptops under 60 k',
      'Headphones with ANC',
      'Active discount coupons',
      'Shipping & return policy',
    ],
    products: [],
    type: 'help',
  };
}

function getLastAssistantContext(history = []) {
  if (!Array.isArray(history)) return { lastProducts: [], lastFilters: null };
  let lastProducts = [];
  let lastFilters = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg?.role === 'assistant') {
      if (lastProducts.length === 0 && Array.isArray(msg.products) && msg.products.length > 0) {
        lastProducts = msg.products;
      }
      if (!lastFilters && msg.structuredFilters) {
        lastFilters = msg.structuredFilters;
      }
      if (lastProducts.length > 0 && lastFilters) break;
    }
  }
  return { lastProducts, lastFilters };
}

function formatStructuredFiltersForUI(smart, extras = {}) {
  if (!smart) return null;
  return {
    category: extras.category || smart.category || null,
    subTypeKey: extras.subTypeKey || smart.subTypeKey || null,
    brand: smart.brand || null,
    budget: {
      min: smart.minPrice ?? null,
      max: smart.maxPrice ?? null,
      formattedMin: smart.minPrice ? formatINR(smart.minPrice) : null,
      formattedMax: smart.maxPrice ? formatINR(smart.maxPrice) : null,
    },
    requiredSpecs: (smart.features || []).map((f) => f.label || f),
    corrections: smart.corrections || [],
    sortReason: smart.sortReason || null,
    rawQuery: smart.originalQuery || '',
  };
}

function noResultsResponse(query, budget) {
  const budgetNote = budget.max ? ` under ${formatINR(budget.max)}` : budget.min ? ` above ${formatINR(budget.min)}` : '';
  return {
    text: `I could not find products matching "${query}"${budgetNote}.\n\nTry:\n• Broadening your search (e.g. just "headphones" instead of a specific model)\n• Adjusting your budget\n• Browsing by category`,
    suggestions: [
      'Show all products',
      'Browse categories',
      'Popular products',
      'Best rated items',
    ],
    products: [],
    type: 'no_results',
  };
}

function errorResponse() {
  return {
    text: `Something went wrong while searching. Please try again in a moment.\n\nYou can also browse our products page directly.`,
    suggestions: ['Show popular products', 'Browse categories'],
    products: [],
    type: 'error',
  };
}

// ─── Product search orchestrator ───────────────────────────────────────────────

async function searchProducts(params) {
  const { category, search, minPrice, maxPrice, minRating, sortBy = 'ratingDesc', limit = 6 } = params;

  const { data, count, error } = await productsService.getProducts({
    category,
    search,
    minPrice,
    maxPrice,
    minRating,
    inStockOnly: false,
    sortBy,
    page: 1,
    limit,
  });

  if (error) return { products: [], count: 0, error };
  return { products: data || [], count: count || 0, error: null };
}

// ─── Order fetcher ─────────────────────────────────────────────────────────────

async function fetchUserOrders() {
  try {
    const { data, error } = await insforge.database
      .from('orders')
      .select(`
        id, status, order_status, total_amount, created_at,
        order_items(quantity, unit_price, products(name, image))
      `)
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) return null;
    return data || [];
  } catch {
    return null;
  }
}

// ─── Cart Command Helpers (Add / Display / Remove / Clear) ───────────────────

function isDisplayCartCommand(text) {
  const clean = (text || '').trim().toLowerCase();
  if (!clean) return false;
  // Don't match if it's an add or remove command
  if (/\b(?:add|put|remove|delete|clear|empty|drop)\b/i.test(clean)) return false;
  return (
    /^(?:open|show|display|view|check|see|go\s*to)\s+(?:my\s+|the\s+)?(?:shopping\s+)?cart(?:\s+items|\s+page)?$/i.test(clean) ||
    /\b(?:open|show|display|view|check|see|go\s*to)\s+(?:my\s+|the\s+)?(?:shopping\s+)?cart\b/i.test(clean) ||
    /\bwhat(?:'s|\s+is)\s+in\s+(?:my\s+|the\s+)?(?:shopping\s+)?cart\b/i.test(clean) ||
    /^(?:my\s+|the\s+)?(?:shopping\s+)?cart(?:\s+items)?$/i.test(clean) ||
    /\b(?:display|show|view)\s+cart\b/i.test(clean)
  );
}

function isClearCartCommand(text) {
  const clean = (text || '').trim().toLowerCase();
  if (!clean) return false;
  return (
    /\b(?:clear|empty|reset)\s+(?:my\s+|the\s+)?(?:shopping\s+)?cart\b/i.test(clean) ||
    /\b(?:remove|delete)\s+(?:all|everything)(?:\s+items|\s+products)?(?:\s+from\s+(?:my\s+|the\s+)?cart)?\b/i.test(clean)
  );
}

function isRemoveFromCartCommand(text) {
  const clean = (text || '').trim().toLowerCase();
  if (!clean) return false;
  if (/\b(?:wishlist|saved\s+items|account|profile)\b/i.test(clean)) return false;
  return (
    /^(?:remove|delete)(?:\s+(?:it|this|that|item|product|from\s+(?:my\s+|the\s+)?(?:shopping\s+)?cart))?$/i.test(clean) ||
    /\b(?:remove|delete|drop|take\s+out)\b.*?\b(?:cart|tocart|item|product|it|this)\b/i.test(clean) ||
    /^(?:remove|delete)\s+.+/i.test(clean)
  );
}

function isAddToCartCommand(text) {
  const clean = (text || '').trim().toLowerCase();
  if (!clean) return false;
  if (/\b(?:wishlist|saved\s+items)\b/i.test(clean)) return false;
  return (
    /\badd\b.*?\b(?:to\s*)?(?:my\s+|the\s+)?(?:shopping\s+)?cart\b/i.test(clean) ||
    /\badd\s*tocart\b/i.test(clean) ||
    /^(?:add|add\s+this|add\s+it|add\s+item|add\s+product|add\s+to\s*cart|buy\s+this|put\s+in\s+cart)$/i.test(clean) ||
    /\b(?:put|place)\b.*?\bin(?:to)?\s+(?:my\s+|the\s+)?(?:shopping\s+)?cart\b/i.test(clean) ||
    /^(?:add|buy|order|purchase|put|place)\s+(?:the\s+)?(?:first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|[1-5]|#\s*[1-5]|one|two|three|four|five|won)(?:\s+(?:one|item|product|to\s+cart|in\s+cart))?$/i.test(clean) ||
    /^(?:add|buy|order)\s+(?:this|that|it)(?:\s+one)?(?:\s+(?:to\s+cart|in\s+cart))?$/i.test(clean) ||
    /\b(?:add|buy|order)\s+(?:item|product)\s*(?:[1-5]|one|two|three|four|five|won)\b/i.test(clean) ||
    /^(?:add|buy)\s+(?:one|two|three|four|five|won|[1-5])$/i.test(clean) ||
    /^(?:i\s+(?:want|need|take)\s+(?:one|this|the\s+first\s+one))$/i.test(clean)
  );
}

function extractCartTargetKeyword(text, mode = 'add') {
  let cleaned = (text || '')
    .toLowerCase()
    .replace(/\b(?:please|now|for\s+me|right\s+now|quickly)\b/gi, ' ')
    .replace(/\b(?:to\s*cart|tocart|in\s+cart|into\s+cart|from\s+cart)\b/gi, ' ');

  if (mode === 'add') {
    cleaned = cleaned.replace(/\b(?:add|put|place|buy|order|purchase)\b/gi, ' ');
  } else {
    cleaned = cleaned.replace(/\b(?:remove|delete|drop|take\s+out)\b/gi, ' ');
  }

  cleaned = cleaned
    .replace(/\b(?:this|it|that|the|my|a|an|one|won|item|items|product|products|to|from|in|into|shopping|cart)\b/gi, ' ')
    .replace(/\b(?:first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|[1-5]|#\s*[1-5]|one|two|three|four|five|won)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

function parseOrdinalIndex(text) {
  const lower = (text || '').toLowerCase().trim();
  if (!lower) return null;

  // Ordinal 0 (First / 1 / One / Won)
  if (
    /^(?:1|#\s*1|one|won|first|1st)$/i.test(lower) ||
    /\b(?:first|1st|#\s*1|number\s*1|item\s*1|product\s*1|option\s*1|one|won|1)\b/i.test(lower)
  ) return 0;

  // Ordinal 1 (Second / 2 / Two)
  if (
    /^(?:2|#\s*2|two|second|2nd)$/i.test(lower) ||
    /\b(?:second|2nd|#\s*2|number\s*2|item\s*2|product\s*2|option\s*2|two|2)\b/i.test(lower)
  ) return 1;

  // Ordinal 2 (Third / 3 / Three)
  if (
    /^(?:3|#\s*3|three|third|3rd)$/i.test(lower) ||
    /\b(?:third|3rd|#\s*3|number\s*3|item\s*3|product\s*3|option\s*3|three|3)\b/i.test(lower)
  ) return 2;

  // Ordinal 3 (Fourth / 4 / Four)
  if (
    /^(?:4|#\s*4|four|fourth|4th)$/i.test(lower) ||
    /\b(?:fourth|4th|#\s*4|number\s*4|item\s*4|product\s*4|option\s*4|four|4)\b/i.test(lower)
  ) return 3;

  // Ordinal 4 (Fifth / 5 / Five)
  if (
    /^(?:5|#\s*5|five|fifth|5th)$/i.test(lower) ||
    /\b(?:fifth|5th|#\s*5|number\s*5|item\s*5|product\s*5|option\s*5|five|5)\b/i.test(lower)
  ) return 4;

  // Ordinal -1 (Last)
  if (/\b(?:last|last\s+one|final|final\s+one)\b/i.test(lower)) return -1;

  return null;
}

function isItemSelectionOrViewCommand(text) {
  const clean = (text || '').trim().toLowerCase();
  if (!clean) return false;
  if (isAddToCartCommand(clean) || isRemoveFromCartCommand(clean) || isClearCartCommand(clean) || isDisplayCartCommand(clean)) {
    return false;
  }
  // Exclude OnePlus phones search from ordinal interception
  if (/\boneplus\b|\bone\s+plus\b/i.test(clean)) return false;

  // Pure ordinal/number commands: "1", "one", "first", "first one", "#1", "item 1", "product 1", "number 1"
  if (/^(?:the\s+)?(?:first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|[1-5]|#\s*[1-5]|one|two|three|four|five|won)(?:\s+(?:one|item|product))?$/i.test(clean)) {
    return true;
  }
  // Actions + ordinal/number: "open one", "show 1", "view first one", "select 1", "details of one", "click 1"
  if (/^(?:open|show|view|display|select|choose|pick|check|see|go\s*to|tell\s+me\s+about|details\s+(?:of|for)|click)\s+(?:the\s+)?(?:first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|[1-5]|#\s*[1-5]|one|two|three|four|five|won)(?:\s+(?:one|item|product))?$/i.test(clean)) {
    return true;
  }
  // Questions: "what is one", "how much is one", "price of one"
  if (/^(?:what\s+is\s+(?:the\s+)?price\s+of|how\s+much\s+is|price\s+of)\s+(?:the\s+)?(?:first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|[1-5]|#\s*[1-5]|one|two|three|four|five|won)(?:\s+(?:one|item|product))?$/i.test(clean)) {
    return true;
  }
  // "item 1", "product 1", "number 1", "option 1"
  if (/^(?:item|product|number|option)\s*(?:[1-5]|one|two|three|four|five|won)$/i.test(clean)) {
    return true;
  }
  return false;
}

// ─── Main chat engine ─────────────────────────────────────────────────────────

export const aiChatService = {
  /**
   * Process a user message and return an AI-powered response with real product data.
   */
  async sendMessage(message, history = [], userCtx = {}) {
    const text = (message || '').trim();
    if (!text) {
      return helpResponse();
    }

    const intents = detectIntent(text);
    const user = userCtx?.user || null;

    // Direct Cart Commands (Add to cart, Display cart, Remove from cart, Clear cart, Select item)
    if (
      isDisplayCartCommand(text) ||
      isClearCartCommand(text) ||
      isRemoveFromCartCommand(text) ||
      isAddToCartCommand(text) ||
      isItemSelectionOrViewCommand(text) ||
      intents.includes('cart_inquiry')
    ) {
      let lastProducts = userCtx?.lastProducts || [];
      if ((!lastProducts || lastProducts.length === 0) && Array.isArray(history)) {
        for (let i = history.length - 1; i >= 0; i--) {
          if (Array.isArray(history[i]?.products) && history[i].products.length > 0) {
            lastProducts = history[i].products;
            break;
          }
        }
      }

      const voiceRes = await this.processVoiceCommand(text, {
        ...userCtx,
        lastProducts,
      });

      return {
        text: voiceRes.voiceText,
        products: voiceRes.products || [],
        action: voiceRes.action || { type: 'navigate', path: 'cart', label: 'View Shopping Cart' },
        suggestions:
          voiceRes.actionType === 'add_to_cart'
            ? ['Display cart', 'Remove from cart', 'Continue shopping']
            : voiceRes.actionType === 'display_cart'
            ? ['Remove from cart', 'Add to cart', 'Show popular products']
            : ['Display cart', 'Show wireless headphones', 'Show popular products'],
        type: voiceRes.actionType || 'cart_action',
      };
    }

    // Greeting / Politeness / Smalltalk
    if (intents.includes('greeting')) {
      return greetingResponse(user?.name);
    }
    if (/^(?:thanks?|thank\s*you|thx|ty|awesome|great|cool|nice|ok|okay|got\s*it)[\s!.?]*$/i.test(text)) {
      return {
        text: `You're welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Let me know if you want to compare products, filter by budget, check active coupons, or track an order.`,
        suggestions: ['Laptops under 60 k', 'Best rated products', 'Active discount coupons', 'View my cart'],
        products: [],
        type: 'courtesy',
      };
    }
    if (/^(?:bye|goodbye|see\s*you|exit|close)[\s!.?]*$/i.test(text)) {
      return {
        text: `Goodbye! Happy shopping on **TrustCart AI**. I'll be right here whenever you need product advice or comparisons.`,
        suggestions: ['Browse products', 'Show popular products'],
        products: [],
        type: 'courtesy',
      };
    }

    // Help
    if (intents.includes('help') || /\b(?:who\s+are\s+you|what\s+can\s+you\s+do|capabilities)\b/i.test(text)) {
      return helpResponse();
    }

    // Store Policies: Shipping / Delivery / Returns / Warranty / Payment Info
    if (/\b(?:shipping|delivery\s*(?:time|fee|charge|cost|policy)|free\s*shipping|how\s*long.*deliver)\b/i.test(text) && !/\btrack|my\s*order\b/i.test(text)) {
      return {
        text: `🚚 **Shipping & Delivery Information:**\n\n• **Free Express Shipping** on all orders above **₹999** (use code **FREESHIP** above ₹499).\n• **Estimated Delivery:** 2–5 business days across India with doorstep delivery.\n• **Live 6-Stage Tracking:** Order Placed → Confirmed → Packed → Shipped → Out for Delivery → Delivered.\n• You can save multiple delivery addresses and track every order from **My Orders**.`,
        suggestions: ['Track my orders', 'Return & warranty policy', 'Active discount coupons', 'Browse products'],
        products: [],
        type: 'policy_shipping',
        action: { type: 'navigate', path: 'orders', label: 'View My Orders' },
      };
    }

    if (/\b(?:return\s*policy|refund|replacement|warranty|defect|damaged|exchange)\b/i.test(text) && !/\b(?:laptop|phone|headphone|monitor|speaker|camera|watch)\b/i.test(text)) {
      return {
        text: `🛡️ **Returns, Replacements & Warranty Policy:**\n\n• **7-Day Hassle-Free Return/Replacement** on eligible delivered orders via our Defect Detection & Return Portal.\n• **Official Warranty:** 1 Year Manufacturer Warranty across our verified hardware catalog.\n• **How to request a return:** Go to **My Orders → Order Details** and click **Request Return** with photo evidence for fast admin review.`,
        suggestions: ['My recent orders', 'Payment methods', 'Shipping & delivery info', 'Browse products'],
        products: [],
        type: 'policy_returns',
        action: { type: 'navigate', path: 'orders', label: 'Open My Orders' },
      };
    }

    if (/\b(?:payment\s*methods?|how\s*(?:can|to)\s*pay|upi|razorpay|cash\s*on\s*delivery|cod\b|credit\s*card|emi)\b/i.test(text)) {
      return {
        text: `💳 **Supported Payment Methods:**\n\n• **UPI** (Google Pay, PhonePe, Paytm)\n• **Credit & Debit Cards** (Visa, Mastercard, RuPay)\n• **Net Banking** via our secure Razorpay Sandbox Checkout\n• **Cash on Delivery (COD)** on eligible orders\n\nAll checkout totals are strictly verified server-side before payment authorization.`,
        suggestions: ['Active discount coupons', 'View my cart', 'Shipping & delivery info'],
        products: [],
        type: 'policy_payment',
        action: { type: 'navigate', path: 'cart', label: 'Go to Cart' },
      };
    }

    // Active Coupons & Promo Codes
    if (/\b(?:coupon|coupons|promo\s*code|voucher|discount\s*code|active\s*offers?)\b/i.test(text)) {
      const couponLines = INITIAL_COUPONS.map((c) => `• **${c.code}** — ${c.description}`).join('\n');
      const { data: allCatalog } = await productsService.getProducts({ limit: 100 });
      const topDeals = [...(allCatalog || [])].sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0)).slice(0, 4);
      return {
        text: `🏷️ **Active Store Coupons & Promo Codes:**\n\n${couponLines}\n\nPlus, automatic tiered cart discounts (Silver ₹250, Gold ₹750, Platinum ₹2,500) apply automatically in your cart!\n\nHere are our biggest discounted items right now:`,
        suggestions: ['Laptops under 60 k', 'Headphones under 5000', 'View my cart', 'Best rated products'],
        products: topDeals,
        type: 'coupons',
        action: { type: 'navigate', path: 'cart', label: 'Apply Coupon in Cart' },
      };
    }

    // Wishlist Inquiry or Save to Wishlist
    if (intents.includes('wishlist_inquiry') || /\b(?:save|add)\b.*?\b(?:to\s*)?wishlist\b/i.test(text)) {
      const isAddWishlist = /\b(?:save|add)\b.*?\b(?:to\s*)?wishlist\b/i.test(text);
      if (isAddWishlist && typeof userCtx.toggleWishlist === 'function') {
        const { lastProducts } = getLastAssistantContext(history);
        const ord = parseOrdinalIndex(text);
        let targetProd = ord !== null && lastProducts.length > 0 ? (ord === -1 ? lastProducts[lastProducts.length - 1] : lastProducts[ord] || lastProducts[0]) : lastProducts[0];
        if (targetProd) {
          if (!userCtx.isInWishlist || !userCtx.isInWishlist(targetProd.id)) {
            userCtx.toggleWishlist(targetProd);
          }
          return {
            text: `❤️ Saved **${targetProd.name}** (${formatINR(targetProd.price)}) to your Wishlist!`,
            suggestions: ['Show my wishlist', 'Add to cart', 'Continue shopping'],
            products: [targetProd],
            type: 'wishlist_added',
            action: { type: 'navigate', path: 'wishlist', label: 'Open Wishlist' },
          };
        }
      }

      const wishlistItems = Array.isArray(userCtx.wishlistItems) ? userCtx.wishlistItems : [];
      if (wishlistItems.length === 0) {
        return {
          text: `❤️ Your wishlist is currently empty! Browse products or click the ❤️ icon on any card here to save items for later.`,
          suggestions: ['Best rated laptops', '5G phones under 35k', 'Popular products'],
          products: [],
          type: 'wishlist_empty',
          action: { type: 'navigate', path: 'wishlist', label: 'Open Wishlist' },
        };
      }
      return {
        text: `❤️ You have **${wishlistItems.length} saved item${wishlistItems.length !== 1 ? 's' : ''}** in your Wishlist:`,
        suggestions: ['Compare wishlist items', 'View my cart', 'Continue shopping'],
        products: wishlistItems.slice(0, 6),
        type: 'wishlist_items',
        action: { type: 'navigate', path: 'wishlist', label: 'View Full Wishlist' },
      };
    }

    // Order status (checks OrdersContext first, then live InsForge DB)
    if (intents.includes('order_status')) {
      const ctxOrders = Array.isArray(userCtx.orders) ? userCtx.orders : [];
      if (!user && ctxOrders.length === 0) {
        return {
          text: `To check your personal orders and live delivery timeline, please sign in first.`,
          suggestions: ['Browse products', 'Popular items', 'Shipping & delivery info'],
          products: [],
          type: 'auth_required',
          action: { type: 'navigate', path: 'login', label: 'Sign In to View Orders' },
        };
      }

      let orders = ctxOrders;
      if (orders.length === 0 && user) {
        orders = (await fetchUserOrders()) || [];
      }

      if (!orders || orders.length === 0) {
        return {
          text: `You do not have any orders yet${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Ready to discover your first product?`,
          suggestions: ['Laptops under 60 k', 'Popular products', 'Active discount coupons'],
          products: [],
          type: 'orders_empty',
        };
      }

      const orderList = orders
        .slice(0, 3)
        .map((o, i) => {
          const status = String(o.delivery_status || o.status || o.order_status || 'Order Placed').replace(/_/g, ' ').toUpperCase();
          const dateVal = o.created_at || o.date;
          const date = dateVal ? new Date(dateVal).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
          const total = o.total_amount ?? o.pricing?.total ?? 0;
          const itemNames = (o.order_items || o.items || []).map((oi) => oi.products?.name || oi.name).filter(Boolean).slice(0, 2).join(', ');
          return `**#${String(o.id).slice(-8)}** — ${status}\n${date} · ${formatINR(total)}${itemNames ? `\n${itemNames}` : ''}`;
        })
        .join('\n\n');

      return {
        text: `📦 **Your Recent Orders:**\n\n${orderList}\n\nOpen **My Orders** to view live 6-stage delivery timelines and invoices.`,
        suggestions: ['Shipping & delivery info', 'Return & warranty policy', 'Continue shopping'],
        products: [],
        type: 'orders',
        action: { type: 'navigate', path: 'orders', label: 'Track My Orders' },
      };
    }

    // Categories list
    if (intents.includes('categories') && !extractCategory(text) && !extractSearchTerm(text)) {
      const { data: cats } = await productsService.getCategories();
      if (cats && cats.length > 0) {
        const catList = cats.slice(0, 10).map((c) => `• **${c.name}** — ${c.description || ''}`).join('\n');
        return {
          text: `🛍️ **Our 6 Product Departments:**\n\n${catList}\n\nTap a category below or tell me what product and budget you want!`,
          suggestions: ['Laptops under 60 k', '5G Smartphones', 'Audio & Headphones', 'Gaming & Displays'],
          products: [],
          type: 'categories',
          action: { type: 'navigate', path: 'categories', label: 'Explore All Categories' },
        };
      }
    }

    // All products / catalog
    if (intents.includes('all_products') || /^(?:show\s*)?(?:all\s*)?products?$/i.test(text.trim())) {
      try {
        const { products } = await searchProducts({ sortBy: 'ratingDesc', limit: 8 });
        if (products.length > 0) {
          return {
            text: `Here are our top-rated featured products across all 6 categories:`,
            suggestions: ['Laptops under 60 k', '5G phones under 35k', 'ANC headphones', 'Gaming monitors'],
            products,
            type: 'all_products',
            action: { type: 'navigate', path: 'products', label: 'Browse All 60 Products' },
          };
        }
      } catch {
        return errorResponse();
      }
    }

    // ─── Product Details / Specs Q&A ("tell me about AeroBook 14", "specs of #1") ───
    const { lastProducts, lastFilters } = getLastAssistantContext(history);
    if (/^(?:tell\s+me\s+(?:more\s+)?about|details?\s+(?:of|for|about)|specs?\s+(?:of|for)|specifications?\s+(?:of|for)|pros?\s+and\s+cons?\s+(?:of|for)|what\s+is\s+(?:the\s+)?price\s+of|how\s+much\s+is)\s+/i.test(text)) {
      const ord = parseOrdinalIndex(text);
      let targetProd = null;
      if (ord !== null && lastProducts.length > 0) {
        targetProd = ord === -1 ? lastProducts[lastProducts.length - 1] : lastProducts[ord] || lastProducts[0];
      }
      if (!targetProd) {
        const { data: allProds } = await productsService.getProducts({ limit: 100 });
        const cleanedTarget = text.replace(/^(?:tell\s+me\s+(?:more\s+)?about|details?\s+(?:of|for|about)|specs?\s+(?:of|for)|specifications?\s+(?:of|for)|pros?\s+and\s+cons?\s+(?:of|for)|what\s+is\s+(?:the\s+)?price\s+of|how\s+much\s+is)\s+/i, '').trim();
        const { results } = executeSmartSearch(allProds || [], cleanedTarget);
        if (results.length > 0) targetProd = results[0];
      }
      if (targetProd) {
        const stockText = targetProd.stock > 0 ? `In Stock (${targetProd.stock} units)` : 'Out of Stock';
        const discText = targetProd.discountPercent > 0 ? ` (${targetProd.discountPercent}% OFF from ${formatINR(targetProd.originalPrice)})` : '';
        return {
          text: `🔍 **${targetProd.name}** (${targetProd.brand})\n\n• **Price:** ${formatINR(targetProd.price)}${discText}\n• **Rating:** ⭐ ${targetProd.rating}/5 (${targetProd.reviewsCount || 0} reviews)\n• **Availability:** ${stockText}\n• **Category:** ${targetProd.category}\n• **Overview & Verified Specs:** ${targetProd.description}\n• **Warranty:** ${targetProd.specs?.Warranty || '1 Year Official Manufacturer Warranty'}`,
          products: [targetProd],
          suggestions: [
            `Prepare cart with ${targetProd.name.slice(0, 22)}`,
            `More ${targetProd.category}`,
            'Compare with similar options',
          ],
          type: 'product_info',
          action: { type: 'navigate', path: 'product-details', params: { id: targetProd.id }, label: `Open ${targetProd.name}` },
        };
      }
    }

    // ─── Follow-Up Refinement Detection (e.g. "under 50k", "cheaper ones", "top rated ones") ───
    const rawSmart = parseSmartSearchQuery(text);
    const isFollowUpRefinement =
      Boolean(lastFilters) &&
      !rawSmart.category &&
      !rawSmart.subTypeKey &&
      !rawSmart.brand &&
      rawSmart.keywords.length === 0 &&
      (rawSmart.maxPrice !== null ||
        rawSmart.minPrice !== null ||
        rawSmart.sortBy !== 'relevance' ||
        rawSmart.features.length > 0 ||
        /\b(?:cheaper|more\s*affordable|under|below|above|higher|better|top\s*rated|budget|sort\s*by)\b/i.test(text));

    const effectiveQueryText = isFollowUpRefinement
      ? `${lastFilters.subTypeKey || lastFilters.category || lastFilters.rawQuery || ''} ${text}`.trim()
      : text;

    // ─── TrustCart Agent: Structured NLP & Intent Analysis ────────────────────
    const agentFilters = trustCartAgentService.parseShoppingRequest(effectiveQueryText);

    // 1. Comparison Intent Handling
    if (agentFilters.isComparison) {
      let targetProductIds = [];
      const { data: allProds } = await productsService.getProducts({ limit: 100 });
      if (allProds && allProds.length > 0) {
        // Match explicit product names / models mentioned in query
        const lowerText = text.toLowerCase();
        const matches = allProds.filter((p) => {
          const pName = p.name.toLowerCase();
          const pId = String(p.id).toLowerCase();
          if (lowerText.includes(pId) || lowerText.includes(pName)) return true;
          const distinctWords = pName.split(/\s+/).filter((w) => w.length >= 4 && !['laptop', 'smartphone', 'wireless', 'gaming', 'smart', 'monitor', 'headphones'].includes(w));
          return distinctWords.some((w) => lowerText.includes(w));
        });
        if (matches.length >= 2) {
          targetProductIds = matches.slice(0, 3).map((p) => p.id);
        }
      }

      // If user said "compare top 2" / "compare them" / "compare options", use lastProducts!
      if (targetProductIds.length < 2 && lastProducts.length >= 2) {
        targetProductIds = lastProducts.slice(0, 3).map((p) => p.id);
      }

      // If user said "compare popular phones" / "compare laptops", find top 2 in that category!
      if (targetProductIds.length < 2 && (agentFilters.subTypeKey || agentFilters.category)) {
        const { results } = executeSmartSearch(allProds || [], effectiveQueryText);
        if (results.length >= 2) {
          targetProductIds = results.slice(0, 2).map((p) => p.id);
        }
      }

      if (targetProductIds.length >= 2) {
        const comp = await trustCartAgentService.compareProducts(targetProductIds.slice(0, 2));
        if (comp && !comp.error && comp.products) {
          const [p1, p2] = comp.products;
          const textMsg = `⚖️ **TrustCart Product Comparison:**\n\n• **${p1.name}** (${formatINR(p1.price)} · ⭐ ${p1.rating})\nvs\n• **${p2.name}** (${formatINR(p2.price)} · ⭐ ${p2.rating})\n\n**Price Analysis:** ${comp.verdict.priceComparison}\n\n**Verified Highlights:**\n• **${p1.name}:** ${p1.description || p1.processor}\n• **${p2.name}:** ${p2.description || p2.processor}\n\n💡 **TrustCart Verdict:** ${comp.verdict.recommendation}\n\nWant a full weighted score & AI breakdown? Click **Open in AI Compare Products** below!`;
          return {
            text: textMsg,
            products: comp.products,
            comparisonData: comp,
            action: {
              type: 'compare_available',
              products: comp.products,
              label: 'Open in AI Compare Products',
            },
            suggestions: [
              `Prepare cart with ${p1.name.slice(0, 20)}`,
              `Prepare cart with ${p2.name.slice(0, 20)}`,
              'Find other options',
            ],
            type: 'comparison',
          };
        }
      }
    }

    // 2. Prepare Cart with Explicit Customer Confirmation
    if (agentFilters.isPrepareCart) {
      let candidateProduct = null;
      const { data: catProds } = await productsService.getProducts({ limit: 100 });
      if (catProds && catProds.length > 0) {
        candidateProduct = catProds.find((p) => {
          const pName = p.name.toLowerCase();
          return text.toLowerCase().includes(pName) || (p.brand && text.toLowerCase().includes(p.brand.toLowerCase()) && text.toLowerCase().includes((p.name.split(' ')[1] || '').toLowerCase()));
        });
      }

      if (!candidateProduct && lastProducts.length > 0) {
        const ord = parseOrdinalIndex(text);
        candidateProduct = ord !== null ? (ord === -1 ? lastProducts[lastProducts.length - 1] : lastProducts[ord] || lastProducts[0]) : lastProducts[0];
      }

      if (candidateProduct) {
        const prep = trustCartAgentService.prepareCart({ product: candidateProduct, quantity: 1 });
        if (prep && !prep.error) {
          return {
            text: `🛒 **Cart Preparation Staging:**\n\n**Selected Product:** ${prep.preparedItem.name}\n**Price:** ${prep.preparedItem.formattedTotal}\n**Quantity:** 1\n\n🛡️ **Explicit Customer Confirmation Required:**\n${prep.notice}\n\nPlease click **"Confirm & Add to Cart"** below to authorize this item in your shopping cart.`,
            products: [candidateProduct],
            action: {
              type: 'confirm_add_to_cart',
              token: prep.confirmationToken,
              product: candidateProduct,
              label: 'Confirm & Add to Cart',
            },
            preparedCart: prep,
            suggestions: ['Confirm & Add to Cart', 'Cancel', 'Compare alternatives'],
            type: 'cart_prepare',
          };
        }
      }
    }

    // 3. Universal Smart Natural-Language Product Search (Handles Price, Typos, Features, Use-Cases, Brands, Sort)
    const smart = agentFilters._smart || parseSmartSearchQuery(effectiveQueryText);
    const uiFilters = formatStructuredFiltersForUI(smart);

    const isProductQuery =
      Boolean(smart.subTypeKey) ||
      Boolean(smart.category) ||
      Boolean(smart.brand) ||
      smart.maxPrice !== null ||
      smart.minPrice !== null ||
      smart.features.length > 0 ||
      smart.sortBy !== 'relevance' ||
      smart.keywords.length > 0;

    if (isProductQuery) {
      try {
        const rankedResult = await trustCartAgentService.findAndRankProducts(agentFilters);
        const matchedProducts = (rankedResult?.products || []).slice(0, 6);

        if (matchedProducts.length > 0) {
          const top = matchedProducts[0];
          const runnerUp = matchedProducts.length > 1 ? matchedProducts[1] : null;
          const isAgentDetailed =
            agentFilters.requiredSpecs.length > 0 ||
            smart.features.length > 0 ||
            smart.maxPrice !== null ||
            smart.minPrice !== null;

          const typoBanner = smart.corrections?.length > 0
            ? `✨ *Auto-corrected:* ${smart.corrections.map((c) => `"${c.from}" → "${c.to}"`).join(', ')}\n\n`
            : '';

          const targetWord = smart.subTypeKey
            ? `${smart.subTypeKey.replace('_', ' ')}${rankedResult.count > 1 ? 's' : ''}`
            : smart.category
            ? `${smart.category} product${rankedResult.count > 1 ? 's' : ''}`
            : `product${rankedResult.count > 1 ? 's' : ''}`;

          const budgetPhrase =
            smart.minPrice && smart.maxPrice
              ? ` between **${formatINR(smart.minPrice)}** and **${formatINR(smart.maxPrice)}**`
              : smart.maxPrice
              ? ` under **${formatINR(smart.maxPrice)}**`
              : smart.minPrice
              ? ` above **${formatINR(smart.minPrice)}**`
              : '';

          const featurePhrase = smart.features.length > 0
            ? ` matching **${smart.features.map((f) => f.label).join(', ')}**`
            : '';

          let responseText = `${typoBanner}`;
          if (isAgentDetailed) {
            const filtersSummary = [
              smart.subTypeKey ? `Type: ${smart.subTypeKey}` : smart.category ? `Category: ${smart.category}` : null,
              smart.maxPrice ? `Budget: ≤ ${formatINR(smart.maxPrice)}` : null,
              smart.minPrice ? `Min Price: ≥ ${formatINR(smart.minPrice)}` : null,
              smart.features.length > 0 ? `Features: ${smart.features.map((f) => f.label).join(', ')}` : null,
              smart.brand ? `Brand: ${smart.brand}` : null,
              smart.sortReason ? `Sorted: ${smart.sortReason}` : null,
            ].filter(Boolean).join(' • ');

            responseText += `🎯 **Structured Search Filters Applied:**\n[${filtersSummary}]\n\n`;
            responseText += `Found **${rankedResult.count} matching ${targetWord}**${budgetPhrase}${featurePhrase}:\n\n`;
            responseText += `🏆 **Top Match: ${top.name}** (${formatINR(top.price)} · ⭐ ${top.rating})\n`;
            if (top.reasons && top.reasons.length > 0) {
              responseText += `• **Why it fits:** ${top.reasons[0]}\n`;
            }
            if (top.tradeOffs && top.tradeOffs.length > 0) {
              responseText += `• **Trade-off to note:** ${top.tradeOffs[0]}\n`;
            }
            if (runnerUp) {
              responseText += `\n🥈 **Alternative Pick: ${runnerUp.name}** (${formatINR(runnerUp.price)} · ⭐ ${runnerUp.rating})\n`;
              if (runnerUp.reasons && runnerUp.reasons.length > 0) {
                responseText += `• **Why it fits:** ${runnerUp.reasons[0]}\n`;
              }
            }
          } else {
            const sortNote = smart.sortReason ? ` (sorted by ${smart.sortReason})` : '';
            responseText += `Found **${rankedResult.count} ${targetWord}**${budgetPhrase}${featurePhrase}${sortNote}:\n\n`;
            responseText += `🏆 **Top Pick: ${top.name}** — ${formatINR(top.price)} (⭐ ${top.rating})\n${top.description?.slice(0, 120) || ''}`;
          }

          const suggestions = [
            runnerUp ? `Compare ${top.name.slice(0, 18)} and ${runnerUp.name.slice(0, 18)}` : null,
            smart.maxPrice ? `Show cheaper ones` : `Under ${formatINR(Math.max(5000, Math.round((top.price || 30000) * 0.85 / 1000) * 1000))}`,
            `Specs of #1`,
            `Prepare cart with #1`,
          ].filter(Boolean).slice(0, 4);

          return {
            text: responseText,
            products: matchedProducts,
            count: rankedResult.count,
            structuredFilters: uiFilters,
            suggestions,
            type: isAgentDetailed ? 'agent_ranked' : 'search_results',
            action:
              matchedProducts.length >= 2
                ? {
                    type: 'compare_available',
                    products: matchedProducts.slice(0, 3),
                    label: 'Compare Top Matches',
                  }
                : {
                    type: 'navigate',
                    path: 'search',
                    query: { q: effectiveQueryText },
                    label: `View in Search Page`,
                  },
          };
        }

        // Honest Close Alternatives when strict budget/filter returned 0 exact matches!
        if (rankedResult?.closeAlternatives && rankedResult.closeAlternatives.length > 0) {
          const alts = rankedResult.closeAlternatives.slice(0, 6);
          return {
            text: `ℹ️ ${rankedResult.relaxedReason}\n\nHere are the closest options in our catalog:`,
            products: alts,
            count: alts.length,
            structuredFilters: uiFilters,
            suggestions: [
              alts.length >= 2 ? 'Compare top 2' : 'Show all products',
              `Best rated ${smart.subTypeKey || smart.category || 'products'}`,
              'Active discount coupons',
            ],
            type: 'search_alternatives',
            action: {
              type: 'navigate',
              path: 'products',
              query: smart.category ? { category: smart.category } : {},
              label: `Browse ${smart.category || 'Catalog'}`,
            },
          };
        }
      } catch (err) {
        console.warn('[aiChatService] Smart search error:', err.message);
      }
    }

    // Popular products
    if (intents.includes('popular')) {
      try {
        const { products } = await searchProducts({ sortBy: 'ratingDesc', limit: 6 });
        if (products.length > 0) {
          return {
            text: `🔥 **Trending & Most Popular Products:**\n\nHere are our customers' highest-rated favorites right now:`,
            suggestions: ['Laptops under 60 k', '5G phones under 35k', 'ANC headphones', 'Gaming monitors'],
            products,
            type: 'popular',
          };
        }
      } catch {
        return errorResponse();
      }
    }

    // Featured / recommendations
    if (intents.includes('featured')) {
      try {
        const { products } = await searchProducts({ sortBy: 'ratingDesc', minRating: 4.5, limit: 6 });
        if (products.length > 0) {
          return {
            text: `⭐ **Top Rated Products — Recommended for You:**`,
            suggestions: ['Laptops under 60 k', '5G Smartphones', 'ANC headphones', 'Active discount coupons'],
            products,
            type: 'featured',
          };
        }
      } catch {
        return errorResponse();
      }
    }

    // Discount / deals
    if (intents.includes('discount')) {
      try {
        const { data: allProds } = await productsService.getProducts({ limit: 100 });
        const discounted = [...(allProds || [])]
          .filter((p) => p.discountPercent > 0)
          .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0))
          .slice(0, 6);
        if (discounted.length > 0) {
          return {
            text: `🏷️ **Best Deals & Highest Discounts Right Now:**`,
            suggestions: ['Active discount coupons', 'Laptops under 60 k', 'Audio deals', 'Smart home gadgets'],
            products: discounted,
            type: 'deals',
          };
        }
      } catch {
        return errorResponse();
      }
    }

    // Complete helpful fallback (never a dead end)
    return {
      text: `I didn't find an exact match for "${text.slice(0, 60)}", but I can help right away!\n\nTry asking naturally like:\n• **"Laptops under 60 k"** or **"Best laptops for coding"**\n• **"5G phones with 6000mAh battery"**\n• **"ANC headphones under 7000"**\n• **"Compare AeroBook 14 and CreatorBook 16"**\n• **"Active discount coupons"** or **"Shipping & return policy"**`,
      suggestions: ['Laptops under 60 k', 'Best laptops', '5G phones under 35k', 'Active discount coupons'],
      products: [],
      type: 'fallback',
    };
  },

  /**
   * Get quick suggestions for the chatbot
   */
  getQuickSuggestions() {
    return [
      'Find wireless headphones under ₹3000',
      'Show me smartphones between ₹15000 and ₹30000',
      'Best rated laptops',
      'Popular electronics',
      'My recent orders',
    ];
  },

  /**
   * Parse voice speech command and execute shopping action
   * @param {string} transcript - User spoken text
   * @param {Object} context - Optional context: { user, currentProduct, currentPath, addItem }
   */
  async processVoiceCommand(transcript, context = {}) {
    const rawText = (transcript || '').trim();
    const cleanText = rawText.toLowerCase();

    if (!cleanText) {
      return {
        status: 'error',
        actionType: 'none',
        voiceText: 'I did not catch any speech. Please try speaking again.',
        spokenText: 'I did not catch that. Please speak again.',
        products: [],
        command: rawText,
      };
    }

    // 1. "Display cart" / "Open my cart" / "Show my cart" / "View cart" / "What is in my cart"
    if (isDisplayCartCommand(cleanText)) {
      const currentCart =
        (typeof context.getLatestItems === 'function' ? context.getLatestItems() : context.cartItems) || [];

      if (typeof context.onNavigateBackground === 'function') {
        context.onNavigateBackground('cart');
      }

      if (currentCart.length === 0) {
        return {
          status: 'success',
          actionType: 'display_cart',
          isCartView: true,
          action: { type: 'navigate', path: 'cart', label: 'Open Cart Page' },
          voiceText: 'Your shopping cart is currently empty. Say "Add to cart" or search for a product to add items.',
          spokenText: 'Your shopping cart is currently empty.',
          products: [],
          command: rawText,
        };
      }

      const totalUnits = currentCart.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
      const cartSubtotal = currentCart.reduce(
        (acc, item) => acc + Number(item.price || 0) * (Number(item.quantity) || 1),
        0
      );
      const itemsSummary = currentCart
        .slice(0, 4)
        .map((item) => `${item.name} (×${item.quantity || 1})`)
        .join(', ');

      return {
        status: 'success',
        actionType: 'display_cart',
        isCartView: true,
        action: { type: 'navigate', path: 'cart', label: 'Open Full Cart Page' },
        voiceText: `You have ${totalUnits} item${totalUnits !== 1 ? 's' : ''} in your cart (Subtotal: ${formatINR(cartSubtotal)}): ${itemsSummary}.`,
        spokenText: `You have ${totalUnits} ${totalUnits === 1 ? 'item' : 'items'} in your shopping cart totaling ${formatINR(cartSubtotal)}.`,
        products: currentCart,
        command: rawText,
      };
    }

    // 2. "Clear cart" / "Empty cart" / "Remove all from cart"
    if (isClearCartCommand(cleanText)) {
      if (typeof context.clearCart === 'function') {
        try {
          await context.clearCart();
        } catch (e) {
          console.error('[aiChatService] Failed to clear cart:', e);
        }
      }
      if (typeof context.onNavigateBackground === 'function') {
        context.onNavigateBackground('cart');
      }
      return {
        status: 'success',
        actionType: 'remove_from_cart',
        isCartView: true,
        action: { type: 'navigate', path: 'cart', label: 'View Cart' },
        voiceText: 'Cleared all items from your shopping cart.',
        spokenText: 'Cleared all items from your shopping cart.',
        products: [],
        command: rawText,
      };
    }

    // 3. "Remove" / "Remove from cart" / "Remove [product] from cart" / "Delete item"
    if (isRemoveFromCartCommand(cleanText)) {
      const currentCart =
        (typeof context.getLatestItems === 'function' ? context.getLatestItems() : context.cartItems) || [];

      if (currentCart.length === 0) {
        return {
          status: 'success',
          actionType: 'remove_from_cart',
          isCartView: true,
          action: { type: 'navigate', path: 'products', label: 'Browse Products' },
          voiceText: 'Your shopping cart is already empty — there are no items to remove.',
          spokenText: 'Your shopping cart is already empty.',
          products: [],
          command: rawText,
        };
      }

      const ordinalIdx = parseOrdinalIndex(cleanText);
      const targetKeyword = extractCartTargetKeyword(cleanText, 'remove');
      let targetItem = null;

      if (ordinalIdx !== null) {
        targetItem =
          ordinalIdx === -1
            ? currentCart[currentCart.length - 1]
            : currentCart[ordinalIdx] || currentCart[0];
      } else if (targetKeyword.length >= 2) {
        const kwWords = targetKeyword.split(/\s+/).filter((w) => w.length >= 3);
        targetItem = currentCart.find((item) => {
          const itemName = (item.name || '').toLowerCase();
          const itemCat = (item.category || '').toLowerCase();
          return (
            itemName.includes(targetKeyword) ||
            itemCat.includes(targetKeyword) ||
            kwWords.some((w) => itemName.includes(w) || itemCat.includes(w))
          );
        });
      }

      if (!targetItem) {
        const preferred = context.lastAddedProduct || context.currentProduct || context.activeProduct;
        if (preferred?.id) {
          targetItem = currentCart.find(
            (i) => String(i.id || i.productId) === String(preferred.id)
          );
        }
      }

      if (!targetItem) {
        // Default to the most recently added item in the cart
        targetItem = currentCart[currentCart.length - 1];
      }

      let remainingItems = currentCart.filter(
        (i) => String(i.id || i.productId) !== String(targetItem.id || targetItem.productId)
      );

      if (typeof context.removeItem === 'function') {
        try {
          const res = await context.removeItem(targetItem.id || targetItem.productId);
          if (res && Array.isArray(res.items)) {
            remainingItems = res.items;
          }
        } catch (e) {
          console.error('[aiChatService] Failed to remove item from cart:', e);
        }
      }

      const removedName = targetItem.name || targetItem.title || 'Item';
      const remainingUnits = remainingItems.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0);

      return {
        status: 'success',
        actionType: 'remove_from_cart',
        isCartView: true,
        removedProduct: targetItem,
        action: { type: 'navigate', path: 'cart', label: 'View Shopping Cart' },
        voiceText:
          remainingItems.length > 0
            ? `Removed ${removedName} from your shopping cart. You have ${remainingUnits} item${remainingUnits !== 1 ? 's' : ''} remaining in your cart.`
            : `Removed ${removedName} from your shopping cart. Your cart is now empty.`,
        spokenText:
          remainingItems.length > 0
            ? `Removed ${removedName} from your cart.`
            : `Removed ${removedName}. Your cart is now empty.`,
        products: remainingItems,
        command: rawText,
      };
    }

    // 4. "Show my orders" / "Open my orders" / "Track orders"
    if (/^(?:open|show|go\s+to|view|track)\s+(?:my\s+)?orders?$/i.test(cleanText) ||
        /\b(?:show|track)\s+(?:my\s+)?orders?\b/i.test(cleanText)) {
      return {
        status: 'success',
        actionType: 'navigate',
        action: { type: 'navigate', path: 'orders', label: 'View Orders' },
        voiceText: 'Opening your orders page.',
        spokenText: 'Showing your orders.',
        products: [],
        command: rawText,
      };
    }

    // 5. "Open wishlist" / "Show wishlist"
    if (/\b(?:open|show|go\s+to)\s+(?:my\s+)?(?:wishlist|saved\s+items)\b/i.test(cleanText)) {
      return {
        status: 'success',
        actionType: 'navigate',
        action: { type: 'navigate', path: 'wishlist', label: 'View Wishlist' },
        voiceText: 'Opening your wishlist.',
        spokenText: 'Opening your wishlist.',
        products: [],
        command: rawText,
      };
    }

    // 6. "Add this product to my cart" / "Add to cart" / "Add tocart" / "Add [product] to cart" / "Add 1" / "Add one"
    if (isAddToCartCommand(cleanText)) {
      const lastProducts = Array.isArray(context.lastProducts) ? context.lastProducts : [];
      const ordinalIdx = parseOrdinalIndex(cleanText);
      const targetKeyword = extractCartTargetKeyword(cleanText, 'add').replace(
        /\b(?:first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|[1-5]|#\s*[1-5]|one|two|three|four|five|won)\b/gi,
        ''
      ).trim();

      let targetProduct = null;

      // A. Check if user referred to an ordinal item from displayed products ("add first item to cart", "add 1", "add one")
      if (ordinalIdx !== null && lastProducts.length > 0) {
        targetProduct =
          ordinalIdx === -1
            ? lastProducts[lastProducts.length - 1]
            : lastProducts[ordinalIdx] || lastProducts[0];
      }

      // B. Check if user named a specific product ("add wireless headphones to cart", "add laptop to cart")
      if (!targetProduct && targetKeyword.length >= 2) {
        const kwWords = targetKeyword.split(/\s+/).filter((w) => w.length >= 3);
        if (lastProducts.length > 0) {
          targetProduct = lastProducts.find((p) => {
            const pName = (p.name || '').toLowerCase();
            const pBrand = (p.brand || '').toLowerCase();
            const pCat = (p.category || '').toLowerCase();
            return (
              pName.includes(targetKeyword) ||
              pBrand.includes(targetKeyword) ||
              pCat.includes(targetKeyword) ||
              kwWords.some((w) => pName.includes(w) || pBrand.includes(w) || pCat.includes(w))
            );
          });
        }

        if (!targetProduct) {
          const catMatch = extractCategory(targetKeyword);
          const { products: searchMatches } = await searchProducts({
            search: targetKeyword,
            limit: 6,
          });
          if (searchMatches && searchMatches.length > 0) {
            targetProduct = searchMatches.find((p) => Number(p.stock ?? 99) > 0) || searchMatches[0];
          } else if (catMatch) {
            const { products: catMatches } = await searchProducts({
              category: catMatch,
              limit: 6,
            });
            if (catMatches && catMatches.length > 0) {
              targetProduct = catMatches.find((p) => Number(p.stock ?? 99) > 0) || catMatches[0];
            }
          }
        }
      }

      // C. Otherwise use activeProduct (on product-details page) or top product from lastProducts
      if (!targetProduct) {
        targetProduct =
          context.currentProduct ||
          context.activeProduct ||
          (lastProducts.length > 0 ? lastProducts[0] : null);
      }

      // D. Fallback if ordinal item requested but lastProducts was empty: query top catalog items
      if (!targetProduct && ordinalIdx !== null) {
        const { products: featuredProducts } = await searchProducts({
          sortBy: 'ratingDesc',
          limit: 6,
        });
        if (featuredProducts && featuredProducts.length > 0) {
          targetProduct =
            ordinalIdx === -1
              ? featuredProducts[featuredProducts.length - 1]
              : featuredProducts[Math.min(ordinalIdx, featuredProducts.length - 1)] || featuredProducts[0];
        }
      }

      // E. Fallback if user is on Home/Catalog page and says "add to cart" directly: pick top featured in-stock product
      if (!targetProduct) {
        const { products: featuredProducts } = await searchProducts({
          sortBy: 'ratingDesc',
          limit: 6,
        });
        if (featuredProducts && featuredProducts.length > 0) {
          targetProduct =
            featuredProducts.find((p) => Number(p.stock ?? 99) > 0) || featuredProducts[0];
        }
      }

      if (targetProduct && targetProduct.id) {
        let updatedCartItems = [];
        if (typeof context.addItem === 'function') {
          try {
            const addRes = await context.addItem(targetProduct, 1);
            if (addRes && Array.isArray(addRes.items)) {
              updatedCartItems = addRes.items;
            }
          } catch (e) {
            console.error('[aiChatService] Failed to add item to cart:', e);
          }
        }
        if (updatedCartItems.length === 0 && typeof context.getLatestItems === 'function') {
          updatedCartItems = context.getLatestItems() || [];
        }

        const name = targetProduct.name || targetProduct.title || 'Product';
        const totalUnits =
          updatedCartItems.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0) || 1;

        return {
          status: 'success',
          actionType: 'add_to_cart',
          action: { type: 'navigate', path: 'cart', label: 'View Shopping Cart' },
          product: targetProduct,
          products: [targetProduct],
          voiceText: `Added ${name} (${formatINR(targetProduct.price)}) to your shopping cart. You now have ${totalUnits} item${totalUnits !== 1 ? 's' : ''} in your cart.`,
          spokenText: `Added ${name} to your shopping cart.`,
          command: rawText,
        };
      } else {
        return {
          status: 'error',
          actionType: 'none',
          errorReason: 'no_product_selected',
          voiceText: 'Could not find a matching product to add to your cart. Please try specifying a product name.',
          spokenText: 'Could not find a product to add to your cart.',
          products: [],
          command: rawText,
        };
      }
    }

    // 7. "One" / "1" / "First one" / "Item 1" / "Open one" / "Select 1" / "Details of one"
    if (isItemSelectionOrViewCommand(cleanText)) {
      const lastProducts = Array.isArray(context.lastProducts) ? context.lastProducts : [];
      const ordinalIdx = parseOrdinalIndex(cleanText);
      let targetProduct = null;

      // A. Pick from recently displayed products in voice assistant
      if (ordinalIdx !== null && lastProducts.length > 0) {
        targetProduct =
          ordinalIdx === -1
            ? lastProducts[lastProducts.length - 1]
            : lastProducts[ordinalIdx] || lastProducts[0];
      }

      // B. If viewing a product on product details page
      if (!targetProduct && (context.currentProduct || context.activeProduct)) {
        targetProduct = context.currentProduct || context.activeProduct;
      }

      // C. Query top rated products from catalog
      if (!targetProduct) {
        const { products: featured } = await searchProducts({ sortBy: 'ratingDesc', limit: 6 });
        if (featured && featured.length > 0) {
          targetProduct =
            ordinalIdx === -1
              ? featured[featured.length - 1]
              : featured[ordinalIdx !== null ? Math.min(ordinalIdx, featured.length - 1) : 0] || featured[0];
        }
      }

      if (targetProduct && targetProduct.id) {
        const name = targetProduct.name || targetProduct.title || 'Product';
        const numLabel = ordinalIdx !== null && ordinalIdx >= 0 ? `item #${ordinalIdx + 1}` : 'selected product';

        // Check if user specifically asked about price
        if (/\b(?:price|cost|how\s+much)\b/i.test(cleanText)) {
          return {
            status: 'success',
            actionType: 'select_product',
            product: targetProduct,
            products: [targetProduct],
            action: {
              type: 'navigate',
              path: 'product-details',
              params: { id: targetProduct.id },
              query: { id: targetProduct.id },
              label: `View ${name} Details`,
            },
            voiceText: `${name} is priced at ${formatINR(targetProduct.price)}. Say "Add to cart" or tap below to purchase.`,
            spokenText: `${name} is ${formatINR(targetProduct.price)}. Say Add to cart or tap to purchase.`,
            command: rawText,
          };
        }

        return {
          status: 'success',
          actionType: 'select_product',
          product: targetProduct,
          products: [targetProduct],
          action: {
            type: 'navigate',
            path: 'product-details',
            params: { id: targetProduct.id },
            query: { id: targetProduct.id },
            label: `View ${name}`,
          },
          voiceText: `Selected ${numLabel}: ${name} (${formatINR(targetProduct.price)}). Rated ${targetProduct.rating || 4.8}★. Say "Add to cart" to purchase, or tap below to open full details.`,
          spokenText: `Selected ${name} for ${formatINR(targetProduct.price)}. Say Add to cart or tap to view details.`,
          command: rawText,
        };
      }
    }

    // 5. Check if query is explicitly unsupported / non-shopping
    const nonShoppingPatterns = [
      /\b(?:book|call)\s+(?:an?\s+)?(?:uber|taxi|cab|flight|hotel)\b/i,
      /\b(?:play|stream)\s+(?:music|song|spotify|video)\b/i,
      /\b(?:delete|cancel)\s+(?:my\s+)?(?:account|profile)\b/i,
      /\b(?:call|dial|ring)\s+[a-z]+/i,
      /\b(?:weather|temperature|forecast)\b/i,
      /\b(?:tell\s+me\s+a\s+joke|who\s+are\s+you|who\s+made\s+you)\b/i,
      /\b(?:order|deliver)\s+(?:a\s+)?(?:pizza|food|burger)\b/i,
    ];

    for (const pattern of nonShoppingPatterns) {
      if (pattern.test(cleanText)) {
        return {
          status: 'unsupported',
          actionType: 'none',
          voiceText: 'That action is not supported. You can ask me to search products, filter by budget (e.g. "laptops under 60000 rupees"), open your cart or orders, or add a product to your cart.',
          spokenText: 'I cannot perform that command. Please try a supported shopping request.',
          products: [],
          command: rawText,
        };
      }
    }

    // 6. "Show laptops under 60000 rupees" / Budget Search
    const budget = extractBudget(cleanText);
    const category = extractCategory(cleanText);
    const brand = extractBrand(cleanText);
    const minRating = extractMinRating(cleanText);
    const searchTerm = extractSearchTerm(cleanText);

    if (budget.max || budget.min) {
      // Budget filtering
      const isLaptopQuery = /laptop|notebook|macbook|computer/i.test(cleanText);
      const searchTarget = isLaptopQuery ? 'laptop' : searchTerm || category || '';
      
      let queryParams = {
        maxPrice: budget.max,
        minPrice: budget.min,
        minRating,
        limit: 6,
      };

      if (isLaptopQuery) {
        queryParams.search = 'laptop';
      } else if (category) {
        queryParams.category = category;
      } else if (searchTarget) {
        queryParams.search = searchTarget;
      }

      let { products } = await searchProducts(queryParams);

      // If category search was too strict, fallback to search text or general budget
      if (products.length === 0 && searchTarget) {
        const fallback = await searchProducts({ search: searchTarget, maxPrice: budget.max, limit: 6 });
        products = fallback.products;
      }
      if (products.length === 0 && budget.max) {
        const fallback = await searchProducts({ maxPrice: budget.max, limit: 6 });
        products = fallback.products;
      }

      const budgetLabel = budget.max ? `under ${formatINR(budget.max)}` : `above ${formatINR(budget.min)}`;
      const targetLabel = isLaptopQuery ? 'laptops' : searchTarget || 'products';

      if (products.length > 0) {
        return {
          status: 'success',
          actionType: 'show_products',
          action: {
            type: 'navigate',
            path: 'products',
            query: { search: isLaptopQuery ? 'laptop' : searchTarget, maxPrice: budget.max, minPrice: budget.min },
            label: `View ${targetLabel} ${budgetLabel}`,
          },
          voiceText: `Found ${products.length} ${targetLabel} ${budgetLabel}.`,
          spokenText: `Found ${products.length} ${targetLabel} ${budgetLabel}.`,
          products,
          count: products.length,
          command: rawText,
        };
      } else {
        return {
          status: 'success',
          actionType: 'show_products',
          action: null,
          voiceText: `No ${targetLabel} found ${budgetLabel}. Try increasing your budget or adjusting the search term.`,
          spokenText: `No ${targetLabel} found ${budgetLabel}.`,
          products: [],
          count: 0,
          command: rawText,
        };
      }
    }

    // 7. "Show wireless headphones" / Headphones specific intent
    if (/headphone|earphone|earbud|airpod|headset|audio/i.test(cleanText)) {
      let { products } = await searchProducts({ category: 'audio', limit: 6 });
      if (products.length === 0) {
        const fallback = await searchProducts({ search: 'headphones', limit: 6 });
        products = fallback.products;
      }
      return {
        status: 'success',
        actionType: 'show_products',
        action: {
          type: 'navigate',
          path: 'products',
          query: { category: 'audio' },
          label: 'Browse Audio & Headphones',
        },
        voiceText: `Found ${products.length} wireless headphones and audio gear for you.`,
        spokenText: `Found ${products.length} headphones in our audio catalog.`,
        products,
        count: products.length,
        command: rawText,
      };
    }

    // 8. "Search gaming keyboard" / Keyboard specific intent
    if (/keyboard/i.test(cleanText)) {
      let { products } = await searchProducts({ search: 'keyboard', limit: 6 });
      if (products.length === 0) {
        const catRes = await searchProducts({ category: 'gaming', limit: 6 });
        products = catRes.products;
      }
      return {
        status: 'success',
        actionType: 'show_products',
        action: {
          type: 'navigate',
          path: 'search',
          query: { q: 'keyboard' },
          label: 'View Keyboards in Search',
        },
        voiceText: `Found ${products.length} mechanical and gaming keyboards.`,
        spokenText: `Found ${products.length} keyboards.`,
        products,
        count: products.length,
        command: rawText,
      };
    }

    // 9. "Show electronics" / Specific Category
    if (category && (!searchTerm || category === 'electronics')) {
      const { products } = await searchProducts({ category, limit: 6 });
      return {
        status: 'success',
        actionType: 'show_products',
        action: {
          type: 'navigate',
          path: 'products',
          query: { category },
          label: `Browse ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        },
        voiceText: `Showing ${products.length} products in ${category}.`,
        spokenText: `Showing ${category} products.`,
        products,
        count: products.length,
        command: rawText,
      };
    }

    // 10. General Search
    const query = searchTerm || category || brand || cleanText
      .replace(/^(?:show|find|search|display|look\s+for|give\s+me)\s+/i, '')
      .trim();

    if (query.length >= 2) {
      let { products } = await searchProducts({ search: query, limit: 6 });
      
      // If direct search didn't match, check category
      if (products.length === 0 && category) {
        const catRes = await searchProducts({ category, limit: 6 });
        products = catRes.products;
      }

      if (products.length > 0) {
        return {
          status: 'success',
          actionType: 'show_products',
          action: {
            type: 'navigate',
            path: 'products',
            query: { search: query },
            label: `View all results for "${query}"`,
          },
          voiceText: `Found ${products.length} products for "${query}".`,
          spokenText: `Found ${products.length} products for ${query}.`,
          products,
          count: products.length,
          command: rawText,
        };
      } else {
        return {
          status: 'success',
          actionType: 'show_products',
          action: null,
          voiceText: `No products found matching "${query}". Try searching for categories like headphones, laptops, or electronics.`,
          spokenText: `No products found matching ${query}.`,
          products,
          count: 0,
          command: rawText,
        };
      }
    }

    // Fallback unsupported
    return {
      status: 'unsupported',
      actionType: 'none',
      voiceText: 'I could not recognize that command. Try saying "Show wireless headphones", "Show laptops under 60000 rupees", "Open my cart", or "Show electronics".',
      spokenText: 'I did not recognize that command. Please try a shopping request.',
      products: [],
      command: rawText,
    };
  },

  /**
   * Enhanced sendMessage that attempts Gemini AI search first for product queries,
   * then falls back to the full rule-based engine.
   *
   * Called by ChatbotModal when the user submits a message.
   * Falls back to sendMessage (rule-based) automatically if AI is unavailable.
   *
   * @param {string} message - User input
   * @param {Array}  history - Conversation history
   * @param {Object} userCtx - { user, ... }
   */
  async sendMessageEnhanced(message, history = [], userCtx = {}) {
    const text = (message || '').trim();
    if (!text) return helpResponse();

    // Route ALL rich conversational, follow-up, policy, coupon, cart, wishlist, order, compare,
    // product-detail, and natural-language search queries through our upgraded TrustCart engine first
    // so users ALWAYS receive accurate results, reasons, trade-offs, typo auto-correction,
    // follow-up memory, and close alternatives without being truncated by raw /api/ai-search.
    const localResult = await this.sendMessage(message, history, userCtx);
    if (localResult && localResult.type !== 'fallback') {
      return localResult;
    }

    // If local rule-based engine couldn't identify the intent, try server-side /api/ai-search (Gemini LLM)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          message: text,
          context: (history || []).slice(-4).map(h => ({
            role: h.role,
            text: (h.text || '').slice(0, 200)
          }))
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.ok && result.products && result.products.length > 0) {
          const parsedSmart = parseSmartSearchQuery(text);
          return {
            text: result.text || `Found ${result.count || result.products.length} products:`,
            products: result.products,
            count: result.count || result.products.length,
            type: result.type || 'ai_search_results',
            aiPowered: result.aiPowered || false,
            structuredFilters: formatStructuredFiltersForUI(parsedSmart, {
              category: result.filters?.category,
              subTypeKey: result.filters?.subTypeKey
            }),
            suggestions: [
              result.filters?.category ? `Best rated ${result.filters.category}` : 'Browse categories',
              'Compare top 2',
              'Active discount coupons',
              'Show all products'
            ],
            action:
              result.products.length >= 2
                ? { type: 'compare_available', products: result.products.slice(0, 3), label: 'Compare Top Matches' }
                : null
          };
        }
      }
    } catch (fetchErr) {
      if (fetchErr.name !== 'AbortError') {
        console.warn('[aiChatService.sendMessageEnhanced] AI search unavailable:', fetchErr.message);
      }
    }

    return localResult;
  }
};

export default aiChatService;
