/**
 * Automated Test Suite: 10-Digit Mobile Number Validation Everywhere
 */

import {
  sanitizeMobileInput,
  isValid10DigitMobile,
  validateMobileNumber,
  formatMobileDisplay
} from '../src/phoneUtils.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

console.log('================================================================');
console.log('🧪 TESTING 10-DIGIT MOBILE NUMBER VALIDATION & SANITIZATION');
console.log('================================================================\n');

// 1. Sanitization & Stripping
console.log('--- 1. Input Sanitization & Auto-Trimming ---');
assert(sanitizeMobileInput('9876543210') === '9876543210', 'Preserves clean 10-digit number');
assert(sanitizeMobileInput('98765-43210') === '9876543210', 'Strips hyphens');
assert(sanitizeMobileInput('(987) 654-3210') === '9876543210', 'Strips parentheses and spaces');
assert(sanitizeMobileInput('+91 98765 43210') === '9876543210', 'Strips +91 country prefix on paste');
assert(sanitizeMobileInput('09876543210') === '9876543210', 'Strips leading 0 on paste');
assert(sanitizeMobileInput('9876543210999999').length === 10, 'Strictly caps at maximum 10 digits');
assert(sanitizeMobileInput('abc98def76ghi543210') === '9876543210', 'Strips alphabetic characters');

// 2. Validation Checks
console.log('\n--- 2. 10-Digit Validation Logic (Reject 15 Digits or Any Non-10 Length) ---');
assert(isValid10DigitMobile('9876543210') === true, 'Accepts valid 10-digit number starting with 9');
assert(isValid10DigitMobile('8123456789') === true, 'Accepts valid 10-digit number starting with 8');
assert(isValid10DigitMobile('7012345678') === true, 'Accepts valid 10-digit number starting with 7');
assert(isValid10DigitMobile('6234567890') === true, 'Accepts valid 10-digit number starting with 6');
assert(isValid10DigitMobile('1234567890') === false, 'Rejects 10-digit number not starting with 6-9');
assert(isValid10DigitMobile('98765') === false, 'Rejects short number (< 10 digits)');
assert(isValid10DigitMobile('') === false, 'Rejects empty number');

// 3. User-Facing Validation Messages & Explicit 15-Digit Rejection
console.log('\n--- 3. Validation Messages & Explicit 15-Digit Block ---');
assert(validateMobileNumber('', true).includes('required'), 'Reports required when empty');
assert(validateMobileNumber('', false) === '', 'Allows empty when optional');
assert(validateMobileNumber('98765').includes('must be exactly 10 digits'), 'Reports exact digit count when short');
assert(validateMobileNumber('2345678901').includes('must start with 6, 7, 8, or 9'), 'Reports prefix error');
assert(validateMobileNumber('9876543210') === '', 'Returns no error for valid 10-digit number');
assert(validateMobileNumber('987654321012345').includes('15-digit numbers are not permitted'), 'Explicitly rejects 15-digit input');
assert(sanitizeMobileInput('987654321012345').length === 10, 'Hard-caps 15-digit input to strictly 10 digits');

// 4. Formatting
console.log('\n--- 4. Clean Display Formatting ---');
assert(formatMobileDisplay('9876543210') === '+91 98765 43210', 'Formats clean +91 98765 43210 display');

console.log('\n================================================================');
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}

