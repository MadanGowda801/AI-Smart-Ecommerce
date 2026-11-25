/**
 * Strict 10-Digit Mobile Number Validation & Sanitization Utility
 *
 * Rules:
 *  - Strictly exactly 10 digits (15-digit or international lengths are NOT allowed).
 *  - Hard limit of 10 digits on all inputs and forms.
 *  - Strips non-digits (letters, special characters, spaces, dashes).
 *  - Handles pasted numbers with "+91" or leading "0" by trimming to the 10-digit number.
 *  - Must start with valid Indian mobile prefix (6, 7, 8, or 9).
 */

/**
 * Extracts and sanitizes input to maximum 10 digits.
 * If pasted with +91 or 0 prefix, strips country code.
 * Rejects and caps any attempt to exceed 10 digits.
 */
export function sanitizeMobileInput(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  let digits = String(value).replace(/\D/g, '');

  // If pasted with country code e.g. 919876543210 (12 digits) or +91
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Strict maximum 10 digits (never 15 digits)
  return digits.slice(0, 10);
}

/**
 * Validates whether the mobile number is strictly 10 digits
 * and begins with valid mobile prefixes (6, 7, 8, or 9).
 */
export function isValid10DigitMobile(value) {
  const digits = sanitizeMobileInput(value);
  return /^[6-9]\d{9}$/.test(digits) && digits.length === 10;
}

/**
 * Returns a human-friendly validation error message if invalid.
 * Explicitly blocks 15 digits or any length other than exactly 10 digits.
 */
export function validateMobileNumber(value, isRequired = true) {
  if (value === null || value === undefined || value === '') {
    return isRequired ? 'Mobile number is required (must be exactly 10 digits).' : '';
  }

  const rawDigits = String(value).replace(/\D/g, '');
  if (!rawDigits) {
    return isRequired ? 'Mobile number is required.' : '';
  }

  // Explicit block on 15-digit or oversized numbers
  if (rawDigits.length > 10) {
    return 'Invalid number: 15-digit numbers are not permitted. Only an exact 10-digit mobile number is allowed.';
  }

  if (rawDigits.length < 10) {
    return `Mobile number must be exactly 10 digits (currently ${rawDigits.length} digit${rawDigits.length === 1 ? '' : 's'}).`;
  }

  if (!/^[6-9]/.test(rawDigits)) {
    return 'Mobile number must start with 6, 7, 8, or 9.';
  }

  return '';
}

/**
 * Formats an exact 10-digit number for display: "+91 98765 43210"
 */
export function formatMobileDisplay(value) {
  const digits = sanitizeMobileInput(value);
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return value || '';
}

export default {
  sanitizeMobileInput,
  isValid10DigitMobile,
  validateMobileNumber,
  formatMobileDisplay
};
