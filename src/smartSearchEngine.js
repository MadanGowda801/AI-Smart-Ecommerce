/**
 * TrustCart AI — Shared Smart Natural-Language Search & Ranking Engine
 *
 * Used across:
 *   - Frontend SearchResultsPage.jsx & ProductsPage.jsx
 *   - AI Shopping Chatbot (aiChatService.js & trustCartAgentService.js)
 *   - Backend /api/ai-search (server/aiSearchService.js)
 *
 * Capabilities:
 *   1. Full Indian & international price parsing WITH OR WITHOUT spaces
 *      ("60 k", "60k", "1.5 lakh", "60 thousand", "₹60,000", "rs 60000", "between 20k and 60k", "around 25k")
 *   2. Automatic typo tolerance (explicit map + Damerau-Levenshtein distance)
 *      ("laptos" -> "laptop", "hedphones" -> "headphone", "smartfone" -> "smartphone", "moniter" -> "monitor")
 *   3. Exact product sub-type detection ("laptops" -> laptop only, not SSD/monitor in Electronics)
 *   4. Feature, specification & use-case matching (RAM, storage, battery, camera, display, ANC, waterproof,
 *      gaming, student/office/coding, creator, wireless, fast charging, high refresh rate, etc.)
 *   5. Smart sort intent detection (best/top rated, cheapest/budget, premium, popular, highest discount)
 *   6. Graceful close-alternative fallback when strict budget yields 0 exact matches.
 *
 * Zero browser-only dependencies.
 */

// ── 1. Vocabulary & Typo Correction ───────────────────────────────────────────

const DIRECT_TYPO_MAP = {
  laptos: 'laptop',
  lapto: 'laptop',
  laptp: 'laptop',
  laptps: 'laptop',
  labtop: 'laptop',
  labtops: 'laptop',
  latop: 'laptop',
  latops: 'laptop',
  lptop: 'laptop',
  lptops: 'laptop',
  lappy: 'laptop',
  lappies: 'laptop',
  notebok: 'notebook',
  ultrabok: 'ultrabook',
  mackbook: 'macbook',
  macbok: 'macbook',
  moble: 'mobile',
  mobles: 'mobile',
  mobils: 'mobile',
  mobil: 'mobile',
  fone: 'phone',
  fones: 'phone',
  phne: 'phone',
  phnes: 'phone',
  smartfone: 'smartphone',
  smartfones: 'smartphone',
  smartphne: 'smartphone',
  smartphnes: 'smartphone',
  smartphons: 'smartphone',
  smatphone: 'smartphone',
  smrtphone: 'smartphone',
  hedphone: 'headphone',
  hedphones: 'headphone',
  headphne: 'headphone',
  headphnes: 'headphone',
  headphons: 'headphone',
  heaphones: 'headphone',
  earfon: 'earphone',
  earfones: 'earphone',
  earbd: 'earbud',
  earbds: 'earbud',
  earbus: 'earbud',
  airpod: 'earbud',
  airpods: 'earbud',
  tws: 'earbud',
  speker: 'speaker',
  spekers: 'speaker',
  spekar: 'speaker',
  soundbr: 'soundbar',
  micropone: 'microphone',
  keybord: 'keyboard',
  keybords: 'keyboard',
  keybaord: 'keyboard',
  keybaords: 'keyboard',
  keboard: 'keyboard',
  mose: 'mouse',
  mous: 'mouse',
  moniter: 'monitor',
  moniters: 'monitor',
  monitr: 'monitor',
  monitrs: 'monitor',
  scren: 'display',
  disply: 'display',
  camra: 'camera',
  camras: 'camera',
  camrea: 'camera',
  batery: 'battery',
  batry: 'battery',
  battry: 'battery',
  chargre: 'charger',
  chargr: 'charger',
  chager: 'charger',
  powerbnk: 'powerbank',
  pwerbank: 'powerbank',
  watc: 'watch',
  wach: 'watch',
  watchs: 'watch',
  smartwtch: 'smartwatch',
  smartwach: 'smartwatch',
  gamng: 'gaming',
  gming: 'gaming',
  gamin: 'gaming',
  blutooth: 'bluetooth',
  bluethooth: 'bluetooth',
  wireles: 'wireless',
  wirels: 'wireless',
  wrieless: 'wireless',
  waterprof: 'waterproof',
  noisecancelling: 'anc',
  noisecanceling: 'anc',
  studnt: 'student',
  studnet: 'student',
  ofice: 'office',
  progamming: 'programming',
  codng: 'coding',
  chepest: 'cheapest',
  cheep: 'cheap',
  buget: 'budget',
  budgt: 'budget',
  dorbell: 'doorbell',
  sensr: 'sensor',
  curtan: 'curtain',
  aerobok: 'aerobook',
  probok: 'probook',
  createrbook: 'creatorbook',
  sonicpod: 'sonicpods',
  fitbnd: 'fitband',
  activewtch: 'activewatch',
  controler: 'controller',
  webcm: 'webcam',
  captrue: 'capture'
};

const FUZZY_VOCABULARY = [
  'laptop', 'ultrabook', 'notebook', 'desktop', 'monitor', 'storage', 'workstation',
  'smartphone', 'mobile', 'phone', 'foldable', 'smartwatch', 'watch', 'fitness', 'tracker',
  'headphone', 'earphone', 'earbud', 'headset', 'speaker', 'soundbar', 'microphone', 'podcast', 'audio',
  'camera', 'security', 'doorbell', 'sensor', 'temperature', 'motion', 'curtain', 'remote', 'smarthome',
  'charger', 'powerbank', 'adapter', 'keyboard', 'mechanical', 'mouse', 'ergonomic', 'sleeve', 'stand',
  'gaming', 'controller', 'gamepad', 'webcam', 'capture', 'esports',
  'wireless', 'bluetooth', 'waterproof', 'battery', 'display', 'amoled', 'charging', 'touchscreen', 'stylus',
  'student', 'office', 'programming', 'coding', 'creator', 'editing', 'business', 'portable', 'lightweight',
  'aerobook', 'probook', 'ultraslim', 'creatorbook', 'everyday', 'aerotech', 'novacompute', 'voltpc',
  'viewmax', 'hyperdrive', 'novamobile', 'pixelone', 'maxview', 'foldx', 'pulsefit', 'fitband',
  'activewatch', 'safekid', 'auraring', 'sonicpods', 'sonicwave', 'studioover', 'bassboost', 'beatpulse',
  'clearcall', 'voicepro', 'partybox', 'miniboom', 'lumihome', 'safeguard', 'voltcharge', 'findmate',
  'urbancarry', 'keycraft', 'hypergear', 'streamcast', 'sony', 'apple', 'samsung', 'keychron', 'macbook'
];

