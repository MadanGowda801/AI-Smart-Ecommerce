/**
 * AI Smart Product Comparison — Shared Constants, Preference Schema & Category Spec Mapping
 *
 * Shared cleanly between server-side comparison/scoring engine and frontend UI.
 * Zero browser-only dependencies.
 */

export const MIN_COMPARE_PRODUCTS = 2;
export const MAX_COMPARE_PRODUCTS = 5;
export const NOT_AVAILABLE_LABEL = 'Not Available';

/**
 * 8 Pre-Suggested Smart Requirement Preference Cards
 */
export const SUGGESTED_PREFERENCE_OPTIONS = [
  {
    id: 'budget_friendly',
    optionNumber: 1,
    title: 'BUDGET FRIENDLY',
    shortLabel: 'Budget Friendly',
    description: 'Prioritize affordability and stay strictly within your target budget.',
    subOptions: [
      { id: 'under_5000', label: 'Under ₹5,000', maxBudget: 5000 },
      { id: 'under_10000', label: 'Under ₹10,000', maxBudget: 10000 },
      { id: 'under_20000', label: 'Under ₹20,000', maxBudget: 20000 },
      { id: 'under_30000', label: 'Under ₹30,000', maxBudget: 30000 },
      { id: 'under_50000', label: 'Under ₹50,000', maxBudget: 50000 },
      { id: 'custom_budget', label: 'Custom budget', isCustomBudget: true }
    ]
  },
  {
    id: 'best_performance',
    optionNumber: 2,
    title: 'BEST PERFORMANCE',
    shortLabel: 'Best Performance',
    description: 'Focus on processing power, RAM, speed, and workload capability.',
    subOptions: [
      { id: 'basic_performance', label: 'Basic performance' },
      { id: 'daily_usage', label: 'Daily usage' },
      { id: 'multitasking', label: 'Multitasking' },
      { id: 'high_performance', label: 'High performance' },
      { id: 'professional_performance', label: 'Professional performance' }
    ]
  },
  {
    id: 'battery_life',
    optionNumber: 3,
    title: 'BATTERY LIFE',
    shortLabel: 'Battery Life',
    description: 'Prioritize long battery backup, endurance, and fast charging support.',
    subOptions: [
      { id: 'normal_battery', label: 'Normal battery' },
      { id: 'long_battery_life', label: 'Long battery life' },
      { id: 'max_battery_backup', label: 'Maximum battery backup' },
      { id: 'fast_charging', label: 'Fast charging' }
    ]
  },
  {
    id: 'camera_display',
    optionNumber: 4,
    title: 'CAMERA AND DISPLAY',
    shortLabel: 'Camera & Display',
    description: 'Prioritize sharp cameras, OLED/AMOLED panels, high resolution, and smooth refresh rates.',
    subOptions: [
      { id: 'best_camera', label: 'Best camera' },
      { id: 'best_display', label: 'Best display' },
      { id: 'high_resolution', label: 'High resolution' },
      { id: 'high_refresh_rate', label: 'High refresh rate' },
      { id: 'photography_video', label: 'Photography and video' }
    ]
  },
  {
    id: 'gaming_entertainment',
    optionNumber: 5,
    title: 'GAMING AND ENTERTAINMENT',
    shortLabel: 'Gaming & Entertainment',
    description: 'Optimize for smooth frame rates, graphics, surround sound, and media enjoyment.',
    subOptions: [
      { id: 'casual_gaming', label: 'Casual gaming' },
      { id: 'heavy_gaming', label: 'Heavy gaming' },
      { id: 'smooth_graphics', label: 'Smooth graphics' },
      { id: 'gaming_high_refresh', label: 'High refresh rate' },
      { id: 'multimedia_experience', label: 'Multimedia experience' }
    ]
  },
  {
    id: 'student_office',
    optionNumber: 6,
    title: 'STUDENT AND OFFICE USE',
    shortLabel: 'Student & Office Use',
    description: 'Balanced productivity for classes, coding, spreadsheets, meetings, and WFH.',
    subOptions: [
      { id: 'online_classes', label: 'Online classes' },
      { id: 'programming', label: 'Programming' },
      { id: 'office_work', label: 'Office work' },
      { id: 'college_projects', label: 'College projects' },
      { id: 'work_from_home', label: 'Work from home' }
    ]
  },
  {
    id: 'storage_connectivity',
    optionNumber: 7,
    title: 'STORAGE AND CONNECTIVITY',
    shortLabel: 'Storage & Connectivity',
    description: 'Focus on generous storage, higher RAM, Wi-Fi 6/5G/USB-C, and multi-port versatility.',
    subOptions: [
      { id: 'more_storage', label: 'More storage' },
      { id: 'more_ram', label: 'More RAM' },
      { id: 'latest_connectivity', label: 'Latest connectivity' },
      { id: 'expandable_storage', label: 'Expandable storage' },
      { id: 'multiple_connectivity', label: 'Multiple connectivity options' }
    ]
  },
  {
    id: 'best_overall_value',
    optionNumber: 8,
    title: 'BEST OVERALL VALUE',
    shortLabel: 'Best Overall Value',
    description: 'Find the smartest overall buy balancing price, verified specs, ratings, and warranty.',
    subOptions: [
      { id: 'lowest_price', label: 'Lowest price' },
      { id: 'best_specs_for_price', label: 'Best specifications for the price' },
      { id: 'best_customer_rating', label: 'Best customer rating' },
      { id: 'best_warranty_support', label: 'Best warranty and support' },
      { id: 'balanced_overall', label: 'Balanced overall product' }
    ]
  }
];

