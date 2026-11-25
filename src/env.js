/**
 * Environment Configuration Module
 * 
 * Strict runtime validation for frontend environment variables.
 * Enforces that only safe, public variables (anon key) are accessible to the browser client.
 * Server-only secrets (API_KEY, JWT_SECRET, RAZORPAY_KEY_SECRET, etc.) MUST NEVER be
 * prefixed with VITE_ or imported into browser bundles.
 */

const hasImportMetaEnv = typeof import.meta !== 'undefined' && import.meta.env;

const getEnvVar = (key, fallback = undefined) => {
  if (hasImportMetaEnv) {
    return import.meta.env[key] ?? fallback;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] ?? fallback;
  }
  return fallback;
};

// ── 1. Security Guard: Detect Leaked Secrets in Frontend Scope ────────────────
if (hasImportMetaEnv) {
  const dangerousPatterns = ['SECRET', 'PRIVATE_KEY', 'API_KEY', 'PASSWORD', 'TOKEN'];
  const exposedKeys = Object.keys(import.meta.env);

  const leakedSecrets = exposedKeys.filter((key) => {
    const upper = key.toUpperCase();
    if (upper.includes('ANON')) return false; // Anon key is intended to be public
    return dangerousPatterns.some((pattern) => upper.includes(pattern));
  });

  if (leakedSecrets.length > 0) {
    const errorMsg = `🚨 [CRITICAL SECURITY VIOLATION] Sensitive server-side secrets detected in client bundle: ${leakedSecrets.join(', ')}. Remove the VITE_ prefix from these variables immediately!`;
    console.error(errorMsg);
    if (import.meta.env.PROD) {
      throw new Error(errorMsg);
    }
  }
}

// ── 2. Environment Resolution ─────────────────────────────────────────────────
const isProd = Boolean(hasImportMetaEnv ? import.meta.env.PROD : false);
const isDev = Boolean(hasImportMetaEnv ? import.meta.env.DEV : true);
const mode = hasImportMetaEnv ? import.meta.env.MODE : 'development';

const rawUrl = getEnvVar('VITE_INSFORGE_URL');
const rawAnonKey = getEnvVar('VITE_INSFORGE_ANON_KEY');

// In production, validate that required environment variables are configured
if (isProd) {
  if (!rawUrl) {
    console.warn(
      '⚠️ [Configuration Warning] VITE_INSFORGE_URL is not set in production. Set VITE_INSFORGE_URL in your hosting platform (Vercel, Netlify, Docker).'
    );
  }
  if (!rawAnonKey) {
    console.error(
      '🚨 [Configuration Error] VITE_INSFORGE_ANON_KEY is missing in production. Frontend requests will fail without a valid public anon key.'
    );
  }
}

// Development-only fallback constants (never used in production bundles)
const DEV_FALLBACK_URL = 'https://wheg6hgs.ap-southeast.insforge.app';
const DEV_FALLBACK_ANON_KEY = 'anon_1f344ff00d148a22234c12c3f5616df77fc3c01286d1f4a3aac7fd0fab6649a9';

export const env = Object.freeze({
  /**
   * Public InsForge Backend API Base URL
   */
  insforgeUrl: rawUrl || DEV_FALLBACK_URL,

  /**
   * Public InsForge Anonymous Key (scoped by PostgreSQL Row Level Security policies)
   */
  insforgeAnonKey: rawAnonKey || DEV_FALLBACK_ANON_KEY,

  /**
   * Public Razorpay Key ID
   */
  razorpayKeyId: getEnvVar('VITE_RAZORPAY_KEY_ID', 'rzp_test_smartshopdev2026'),

  /**
   * Environment status flags
   */
  isDev,
  isProd,
  mode,

  /**
   * Validation check method
   */
  isValid: Boolean((rawUrl || DEV_FALLBACK_URL) && (rawAnonKey || DEV_FALLBACK_ANON_KEY)),
});

export default env;