const KNOWN_BRANDS = [
  'aerotech', 'novacompute', 'voltpc', 'viewmax', 'hyperdrive',
  'novamobile', 'pixelone', 'maxview', 'pulsefit', 'safekid', 'auraring',
  'sonicwave', 'beatpulse', 'voicepro', 'lumihome', 'safeguard',
  'voltcharge', 'findmate', 'urbancarry', 'keycraft', 'hypergear', 'streamcast',
  'apple', 'samsung', 'sony', 'lg', 'oneplus', 'realme', 'redmi', 'xiaomi',
  'oppo', 'vivo', 'asus', 'dell', 'hp', 'lenovo', 'bose', 'boat', 'jbl',
  'sennheiser', 'logitech', 'keychron', 'belkin', 'razer', 'anker'
];

const CATEGORY_KEYWORD_MAP = {
  electronics: ['laptop', 'ultrabook', 'notebook', 'macbook', 'desktop', 'pc', 'computer', 'workstation', 'ssd', 'electronics', 'all-in-one'],
  smartphones: ['smartphone', 'phone', 'mobile', 'foldable', 'android', 'iphone', 'smartwatch', 'watch', 'fitness band', 'smart band', 'smart ring', 'wearable'],
  audio: ['headphone', 'earphone', 'earbud', 'headset', 'speaker', 'soundbar', 'microphone', 'mic', 'podcast', 'audio', 'anc'],
  'smart-home': ['smart home', 'smarthome', 'iot', 'bulb', 'led bulb', 'smart plug', 'ir remote', 'security camera', 'indoor camera', 'outdoor camera', 'doorbell', 'motion sensor', 'temperature sensor', 'curtain', 'smart display'],
  accessories: ['accessory', 'accessories', 'charger', 'power bank', 'powerbank', 'usb-c hub', 'hub', 'charging pad', 'tracker tag', 'sleeve', 'laptop stand', 'stand', 'ergonomic mouse'],
  gaming: ['gaming', 'esports', 'gaming monitor', 'gaming keyboard', 'gaming mouse', 'controller', 'gamepad', 'capture card', 'webcam', 'streaming', 'desk light', 'rgb']
};

/**
 * Specific sub-type keywords so "laptops under 60k" returns ONLY laptops (not monitors/SSDs),
 * "smartwatch" returns watches (not phones), "earbuds" returns earbuds, etc.
 */
const PRODUCT_SUBTYPES = [
  { key: 'laptop', category: 'electronics', patterns: [/\blaptops?\b/i, /\bultrabooks?\b/i, /\bnotebooks?\b/i, /\bmacbooks?\b/i, /\bworkstations?\b/i], matchProduct: (p) => /\blaptop\b|\bultrabook\b|\bmacbook\b/i.test(p.name || '') && !/\b(?:sleeve|stand|power\s*bank|charger|hub|bag|case|cooler|table)\b/i.test(p.name || '') },
  { key: 'desktop', category: 'electronics', patterns: [/\bdesktops?\b/i, /\bmini\s*pc\b/i, /\ball[-\s]in[-\s]one\b/i], matchProduct: (p) => /\bdesktop\b|\bmini\s*pc\b/i.test(p.name || '') },
  { key: 'monitor', category: null, patterns: [/\bmonitors?\b/i], matchProduct: (p) => /\bmonitor\b/i.test(p.name || '') },
  { key: 'ssd', category: 'electronics', patterns: [/\bssds?\b/i, /\bportable\s*storage\b/i], matchProduct: (p) => /\bssd\b/i.test(p.name || '') },
  { key: 'smartphone', category: 'smartphones', patterns: [/\bsmartphones?\b/i, /\bphones?\b/i, /\bmobiles?\b/i, /\bfoldables?\b/i, /\bandroid\b/i, /\biphones?\b/i], matchProduct: (p) => /\bsmartphone\b|\bphone\b|\bfoldable\b|\bgalaxy\b|\biphone\b/i.test(p.name || '') && !/\b(?:headphone|earphone|microphone|charger|power\s*bank|case|stand)\b/i.test(p.name || '') },
  { key: 'smartwatch', category: 'smartphones', patterns: [/\bsmartwatch(?:es)?\b/i, /\bwatch(?:es)?\b/i, /\bfitness\s*(?:band|tracker)s?\b/i, /\bsmart\s*bands?\b/i, /\bsmart\s*rings?\b/i, /\bwearables?\b/i], matchProduct: (p) => /\bwatch\b|\bband\b|\bring\b/i.test(p.name || '') },
  { key: 'earbuds', category: 'audio', patterns: [/\bearbuds?\b/i, /\btws\b/i, /\bairpods?\b/i, /\bsonicpods?\b/i], matchProduct: (p) => /\bearbuds?\b|\bpods?\b|\btws\b/i.test(`${p.name || ''} ${(p.tags || []).join(' ')}`) },
  { key: 'headphones', category: 'audio', patterns: [/\bheadphones?\b/i, /\bheadsets?\b/i, /\bearphones?\b/i], matchProduct: (p) => /\bheadphone|\bheadset|\bearbud|\bpods\b/i.test(p.name || '') },
  { key: 'speaker', category: 'audio', patterns: [/\bspeakers?\b/i, /\bsoundbars?\b/i], matchProduct: (p) => /\bspeaker\b|\bsoundbar\b/i.test(p.name || '') },
  { key: 'microphone', category: 'audio', patterns: [/\bmicrophones?\b/i, /\bmics?\b/i, /\bpodcast\b/i], matchProduct: (p) => /\bmicrophone\b|\bpodcast\b/i.test(p.name || '') },
  { key: 'security_camera', category: 'smart-home', patterns: [/\bsecurity\s*cameras?\b/i, /\bindoor\s*cameras?\b/i, /\boutdoor\s*cameras?\b/i, /\bsmart\s*home\s*cameras?\b/i, /\bdoorbells?\b/i, /\bwifi\s*cameras?\b/i, /\bwi-fi\s*cameras?\b/i, /\b2k\s*cameras?\b/i], matchProduct: (p) => /\bcamera\b|\bdoorbell\b/i.test(p.name || '') },
  { key: 'smart_lighting', category: 'smart-home', patterns: [/\bbulbs?\b/i, /\bsmart\s*lights?\b/i, /\bled\s*bulbs?\b/i, /\bdesk\s*lights?\b/i], matchProduct: (p) => /\bbulb\b|\blight\b/i.test(p.name || '') },
  { key: 'smart_plug_sensor', category: 'smart-home', patterns: [/\bsmart\s*plugs?\b/i, /\bsensors?\b/i, /\bcurtains?\b/i, /\bir\s*remote\b/i], matchProduct: (p) => /\bplug\b|\bsensor\b|\bcurtain\b|\bremote\b/i.test(p.name || '') },
  { key: 'charger', category: 'accessories', patterns: [/\bchargers?\b/i, /\bcharging\s*pads?\b/i, /\bgan\b/i], matchProduct: (p) => /\bcharger\b|\bcharging\s*pad\b/i.test(p.name || '') },
  { key: 'power_bank', category: 'accessories', patterns: [/\bpower\s*banks?\b/i, /\bpowerbanks?\b/i], matchProduct: (p) => /\bpower\s*bank\b/i.test(p.name || '') },
  { key: 'keyboard', category: null, patterns: [/\bkeyboards?\b/i], matchProduct: (p) => /\bkeyboard\b/i.test(p.name || '') },
  { key: 'mouse', category: null, patterns: [/\bmice\b/i, /\bmouse\b/i], matchProduct: (p) => /\bmouse\b/i.test(p.name || '') },
  { key: 'controller', category: 'gaming', patterns: [/\bcontrollers?\b/i, /\bgamepads?\b/i], matchProduct: (p) => /\bcontroller\b|\bgamepad\b/i.test(`${p.name || ''} ${(p.tags || []).join(' ')}`) },
  { key: 'webcam', category: 'gaming', patterns: [/\bwebcams?\b/i, /\bcapture\s*cards?\b/i], matchProduct: (p) => /\bwebcam\b|\bcapture\s*card\b/i.test(p.name || '') }
];