/**
 * Default transparent weighted scoring model (Total = 100%)
 */
export const DEFAULT_SCORING_WEIGHTS = {
  budgetPrice: 25,
  performanceSpecs: 25,
  userPriorities: 20,
  qualityRatings: 10,
  warrantyReliability: 10,
  valueForMoney: 10
};

/**
 * Core universal rows displayed for all categories
 */
export const CORE_COMPARISON_ROWS = [
  { key: 'brand', label: 'Brand', group: 'overview' },
  { key: 'id', label: 'Product ID', group: 'overview' },
  { key: 'category', label: 'Category', group: 'overview' },
  { key: 'priceFormatted', label: 'Current Selling Price', group: 'pricing', highlightType: 'lowest_price' },
  { key: 'originalPriceFormatted', label: 'Original Price', group: 'pricing' },
  { key: 'discountDisplay', label: 'Discount Percentage', group: 'pricing', highlightType: 'highest_discount' },
  { key: 'availabilityDisplay', label: 'Availability / Stock Status', group: 'overview' },
  { key: 'ratingDisplay', label: 'Customer Ratings', group: 'ratings', highlightType: 'highest_rating' },
  { key: 'reviewsDisplay', label: 'Number of Reviews', group: 'ratings' },
  { key: 'warranty', label: 'Warranty', group: 'reliability' }
];

/**
 * Category-specific technical rows — strictly matched to product category
 * so irrelevant specs (e.g., laptop RAM for headphones) are never shown.
 */
