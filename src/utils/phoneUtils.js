/**
 * normalizePhone — The single source of truth for phone number normalization.
 *
 * WHY THIS EXISTS:
 * Indian phone numbers arrive from multiple sources (app, website, WhatsApp, manual entry)
 * in wildly different formats:
 *   "+917208674907"  (app with country code)
 *   "072086 74907"   (manual entry with spaces and leading 0)
 *   "7208674907"     (clean 10-digit)
 *   "91 72086-74907" (country code with dashes)
 *
 * Without normalization, the SAME customer appears as multiple entries in analytics,
 * inflating user counts and fragmenting order history.
 *
 * ALGORITHM:
 *   1. Strip all non-digit characters (spaces, dashes, +, parens)
 *   2. If result is ≥10 digits, take the LAST 10 (strips country code 91, leading 0)
 *   3. If result is <10 digits but ≥7 (valid landline/short), keep as-is
 *   4. If result is <7 digits or empty, return the original trimmed string as fallback
 *
 * TRADEOFF: We lose the original formatting. This is intentional — the display can
 * always re-format, but identity matching MUST be format-agnostic.
 *
 * @param {string|number} raw - The raw phone number from any source
 * @returns {string} Normalized phone string (10-digit for Indian mobiles)
 */
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return '';

  const str = String(raw).trim();
  if (!str) return '';

  // Strip everything that isn't a digit
  const digits = str.replace(/\D/g, '');

  // Indian mobile: 10 digits. With country code (91): 12 digits. With 0 prefix: 11 digits.
  // Take the last 10 to normalize all these to the same value.
  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  // Landlines or short numbers (7-9 digits): keep as-is
  if (digits.length >= 7) {
    return digits;
  }

  // Too short to be a real phone number — return original trimmed string as fallback
  // This handles edge cases like "no contact" or partial entries
  return str;
}