const FEATURE_PATTERNS = {
  ram_16plus: { label: '16GB+ RAM', queryRe: /\b(?:16|24|32)\s*gb(?:\s*(?:ddr\d|ram|memory))?\b/i, productRe: /\b(?:16|24|32)\s*gb\b/i },
  ram_12plus: { label: '12GB+ RAM', queryRe: /\b12\s*gb(?:\s*ram)?\b/i, productRe: /\b(?:12|16|24|32)\s*gb\b/i },
  ssd_storage: { label: 'SSD / High Storage', queryRe: /\b(?:ssd|nvme|512\s*gb|1\s*tb|256\s*gb|more\s*storage)\b/i, productRe: /\b(?:ssd|nvme|512gb|1tb|256gb|ufs)\b/i },
  battery: { label: 'Long Battery', queryRe: /\b(?:battery|mah|5000\s*mah|6000\s*mah|long\s*battery|backup|all[-\s]day)\b/i, productRe: /\b(?:5000mah|6000mah|14-hour|14-day|36-hour|45-hour|50\s*hours|18-hour|battery|20000mah|10000mah)\b/i },
  fast_charging: { label: 'Fast Charging', queryRe: /\b(?:fast\s*charg|turbo\s*charg|quick\s*charg|65w|67w|pd\s*charg|wireless\s*charg)\b/i, productRe: /\b(?:67w|65w|22\.5w|100w|15w\s*qi2|fast\s*(?:usb-c|charging|wall)|turbo\s*charging|wireless\s*charging)\b/i },
  camera: { label: 'Camera / Photography', queryRe: /\b(?:camera|photo|photography|ois|64mp|50mp|night\s*sight|night\s*vision|selfie)\b/i, productRe: /\b(?:64mp|50mp|ois|triple|night\s*sight|computational\s*photography|2k\s*qhd|night\s*vision|1080p\s*60fps|webcam)\b/i },
  oled_amoled: { label: 'OLED / AMOLED Display', queryRe: /\b(?:oled|amoled|super\s*amoled|ltpo|hdr|best\s*display)\b/i, productRe: /\b(?:oled|amoled|ltpo|hdr10|displayhdr|dci-p3)\b/i },
  high_refresh: { label: 'High Refresh Rate', queryRe: /\b(?:120\s*hz|144\s*hz|165\s*hz|high\s*refresh|refresh\s*rate|smooth\s*display)\b/i, productRe: /\b(?:120hz|144hz|165hz|60fps)\b/i },
  resolution_4k: { label: '4K / QHD / 3.2K', queryRe: /\b(?:4k|uhd|3\.2k|2k|qhd|high\s*res|high\s*resolution)\b/i, productRe: /\b(?:4k|uhd|3\.2k|2k|qhd|3840x2160|2560x1440)\b/i },
  anc: { label: 'Active Noise Cancellation', queryRe: /\b(?:anc|noise\s*cancell|noise\s*cancel|quiet|enc)\b/i, productRe: /\b(?:anc|active\s*noise|noise-cancelling|enc)\b/i },
  five_g: { label: '5G Connectivity', queryRe: /\b5g\b/i, productRe: /\b5g\b/i },
  wireless: { label: 'Wireless / Bluetooth', queryRe: /\b(?:wireless|bluetooth|cordless|wifi|wi-fi)\b/i, productRe: /\b(?:wireless|bluetooth|wi-fi|2\.4ghz)\b/i },
  waterproof: { label: 'Water / Weather Resistant', queryRe: /\b(?:waterproof|water\s*resistant|sweat\s*resistant|weatherproof|swim|ipx5|ipx7|ip65|ip66|ip67|5atm)\b/i, productRe: /\b(?:waterproof|water\s*resistance|water-repellent|sweat\s*resistance|weatherproof|swim|ipx5|ipx7|ip65|ip66|ip67|5atm)\b/i },
  touchscreen: { label: 'Touchscreen / Stylus', queryRe: /\b(?:touchscreen|touch\s*screen|2[-\s]in[-\s]1|convertible|stylus)\b/i, productRe: /\b(?:touchscreen|touch|2-in-1|convertible|stylus)\b/i },
  gaming: { label: 'Gaming Performance', queryRe: /\b(?:gaming|gamer|esports|rtx|ray[-\s]tracing|freesync|g-sync|surround|7\.1|dpi|rgb)\b/i, productRe: /\b(?:gaming|esports|ray-tracing|rtx|165hz|144hz|1ms|freesync|g-sync|surround|7\.1|26,000\s*dpi|rgb|vapor\s*chamber|hall-effect)\b/i },
  student_office: { label: 'Student & Office', queryRe: /\b(?:student|college|office|coding|programming|work\s*from\s*home|wfh|business|productivity|online\s*class|multitasking|everyday|daily)\b/i, productRe: /\b(?:student|office|coding|multitasking|business|work\s*from\s*home|everyday|14-hour|ultrabook|ergonomic|teams|zoom|16gb)\b/i },
  creator: { label: 'Creator / Editing', queryRe: /\b(?:creator|video\s*editing|editing|graphic\s*design|studio|streaming|podcast|render)\b/i, productRe: /\b(?:creator|workstation|studio|dci-p3|srgb|32gb|ray-tracing|streaming|podcast|4k|capture)\b/i },
  lightweight: { label: 'Lightweight / Portable', queryRe: /\b(?:lightweight|light\s*weight|slim|thin|portable|compact|travel|featherweight)\b/i, productRe: /\b(?:lightweight|ultra-lightweight|featherweight|ultraslim|1\.1\s*kg|compact|pocket|portable|slim|foldable|ultralight)\b/i },
  gps_health: { label: 'GPS / Health Tracking', queryRe: /\b(?:gps|heart\s*rate|spo2|ecg|sleep|fitness|health|blood\s*pressure|sos)\b/i, productRe: /\b(?:gps|heart-rate|spo2|ecg|sleep|fitness|health|hrv|sos|workout)\b/i },
  extra_bass: { label: 'Extra Bass / Dolby', queryRe: /\b(?:bass|extra\s*bass|dolby|subwoofer|hi-res|ldac|spatial|audiophile)\b/i, productRe: /\b(?:bass|bassboost|dolby|subwoofer|ldac|hi-res|spatial|audiophile|beryllium|50w|180w)\b/i }
};

