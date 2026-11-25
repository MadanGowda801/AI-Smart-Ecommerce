/**
 * AI Smart Product Comparison Engine (Server-Side)
 *
 * Responsibilities:
 * 1. Real-time product fetching & revalidation from InsForge PostgreSQL (with authoritative catalog fallback).
 * 2. Strict factual specification extraction (category-specific, zero invented values, "Not Available" for missing data).
 * 3. Category-specific comparison matrix with difference detection, lowest price, and best value markers.
 * 4. Transparent deterministic weighted scoring (25% Budget, 25% Performance/Specs, 20% User Priorities,
 *    10% Quality/Ratings, 10% Warranty/Reliability, 10% Value for Money) dynamically shaped by user preferences.
 * 5. Secure server-side Gemini 2.0 Flash natural-language recommendation (reusing existing GEMINI_API_KEY)
 *    with a complete deterministic natural-language fallback if external AI is unconfigured or fails.
 */

import {
  MIN_COMPARE_PRODUCTS,
  MAX_COMPARE_PRODUCTS,
  NOT_AVAILABLE_LABEL,
  SUGGESTED_PREFERENCE_OPTIONS,
  DEFAULT_SCORING_WEIGHTS,
  CORE_COMPARISON_ROWS,
  CATEGORY_TECH_ROWS,
  resolveCategoryBucket
} from '../src/compareConstants.js';
import { INITIAL_PRODUCTS, LEGACY_TEST_PRODUCTS } from '../src/mockData.js';

// ── Per-IP Rate Limiter ───────────────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 25;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function checkCompareRateLimit(ip = 'unknown') {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

export function resetCompareRateLimit() {
  rateLimitMap.clear();
}

// ── Sanitization Helpers ──────────────────────────────────────────────────────

export function sanitizeString(val, maxLen = 200) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function formatINR(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return NOT_AVAILABLE_LABEL;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Math.round(num));
}

export function sanitizeProductIds(rawIds) {
  if (!Array.isArray(rawIds)) {
    return { error: 'productIds must be an array of product IDs.' };
  }
  const seen = new Set();
  const cleanIds = [];
  let hadDuplicates = false;

  for (const raw of rawIds) {
    const id = sanitizeString(String(raw ?? ''), 80);
    if (!id) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) {
      hadDuplicates = true;
      continue;
    }
    seen.add(key);
    cleanIds.push(id);
  }

  if (cleanIds.length < MIN_COMPARE_PRODUCTS) {
    return {
      error: `Please select at least ${MIN_COMPARE_PRODUCTS} unique products to compare.`,
      code: 'MIN_PRODUCTS_REQUIRED'
    };
  }
  if (cleanIds.length > MAX_COMPARE_PRODUCTS) {
    return {
      error: `You can compare a maximum of ${MAX_COMPARE_PRODUCTS} products at once.`,
      code: 'MAX_PRODUCTS_EXCEEDED'
    };
  }

  return { ids: cleanIds, hadDuplicates };
}

// ── 1. Real-Time Product Data Retrieval & Revalidation ────────────────────────

function normalizeRawRecord(raw, source = 'insforge_live') {
  if (!raw || !raw.id) return null;

  const price = Number(raw.price);
  const validPrice = Number.isFinite(price) && price > 0 ? Math.round(price) : null;

  const discountRaw = raw.discount ?? raw.discountPercent ?? raw.discount_percent;
  const discountPercent = Number.isFinite(Number(discountRaw)) && Number(discountRaw) > 0
    ? Math.round(Number(discountRaw))
    : 0;

  let originalPrice = Number(raw.originalPrice ?? raw.original_price);
  if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
    if (validPrice && discountPercent > 0 && discountPercent < 100) {
      originalPrice = Math.round(validPrice / (1 - discountPercent / 100));
    } else {
      originalPrice = validPrice;
    }
  }

  const stockRaw = raw.stock;
  const stock = stockRaw !== undefined && stockRaw !== null && Number.isFinite(Number(stockRaw))
    ? Math.max(0, Math.floor(Number(stockRaw)))
    : null;

  const ratingRaw = raw.rating;
  const rating = ratingRaw !== undefined && ratingRaw !== null && Number.isFinite(Number(ratingRaw)) && Number(ratingRaw) > 0
    ? Math.min(5, Math.max(0, Number(Number(ratingRaw).toFixed(1))))
    : null;

  const reviewsRaw = raw.review_count ?? raw.reviewsCount;
  const reviewsCount = reviewsRaw !== undefined && reviewsRaw !== null && Number.isFinite(Number(reviewsRaw))
    ? Math.max(0, Math.floor(Number(reviewsRaw)))
    : null;

  const category = raw.categories?.name || raw.category || NOT_AVAILABLE_LABEL;
  const categorySlug =
    raw.categories?.slug ||
    raw.categorySlug ||
    String(category).toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const primaryImage =
    raw.image ||
    raw.image_url ||
    (Array.isArray(raw.images) && raw.images[0]) ||
    null;

  const normalized = {
    id: String(raw.id),
    name: sanitizeString(raw.name || '', 180) || 'Unnamed Product',
    brand: sanitizeString(raw.brand || '', 80) || NOT_AVAILABLE_LABEL,
    category,
    categorySlug,
    price: validPrice,
    originalPrice,
    discountPercent,
    stock,
    inStock: stock !== null ? stock > 0 : null,
    rating,
    reviewsCount,
    image: primaryImage,
    description: sanitizeString(raw.description || '', 1000),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => sanitizeString(String(t), 60)).filter(Boolean) : [],
    rawSpecs: (raw.specifications && typeof raw.specifications === 'object')
      ? raw.specifications
      : (raw.specs && typeof raw.specs === 'object')
      ? raw.specs
      : {},
    warrantyTerms: sanitizeString(raw.warranty_terms || raw.warranty || '', 140),
    dataSource: source
  };

  normalized.categoryBucket = resolveCategoryBucket(normalized);
  return normalized;
}

export async function fetchLiveProductsByIds(admin, productIds) {
  const fetchedAt = new Date().toISOString();
  const catalogIndex = new Map();
  for (const item of [...INITIAL_PRODUCTS, ...(LEGACY_TEST_PRODUCTS || [])]) {
    catalogIndex.set(String(item.id).toLowerCase(), item);
  }

  const liveMap = new Map();
  let dbAttempted = false;
  let dbError = null;

  if (admin) {
    dbAttempted = true;
    try {
      const uuidIds = productIds.filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );
      const nonUuidIds = productIds.filter((id) => !uuidIds.includes(id));

      // Query matching UUIDs from InsForge products table
      if (uuidIds.length > 0) {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout')), 3500)
        );
        const queryPromise = admin.database
          .from('products')
          .select('*, categories(id, name, slug)')
          .in('id', uuidIds);

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        if (error) {
          dbError = error.message;
        } else if (Array.isArray(data)) {
          for (const row of data) {
            liveMap.set(String(row.id).toLowerCase(), normalizeRawRecord(row, 'insforge_live'));
          }
        }
      }

      // Also check if any non-UUID catalog IDs have live overrides by slug/name in InsForge DB
      if (nonUuidIds.length > 0) {
        const catalogNames = nonUuidIds
          .map((id) => catalogIndex.get(id.toLowerCase())?.name)
          .filter(Boolean);
        if (catalogNames.length > 0) {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database query timeout')), 2500)
          );
          const queryPromise = admin.database
            .from('products')
            .select('*, categories(id, name, slug)')
            .in('name', catalogNames);

          const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
          if (!error && Array.isArray(data)) {
            for (const row of data) {
              const matchedCatId = nonUuidIds.find(
                (cid) => catalogIndex.get(cid.toLowerCase())?.name?.toLowerCase() === String(row.name || '').toLowerCase()
              );
              if (matchedCatId) {
                const liveRec = normalizeRawRecord({ ...row, id: matchedCatId }, 'insforge_live');
                liveMap.set(matchedCatId.toLowerCase(), liveRec);
              }
            }
          }
        }
      }
    } catch (err) {
      dbError = err.message || 'Database connection unavailable';
    }
  }

  const resolvedProducts = [];
  const invalidIds = [];

  for (const id of productIds) {
    const key = id.toLowerCase();
    if (liveMap.has(key)) {
      resolvedProducts.push(liveMap.get(key));
    } else if (catalogIndex.has(key)) {
      resolvedProducts.push(normalizeRawRecord(catalogIndex.get(key), 'verified_catalog'));
    } else {
      invalidIds.push(id);
    }
  }

  const liveCount = resolvedProducts.filter((p) => p.dataSource === 'insforge_live').length;
  const dataSource =
    liveCount === resolvedProducts.length && liveCount > 0
      ? 'insforge_live'
      : liveCount > 0
      ? 'hybrid'
      : 'verified_catalog';

  return {
    products: resolvedProducts,
    invalidIds,
    fetchedAt,
    dataSource,
    dbAttempted,
    dbError
  };
}

// ── 2. Strict Factual Specification Extractor (Zero Hallucinations) ───────────

function isPlaceholderSpec(val) {
  if (val === undefined || val === null) return true;
  const s = String(val).trim();
  if (!s) return true;
  return /^(standard\s+\w+|integrated\s+processor|n\/a|na|none|unknown|not\s+available|tbd|-)$/i.test(s);
}

function readRawSpec(rawSpecs, keys = []) {
  if (!rawSpecs || typeof rawSpecs !== 'object') return null;
  const entries = Object.entries(rawSpecs);
  for (const targetKey of keys) {
    const found = entries.find(([k]) => k.toLowerCase() === targetKey.toLowerCase());
    if (found && !isPlaceholderSpec(found[1])) {
      return sanitizeString(String(found[1]), 140);
    }
  }
  return null;
}

function extractFirstMatch(text, regexes) {
  for (const regex of regexes) {
    const m = text.match(regex);
    if (m && m[0]) {
      return sanitizeString(m[0], 100);
    }
  }
  return null;
}

function extractAllMatches(text, regexes) {
  const found = [];
  for (const regex of regexes) {
    const m = text.match(regex);
    if (m && m[0]) {
      const cleaned = sanitizeString(m[0], 80);
      if (cleaned && !found.some((x) => x.toLowerCase() === cleaned.toLowerCase())) {
        found.push(cleaned);
      }
    }
  }
  return found.length > 0 ? found.join(', ') : null;
}

/**
 * Extracts ONLY factual specifications verified from the product's database record
 * (structured `specs`/`specifications` + factual product `name`/`description`).
 * Missing attributes are strictly set to `null` (rendered as "Not Available").
 */