export const CATEGORY_TECH_ROWS = {
  electronics: [
    { key: 'processor', label: 'Processor / Chipset', group: 'specs' },
    { key: 'ram', label: 'RAM', group: 'specs' },
    { key: 'storage', label: 'Internal Storage', group: 'specs' },
    { key: 'displaySize', label: 'Display Size', group: 'specs' },
    { key: 'displayResolution', label: 'Display Resolution', group: 'specs' },
    { key: 'refreshRate', label: 'Refresh Rate', group: 'specs' },
    { key: 'batteryCapacity', label: 'Battery Capacity / Life', group: 'specs' },
    { key: 'chargingSpeed', label: 'Charging Speed', group: 'specs' },
    { key: 'operatingSystem', label: 'Operating System', group: 'specs' },
    { key: 'connectivity', label: 'Connectivity', group: 'specs' },
    { key: 'weight', label: 'Weight', group: 'specs' },
    { key: 'additionalSpecs', label: 'Key Category Specifications', group: 'specs' }
  ],
  smartphones: [
    { key: 'processor', label: 'Processor / Chipset', group: 'specs' },
    { key: 'ram', label: 'RAM', group: 'specs' },
    { key: 'storage', label: 'Internal Storage', group: 'specs' },
    { key: 'displaySize', label: 'Display Size', group: 'specs' },
    { key: 'displayResolution', label: 'Display Type / Resolution', group: 'specs' },
    { key: 'refreshRate', label: 'Refresh Rate', group: 'specs' },
    { key: 'batteryCapacity', label: 'Battery Capacity', group: 'specs' },
    { key: 'chargingSpeed', label: 'Charging Speed', group: 'specs' },
    { key: 'camera', label: 'Camera Specifications', group: 'specs' },
    { key: 'operatingSystem', label: 'Operating System', group: 'specs' },
    { key: 'connectivity', label: 'Connectivity', group: 'specs' },
    { key: 'weight', label: 'Weight', group: 'specs' },
    { key: 'additionalSpecs', label: 'Key Category Specifications', group: 'specs' }
  ],
  wearables: [
    { key: 'displaySize', label: 'Display Size / Type', group: 'specs' },
    { key: 'batteryCapacity', label: 'Battery Life', group: 'specs' },
    { key: 'connectivity', label: 'Connectivity', group: 'specs' },
    { key: 'waterResistance', label: 'Water / Dust Resistance', group: 'specs' },
    { key: 'healthSensors', label: 'Health & Fitness Sensors', group: 'specs' },
    { key: 'weight', label: 'Weight', group: 'specs' },
    { key: 'additionalSpecs', label: 'Key Category Specifications', group: 'specs' }
  ],
  audio: [
    { key: 'audioDrivers', label: 'Driver / Audio Output', group: 'specs' },
    { key: 'noiseCancellation', label: 'Noise Cancellation (ANC/ENC)', group: 'specs' },
    { key: 'batteryCapacity', label: 'Battery / Playback Life', group: 'specs' },
    { key: 'chargingSpeed', label: 'Charging Feature', group: 'specs' },
    { key: 'connectivity', label: 'Connectivity', group: 'specs' },
    { key: 'microphone', label: 'Microphone', group: 'specs' },
    { key: 'waterResistance', label: 'Water / Sweat Resistance', group: 'specs' },
    { key: 'weight', label: 'Weight', group: 'specs' },
    { key: 'additionalSpecs', label: 'Key Category Specifications', group: 'specs' }
  ],
  'smart-home': [
    { key: 'connectivity', label: 'Connectivity / Protocol', group: 'specs' },
    { key: 'voiceAssistant', label: 'Voice Assistant Support', group: 'specs' },
    { key: 'displayResolution', label: 'Video / Display Resolution', group: 'specs' },
    { key: 'powerRating', label: 'Power / Load Rating', group: 'specs' },
    { key: 'batteryCapacity', label: 'Battery / Power Source', group: 'specs' },
    { key: 'waterResistance', label: 'Weather / IP Rating', group: 'specs' },
    { key: 'smartFeatures', label: 'Smart Automation & Sensors', group: 'specs' },
    { key: 'additionalSpecs', label: 'Key Category Specifications', group: 'specs' }
  ],
  accessories: [
    { key: 'chargingSpeed', label: 'Power / Charging Output', group: 'specs' },
    { key: 'batteryCapacity', label: 'Battery Capacity', group: 'specs' },
    { key: 'connectivity', label: 'Ports & Connectivity', group: 'specs' },
    { key: 'waterResistance', label: 'Protection / IP Rating', group: 'specs' },
    { key: 'buildMaterial', label: 'Build Material', group: 'specs' },
    { key: 'weight', label: 'Weight', group: 'specs' },
    { key: 'additionalSpecs', label: 'Key Category Specifications', group: 'specs' }
  ],
  gaming: [
    { key: 'displaySize', label: 'Display Size', group: 'specs' },
    { key: 'displayResolution', label: 'Resolution / Video Spec', group: 'specs' },
    { key: 'refreshRate', label: 'Refresh Rate / Frame Rate', group: 'specs' },
    { key: 'responseTime', label: 'Response Time / Sensor DPI', group: 'specs' },
    { key: 'connectivity', label: 'Connectivity & Ports', group: 'specs' },
    { key: 'weight', label: 'Weight', group: 'specs' },
    { key: 'additionalSpecs', label: 'Gaming Features & Extras', group: 'specs' }
  ]
};

/**
 * Category-relevant manual requirement fields for Section 6 ("Enter Your Own Requirements")
 */