const STOP_WORDS = new Set([
  'show', 'me', 'find', 'search', 'for', 'look', 'looking', 'give', 'get', 'display', 'list',
  'i', 'want', 'need', 'would', 'like', 'to', 'buy', 'purchase', 'recommend', 'suggest',
  'a', 'an', 'the', 'some', 'any', 'my', 'our', 'your', 'please', 'pls', 'plz', 'hey', 'hi',
  'with', 'having', 'that', 'has', 'have', 'and', 'or', 'in', 'of', 'on', 'at', 'by', 'is', 'are',
  'good', 'great', 'nice', 'best', 'top', 'rated', 'stars', 'star', 'product', 'products', 'item', 'items',
  'cheap', 'cheapest', 'affordable', 'budget', 'low', 'lowest', 'high', 'highest', 'premium', 'expensive',
  'most', 'popular', 'trending', 'latest', 'newest', 'deals', 'deal', 'discount', 'offer', 'offers', 'sale',
  'under', 'below', 'above', 'over', 'within', 'upto', 'up', 'less', 'more', 'than', 'between', 'from',
  'around', 'near', 'approx', 'starting', 'max', 'min', 'rs', 'inr', 'rupee', 'rupees', 'price', 'cost',
  'available', 'stock', 'only', 'can', 'you', 'what', 'which', 'ones', 'one', 'something', 'anything', 'all', 'k', 'lakh', 'lac', 'thousand'
]);

// ── 2. Damerau-Levenshtein Distance for Typo Correction ───────────────────────

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

function singularizeWord(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ches') || word.endsWith('shes') || word.endsWith('xes')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is') && word !== 'windows' && word !== 'esports' && word !== 'sonicpods') {
    return word.slice(0, -1);
  }
  return word;
}

export function normalizeAndCorrectQuery(rawQuery) {
  const original = String(rawQuery || '').trim();
  if (!original) return { normalized: '', corrections: [] };

  const corrections = [];
  // Normalize spaced price suffixes like "60 k" -> "60k", "1.5 lakh" -> "1.5lakh", "60 thousand" -> "60000"
  let pre = original
    .replace(/(\d[\d,]*(?:\.\d+)?)\s+(k)\b/gi, '$1k')
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?)\b/gi, '$1lakh')
    .replace(/(\d[\d,]*(?:\.\d+)?)\s+thousands?\b/gi, (_, num) => {
      const n = parseFloat(num.replace(/,/g, ''));
      return Number.isFinite(n) ? String(Math.round(n * 1000)) : `${num}000`;
    })
    .replace(/\bpower\s+bank/gi, 'powerbank')
    .replace(/\bsmart\s+watch/gi, 'smartwatch')
    .replace(/\bsmart\s+phone/gi, 'smartphone');

  const tokens = pre.split(/\s+/);
  const correctedTokens = tokens.map((tok) => {
    const clean = tok.toLowerCase().replace(/^[^a-z0-9₹]+|[^a-z0-9]+$/g, '');
    if (!clean || /\d/.test(clean) || clean.length <= 2 || STOP_WORDS.has(clean)) {
      return tok;
    }

    if (DIRECT_TYPO_MAP[clean]) {
      const target = DIRECT_TYPO_MAP[clean];
      if (target !== clean) corrections.push({ from: clean, to: target });
      return tok.toLowerCase().replace(clean, target);
    }

    const sing = singularizeWord(clean);
    if (DIRECT_TYPO_MAP[sing]) {
      const target = DIRECT_TYPO_MAP[sing];
      if (target !== sing) corrections.push({ from: clean, to: target });
      return tok.toLowerCase().replace(clean, target);
    }

    // Already an exact known vocabulary word
    if (FUZZY_VOCABULARY.includes(clean) || FUZZY_VOCABULARY.includes(sing)) {
      return tok;
    }

    // Fuzzy correction only for words >= 4 letters
    if (clean.length >= 4) {
      const maxDist = clean.length >= 6 ? 2 : 1;
      let bestMatch = null;
      let bestDist = maxDist + 1;

      for (const vocab of FUZZY_VOCABULARY) {
        if (Math.abs(vocab.length - clean.length) > maxDist) continue;
        // Require same first letter or close transposition to avoid bad false corrections
        if (vocab[0] !== clean[0] && vocab[1] !== clean[0]) continue;
        const d = editDistance(clean, vocab);
        if (d < bestDist) {
          bestDist = d;
          bestMatch = vocab;
        }
      }

      if (bestMatch && bestDist <= maxDist) {
        corrections.push({ from: clean, to: bestMatch });
        return tok.toLowerCase().replace(clean, bestMatch);
      }
    }

    return tok;
  });

  return {
    normalized: correctedTokens.join(' '),
    corrections
  };
}