export function extractVerifiedSpecs(product) {
  const raw = product.rawSpecs || {};
  const text = `${product.name || ''}. ${product.description || ''}`;

  // Processor / Chipset
  const processor =
    readRawSpec(raw, ['Processor', 'Chipset', 'CPU', 'processor', 'chipset']) ||
    extractFirstMatch(text, [
      /Snapdragon\s+[A-Za-z0-9\-\+\s]{2,22}(?=\s+(?:processor|chipset|soc)|[,.;]|$)/i,
      /Apple\s+M[1-5](?:\s+(?:Pro|Max|Ultra))?/i,
      /\bM[1-5]\s+(?:Pro|Max|Ultra)\b/i,
      /\bM[1-5]\b(?=\s*\(|\s*chip)/i,
      /Intel\s+Core\s+(?:i[3579]|Ultra\s*[579])[A-Za-z0-9\-]*/i,
      /AMD\s+Ryzen\s+[3579]\s*[A-Za-z0-9\-]*/i,
      /MediaTek\s+Dimensity\s+[A-Za-z0-9\+\s]{2,15}/i,
      /Dimensity\s+\d{3,4}[A-Za-z\+]*/i,
      /Exynos\s+\d{3,4}/i,
      /Google\s+Tensor\s+G\d/i,
      /Swiss\s+precision\s+chip/i
    ]);

  // RAM
  const ram =
    readRawSpec(raw, ['RAM', 'Memory', 'ram', 'memory']) ||
    extractFirstMatch(text, [
      /\b(?:4|6|8|12|16|24|32|64)\s*GB(?:\s*(?:DDR[45]X?|LPDDR[45]X?))?\s*(?:RAM|memory)\b/i,
      /\b(?:4|6|8|12|16|24|32|64)\s*GB\s*DDR[45]X?\b/i
    ]);

  // Storage
  const storage =
    readRawSpec(raw, ['Internal Storage', 'Storage', 'ROM', 'storage', 'ssd']) ||
    extractFirstMatch(text, [
      /\b(?:64|128|256|512)\s*GB(?:\s*(?:NVMe\s*SSD|UFS\s*\d(?:\.\d)?|SSD|storage|ROM))?\b(?=\s*(?:NVMe|UFS|SSD|storage|ROM|,|\.|\)|$))/i,
      /\b[1-8]\s*TB(?:\s*(?:NVMe(?:\s*portable)?\s*SSD|SSD|HDD|storage))?/i,
      /\bSSD\s+storage\b/i
    ]);

  // Display size
  const displaySize =
    readRawSpec(raw, ['Display Size', 'Screen Size', 'display_size']) ||
    extractFirstMatch(text, [
      /\b\d{1,2}(?:\.\d{1,2})?[\-\s]?(?:inch|inches|")\b/i
    ]);

  // Display Resolution / Panel
  const displayResolution =
    readRawSpec(raw, ['Display Resolution', 'Resolution', 'Display', 'display', 'resolution']) ||
    extractAllMatches(text, [
      /\b4K\s*UHD(?:\s*\(3840x2160\))?/i,
      /\b3\.2K\b/i,
      /\b2K\s*QHD\b/i,
      /\bQHD(?:\s*\(2560x1440\))?/i,
      /\bFull\s*HD\s*1080p\b|\bFHD\+\b|\bFull\s*HD\b|\b1080p\b|\bHD\b(?=\s*(?:wireless|touch|video))/i,
      /\bLTPO\s*curved\s*display\b|\bSuper\s*AMOLED\b|\bAMOLED\b|\bOLED\b|\bFast\s*IPS\b|\bIPS(?:\s*anti-glare)?\b|\bHDR10\+?\b|\bDisplayHDR\s*600\b|\bE-ink\b/i
    ]);

  // Refresh Rate
  const refreshRate =
    readRawSpec(raw, ['Refresh Rate', 'refresh_rate', 'refreshRate']) ||
    extractFirstMatch(text, [
      /\b(?:60|75|90|120|144|165|240|360)\s*Hz\b/i,
      /\b60\s*fps\b/i
    ]);

  // Battery Capacity / Life
  const batteryCapacity =
    readRawSpec(raw, ['Battery Capacity', 'Battery', 'Battery Life', 'battery']) ||
    extractFirstMatch(text, [
      /\b\d{4,5}\s*mAh(?:\s*(?:marathon|battery))?/i,
      /\b\d{1,2}[\-\s]?(?:hour|hr|hours|hrs)(?:\s*(?:all-day|total|non-stop))?(?:\s*(?:battery(?:\s*life)?|playback|music\s*playback))?/i,
      /\b\d{1,2}[\-\s]?day(?:\s*battery)?/i,
      /\b\d[\-\s]?month(?:\s*rechargeable\s*battery)?/i,
      /\breplaceable\s+CR2032\s+battery\b/i,
      /\ball-day\s+adaptive\s+battery\b/i
    ]);

  // Charging Speed / Power Output
  const chargingSpeed =
    readRawSpec(raw, ['Charging Speed', 'Charging', 'Power Output', 'charging']) ||
    extractFirstMatch(text, [
      /\b\d{1,3}(?:\.\d)?W(?:\s*(?:GaN|PD|turbo|two-way|fast|Qi2|magnetic|wireless|power\s*delivery))?(?:\s*(?:fast\s*)?(?:charging|charger|pass-through|power\s*delivery))?/i,
      /\bfast\s+USB-C\s+PD\s+charging\b/i,
      /\bwireless\s+charging\s+case\b/i
    ]);

  // Camera Specifications
  const camera =
    readRawSpec(raw, ['Camera', 'Camera Specifications', 'camera']) ||
    extractAllMatches(text, [
      /\btriple\s+\d+MP\s+[a-z\-\s]*cameras?\b/i,
      /\b\d{2,3}MP(?:\s*OIS)?(?:\s*main)?\s*camera\b/i,
      /\bAI\s+computational\s+photography\b/i,
      /\bNight\s+Sight\s+mode\b/i,
      /\b2K\s*QHD\s*indoor\s*Wi-Fi\s*security\s*camera\b/i,
      /\b1080p\s*60fps\s*streaming\s*webcam\b/i,
      /\bpop-up\s+privacy\s+webcam\b/i,
      /\bfull-color\s+spotlight\s+night\s+vision\b/i,
      /\binfrared\s+night\s+vision\b/i
    ]);

  // Operating System
  const operatingSystem =
    readRawSpec(raw, ['Operating System', 'OS', 'os']) ||
    extractFirstMatch(text, [
      /\bClean\s+Android\b/i,
      /\bAndroid\s*\d*\b/i,
      /\bWindows\s*1[01]\b/i,
      /\bmacOS\b/i,
      /\biOS\s*\d*\b/i
    ]);

  // Connectivity
  const connectivity =
    readRawSpec(raw, ['Connectivity', 'Ports', 'connectivity']) ||
    extractAllMatches(text, [
      /\b5G\b/i,
      /\b4G\b/i,
      /\beSIM\s*LTE\b/i,
      /\bWi-Fi\s*6E\b|\bWi-Fi\s*6\b|\bdual-antenna\s+Wi-Fi\b|\bWi-Fi\b/i,
      /\bBluetooth\s*5\.\d\b|\bBluetooth(?:\s+calling)?\b/i,
      /\bThunderbolt\s*4\b/i,
      /\bHDMI\s*2\.1\b|\bHDMI\s*eARC\b|\b4K\s*60Hz\s*HDMI\b|\bHDMI\/DP\b|\bHDMI\b/i,
      /\bUSB-C(?:\s*PD)?\b|\bUSB\s*3\.[02]\b|\bUSB-A\b/i,
      /\b2\.4GHz(?:\s*HyperSpeed)?\b|\btri-mode\s+Bluetooth\/2\.4G\/USB-C\b/i,
      /\bdual\s+LAN\b/i,
      /\bOptical\b/i,
      /\bmulti-band\s+GPS\b|\bGPS\b/i
    ]);

  // Weight
  const weight =
    readRawSpec(raw, ['Weight', 'weight']) ||
    extractFirstMatch(text, [
      /\b\d(?:\.\d{1,2})?\s*kg\b/i,
      /\b\d{2,4}\s*g\b(?!\s*hz|\s*b)/i
    ]);

  // Warranty (strictly from warranty_terms or specs.Warranty)
  const warranty =
    (product.warrantyTerms && !isPlaceholderSpec(product.warrantyTerms) ? product.warrantyTerms : null) ||
    readRawSpec(raw, ['Warranty', 'warranty', 'Warranty Terms']) ||
    null;

  // Audio-specific verified fields
  const audioDrivers =
    readRawSpec(raw, ['Drivers', 'Audio Output', 'Driver Size']) ||
    extractAllMatches(text, [
      /\b\d{2}mm\s+(?:dynamic|beryllium|neodymium|custom-tuned)?\s*drivers?\b/i,
      /\b\d{2,3}W(?:\s*RMS)?(?:\s*2\.1\s*Channel)?\b/i,
      /\bDolby\s+Digital\b/i,
      /\bLDAC\s+Hi-Res\s+audio\b/i,
      /\b3D\s+spatial\s+(?:surround\s+)?sound\b|\bspatial\s+3D\s+sound\b|\bVirtual\s+7\.1\s+surround\s+sound\b/i
    ]);

  const noiseCancellation =
    readRawSpec(raw, ['Noise Cancellation', 'ANC']) ||
    extractFirstMatch(text, [
      /\b\d{2}dB\s+hybrid\s+Active\s+Noise\s+Cancelling\b/i,
      /\bActive\s+Noise\s+Cancell(?:ing|ation)\b|\bANC\b/i,
      /\bquad-mic\s+ENC\b/i,
      /\bflip-to-mute\s+noise-cancelling\s+boom\s+microphone\b/i,
      /\bAI\s+noise-cancelling\s+mic\b/i
    ]);

  const microphone =
    readRawSpec(raw, ['Microphone', 'Mic']) ||
    extractFirstMatch(text, [
      /\bquad-mic\s+ENC\b/i,
      /\bflip-to-mute\s+noise-cancelling\s+boom\s+microphone\b/i,
      /\bdetachable\s+AI\s+noise-cancelling\s+mic\b/i,
      /\bBroadcast-grade\s+mic\b/i,
      /\bcardioid\s+pickup\s+pattern\b/i,
      /\bdual\s+stereo\s+mics\b/i
    ]);

  // Water / Dust Resistance
  const waterResistance =
    readRawSpec(raw, ['Water Resistance', 'IP Rating']) ||
    extractFirstMatch(text, [
      /\bIP(?:X?[4-8]|[56][4-9])\s*(?:water(?:proof|\s*resistance)?|sweat\s*resistance|weatherproof|rating)?\b/i,
      /\b5ATM\s+swim\s+resistance\b/i,
      /\bwater-repellent\b/i,
      /\bdust\/waterproof\b/i
    ]);

  // Health Sensors (wearables)
  const healthSensors =
    readRawSpec(raw, ['Sensors', 'Health Sensors']) ||
    extractAllMatches(text, [
      /\b24\/7\s+heart-rate\s*&\s*SpO2\b/i,
      /\bECG\s*&\s*blood\s+pressure\s+insights\b/i,
      /\bsleep\s+(?:stage\s+tracking|recovery)\b/i,
      /\bskin\s+temperature\b/i,
      /\bHRV\b/i,
      /\b120\+\s+workout\s+modes\b/i
    ]);

  // Smart Home fields
  const voiceAssistant =
    readRawSpec(raw, ['Voice Assistant']) ||
    extractAllMatches(text, [
      /\bAlexa\s*&\s*Google\s+Home\b/i,
      /\bfar-field\s+voice\s+assistant\b/i,
      /\bvoice\s+control\b/i
    ]);

  const powerRating =
    readRawSpec(raw, ['Power Rating', 'Wattage']) ||
    extractFirstMatch(text, [
      /\b16A\b/i,
      /\b\d{1,3}W\b/i
    ]);

  const smartFeatures =
    readRawSpec(raw, ['Smart Features', 'Automation']) ||
    extractAllMatches(text, [
      /\b16\s+Million\s+RGBW\b/i,
      /\breal-time\s+energy\s+consumption\s+monitoring\b/i,
      /\b360°\s*pan-tilt\b/i,
      /\bAI\s+human\/pet\s+tracking\b/i,
      /\bPIR\s+(?:parcel\s+detection|smart\s+motion)\b/i,
      /\bsunrise\/sunset\s+scheduling\b|\bprogrammable\s+sunrise\s+schedules\b/i,
      /\bprivacy\s+shutter\b/i
    ]);

  // Accessories / Build
  const buildMaterial =
    readRawSpec(raw, ['Build Material', 'Material']) ||
    extractFirstMatch(text, [
      /\baerospace-grade\s+titanium\b|\btitanium(?:\s+hinge)?\b/i,
      /\bsapphire\s+crystal\s+titanium\b/i,
      /\baircraft-grade\s+aluminium\b|\banodized\s+aluminium\b|\bprecision-milled\s+aluminium\b|\baluminium\b/i,
      /\bshockproof\s+memory\s+foam\b/i,
      /\bbraided\s+nylon\b/i,
      /\bPBT\s+keycaps\b/i
    ]);

  // Gaming response / DPI
  const responseTime =
    readRawSpec(raw, ['Response Time', 'DPI', 'Sensor']) ||
    extractAllMatches(text, [
      /\b1ms\s*(?:GtG|MPRT)\b/i,
      /\b26,000\s*DPI\s*optical\s*sensor\b|\b4000\s*DPI\s*optical\s*sensor\b/i,
      /\bHall-effect\s+drift-free\s+thumbstick\b/i,
      /\blinear\s+optical\s+switches\b|\btactile\s+brown\s+switches\b/i,
      /\bzero-lag\s+4K60\s+HDR\s+pass-through\b/i
    ]);

  // Category-specific notable extras from description/tags (strictly factual)
  const additionalMatches = extractAllMatches(text, [
    /\bdedicated\s+ray-tracing\s+graphics\b/i,
    /\b100%\s*DCI-P3\b|\b99%\s*sRGB\b/i,
    /\b360-degree\s+convertible\s+touchscreen\b/i,
    /\bmagnetic\s+active\s+stylus\s+support\b/i,
    /\btriple\s+4K\s+display\s+output\b/i,
    /\b1050MB\/s\s+read\/write\b/i,
    /\bvapor\s+chamber\s+cooling\b/i,
    /\bAMD\s+FreeSync\s+Premium\b/i,
    /\bG-Sync\s+compatibility\b/i,
    /\bhot-swappable\b/i,
    /\b7-in-1\s+USB-C\s+multiport\b/i,
    /\b90dB\s+loud\s+chime\b/i,
    /\bSOS\s+emergency\s+button\b/i,
    /\b7\s+height\s+levels\b/i,
    /\bgame\s+audio\s+reactivity\b/i
  ]);

  const availabilityDisplay =
    product.stock === null
      ? NOT_AVAILABLE_LABEL
      : product.stock <= 0
      ? 'Out of Stock'
      : product.stock <= 5
      ? `Low Stock (${product.stock} left)`
      : `In Stock (${product.stock} units)`;

  return {
    brand: product.brand || NOT_AVAILABLE_LABEL,
    id: product.id,
    category: product.category || NOT_AVAILABLE_LABEL,
    priceFormatted: formatINR(product.price),
    originalPriceFormatted: formatINR(product.originalPrice),
    discountDisplay: product.discountPercent > 0 ? `${product.discountPercent}% OFF` : NOT_AVAILABLE_LABEL,
    availabilityDisplay,
    ratingDisplay: product.rating !== null ? `${product.rating.toFixed(1)} / 5.0` : NOT_AVAILABLE_LABEL,
    reviewsDisplay: product.reviewsCount !== null ? `${product.reviewsCount.toLocaleString('en-IN')} reviews` : NOT_AVAILABLE_LABEL,
    warranty: warranty || NOT_AVAILABLE_LABEL,
    processor: processor || NOT_AVAILABLE_LABEL,
    ram: ram || NOT_AVAILABLE_LABEL,
    storage: storage || NOT_AVAILABLE_LABEL,
    displaySize: displaySize || NOT_AVAILABLE_LABEL,
    displayResolution: displayResolution || NOT_AVAILABLE_LABEL,
    refreshRate: refreshRate || NOT_AVAILABLE_LABEL,
    batteryCapacity: batteryCapacity || NOT_AVAILABLE_LABEL,
    chargingSpeed: chargingSpeed || NOT_AVAILABLE_LABEL,
    camera: camera || NOT_AVAILABLE_LABEL,
    operatingSystem: operatingSystem || NOT_AVAILABLE_LABEL,
    connectivity: connectivity || NOT_AVAILABLE_LABEL,
    weight: weight || NOT_AVAILABLE_LABEL,
    audioDrivers: audioDrivers || NOT_AVAILABLE_LABEL,
    noiseCancellation: noiseCancellation || NOT_AVAILABLE_LABEL,
    microphone: microphone || NOT_AVAILABLE_LABEL,
    waterResistance: waterResistance || NOT_AVAILABLE_LABEL,
    healthSensors: healthSensors || NOT_AVAILABLE_LABEL,
    voiceAssistant: voiceAssistant || NOT_AVAILABLE_LABEL,
    powerRating: powerRating || NOT_AVAILABLE_LABEL,
    smartFeatures: smartFeatures || NOT_AVAILABLE_LABEL,
    buildMaterial: buildMaterial || NOT_AVAILABLE_LABEL,
    responseTime: responseTime || NOT_AVAILABLE_LABEL,
    additionalSpecs: additionalMatches || NOT_AVAILABLE_LABEL
  };
}

// ── 3. Numeric Parsers (Used Strictly on Verified Extracted Specs) ────────────

function parseGbValue(str) {
  if (!str || str === NOT_AVAILABLE_LABEL) return null;
  const tbMatch = String(str).match(/(\d+(?:\.\d+)?)\s*TB/i);
  if (tbMatch) return parseFloat(tbMatch[1]) * 1024;
  const gbMatch = String(str).match(/(\d+(?:\.\d+)?)\s*GB/i);
  if (gbMatch) return parseFloat(gbMatch[1]);
  return null;
}

function parseRefreshHz(str) {
  if (!str || str === NOT_AVAILABLE_LABEL) return null;
  const m = String(str).match(/(\d{2,3})\s*Hz/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseBatteryScoreUnit(str) {
  if (!str || str === NOT_AVAILABLE_LABEL) return null;
  const s = String(str);
  const mah = s.match(/(\d{3,5})\s*mAh/i);
  if (mah) return { type: 'mah', value: parseInt(mah[1], 10) };
  const hrs = s.match(/(\d{1,3})\s*(?:-|\s)?(?:hour|hr)/i);
  if (hrs) return { type: 'hours', value: parseInt(hrs[1], 10) };
  const days = s.match(/(\d{1,2})\s*(?:-|\s)?day/i);
  if (days) return { type: 'days', value: parseInt(days[1], 10) };
  const months = s.match(/(\d{1,2})\s*(?:-|\s)?month/i);
  if (months) return { type: 'days', value: parseInt(months[1], 10) * 30 };
  return null;
}

function parseWattValue(str) {
  if (!str || str === NOT_AVAILABLE_LABEL) return null;
  const m = String(str).match(/(\d{1,3}(?:\.\d)?)\s*W/i);
  return m ? parseFloat(m[1]) : null;
}

function parseDisplayInches(str) {
  if (!str || str === NOT_AVAILABLE_LABEL) return null;
  const m = String(str).match(/(\d{1,2}(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1]) : null;
}

function parseCameraMp(str) {
  if (!str || str === NOT_AVAILABLE_LABEL) return null;
  const m = String(str).match(/(\d{2,3})\s*MP/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseWarrantyMonths(str) {
  if (!str || str === NOT_AVAILABLE_LABEL) return null;
  const yr = String(str).match(/(\d+)\s*(?:year|yr)/i);
  if (yr) return parseInt(yr[1], 10) * 12;
  const mo = String(str).match(/(\d+)\s*month/i);
  if (mo) return parseInt(mo[1], 10);
  return 12;
}

// ── 4. Category-Specific Comparison Matrix Builder ────────────────────────────

export function buildComparisonMatrix(products) {
  const enriched = products.map((p) => {
    const verifiedSpecs = extractVerifiedSpecs(p);
    return { ...p, verifiedSpecs };
  });

  const buckets = [...new Set(enriched.map((p) => p.categoryBucket))];
  const isCrossCategory = buckets.length > 1;
  const dominantCategoryBucket = isCrossCategory ? 'mixed' : (buckets[0] || 'electronics');

  // Assemble strictly relevant technical rows for the selected product category/categories
  const techRowMap = new Map();
  const bucketsToInclude = isCrossCategory ? buckets : [buckets[0] || 'electronics'];

  for (const bucket of bucketsToInclude) {
    const rows = CATEGORY_TECH_ROWS[bucket] || CATEGORY_TECH_ROWS.electronics;
    for (const row of rows) {
      if (!techRowMap.has(row.key)) {
        techRowMap.set(row.key, row);
      }
    }
  }

  // Refine electronics sub-rows: if comparing ONLY monitors or ONLY portable SSDs, hide inapplicable rows
  const allNamesLower = enriched.map((p) => p.name.toLowerCase());
  const allMonitors = allNamesLower.every((n) => /\bmonitor\b/.test(n));
  const allStorageDrives = allNamesLower.every((n) => /\bssd\b|\bhdd\b/.test(n));

  let techRows = Array.from(techRowMap.values());
  if (allMonitors) {
    techRows = techRows.filter((r) => !['processor', 'ram', 'storage', 'batteryCapacity', 'chargingSpeed', 'operatingSystem'].includes(r.key));
  } else if (allStorageDrives) {
    techRows = techRows.filter((r) => !['processor', 'ram', 'displaySize', 'displayResolution', 'refreshRate', 'batteryCapacity', 'chargingSpeed', 'operatingSystem'].includes(r.key));
  }

  const allRowDefs = [...CORE_COMPARISON_ROWS, ...techRows];

  // Determine lowest price, highest rating, highest discount
  const validPrices = enriched.filter((p) => p.price !== null).map((p) => p.price);
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const lowestPriceIds = minPrice !== null
    ? enriched.filter((p) => p.price === minPrice).map((p) => p.id)
    : [];

  const validRatings = enriched.filter((p) => p.rating !== null).map((p) => p.rating);
  const maxRating = validRatings.length > 0 ? Math.max(...validRatings) : null;
  const highestRatingIds = maxRating !== null
    ? enriched.filter((p) => p.rating === maxRating).map((p) => p.id)
    : [];

  const validDiscounts = enriched.filter((p) => p.discountPercent > 0).map((p) => p.discountPercent);
  const maxDiscount = validDiscounts.length > 0 ? Math.max(...validDiscounts) : null;
  const highestDiscountIds = maxDiscount !== null
    ? enriched.filter((p) => p.discountPercent === maxDiscount).map((p) => p.id)
    : [];

  // Build rows with values & difference flags
  const rows = allRowDefs.map((rowDef) => {
    const values = enriched.map((p) => p.verifiedSpecs[rowDef.key] || NOT_AVAILABLE_LABEL);
    const normalizedSet = new Set(values.map((v) => String(v).trim().toLowerCase()));
    const hasDifference = normalizedSet.size > 1;
    const allMissing = values.every((v) => v === NOT_AVAILABLE_LABEL);

    let highlightIds = [];
    if (rowDef.highlightType === 'lowest_price' && hasDifference) highlightIds = lowestPriceIds;
    if (rowDef.highlightType === 'highest_rating' && hasDifference) highlightIds = highestRatingIds;
    if (rowDef.highlightType === 'highest_discount' && hasDifference) highlightIds = highestDiscountIds;

    return {
      key: rowDef.key,
      label: rowDef.label,
      group: rowDef.group,
      values,
      hasDifference,
      allMissing,
      highlightIds
    };
  });

  // Calculate spec completeness per product (for honest incomplete-data disclosure)
  const specCompleteness = {};
  for (const p of enriched) {
    const presentKeys = [];
    const missingKeys = [];
    for (const tr of techRows) {
      const val = p.verifiedSpecs[tr.key];
      if (val && val !== NOT_AVAILABLE_LABEL) {
        presentKeys.push(tr.label);
      } else {
        missingKeys.push(tr.label);
      }
    }
    const pct = techRows.length > 0 ? Math.round((presentKeys.length / techRows.length) * 100) : 100;
    specCompleteness[p.id] = {
      availableCount: presentKeys.length,
      totalTechFields: techRows.length,
      percentage: pct,
      presentFields: presentKeys,
      missingFields: missingKeys
    };
  }

  // Identify Best Value badge candidate (value ratio from verified rating, specs available, discount & price)
  const valueScores = enriched.map((p) => {
    if (!p.price) return { id: p.id, val: 0 };
    const ratingVal = p.rating || 0;
    const specCoverage = (specCompleteness[p.id]?.availableCount || 0) / Math.max(1, techRows.length);
    const discountBoost = (p.discountPercent || 0) / 100;
    const stockFactor = p.stock === 0 ? 0.4 : 1;
    const priceRatio = minPrice ? minPrice / p.price : 1;
    const score = (priceRatio * 0.45 + (ratingVal / 5) * 0.25 + specCoverage * 0.2 + discountBoost * 0.1) * stockFactor;
    return { id: p.id, val: score };
  });
  valueScores.sort((a, b) => b.val - a.val);
  const bestValueIds = valueScores.length > 0 && valueScores[0].val > 0 ? [valueScores[0].id] : [];

  return {
    products: enriched,
    rows,
    techRowCount: techRows.length,
    dominantCategoryBucket,
    categoryBuckets: buckets,
    isCrossCategory,
    lowestPriceIds,
    highestRatingIds,
    highestDiscountIds,
    bestValueIds,
    specCompleteness
  };
}

// ── 5. Preferences Normalization & Dynamic Weight Calculator ──────────────────

export function normalizePreferences(rawPreferences = {}) {
  const selectedOptions = Array.isArray(rawPreferences.selectedOptions)
    ? rawPreferences.selectedOptions
        .filter((o) => o && typeof o === 'object')
        .map((o) => ({
          id: sanitizeString(String(o.id || ''), 50),
          subOptions: Array.isArray(o.subOptions)
            ? o.subOptions.map((s) => sanitizeString(String(s), 60)).filter(Boolean)
            : []
        }))
        .filter((o) => SUGGESTED_PREFERENCE_OPTIONS.some((def) => def.id === o.id))
    : [];

  const manualRaw = (rawPreferences.manual && typeof rawPreferences.manual === 'object')
    ? rawPreferences.manual
    : {};

  // Resolve effective max budget (manual input overrides or complements Option 1 preset/custom budget)
  let effectiveMaxBudget = null;
  const customBudgetNum = Number(String(rawPreferences.customBudget ?? '').replace(/[^0-9.]/g, ''));
  const manualBudgetNum = Number(String(manualRaw.maxBudget ?? '').replace(/[^0-9.]/g, ''));

  const budgetOpt = selectedOptions.find((o) => o.id === 'budget_friendly');
  let presetBudget = null;
  if (budgetOpt) {
    const budgetDef = SUGGESTED_PREFERENCE_OPTIONS.find((d) => d.id === 'budget_friendly');
    for (const subId of budgetOpt.subOptions) {
      const subDef = budgetDef?.subOptions.find((s) => s.id === subId || s.label.toLowerCase() === subId.toLowerCase());
      if (subDef?.maxBudget) {
        presetBudget = presetBudget === null ? subDef.maxBudget : Math.min(presetBudget, subDef.maxBudget);
      }
    }
  }

  if (Number.isFinite(manualBudgetNum) && manualBudgetNum > 0) {
    effectiveMaxBudget = Math.round(manualBudgetNum);
  } else if (Number.isFinite(customBudgetNum) && customBudgetNum > 0) {
    effectiveMaxBudget = Math.round(customBudgetNum);
  } else if (presetBudget !== null) {
    effectiveMaxBudget = presetBudget;
  }

  const manual = {
    maxBudget: effectiveMaxBudget,
    preferredBrand: sanitizeString(String(manualRaw.preferredBrand || ''), 60),
    productCategory: sanitizeString(String(manualRaw.productCategory || ''), 60),
    primaryUsage: sanitizeString(String(manualRaw.primaryUsage || ''), 120),
    minRam: sanitizeString(String(manualRaw.minRam || ''), 30),
    minStorage: sanitizeString(String(manualRaw.minStorage || ''), 30),
    preferredProcessor: sanitizeString(String(manualRaw.preferredProcessor || ''), 60),
    minBattery: sanitizeString(String(manualRaw.minBattery || ''), 40),
    preferredDisplaySize: sanitizeString(String(manualRaw.preferredDisplaySize || ''), 40),
    cameraRequirements: sanitizeString(String(manualRaw.cameraRequirements || ''), 120),
    warrantyPreference: sanitizeString(String(manualRaw.warrantyPreference || ''), 60),
    requiredConnectivity: sanitizeString(String(manualRaw.requiredConnectivity || ''), 120),
    otherRequirements: sanitizeString(String(manualRaw.otherRequirements || ''), 300)
  };

  return {
    selectedOptions,
    manual,
    effectiveMaxBudget
  };
}

export function computeDynamicWeights(prefs) {
  const w = { ...DEFAULT_SCORING_WEIGHTS };
  const optionIds = new Set(prefs.selectedOptions.map((o) => o.id));
  const m = prefs.manual || {};
  const manualSpecCount = [
    m.preferredBrand, m.minRam, m.minStorage, m.preferredProcessor,
    m.minBattery, m.preferredDisplaySize, m.cameraRequirements,
    m.requiredConnectivity, m.primaryUsage, m.otherRequirements
  ].filter((v) => Boolean(v && String(v).trim())).length;

  // Shift weights transparently based on user's selected priorities
  if (optionIds.has('budget_friendly') || prefs.effectiveMaxBudget) {
    w.budgetPrice += 12;
    w.performanceSpecs -= 5;
    w.warrantyReliability -= 4;
    w.qualityRatings -= 3;
  } else if (manualSpecCount >= 2 || optionIds.has('best_performance') || optionIds.has('camera_display') || optionIds.has('gaming_entertainment')) {
    // When user specifies explicit performance/spec requirements WITHOUT a budget cap,
    // prioritize matching their explicit specs & priorities over picking the cheapest item.
    w.budgetPrice -= 10;
    w.userPriorities += 8;
    w.performanceSpecs += 6;
    w.warrantyReliability -= 2;
    w.valueForMoney -= 2;
  }

  if (optionIds.has('best_performance') || optionIds.has('gaming_entertainment')) {
    w.performanceSpecs += 7;
    w.userPriorities += 4;
    w.budgetPrice -= 5;
    w.warrantyReliability -= 3;
    w.valueForMoney -= 3;
  }
  if (optionIds.has('best_overall_value')) {
    w.valueForMoney += 8;
    w.qualityRatings += 2;
    w.performanceSpecs -= 5;
    w.warrantyReliability -= 5;
  }
  if (optionIds.has('battery_life') || optionIds.has('camera_display') || optionIds.has('student_office') || optionIds.has('storage_connectivity')) {
    w.userPriorities += 7;
    w.warrantyReliability -= 4;
    w.qualityRatings -= 3;
  }
  if (manualSpecCount > 0) {
    w.userPriorities += Math.min(10, manualSpecCount * 3);
  }

  // Ensure positive floor and normalize to exactly 100
  const keys = Object.keys(w);
  for (const k of keys) {
    w[k] = Math.max(5, w[k]);
  }
  const sum = keys.reduce((acc, k) => acc + w[k], 0);
  const normalized = {};
  let running = 0;
  keys.forEach((k, idx) => {
    if (idx === keys.length - 1) {
      normalized[k] = Math.max(1, 100 - running);
    } else {
      normalized[k] = Math.round((w[k] / sum) * 100);
      running += normalized[k];
    }
  });
  return normalized;
}

// ── 6. Deterministic Weighted Scoring Engine ──────────────────────────────────

export function scoreComparedProducts(matrix, rawPreferences = {}) {
  const prefs = normalizePreferences(rawPreferences);
  const weights = computeDynamicWeights(prefs);
  const products = matrix.products;

  const prices = products.map((p) => p.price).filter((v) => v !== null && v > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  // Relative spec benchmarks among compared products (only using verified available values)
  const ramVals = products.map((p) => parseGbValue(p.verifiedSpecs.ram)).filter((v) => v !== null);
  const maxRam = ramVals.length ? Math.max(...ramVals) : null;

  const storageVals = products.map((p) => parseGbValue(p.verifiedSpecs.storage)).filter((v) => v !== null);
  const maxStorage = storageVals.length ? Math.max(...storageVals) : null;

  const hzVals = products.map((p) => parseRefreshHz(p.verifiedSpecs.refreshRate)).filter((v) => v !== null);
  const maxHz = hzVals.length ? Math.max(...hzVals) : null;

  const wattVals = products.map((p) => parseWattValue(p.verifiedSpecs.chargingSpeed)).filter((v) => v !== null);
  const maxWatt = wattVals.length ? Math.max(...wattVals) : null;

  const mpVals = products.map((p) => parseCameraMp(p.verifiedSpecs.camera)).filter((v) => v !== null);
  const maxMp = mpVals.length ? Math.max(...mpVals) : null;

  const maxReviews = Math.max(1, ...products.map((p) => p.reviewsCount || 0));

  const optionIds = new Set(prefs.selectedOptions.map((o) => o.id));
  const allSelectedSubLabels = prefs.selectedOptions.flatMap((o) => o.subOptions).map((s) => s.toLowerCase());

  const scored = products.map((p) => {
    const specs = p.verifiedSpecs;
    const compInfo = matrix.specCompleteness[p.id] || { availableCount: 0, totalTechFields: 1, percentage: 0, missingFields: [] };
    const fullText = `${p.name} ${p.brand} ${p.description} ${(p.tags || []).join(' ')} ${Object.values(specs).join(' ')}`.toLowerCase();

    const matchedRequirements = [];
    const unmetRequirements = [];
    const factualAdvantages = [];
    const factualDisadvantages = [];

    // ─── A. Budget & Price Suitability (0..100) ─────────────────────────────
    let budgetScore = 0;
    if (p.price === null) {
      budgetScore = 0;
      factualDisadvantages.push('Current selling price is Not Available in catalog.');
    } else if (prefs.effectiveMaxBudget) {
      if (p.price <= prefs.effectiveMaxBudget) {
        const headroomRatio = (prefs.effectiveMaxBudget - p.price) / prefs.effectiveMaxBudget;
        budgetScore = Math.min(100, Math.round(82 + headroomRatio * 18));
        const savings = prefs.effectiveMaxBudget - p.price;
        matchedRequirements.push(
          savings > 0
            ? `Fits within your ${formatINR(prefs.effectiveMaxBudget)} budget (saves ${formatINR(savings)})`
            : `Matches your exact ${formatINR(prefs.effectiveMaxBudget)} budget`
        );
        factualAdvantages.push(`Priced at ${formatINR(p.price)}, staying within your ${formatINR(prefs.effectiveMaxBudget)} budget.`);
      } else {
        const overRatio = (p.price - prefs.effectiveMaxBudget) / prefs.effectiveMaxBudget;
        budgetScore = Math.max(0, Math.round(45 - overRatio * 95));
        const excess = p.price - prefs.effectiveMaxBudget;
        unmetRequirements.push(`Exceeds your ${formatINR(prefs.effectiveMaxBudget)} budget by ${formatINR(excess)}`);
        factualDisadvantages.push(`Priced at ${formatINR(p.price)}, exceeding your ${formatINR(prefs.effectiveMaxBudget)} budget by ${formatINR(excess)}.`);
      }
    } else {
      // No explicit budget cap: normalize relative affordability fairly across compared items
      if (maxPrice === minPrice) {
        budgetScore = 75;
      } else {
        const relAffordability = (maxPrice - p.price) / (maxPrice - minPrice);
        budgetScore = Math.round(50 + relAffordability * 45);
      }
      if (p.price === minPrice && maxPrice > minPrice) {
        factualAdvantages.push(`Lowest selling price among compared options at ${formatINR(p.price)}.`);
      }
    }

    // ─── B. Performance & Verified Specifications (0..100) ──────────────────
    // Missing data NEVER receives positive score.
    let specEarned = 0;
    let specPossible = 0;

    // 1. RAM
    const pRam = parseGbValue(specs.ram);
    if (maxRam !== null) {
      specPossible += 20;
      if (pRam !== null) {
        specEarned += Math.round((pRam / maxRam) * 20);
        if (pRam === maxRam && ramVals.length > 1) factualAdvantages.push(`Higher verified RAM (${specs.ram}).`);
      }
    }

    // 2. Storage
    const pStorage = parseGbValue(specs.storage);
    if (maxStorage !== null) {
      specPossible += 18;
      if (pStorage !== null) {
        specEarned += Math.round((pStorage / maxStorage) * 18);
        if (pStorage === maxStorage && storageVals.length > 1) factualAdvantages.push(`Generous verified storage (${specs.storage}).`);
      }
    }

    // 3. Processor presence / tier
    if (products.some((x) => x.verifiedSpecs.processor !== NOT_AVAILABLE_LABEL)) {
      specPossible += 20;
      if (specs.processor !== NOT_AVAILABLE_LABEL) {
        const isFlagshipCpu = /snapdragon\s*8|m[2-5]\b|ryzen\s*[79]|core\s*i[79]|ultra\s*[79]/i.test(specs.processor);
        specEarned += isFlagshipCpu ? 20 : 14;
        factualAdvantages.push(`Verified processor: ${specs.processor}.`);
      }
    }

    // 4. Refresh rate
    const pHz = parseRefreshHz(specs.refreshRate);
    if (maxHz !== null) {
      specPossible += 15;
      if (pHz !== null) {
        specEarned += Math.round((pHz / maxHz) * 15);
        if (pHz >= 120) factualAdvantages.push(`Smooth high refresh rate (${specs.refreshRate}).`);
      }
    }

    // 5. Charging speed / power output
    const pWatt = parseWattValue(specs.chargingSpeed);
    if (maxWatt !== null) {
      specPossible += 12;
      if (pWatt !== null) {
        specEarned += Math.round((pWatt / maxWatt) * 12);
        if (pWatt === maxWatt && wattVals.length > 1) factualAdvantages.push(`Faster verified charging/power output (${specs.chargingSpeed}).`);
      }
    }

    // 6. Camera MP / OIS
    const pMp = parseCameraMp(specs.camera);
    if (maxMp !== null) {
      specPossible += 15;
      if (pMp !== null) {
        const oisBonus = /ois|triple/i.test(specs.camera) ? 3 : 0;
        specEarned += Math.min(15, Math.round((pMp / maxMp) * 12) + oisBonus);
        factualAdvantages.push(`Verified camera system: ${specs.camera}.`);
      }
    }

    // 7. Battery / playback presence & relative strength
    const pBat = parseBatteryScoreUnit(specs.batteryCapacity);
    if (products.some((x) => parseBatteryScoreUnit(x.verifiedSpecs.batteryCapacity) !== null)) {
      specPossible += 18;
      if (pBat) {
        const sameTypeVals = products
          .map((x) => parseBatteryScoreUnit(x.verifiedSpecs.batteryCapacity))
          .filter((b) => b && b.type === pBat.type)
          .map((b) => b.value);
        const maxSameBat = sameTypeVals.length ? Math.max(...sameTypeVals) : pBat.value;
        specEarned += Math.round((pBat.value / Math.max(1, maxSameBat)) * 18);
        if (pBat.value === maxSameBat && sameTypeVals.length > 1) {
          factualAdvantages.push(`Strong verified battery backup (${specs.batteryCapacity}).`);
        }
      }
    }

    // 8. Category-specific verified feature coverage (ANC, resolution, connectivity, drivers, IP rating, extras)
    specPossible += 25;
    const coveragePoints = Math.round((compInfo.percentage / 100) * 18);
    let extraFeaturePoints = 0;
    if (specs.noiseCancellation !== NOT_AVAILABLE_LABEL) {
      extraFeaturePoints += 4;
      factualAdvantages.push(`Includes ${specs.noiseCancellation}.`);
    }
    if (specs.displayResolution !== NOT_AVAILABLE_LABEL && /4k|3\.2k|2k|qhd|oled|amoled|hdr/i.test(specs.displayResolution)) {
      extraFeaturePoints += 4;
      factualAdvantages.push(`High-clarity display: ${specs.displayResolution}.`);
    }
    if (specs.connectivity !== NOT_AVAILABLE_LABEL) {
      const connCount = specs.connectivity.split(',').length;
      extraFeaturePoints += Math.min(4, connCount);
    }
    if (specs.additionalSpecs !== NOT_AVAILABLE_LABEL) {
      extraFeaturePoints += 3;
      factualAdvantages.push(`Notable feature: ${specs.additionalSpecs}.`);
    }
    specEarned += Math.min(25, coveragePoints + Math.min(7, extraFeaturePoints));

    const performanceScore = specPossible > 0
      ? Math.min(100, Math.round((specEarned / specPossible) * 100))
      : 0;

    if (compInfo.percentage < 50) {
      factualDisadvantages.push(
        `Limited technical specifications listed in catalog (${compInfo.availableCount}/${compInfo.totalTechFields} category fields available).`
      );
    }

    // ─── C. User's Selected Priorities & Manual Requirements (0..100) ───────
    let priorityChecks = 0;
    let priorityPoints = 0;

    const addPriorityCheck = (pointsOutOf10, matchedText, unmetText) => {
      priorityChecks += 1;
      priorityPoints += pointsOutOf10;
      if (matchedText) matchedRequirements.push(matchedText);
      if (unmetText) unmetRequirements.push(unmetText);
    };

    // Option 1: Budget Friendly
    if (optionIds.has('budget_friendly')) {
      if (prefs.effectiveMaxBudget && p.price !== null) {
        addPriorityCheck(
          p.price <= prefs.effectiveMaxBudget ? 10 : 1,
          p.price <= prefs.effectiveMaxBudget ? `Matches Budget Friendly priority (${formatINR(p.price)})` : null,
          p.price > prefs.effectiveMaxBudget ? `Over target budget (${formatINR(p.price)} vs ${formatINR(prefs.effectiveMaxBudget)})` : null
        );
      } else if (p.price !== null && maxPrice > minPrice) {
        const pts = Math.round(((maxPrice - p.price) / (maxPrice - minPrice)) * 10);
        addPriorityCheck(pts, pts >= 7 ? 'Most budget-friendly price tier' : null, null);
      }
    }

    // Option 2: Best Performance
    if (optionIds.has('best_performance')) {
      const wantsPro = allSelectedSubLabels.some((s) => s.includes('professional') || s.includes('high_performance') || s.includes('high performance'));
      const hasProSpec =
        (pRam && pRam >= 24) ||
        /snapdragon\s*8|ray-tracing|workstation|32gb|flagship|core\s*i[79]|ryzen\s*[79]|m[2-5]\s*(?:pro|max)/i.test(fullText);
      const hasMidSpec =
        (pRam && pRam >= 12) ||
        /16gb|pro\b|1050mb\/s|26,000\s*dpi/i.test(fullText);
      const hasBasicSpec = specs.processor !== NOT_AVAILABLE_LABEL || specs.ram !== NOT_AVAILABLE_LABEL || performanceScore >= 55;

      if (hasProSpec) {
        addPriorityCheck(10, 'Strong verified professional-grade performance hardware', null);
      } else if (hasMidSpec) {
        addPriorityCheck(
          wantsPro ? 5 : 9,
          wantsPro ? null : 'Strong verified performance credentials for multitasking & daily workloads',
          wantsPro ? 'Mid-tier specs compared to dedicated workstation/flagship performance options' : null
        );
      } else if (hasBasicSpec) {
        addPriorityCheck(wantsPro ? 2 : 6, wantsPro ? null : 'Suitable verified performance for daily tasks', wantsPro ? 'Entry-level specs not tailored for heavy professional workloads' : null);
      } else {
        addPriorityCheck(1, null, 'Limited performance specifications published in catalog');
      }
    }

    // Option 3: Battery Life
    if (optionIds.has('battery_life')) {
      const wantsFastCharge = allSelectedSubLabels.some((s) => s.includes('fast'));
      if (pBat) {
        const strongBat =
          (pBat.type === 'mah' && pBat.value >= 5000) ||
          (pBat.type === 'hours' && pBat.value >= 14) ||
          (pBat.type === 'days' && pBat.value >= 7);
        addPriorityCheck(
          strongBat ? 10 : 6,
          `Verified battery specification: ${specs.batteryCapacity}`,
          null
        );
      } else {
        addPriorityCheck(1, null, 'Battery capacity/life is Not Available in catalog');
      }
      if (wantsFastCharge) {
        if (specs.chargingSpeed !== NOT_AVAILABLE_LABEL) {
          addPriorityCheck(9, `Fast charging supported (${specs.chargingSpeed})`, null);
        } else {
          addPriorityCheck(1, null, 'Fast charging speed is Not Available');
        }
      }
    }

    // Option 4: Camera and Display
    if (optionIds.has('camera_display')) {
      const wantsHighRes = allSelectedSubLabels.some((s) => s.includes('high_resolution') || s.includes('high resolution'));
      const wantsHighHz = allSelectedSubLabels.some((s) => s.includes('high_refresh') || s.includes('high refresh'));
      const wantsCam = allSelectedSubLabels.some((s) => s.includes('camera') || s.includes('photography'));

      const hasCam = specs.camera !== NOT_AVAILABLE_LABEL;
      const hasHighRes = /4k|3\.2k|2k|qhd|oled|amoled|ltpo|dci-p3|hdr/i.test(`${specs.displayResolution} ${specs.additionalSpecs}`);
      const hasAnyDisp = specs.displayResolution !== NOT_AVAILABLE_LABEL || specs.displaySize !== NOT_AVAILABLE_LABEL;

      if (wantsHighRes) {
        addPriorityCheck(
          hasHighRes ? 10 : hasAnyDisp ? 4 : 1,
          hasHighRes ? `High-resolution / wide-gamut display (${specs.displayResolution})` : null,
          hasHighRes ? null : `Display (${specs.displayResolution}) lacks 2K/3.2K/4K/OLED high-res panel`
        );
      }
      if (wantsHighHz) {
        addPriorityCheck(
          pHz && pHz >= 120 ? 10 : 1,
          pHz && pHz >= 120 ? `Verified high refresh rate (${specs.refreshRate})` : null,
          pHz && pHz >= 120 ? null : `High refresh rate is ${specs.refreshRate}`
        );
      }
      if (wantsCam) {
        addPriorityCheck(
          hasCam ? 10 : 1,
          hasCam ? `Verified camera system (${specs.camera})` : null,
          hasCam ? null : 'Camera specifications are Not Available'
        );
      }
      if (!wantsHighRes && !wantsHighHz && !wantsCam) {
        if (hasCam && hasAnyDisp) {
          addPriorityCheck(10, `Strong camera (${specs.camera}) and display (${specs.displayResolution})`, null);
        } else if (hasCam || hasHighRes) {
          addPriorityCheck(8, `Verified visual spec: ${hasCam ? specs.camera : specs.displayResolution}`, null);
        } else if (hasAnyDisp) {
          addPriorityCheck(5, `Verified display: ${specs.displayResolution || specs.displaySize}`, null);
        } else {
          addPriorityCheck(1, null, 'Camera & display specifications are Not Available');
        }
      }
    }

    // Option 5: Gaming and Entertainment
    if (optionIds.has('gaming_entertainment')) {
      const gamingHit =
        (pHz && pHz >= 120) ||
        /gaming|165hz|144hz|120hz|ray-tracing|freesync|g-sync|surround|7\.1|dolby|hdr|vapor\s+chamber|26,000\s*dpi|hall-effect/i.test(fullText);
      addPriorityCheck(
        gamingHit ? 10 : 3,
        gamingHit ? 'Equipped with verified gaming/entertainment hardware features' : null,
        gamingHit ? null : 'Not specifically tailored for gaming or high-refresh entertainment'
      );
    }

    // Option 6: Student and Office Use
    if (optionIds.has('student_office')) {
      const officeHit =
        /student|office|coding|multitasking|business|work\s*from\s*home|teams|zoom|14-hour|ergonomic|keyboard|touchscreen|stylus|webcam|all-in-one|ultrabook|fhd/i.test(fullText) ||
        (pRam && pRam >= 16);
      addPriorityCheck(
        officeHit ? 9 : 4,
        officeHit ? 'Well suited for student, office, or work-from-home productivity' : null,
        null
      );
    }

    // Option 7: Storage and Connectivity
    if (optionIds.has('storage_connectivity')) {
      const hasStorage = specs.storage !== NOT_AVAILABLE_LABEL;
      const hasConn = specs.connectivity !== NOT_AVAILABLE_LABEL;
      const scoreVal = (hasStorage ? 5 : 0) + (hasConn ? 5 : 0);
      addPriorityCheck(
        Math.max(1, scoreVal),
        hasStorage || hasConn ? `Verified ${[hasStorage ? `storage (${specs.storage})` : null, hasConn ? `connectivity (${specs.connectivity})` : null].filter(Boolean).join(' & ')}` : null,
        !hasStorage && !hasConn ? 'Storage & connectivity details are Not Available' : null
      );
    }

    // Option 8: Best Overall Value
    if (optionIds.has('best_overall_value')) {
      const isLowest = p.price === minPrice;
      const highRating = p.rating !== null && p.rating >= 4.7;
      const goodDiscount = p.discountPercent >= 18;
      const valPts = (isLowest ? 4 : 2) + (highRating ? 3 : 1) + (goodDiscount ? 3 : 1);
      addPriorityCheck(valPts, valPts >= 7 ? 'Delivers strong specifications and ratings relative to price' : null, null);
    }

    // Manual requirements matching
    const m = prefs.manual;

    if (m.preferredBrand) {
      const matchesBrand = p.brand.toLowerCase().includes(m.preferredBrand.toLowerCase()) ||
        p.name.toLowerCase().includes(m.preferredBrand.toLowerCase());
      addPriorityCheck(
        matchesBrand ? 10 : 1,
        matchesBrand ? `Matches preferred brand (${p.brand})` : null,
        matchesBrand ? null : `Brand is ${p.brand} (requested ${m.preferredBrand})`
      );
    }

    if (m.minRam) {
      const reqRam = parseGbValue(m.minRam) || parseFloat(m.minRam);
      if (Number.isFinite(reqRam) && reqRam > 0) {
        if (pRam !== null && pRam >= reqRam) {
          addPriorityCheck(10, `Meets minimum RAM requirement (${specs.ram} ≥ ${reqRam}GB)`, null);
        } else if (pRam !== null) {
          addPriorityCheck(0, null, `RAM (${specs.ram}) is below requested ${reqRam}GB`);
          factualDisadvantages.push(`RAM (${specs.ram}) falls below your requested ${reqRam}GB minimum.`);
        } else {
          addPriorityCheck(0, null, `RAM is Not Available (requested ≥ ${reqRam}GB)`);
        }
      }
    }

    if (m.minStorage) {
      const reqStorage = parseGbValue(m.minStorage) || parseFloat(m.minStorage);
      if (Number.isFinite(reqStorage) && reqStorage > 0) {
        if (pStorage !== null && pStorage >= reqStorage) {
          addPriorityCheck(10, `Meets minimum storage requirement (${specs.storage})`, null);
        } else if (pStorage !== null) {
          addPriorityCheck(2, null, `Storage (${specs.storage}) is below requested ${m.minStorage}`);
        } else {
          addPriorityCheck(0, null, `Storage is Not Available (requested ${m.minStorage})`);
        }
      }
    }

    if (m.preferredProcessor) {
      const hit = specs.processor !== NOT_AVAILABLE_LABEL &&
        specs.processor.toLowerCase().includes(m.preferredProcessor.toLowerCase());
      addPriorityCheck(
        hit ? 10 : 1,
        hit ? `Matches preferred processor (${specs.processor})` : null,
        hit ? null : `Processor (${specs.processor}) does not match "${m.preferredProcessor}"`
      );
    }

    if (m.minBattery) {
      const reqBat = parseBatteryScoreUnit(m.minBattery);
      if (reqBat && pBat && reqBat.type === pBat.type) {
        addPriorityCheck(
          pBat.value >= reqBat.value ? 10 : 3,
          pBat.value >= reqBat.value ? `Meets minimum battery target (${specs.batteryCapacity})` : null,
          pBat.value < reqBat.value ? `Battery (${specs.batteryCapacity}) is below requested ${m.minBattery}` : null
        );
      } else if (pBat) {
        addPriorityCheck(6, `Verified battery info: ${specs.batteryCapacity}`, null);
      } else {
        addPriorityCheck(0, null, `Battery capacity is Not Available (requested ${m.minBattery})`);
      }
    }

    if (m.preferredDisplaySize) {
      const reqIn = parseDisplayInches(m.preferredDisplaySize);
      const pIn = parseDisplayInches(specs.displaySize);
      if (reqIn && pIn) {
        const diff = Math.abs(pIn - reqIn);
        addPriorityCheck(
          diff <= 0.6 ? 10 : diff <= 1.5 ? 6 : 2,
          diff <= 0.6 ? `Matches preferred display size (${specs.displaySize})` : null,
          diff > 1.5 ? `Display size (${specs.displaySize}) differs from preferred ${m.preferredDisplaySize}` : null
        );
      } else {
        addPriorityCheck(0, null, `Display size is Not Available (requested ${m.preferredDisplaySize})`);
      }
    }

    if (m.cameraRequirements) {
      const tokens = m.cameraRequirements.toLowerCase().split(/[\s,]+/).filter((t) => t.length >= 2);
      const matched = specs.camera !== NOT_AVAILABLE_LABEL && tokens.some((t) => specs.camera.toLowerCase().includes(t) || fullText.includes(t));
      addPriorityCheck(
        matched ? 10 : specs.camera !== NOT_AVAILABLE_LABEL ? 5 : 0,
        matched ? `Matches camera requirement (${specs.camera})` : null,
        matched ? null : `Camera details (${specs.camera}) do not explicitly confirm "${m.cameraRequirements}"`
      );
    }

    if (m.requiredConnectivity) {
      const tokens = m.requiredConnectivity.toLowerCase().split(/[\s,/]+/).filter((t) => t.length >= 2);
      const hitCount = tokens.filter((t) => fullText.includes(t)).length;
      const ratio = tokens.length > 0 ? hitCount / tokens.length : 0;
      addPriorityCheck(
        Math.round(ratio * 10),
        ratio >= 0.5 ? `Supports required connectivity (${specs.connectivity})` : null,
        ratio < 0.5 ? `Connectivity (${specs.connectivity}) missing requested "${m.requiredConnectivity}"` : null
      );
    }

    if (m.warrantyPreference) {
      const reqMonths = parseWarrantyMonths(m.warrantyPreference) || 12;
      const pMonths = parseWarrantyMonths(specs.warranty);
      addPriorityCheck(
        pMonths && pMonths >= reqMonths ? 10 : 2,
        pMonths && pMonths >= reqMonths ? `Meets warranty preference (${specs.warranty})` : null,
        !pMonths || pMonths < reqMonths ? `Warranty (${specs.warranty}) below requested "${m.warrantyPreference}"` : null
      );
    }

    if (m.primaryUsage || m.otherRequirements) {
      const customText = `${m.primaryUsage} ${m.otherRequirements}`.toLowerCase();
      const keywords = customText.split(/[^a-z0-9\+]+/).filter((w) => w.length >= 3);
      if (keywords.length > 0) {
        const hits = keywords.filter((kw) => fullText.includes(kw));
        const ratio = hits.length / keywords.length;
        addPriorityCheck(
          Math.min(10, Math.round(2 + ratio * 8)),
          hits.length > 0 ? `Relevant to your usage criteria (${hits.slice(0, 3).join(', ')})` : null,
          hits.length === 0 ? `No explicit catalog match for "${(m.primaryUsage || m.otherRequirements).slice(0, 50)}"` : null
        );
      }
    }

    const userPrioritiesScore = priorityChecks > 0
      ? Math.min(100, Math.round((priorityPoints / (priorityChecks * 10)) * 100))
      : Math.round((budgetScore + performanceScore) / 2);

    // ─── D. Quality & Customer Ratings (0..100) ─────────────────────────────
    let qualityRatingsScore = 0;
    if (p.rating !== null) {
      const ratingBase = (p.rating / 5) * 80;
      const reviewConfidence = p.reviewsCount !== null
        ? (Math.log10(p.reviewsCount + 1) / Math.log10(maxReviews + 1)) * 20
        : 0;
      qualityRatingsScore = Math.min(100, Math.round(ratingBase + reviewConfidence));
      if (p.rating >= 4.8) {
        factualAdvantages.push(`High customer rating of ${p.rating.toFixed(1)}/5 (${p.reviewsCount ?? 0} reviews).`);
      } else if (p.rating < 4.5) {
        factualDisadvantages.push(`Lower customer rating (${p.rating.toFixed(1)}/5) compared to top-rated alternatives.`);
      }
    } else {
      factualDisadvantages.push('Customer rating is Not Available.');
    }

    // ─── E. Warranty, Reliability & Stock Availability (0..100) ─────────────
    let warrantyReliabilityScore = 0;
    const wMonths = parseWarrantyMonths(specs.warranty);
    if (wMonths !== null) {
      warrantyReliabilityScore += Math.min(55, Math.round((wMonths / 12) * 45));
    } else {
      factualDisadvantages.push('Warranty details are Not Available.');
    }
    if (p.stock !== null) {
      if (p.stock > 10) {
        warrantyReliabilityScore += 45;
      } else if (p.stock > 0) {
        warrantyReliabilityScore += 30;
        factualDisadvantages.push(`Limited stock remaining (${p.stock} units left).`);
      } else {
        warrantyReliabilityScore += 0;
        factualDisadvantages.push('Currently Out of Stock.');
      }
    }
    warrantyReliabilityScore = Math.min(100, warrantyReliabilityScore);

    // ─── F. Overall Value for Money (0..100) ────────────────────────────────
    let valueForMoneyScore = 0;
    if (p.price !== null && p.price > 0) {
      const priceFactor = maxPrice > minPrice ? (maxPrice - p.price) / (maxPrice - minPrice) : 0.7;
      const qualityPerformance = (performanceScore * 0.55 + qualityRatingsScore * 0.45) / 100;
      const discountBonus = Math.min(15, Math.round((p.discountPercent || 0) * 0.6));
      valueForMoneyScore = Math.min(100, Math.round(priceFactor * 40 + qualityPerformance * 45 + discountBonus));
      if (p.discountPercent >= 20) {
        factualAdvantages.push(`Strong verified discount of ${p.discountPercent}% OFF (MRP ${formatINR(p.originalPrice)}).`);
      }
    }

    // ─── Weighted Total (0..100) ────────────────────────────────────────────
    let overallScore = Math.round(
      (budgetScore * weights.budgetPrice +
        performanceScore * weights.performanceSpecs +
        userPrioritiesScore * weights.userPriorities +
        qualityRatingsScore * weights.qualityRatings +
        warrantyReliabilityScore * weights.warrantyReliability +
        valueForMoneyScore * weights.valueForMoney) / 100
    );

    // Apply out-of-stock penalty so in-stock matching items win over unavailable ones
    if (p.stock === 0) {
      overallScore = Math.max(10, overallScore - 20);
    }

    // Ensure at least one honest factual disadvantage / trade-off is noted
    if (factualDisadvantages.length === 0) {
      if (p.price !== null && p.price > minPrice) {
        factualDisadvantages.push(`Costs ${formatINR(p.price - minPrice)} more than the lowest-priced option in this comparison.`);
      } else if (compInfo.missingFields.length > 0) {
        factualDisadvantages.push(`Some catalog fields are Not Available (${compInfo.missingFields.slice(0, 3).join(', ')}).`);
      } else {
        factualDisadvantages.push('Standard manufacturer warranty coverage; verify compatibility with your existing accessories.');
      }
    }

    if (factualAdvantages.length === 0) {
      factualAdvantages.push(`Verified catalog listing by ${p.brand} at ${formatINR(p.price)}.`);
    }

    return {
      productId: p.id,
      name: p.name,
      brand: p.brand,
      image: p.image,
      price: p.price,
      priceFormatted: formatINR(p.price),
      originalPrice: p.originalPrice,
      discountPercent: p.discountPercent,
      rating: p.rating,
      reviewsCount: p.reviewsCount,
      stock: p.stock,
      overallScore: Math.min(100, Math.max(0, overallScore)),
      breakdown: {
        budgetPrice: budgetScore,
        performanceSpecs: performanceScore,
        userPriorities: userPrioritiesScore,
        qualityRatings: qualityRatingsScore,
        warrantyReliability: warrantyReliabilityScore,
        valueForMoney: valueForMoneyScore
      },
      specCompleteness: compInfo,
      matchedRequirements: [...new Set(matchedRequirements)],
      unmetRequirements: [...new Set(unmetRequirements)],
      factualAdvantages: [...new Set(factualAdvantages)].slice(0, 6),
      factualDisadvantages: [...new Set(factualDisadvantages)].slice(0, 5),
      verifiedSpecs: specs
    };
  });

  // Sort strictly by overallScore desc, then budget suitability desc, then rating desc, then price asc
  scored.sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    if (b.breakdown.budgetPrice !== a.breakdown.budgetPrice) return b.breakdown.budgetPrice - a.breakdown.budgetPrice;
    if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
    return (a.price || Infinity) - (b.price || Infinity);
  });

  const lowSpecProducts = scored.filter((s) => s.specCompleteness.percentage < 60);
  const incompleteDataNotice = lowSpecProducts.length > 0
    ? `Note: Some technical specifications are marked "Not Available" in the catalog for ${lowSpecProducts.map((x) => x.name).join(', ')}. Missing fields were not given positive credit in the score.`
    : null;

  return {
    ranked: scored,
    weights,
    preferencesApplied: prefs,
    incompleteDataNotice
  };
}

// ── 7. Deterministic Natural-Language Recommendation Builder (Fallback) ───────

export function buildDeterministicRecommendation(scoringResult, matrix) {
  const { ranked, preferencesApplied, incompleteDataNotice } = scoringResult;
  const winner = ranked[0];
  const runnerUp = ranked[1] || null;
  const others = ranked.slice(1);

  const selectedLabels = preferencesApplied.selectedOptions.map((o) => {
    const def = SUGGESTED_PREFERENCE_OPTIONS.find((d) => d.id === o.id);
    const subText = o.subOptions.length > 0 ? ` (${o.subOptions.join(', ')})` : '';
    return `${def?.shortLabel || o.id}${subText}`;
  });

  const prefSummaryParts = [];
  if (preferencesApplied.effectiveMaxBudget) {
    prefSummaryParts.push(`your ${formatINR(preferencesApplied.effectiveMaxBudget)} budget`);
  }
  if (selectedLabels.length > 0) {
    prefSummaryParts.push(`selected priorities (${selectedLabels.slice(0, 3).join('; ')})`);
  }
  if (preferencesApplied.manual.primaryUsage) {
    prefSummaryParts.push(`primary usage (${preferencesApplied.manual.primaryUsage})`);
  }
  if (preferencesApplied.manual.preferredBrand) {
    prefSummaryParts.push(`preferred brand (${preferencesApplied.manual.preferredBrand})`);
  }
  const prefPhrase = prefSummaryParts.length > 0
    ? `Based on ${prefSummaryParts.join(' and ')}`
    : 'Based on our balanced multi-factor evaluation of the verified catalog data';

  const bestProductReason = winner.matchedRequirements.length > 0
    ? `${prefPhrase}, ${winner.name} achieves the highest suitability score (${winner.overallScore}/100) because it ${winner.matchedRequirements[0].charAt(0).toLowerCase()}${winner.matchedRequirements[0].slice(1)}.`
    : `${prefPhrase}, ${winner.name} leads with a suitability score of ${winner.overallScore}/100, combining ${winner.priceFormatted} pricing with verified catalog ratings and specifications.`;

  const whyBestLines = [
    `${winner.name} (${winner.brand}) scored ${winner.overallScore}/100 across our weighted evaluation (Budget & Price: ${winner.breakdown.budgetPrice}/100, Specs & Performance: ${winner.breakdown.performanceSpecs}/100, Priority Fit: ${winner.breakdown.userPriorities}/100, Value: ${winner.breakdown.valueForMoney}/100).`
  ];
  if (winner.matchedRequirements.length > 0) {
    whyBestLines.push(`Key requirement matches: ${winner.matchedRequirements.slice(0, 3).join('; ')}.`);
  }
  if (matrix.isCrossCategory) {
    whyBestLines.push('Note: You are comparing products from different categories, so scores emphasize shared factors (budget fit, ratings, warranty, value, and your stated priorities) alongside each item\'s category-specific specs.');
  }
  if (incompleteDataNotice) {
    whyBestLines.push(incompleteDataNotice);
  }

  // Price & Value Analysis
  const avgPrice = Math.round(
    ranked.reduce((sum, r) => sum + (r.price || 0), 0) / Math.max(1, ranked.filter((r) => r.price).length)
  );
  let priceValueAnalysis = `${winner.name} is currently priced at ${winner.priceFormatted}`;
  if (winner.discountPercent > 0 && winner.originalPrice > winner.price) {
    priceValueAnalysis += ` (${winner.discountPercent}% off its ${formatINR(winner.originalPrice)} original price)`;
  }
  priceValueAnalysis += '. ';
  if (preferencesApplied.effectiveMaxBudget) {
    if (winner.price <= preferencesApplied.effectiveMaxBudget) {
      priceValueAnalysis += `It fits comfortably inside your ${formatINR(preferencesApplied.effectiveMaxBudget)} ceiling, leaving ${formatINR(preferencesApplied.effectiveMaxBudget - winner.price)} in savings. `;
    } else {
      priceValueAnalysis += `All selected items exceed your ${formatINR(preferencesApplied.effectiveMaxBudget)} budget; ${winner.name} represents the closest practical match on overall value. `;
    }
  }
  priceValueAnalysis += winner.price <= avgPrice
    ? `At ${winner.price <= avgPrice ? formatINR(avgPrice - winner.price) + ' below' : 'at'} the group average (${formatINR(avgPrice)}), its verified specifications and ${winner.rating ? winner.rating.toFixed(1) + '★ rating' : 'catalog listing'} justify the asking price.`
    : `Although priced above the group average (${formatINR(avgPrice)}), its stronger verified specifications and higher weighted fit (${winner.overallScore}/100) justify the difference for your selected priorities.`;

  // Other Products Analysis
  const otherProducts = others.map((item) => {
    const gaps = [];
    if (item.unmetRequirements.length > 0) {
      gaps.push(item.unmetRequirements[0]);
    }
    if (item.price !== null && winner.price !== null && item.price > winner.price) {
      gaps.push(`costs ${formatINR(item.price - winner.price)} more than ${winner.name}`);
    }
    if (item.breakdown.performanceSpecs < winner.breakdown.performanceSpecs) {
      gaps.push(`scored lower on verified specs (${item.breakdown.performanceSpecs}/100 vs ${winner.breakdown.performanceSpecs}/100)`);
    }
    if (item.breakdown.budgetPrice < winner.breakdown.budgetPrice) {
      gaps.push(`scored lower on budget suitability (${item.breakdown.budgetPrice}/100 vs ${winner.breakdown.budgetPrice}/100)`);
    }
    if (gaps.length === 0) {
      gaps.push(`trailed narrowly on overall weighted score (${item.overallScore}/100 vs ${winner.overallScore}/100)`);
    }
    return {
      productId: item.productId,
      name: item.name,
      priceFormatted: item.priceFormatted,
      overallScore: item.overallScore,
      reason: `${item.name} (${item.priceFormatted}, ${item.overallScore}/100) is less suitable for your selected priorities because it ${gaps.slice(0, 2).join(' and ')}.`
    };
  });

  // Runner-up Analysis
  let runnerUpBlock = null;
  if (runnerUp) {
    const runnerAdvantages = [];
    if (runnerUp.price !== null && winner.price !== null && runnerUp.price < winner.price) {
      runnerAdvantages.push(`saving ${formatINR(winner.price - runnerUp.price)} upfront`);
    }
    if (runnerUp.breakdown.performanceSpecs > winner.breakdown.performanceSpecs) {
      runnerAdvantages.push('stronger raw specifications');
    }
    if ((runnerUp.rating || 0) > (winner.rating || 0)) {
      runnerAdvantages.push(`a slightly higher customer rating (${runnerUp.rating.toFixed(1)}★)`);
    }
    if (runnerUp.factualAdvantages[0]) {
      runnerAdvantages.push(runnerUp.factualAdvantages[0].replace(/\.$/, '').toLowerCase());
    }
    runnerUpBlock = {
      productId: runnerUp.productId,
      name: runnerUp.name,
      brand: runnerUp.brand,
      image: runnerUp.image,
      price: runnerUp.price,
      priceFormatted: runnerUp.priceFormatted,
      overallScore: runnerUp.overallScore,
      whenBetter: `${runnerUp.name} (${runnerUp.priceFormatted}, ${runnerUp.overallScore}/100) is a compelling alternative if you prefer ${runnerAdvantages.slice(0, 2).join(' or ') || 'a different brand and feature mix'}.`
    };
  }

  // Final Verdict
  const runnerContrast = runnerUp
    ? ` ${runnerUp.name} (${runnerUp.priceFormatted}) finishes second at ${runnerUp.overallScore}/100${runnerUp.unmetRequirements[0] ? `, held back mainly because it ${runnerUp.unmetRequirements[0].charAt(0).toLowerCase()}${runnerUp.unmetRequirements[0].slice(1)}` : ''}.`
    : '';
  const finalVerdict = `${prefPhrase}, ${winner.name} (${winner.priceFormatted}) is the best match at ${winner.overallScore}/100. It offers ${winner.factualAdvantages[0]?.replace(/\.$/, '').toLowerCase() || 'the strongest overall balance'}.${runnerContrast}`;

  return {
    bestProduct: {
      productId: winner.productId,
      name: winner.name,
      brand: winner.brand,
      image: winner.image,
      price: winner.price,
      priceFormatted: winner.priceFormatted,
      overallScore: winner.overallScore,
      reason: bestProductReason
    },
    whyBest: whyBestLines.join(' '),
    advantages: winner.factualAdvantages,
    disadvantages: winner.factualDisadvantages,
    priceValueAnalysis,
    otherProducts,
    runnerUp: runnerUpBlock,
    finalVerdict,
    incompleteDataNotice,
    disclaimer: 'AI suitability scores are advisory calculations derived from your selected priorities and available catalog records; they are not official manufacturer ratings or guarantees.'
  };
}

// ── 8. Existing Gemini AI Natural-Language Layer (Server-Side Only) ──────────

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function callGeminiForComparison(apiKey, scoringResult, matrix) {
  const { ranked, weights, preferencesApplied, incompleteDataNotice } = scoringResult;
  const winner = ranked[0];
  const runnerUp = ranked[1] || null;

  const compactProducts = ranked.map((r, idx) => ({
    rank: idx + 1,
    productId: r.productId,
    name: r.name,
    brand: r.brand,
    priceINR: r.price,
    originalPriceINR: r.originalPrice,
    discountPercent: r.discountPercent,
    rating: r.rating,
    reviewsCount: r.reviewsCount,
    stock: r.stock,
    overallScore: r.overallScore,
    scoreBreakdown: r.breakdown,
    specCompletenessPercent: r.specCompleteness.percentage,
    missingFields: r.specCompleteness.missingFields.slice(0, 6),
    verifiedSpecs: r.verifiedSpecs,
    matchedRequirements: r.matchedRequirements,
    unmetRequirements: r.unmetRequirements
  }));

  const prompt = `You are a transparent, zero-hallucination e-commerce product comparison analyst for TrustCart AI (Indian INR store).

STRICT ACCURACY RULES:
1. Use ONLY the verified product data, specs, prices, ratings, stock, and deterministic scores provided below.
2. NEVER invent any specification, price, rating, battery figure, RAM, storage, processor, or warranty value that is marked "Not Available".
3. Keep the winner strictly as rank 1 ("${winner.name}") and runner-up strictly as rank 2 (${runnerUp ? `"${runnerUp.name}"` : 'null'}).
4. Clearly note when data is incomplete if missing fields exist.
5. Never claim the AI score is an official rating or guarantee.

USER REQUIREMENTS:
${JSON.stringify(preferencesApplied, null, 2)}

APPLIED WEIGHTS (Total 100%):
${JSON.stringify(weights)}

VERIFIED RANKED PRODUCTS:
${JSON.stringify(compactProducts, null, 2)}

Return ONLY valid JSON with this exact schema:
{
  "bestProductReason": "1-2 clear sentences explaining why rank 1 is best for the user's preferences",
  "whyBest": "2-3 concise sentences explaining how rank 1 matches the user's requirements and weighted criteria",
  "advantages": ["3 to 5 bullet strings citing ONLY actual verified specs/price/ratings of rank 1"],
  "disadvantages": ["2 to 4 honest limitation/compromise bullet strings for rank 1 based on actual data or missing fields"],
  "priceValueAnalysis": "2-3 sentences explaining whether rank 1's price is justified by its verified specs and compared alternatives",
  "otherProducts": [
    { "productId": "exact id of each non-winning product", "reason": "1-2 sentences explaining why it is less suitable for the user's priorities" }
  ],
  "runnerUpWhenBetter": "1-2 sentences explaining when rank 2 might be a better choice",
  "finalVerdict": "2-3 clear, easy-to-understand concluding sentences referencing user's budget/priorities and actual products"
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errSnippet = (await response.text()).slice(0, 140);
      throw new Error(`Gemini API HTTP ${response.status}: ${errSnippet}`);
    }

    const payload = await response.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty Gemini comparison response');

    const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(cleaned);

    if (!parsed || typeof parsed !== 'object' || typeof parsed.finalVerdict !== 'string') {
      throw new Error('Malformed Gemini comparison JSON');
    }

    const base = buildDeterministicRecommendation(scoringResult, matrix);
    const aiOtherMap = new Map(
      (Array.isArray(parsed.otherProducts) ? parsed.otherProducts : [])
        .filter((x) => x && x.productId && typeof x.reason === 'string')
        .map((x) => [String(x.productId).toLowerCase(), sanitizeString(x.reason, 360)])
    );

    return {
      ...base,
      bestProduct: {
        ...base.bestProduct,
        reason: sanitizeString(parsed.bestProductReason, 400) || base.bestProduct.reason
      },
      whyBest: sanitizeString(parsed.whyBest, 600) || base.whyBest,
      advantages: Array.isArray(parsed.advantages) && parsed.advantages.length > 0
        ? parsed.advantages.map((a) => sanitizeString(String(a), 240)).filter(Boolean).slice(0, 6)
        : base.advantages,
      disadvantages: Array.isArray(parsed.disadvantages) && parsed.disadvantages.length > 0
        ? parsed.disadvantages.map((d) => sanitizeString(String(d), 240)).filter(Boolean).slice(0, 5)
        : base.disadvantages,
      priceValueAnalysis: sanitizeString(parsed.priceValueAnalysis, 600) || base.priceValueAnalysis,
      otherProducts: base.otherProducts.map((op) => ({
        ...op,
        reason: aiOtherMap.get(op.productId.toLowerCase()) || op.reason
      })),
      runnerUp: base.runnerUp
        ? {
            ...base.runnerUp,
            whenBetter: sanitizeString(parsed.runnerUpWhenBetter, 400) || base.runnerUp.whenBetter
          }
        : null,
      finalVerdict: sanitizeString(parsed.finalVerdict, 600) || base.finalVerdict,
      incompleteDataNotice
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── 9. Master Request Handlers ────────────────────────────────────────────────

export async function processCompareProductsRequest({ productIds, admin, ip = 'unknown' }) {
  if (checkCompareRateLimit(ip)) {
    return {
      status: 429,
      body: { ok: false, error: 'Too many comparison requests. Please wait a moment and try again.' }
    };
  }

  const validation = sanitizeProductIds(productIds);
  if (validation.error) {
    return {
      status: 400,
      body: { ok: false, error: validation.error, code: validation.code || 'INVALID_SELECTION' }
    };
  }

  const fetched = await fetchLiveProductsByIds(admin, validation.ids);
  if (fetched.invalidIds.length > 0) {
    return {
      status: 404,
      body: {
        ok: false,
        error: `Invalid or unavailable product ID(s): ${fetched.invalidIds.join(', ')}.`,
        invalidIds: fetched.invalidIds
      }
    };
  }

  if (fetched.products.length < MIN_COMPARE_PRODUCTS) {
    return {
      status: 400,
      body: {
        ok: false,
        error: `At least ${MIN_COMPARE_PRODUCTS} valid products are required for comparison.`
      }
    };
  }

  const matrix = buildComparisonMatrix(fetched.products);

  return {
    status: 200,
    body: {
      ok: true,
      fetchedAt: fetched.fetchedAt,
      dataSource: fetched.dataSource,
      hadDuplicatesRemoved: validation.hadDuplicates,
      matrix
    }
  };
}

export async function processCompareRecommendRequest({
  productIds,
  preferences = {},
  admin,
  geminiApiKey = '',
  ip = 'unknown',
  simulateAiFailure = false
}) {
  if (checkCompareRateLimit(ip)) {
    return {
      status: 429,
      body: { ok: false, error: 'Too many AI comparison requests. Please wait a moment and try again.' }
    };
  }

  const validation = sanitizeProductIds(productIds);
  if (validation.error) {
    return {
      status: 400,
      body: { ok: false, error: validation.error, code: validation.code || 'INVALID_SELECTION' }
    };
  }

  const fetched = await fetchLiveProductsByIds(admin, validation.ids);
  if (fetched.invalidIds.length > 0) {
    return {
      status: 404,
      body: {
        ok: false,
        error: `Invalid or unavailable product ID(s): ${fetched.invalidIds.join(', ')}.`,
        invalidIds: fetched.invalidIds
      }
    };
  }

  const matrix = buildComparisonMatrix(fetched.products);
  const scoring = scoreComparedProducts(matrix, preferences);

  let recommendation;
  let aiEnhanced = false;
  let fallbackUsed = false;
  let aiNotice = null;

  if (simulateAiFailure) {
    recommendation = buildDeterministicRecommendation(scoring, matrix);
    fallbackUsed = true;
    aiNotice = 'External AI explanation service was unavailable. Recommendation was generated using verified product data and our deterministic weighted scoring engine.';
  } else if (geminiApiKey && geminiApiKey.trim()) {
    try {
      recommendation = await callGeminiForComparison(geminiApiKey.trim(), scoring, matrix);
      aiEnhanced = true;
    } catch (err) {
      console.warn('[compareService] Gemini explanation failed, falling back to deterministic engine:', err.message);
      recommendation = buildDeterministicRecommendation(scoring, matrix);
      fallbackUsed = true;
      aiNotice = 'External AI explanation service temporarily timed out. Showing verified deterministic weighted recommendation instead.';
    }
  } else {
    recommendation = buildDeterministicRecommendation(scoring, matrix);
    fallbackUsed = true;
    aiNotice = 'Generated using our transparent weighted evaluation engine on live verified catalog data.';
  }

  return {
    status: 200,
    body: {
      ok: true,
      fetchedAt: fetched.fetchedAt,
      dataSource: fetched.dataSource,
      aiEnhanced,
      fallbackUsed,
      aiNotice,
      matrix,
      scoring: {
        weights: scoring.weights,
        ranked: scoring.ranked,
        preferencesApplied: scoring.preferencesApplied,
        incompleteDataNotice: scoring.incompleteDataNotice
      },
      recommendation
    }
  };
}