export const CATEGORY_MANUAL_FIELDS = {
  electronics: [
    'maxBudget', 'preferredBrand', 'productCategory', 'primaryUsage',
    'minRam', 'minStorage', 'preferredProcessor', 'minBattery',
    'preferredDisplaySize', 'warrantyPreference', 'requiredConnectivity', 'otherRequirements'
  ],
  smartphones: [
    'maxBudget', 'preferredBrand', 'productCategory', 'primaryUsage',
    'minRam', 'minStorage', 'preferredProcessor', 'minBattery',
    'preferredDisplaySize', 'cameraRequirements', 'warrantyPreference', 'requiredConnectivity', 'otherRequirements'
  ],
  wearables: [
    'maxBudget', 'preferredBrand', 'productCategory', 'primaryUsage',
    'minBattery', 'preferredDisplaySize', 'warrantyPreference', 'requiredConnectivity', 'otherRequirements'
  ],
  audio: [
    'maxBudget', 'preferredBrand', 'productCategory', 'primaryUsage',
    'minBattery', 'warrantyPreference', 'requiredConnectivity', 'otherRequirements'
  ],
  'smart-home': [
    'maxBudget', 'preferredBrand', 'productCategory', 'primaryUsage',
    'cameraRequirements', 'warrantyPreference', 'requiredConnectivity', 'otherRequirements'
  ],
  accessories: [
    'maxBudget', 'preferredBrand', 'productCategory', 'primaryUsage',
    'minBattery', 'warrantyPreference', 'requiredConnectivity', 'otherRequirements'
  ],
  gaming: [
    'maxBudget', 'preferredBrand', 'productCategory', 'primaryUsage',
    'preferredDisplaySize', 'cameraRequirements', 'warrantyPreference', 'requiredConnectivity', 'otherRequirements'
  ],
  mixed: [
    'maxBudget', 'preferredBrand', 'productCategory', 'primaryUsage',
    'minRam', 'minStorage', 'preferredProcessor', 'minBattery',
    'preferredDisplaySize', 'cameraRequirements', 'warrantyPreference', 'requiredConnectivity', 'otherRequirements'
  ]
};

/**
 * Normalize a product's category slug into one of our canonical schema buckets.
 */
export function resolveCategoryBucket(product) {
  if (!product) return 'electronics';
  const slug = String(product.categorySlug || product.categories?.slug || '').toLowerCase().trim();
  const catName = String(product.category || product.categories?.name || '').toLowerCase();
  const nameAndDesc = `${product.name || ''} ${product.description || ''}`.toLowerCase();

  // Distinguish wearables (smartwatch/band/ring) inside Smartphones & Wearables
  if (
    (slug.includes('smartphone') || slug.includes('mobile') || catName.includes('wearable')) &&
    /\b(smartwatch|smart\s*band|fitness\s*(?:tracker|band)|smart\s*ring|watch)\b/i.test(product.name || '')
  ) {
    return 'wearables';
  }

  if (slug === 'smartphones' || slug === 'mobiles' || catName.includes('smartphone') || catName.includes('mobile')) {
    return 'smartphones';
  }
  if (slug === 'audio' || catName.includes('audio') || catName.includes('headphone')) {
    return 'audio';
  }
  if (slug === 'smart-home' || slug === 'smarthome' || catName.includes('smart home') || catName.includes('iot')) {
    return 'smart-home';
  }
  if (slug === 'accessories' || catName.includes('accessor') || catName.includes('gadget')) {
    return 'accessories';
  }
  if (slug === 'gaming' || catName.includes('gaming') || catName.includes('display')) {
    return 'gaming';
  }
  if (slug === 'electronics' || catName.includes('electronic') || catName.includes('laptop')) {
    return 'electronics';
  }
  // Fallback heuristics from product name
  if (/\b(earbud|headphone|headset|speaker|soundbar|microphone)\b/i.test(nameAndDesc)) return 'audio';
  if (/\b(smartphone|5g phone|foldable)\b/i.test(nameAndDesc)) return 'smartphones';
  if (/\b(gaming monitor|gamepad|capture card|gaming mouse)\b/i.test(nameAndDesc)) return 'gaming';
  return 'electronics';
}

export const EMPTY_MANUAL_REQUIREMENTS = {
  maxBudget: '',
  preferredBrand: '',
  productCategory: '',
  primaryUsage: '',
  minRam: '',
  minStorage: '',
  preferredProcessor: '',
  minBattery: '',
  preferredDisplaySize: '',
  cameraRequirements: '',
  warrantyPreference: '',
  requiredConnectivity: '',
  otherRequirements: ''
};