// ── 3. Price Parser (Handles "60 k", "60k", "1.5 lakh", "rs 60,000", ranges) ─

export function parseIndianPriceToken(raw) {
  if (raw === undefined || raw === null) return null;
  let cleaned = String(raw)
    .toLowerCase()
    .replace(/[₹,\s]/g, '')
    .replace(/^(?:rs\.?|inr|rupees?)/i, '')
    .replace(/(?:rs\.?|inr|rupees?)$/i, '')
    .trim();

  if (!cleaned) return null;

  if (/lakh|lac$/i.test(cleaned)) {
    const val = parseFloat(cleaned.replace(/lakhs?|lacs?/i, ''));
    return Number.isFinite(val) && val > 0 ? Math.round(val * 100000) : null;
  }
  if (cleaned.endsWith('k')) {
    const val = parseFloat(cleaned.slice(0, -1));
    return Number.isFinite(val) && val > 0 ? Math.round(val * 1000) : null;
  }
  if (cleaned.endsWith('l') && /^\d+(?:\.\d+)?l$/.test(cleaned)) {
    const val = parseFloat(cleaned.slice(0, -1));
    return Number.isFinite(val) && val > 0 ? Math.round(val * 100000) : null;
  }
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
}

const PRICE_TOKEN_PATTERN = '(?:₹|rs\\.?|inr|rupees?)?\\s*(\\d[\\d,]*(?:\\.\\d+)?\\s*(?:k|lakhs?|lacs?)?)(?:\\s*(?:rs\\.?|inr|rupees?|bucks))?';

export function extractPriceBounds(normalizedText) {
  const text = String(normalizedText || '').toLowerCase();
  let minPrice = null;
  let maxPrice = null;
  let approxPrice = null;
  let stripped = text;

  // 1. Range: "between 15k and 30k", "15000 to 30000", "20k - 60k"
  const rangeRe = new RegExp(`(?:between|from)?\\s*${PRICE_TOKEN_PATTERN}\\s*(?:to|and|-|–)\\s*${PRICE_TOKEN_PATTERN}`, 'i');
  const rangeMatch = text.match(rangeRe);
  if (rangeMatch) {
    const p1 = parseIndianPriceToken(rangeMatch[1]);
    const p2 = parseIndianPriceToken(rangeMatch[2]);
    // Ignore tiny non-price ranges like "2-in-1" or "7-in-1" or "2.1"
    if (p1 !== null && p2 !== null && (p1 >= 100 || p2 >= 100)) {
      minPrice = Math.min(p1, p2);
      maxPrice = Math.max(p1, p2);
      stripped = stripped.replace(rangeMatch[0], ' ');
      return { minPrice, maxPrice, approxPrice, stripped };
    }
  }

  // 2. Max price: "under 60k", "below rs 60000", "less than 50k", "<= 60k", "budget 40k", "60k budget"
  const underRe = new RegExp(`(?:under|below|less\\s*than|within|up\\s*to|upto|max(?:imum)?|budget(?:\\s*of)?|<=|<)\\s*${PRICE_TOKEN_PATTERN}`, 'i');
  const underMatch = stripped.match(underRe);
  if (underMatch) {
    const val = parseIndianPriceToken(underMatch[1]);
    if (val !== null && val > 0) {
      maxPrice = val;
      stripped = stripped.replace(underMatch[0], ' ');
    }
  }

  if (maxPrice === null) {
    const suffixBudgetRe = new RegExp(`${PRICE_TOKEN_PATTERN}\\s*(?:budget|or\\s*less|or\\s*below|max|maximum|and\\s*under|under)`, 'i');
    const suffixMatch = stripped.match(suffixBudgetRe);
    if (suffixMatch) {
      const val = parseIndianPriceToken(suffixMatch[1]);
      if (val !== null && val >= 100) {
        maxPrice = val;
        stripped = stripped.replace(suffixMatch[0], ' ');
      }
    }
  }

  // 3. Min price: "above 50k", "over 30000", "more than 20k", ">= 15k", "starting from 10k"
  const overRe = new RegExp(`(?:above|over|more\\s*than|greater\\s*than|starting\\s*(?:from|at)?|min(?:imum)?|at\\s*least|>=|>)\\s*${PRICE_TOKEN_PATTERN}`, 'i');
  const overMatch = stripped.match(overRe);
  if (overMatch) {
    const val = parseIndianPriceToken(overMatch[1]);
    if (val !== null && val > 0) {
      minPrice = val;
      stripped = stripped.replace(overMatch[0], ' ');
    }
  }

  // 4. Around / approx price: "around 25k", "near 60000"
  if (minPrice === null && maxPrice === null) {
    const aroundRe = new RegExp(`(?:around|near|approx(?:imately)?|about|close\\s*to)\\s*${PRICE_TOKEN_PATTERN}`, 'i');
    const aroundMatch = stripped.match(aroundRe);
    if (aroundMatch) {
      const val = parseIndianPriceToken(aroundMatch[1]);
      if (val !== null && val >= 100) {
        approxPrice = val;
        minPrice = Math.round(val * 0.75);
        maxPrice = Math.round(val * 1.25);
        stripped = stripped.replace(aroundMatch[0], ' ');
      }
    }
  }

  // 5. Shorthand standalone price with explicit currency or k/lakh (e.g. "60k laptop", "₹25000 phone")
  if (minPrice === null && maxPrice === null) {
    const shorthandMatch = stripped.match(/(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*(?:\.\d+)?(?:k|lakhs?|lacs?)?)|\b(\d+(?:\.\d+)?(?:k|lakhs?|lacs?))\b/i);
    if (shorthandMatch) {
      const rawTok = shorthandMatch[1] || shorthandMatch[2];
      // Ignore resolution like "4k", "2k", "3.2k"
      if (!/^(?:2|3\.2|4|5|6|8)k$/i.test(rawTok)) {
        const val = parseIndianPriceToken(rawTok);
        if (val !== null && val >= 500) {
          maxPrice = val;
          stripped = stripped.replace(shorthandMatch[0], ' ');
        }
      }
    }
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    const tmp = minPrice;
    minPrice = maxPrice;
    maxPrice = tmp;
  }

  return { minPrice, maxPrice, approxPrice, stripped };
}

// ── 4. Master Query Parser ────────────────────────────────────────────────────

export function parseSmartSearchQuery(rawQuery) {
  const originalQuery = String(rawQuery || '').trim();
  const { normalized, corrections } = normalizeAndCorrectQuery(originalQuery);
  const lower = normalized.toLowerCase();

  const { minPrice, maxPrice, approxPrice, stripped } = extractPriceBounds(lower);

  // Rating extraction
  let minRating = null;
  const explicitRating = lower.match(/(?:above|over|at\s*least|min(?:imum)?|rated)?\s*([3-5](?:\.\d)?)\s*(?:\+\s*)?(?:stars?|★|\/5)/i);
  if (explicitRating) {
    minRating = parseFloat(explicitRating[1]);
  } else if (/\b(?:top\s*rated|best\s*rated|highly\s*rated|highest\s*rated)\b/i.test(lower)) {
    minRating = 4.5;
  }

  // Sort intent detection
  let sortBy = 'relevance';
  let sortReason = null;
  if (/\b(?:cheapest|lowest\s*price|budget|affordable|economical|low\s*to\s*high|under\s*budget)\b/i.test(lower)) {
    sortBy = 'priceAsc';
    sortReason = 'Price: Low to High';
  } else if (/\b(?:most\s*expensive|costliest|high\s*to\s*low|luxury)\b/i.test(lower)) {
    sortBy = 'priceDesc';
    sortReason = 'Price: High to Low';
  } else if (/\b(?:highest\s*discount|biggest\s*discount|best\s*deals?|most\s*discount|on\s*sale|offers?)\b/i.test(lower)) {
    sortBy = 'discountDesc';
    sortReason = 'Highest Discount';
  } else if (/\b(?:best|top\s*rated|best\s*rated|highly\s*rated|top|flagship|recommended)\b/i.test(lower)) {
    sortBy = 'ratingDesc';
    sortReason = 'Top Rated';
  } else if (/\b(?:popular|trending|best\s*seller|most\s*reviewed|most\s*bought)\b/i.test(lower)) {
    sortBy = 'popular';
    sortReason = 'Most Popular';
  } else if (/\b(?:newest|latest)\b/i.test(lower)) {
    sortBy = 'newest';
    sortReason = 'Newest';
  }

  // Stock intent
  const inStockOnly = /\b(?:in\s*stock|available\s*now|ready\s*to\s*ship)\b/i.test(lower);

  // Sub-type detection (precise product type like laptop, monitor, smartphone, earbuds, keyboard)
  let subType = null;
  for (const st of PRODUCT_SUBTYPES) {
    if (st.patterns.some((re) => re.test(lower))) {
      subType = st;
      break;
    }
  }

  // Category detection
  let category = subType?.category || null;
  if (!category) {
    for (const [catKey, keywords] of Object.entries(CATEGORY_KEYWORD_MAP)) {
      if (keywords.some((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i').test(lower))) {
        category = catKey;
        break;
      }
    }
  }

  // Brand detection
  let brand = null;
  for (const b of KNOWN_BRANDS) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(lower)) {
      brand = b;
      break;
    }
  }

  // Feature & use-case detection
  const features = [];
  for (const [fKey, fDef] of Object.entries(FEATURE_PATTERNS)) {
    if (fDef.queryRe.test(lower)) {
      features.push({ key: fKey, label: fDef.label });
    }
  }

  // Clean remaining semantic keywords
  const keywordTokens = stripped
    .replace(/[₹.,!?()[\]{}:;"']/g, ' ')
    .split(/\s+/)
    .map((t) => singularizeWord(t.trim().toLowerCase()))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const uniqueKeywords = [...new Set(keywordTokens)];

  // Build concise human-readable searchTerm (excluding price/stop words)
  const searchTerm = uniqueKeywords.length > 0 ? uniqueKeywords.join(' ') : null;

  const isNaturalLanguage =
    minPrice !== null ||
    maxPrice !== null ||
    minRating !== null ||
    features.length > 0 ||
    corrections.length > 0 ||
    sortBy !== 'relevance' ||
    Boolean(subType) ||
    Boolean(category);

  return {
    originalQuery,
    normalizedQuery: normalized,
    corrections,
    category,
    subTypeKey: subType?.key || null,
    subType,
    brand,
    minPrice,
    maxPrice,
    approxPrice,
    minRating,
    inStockOnly,
    sortBy,
    sortReason,
    features,
    keywords: uniqueKeywords,
    searchTerm,
    isNaturalLanguage
  };
}

// ── 5. Smart Catalog Search, Scoring & Graceful Fallback ──────────────────────

function buildProductHaystack(p) {
  const specsStr = p.specs && typeof p.specs === 'object' ? Object.values(p.specs).join(' ') : '';
  return `${p.id || ''} ${p.sku || ''} ${p.name || ''} ${p.brand || ''} ${p.category || ''} ${p.categorySlug || ''} ${p.description || ''} ${(p.tags || []).join(' ')} ${specsStr}`.toLowerCase();
}

function matchesProductCategory(p, targetCat) {
  if (!targetCat || targetCat === 'all' || targetCat === 'All') return true;
  const target = String(targetCat).toLowerCase();
  const slug = String(p.categorySlug || p.categories?.slug || '').toLowerCase();
  const name = String(p.category || p.categories?.name || '').toLowerCase();
  const id = String(p.categoryId || p.category_id || '').toLowerCase();
  return slug === target || name === target || id === target || slug.includes(target) || name.includes(target);
}

/**
 * Execute smart natural-language search across any array of catalog products.
 * Returns ranked exact matches + optional close alternatives if exact price cap yielded 0 items.
 */
export function executeSmartSearch(products = [], rawQuery = '', extraFilters = {}) {
  const parsed = typeof rawQuery === 'object' && rawQuery !== null && 'originalQuery' in rawQuery
    ? rawQuery
    : parseSmartSearchQuery(rawQuery);

  const effectiveCategory = extraFilters.category && extraFilters.category !== 'All' && extraFilters.category !== 'all'
    ? extraFilters.category
    : parsed.category;
  const effectiveMinPrice = extraFilters.minPrice ?? parsed.minPrice;
  const effectiveMaxPrice = extraFilters.maxPrice ?? parsed.maxPrice;
  const effectiveMinRating = Math.max(Number(extraFilters.minRating || 0), Number(parsed.minRating || 0)) || null;
  const effectiveInStock = Boolean(extraFilters.inStockOnly || parsed.inStockOnly);
  const effectiveSort = extraFilters.sortBy && extraFilters.sortBy !== 'relevance'
    ? extraFilters.sortBy
    : parsed.sortBy;

  const hasQueryIntent =
    Boolean(parsed.originalQuery) ||
    Boolean(effectiveCategory) ||
    effectiveMinPrice !== null ||
    effectiveMaxPrice !== null ||
    effectiveMinRating !== null;

  if (!hasQueryIntent) {
    return { parsed, results: products, exactCount: products.length, closeAlternatives: [], relaxedReason: null };
  }

  // Helper to filter & score candidates
  const scoreCandidates = (list, { enforcePrice = true, enforceFeatureStrict = false, enforceSubType = true } = {}) => {
    const scored = [];

    for (const p of list) {
      const price = Number(p.price || 0);
      const rating = Number(p.rating || 0);
      const stock = Number(p.stock ?? 10);
      const hay = buildProductHaystack(p);
      const nameLower = String(p.name || '').toLowerCase();
      const brandLower = String(p.brand || '').toLowerCase();

      // 1. Strict UI & parsed filters
      if (effectiveInStock && stock <= 0) continue;
      if (effectiveMinRating && rating < effectiveMinRating) continue;

      if (enforcePrice) {
        if (effectiveMinPrice !== null && effectiveMinPrice !== undefined && price < effectiveMinPrice) continue;
        if (effectiveMaxPrice !== null && effectiveMaxPrice !== undefined && price > effectiveMaxPrice) continue;
      }

      if (parsed.brand) {
        if (!brandLower.includes(parsed.brand) && !nameLower.includes(parsed.brand)) continue;
      }

      if (extraFilters.category && extraFilters.category !== 'All' && extraFilters.category !== 'all') {
        if (!matchesProductCategory(p, extraFilters.category)) continue;
      }

      // 2. Sub-type / Category / Keyword / Feature relevance
      let score = 0;
      let matchedAnySignal = false;

      if (enforceSubType && parsed.subType) {
        if (!parsed.subType.matchProduct(p)) continue;
        score += 45;
        matchedAnySignal = true;
      } else if (parsed.category) {
        if (!matchesProductCategory(p, parsed.category)) {
          // Allow cross-category if explicit keyword hits name directly (e.g. "4K monitor" in electronics vs gaming)
          const directKeywordHit = parsed.keywords.some((kw) => nameLower.includes(kw));
          if (!directKeywordHit) continue;
          score += 18;
          matchedAnySignal = true;
        } else {
          score += 30;
          matchedAnySignal = true;
        }
      }

      // Feature checks
      let featureHits = 0;
      for (const feat of parsed.features) {
        const def = FEATURE_PATTERNS[feat.key];
        if (def && def.productRe.test(hay)) {
          featureHits += 1;
          score += 24;
          matchedAnySignal = true;
        }
      }
      if (enforceFeatureStrict && parsed.features.length > 0 && featureHits === 0) {
        continue;
      }

      // Keyword checks (exact + fuzzy word hits)
      const nonSubtypeKeywords = parsed.keywords.filter((kw) => {
        if (parsed.brand && kw === parsed.brand) return false;
        if (parsed.subTypeKey && (kw === parsed.subTypeKey || parsed.subTypeKey.includes(kw))) return false;
        return true;
      });

      let kwHits = 0;
      for (const kw of nonSubtypeKeywords) {
        if (nameLower.includes(kw) || String(p.id || '').toLowerCase() === kw) {
          kwHits += 1;
          score += 26;
          matchedAnySignal = true;
        } else if (hay.includes(kw)) {
          kwHits += 1;
          score += 14;
          matchedAnySignal = true;
        } else if (kw.length >= 4) {
          // Fuzzy match against product name words
          const nameWords = nameLower.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
          if (nameWords.some((w) => editDistance(kw, w) <= 1)) {
            kwHits += 1;
            score += 16;
            matchedAnySignal = true;
          }
        }
      }

      // If the user ONLY typed a pure keyword (no category, no subtype, no price, no features, no sort intent),
      // require at least 1 keyword match!
      const isPureFilterOnlyQuery =
        !parsed.subType &&
        !parsed.category &&
        !parsed.brand &&
        parsed.features.length === 0 &&
        effectiveMinPrice === null &&
        effectiveMaxPrice === null &&
        parsed.sortBy === 'relevance';

      if (isPureFilterOnlyQuery && kwHits === 0) {
        continue;
      }

      // If user typed a specific model word + category (e.g. "AeroBook laptop"), boost exact model matches
      if (nonSubtypeKeywords.length > 0 && kwHits === 0 && !parsed.subType && !parsed.category && parsed.features.length === 0 && !parsed.brand) {
        // Pure price query like "under 5000" -> allow all under 5000!
        if (effectiveMaxPrice === null && effectiveMinPrice === null && parsed.sortBy === 'relevance') {
          continue;
        }
      }

      // If user typed an explicit unrecognized model keyword alongside a price (e.g., "nonexistentxyz under 5000")
      if (nonSubtypeKeywords.length > 0 && kwHits === 0 && !parsed.subType && !parsed.category && !parsed.brand && parsed.features.length === 0) {
        continue;
      }

      // Rating, discount & proximity bonus
      score += rating * 4;
      score += Math.min(8, Math.log10((p.reviewsCount || 1) + 1) * 2.5);
      if (parsed.approxPrice && price > 0) {
        const diffRatio = Math.abs(price - parsed.approxPrice) / parsed.approxPrice;
        score += Math.max(0, 15 - diffRatio * 40);
      }
      if (stock <= 0) score -= 25;

      if (matchedAnySignal || effectiveMaxPrice !== null || effectiveMinPrice !== null || parsed.sortBy !== 'relevance') {
        scored.push({ product: p, score, featureHits, kwHits });
      }
    }

    // If user included explicit model/product keywords (beyond category/subtype/features)
    // and at least one candidate directly matched those keywords, filter to the matching items
    // so searches like "AeroBook laptop" or "SonicPods Pro" return laser-accurate matches.
    const modelKeywords = parsed.keywords.filter((kw) => {
      if (parsed.brand && kw === parsed.brand) return false;
      if (parsed.subTypeKey && (kw === parsed.subTypeKey || parsed.subTypeKey.includes(kw))) return false;
      if (parsed.category && parsed.category.includes(kw)) return false;
      if (['smart', 'home', 'pro', 'plus', 'ultra', 'mini', 'max', 'wireless', 'bluetooth', 'gaming', 'student', 'office', 'coding', 'programming', 'creator', 'editing', 'battery', 'camera', 'display', 'fast', 'charging', 'waterproof', 'lightweight', 'portable', 'anc', '5g', '4k', 'oled', 'amoled', '120hz', '144hz', '165hz', 'ram', 'ssd', 'rgb', 'audio', 'electronics'].includes(kw)) return false;
      return kw.length >= 3;
    });
    const finalScored =
      modelKeywords.length > 0 && scored.some((s) => s.kwHits > 0)
        ? scored.filter((s) => s.kwHits > 0)
        : scored;

    // Sort results cleanly
    finalScored.sort((a, b) => {
      switch (effectiveSort) {
        case 'priceAsc':
          return (a.product.price || 0) - (b.product.price || 0);
        case 'priceDesc':
          return (b.product.price || 0) - (a.product.price || 0);
        case 'ratingDesc':
          if ((b.product.rating || 0) !== (a.product.rating || 0)) return (b.product.rating || 0) - (a.product.rating || 0);
          return b.score - a.score;
        case 'discountDesc':
          return (b.product.discountPercent || 0) - (a.product.discountPercent || 0);
        case 'popular':
          return (b.product.reviewsCount || 0) - (a.product.reviewsCount || 0);
        case 'newest':
          return String(b.product.id).localeCompare(String(a.product.id));
        case 'relevance':
        default:
          if (b.score !== a.score) return b.score - a.score;
          return (b.product.rating || 0) - (a.product.rating || 0);
      }
    });

    return finalScored.map((s) => s.product);
  };

  // Pass 1: Strict match (price + subtype + feature boost)
  let results = scoreCandidates(products, {
    enforcePrice: true,
    enforceFeatureStrict: parsed.features.length > 0,
    enforceSubType: true
  });

  // Pass 2: If strict feature filter yielded 0, relax feature strictness while keeping price & subtype intact
  if (results.length === 0 && parsed.features.length > 0) {
    results = scoreCandidates(products, {
      enforcePrice: true,
      enforceFeatureStrict: false,
      enforceSubType: true
    });
  }

  // Pass 3: If subtype was too narrow (e.g. monitor inside gaming vs electronics), relax subtype to category
  // Note: NEVER relax laptop/smartphone into unrelated accessories or monitors/SSDs!
  const strictSubTypes = new Set(['laptop', 'smartphone', 'desktop', 'ssd', 'smartwatch', 'earbuds', 'headphones', 'speaker', 'microphone', 'keyboard', 'mouse']);
  if (results.length === 0 && parsed.subType && parsed.category && !strictSubTypes.has(parsed.subTypeKey)) {
    results = scoreCandidates(products, {
      enforcePrice: true,
      enforceFeatureStrict: false,
      enforceSubType: false
    });
  }

  // Close alternatives when exact budget had 0 matches (e.g., "laptops under 20k")
  let closeAlternatives = [];
  let relaxedReason = null;
  if (results.length === 0 && (effectiveMaxPrice !== null || effectiveMinPrice !== null)) {
    const withoutPrice = scoreCandidates(products, {
      enforcePrice: false,
      enforceFeatureStrict: false,
      enforceSubType: true
    });
    if (withoutPrice.length > 0) {
      closeAlternatives = [...withoutPrice]
        .sort((a, b) => (effectiveMaxPrice !== null ? (a.price || 0) - (b.price || 0) : (b.price || 0) - (a.price || 0)))
        .slice(0, 6);
      relaxedReason = effectiveMaxPrice !== null
        ? `No exact matches under ₹${Number(effectiveMaxPrice).toLocaleString('en-IN')}. Showing our closest affordable options starting from ₹${Number(closeAlternatives[0].price || 0).toLocaleString('en-IN')}.`
        : `No exact matches above ₹${Number(effectiveMinPrice).toLocaleString('en-IN')}. Showing our closest options.`;
    }
  }

  return {
    parsed,
    results,
    exactCount: results.length,
    closeAlternatives,
    relaxedReason
  };
}
