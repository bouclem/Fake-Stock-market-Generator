// Numeric parsing utilities.
//
// JSON doesn't allow numeric underscores (1_200_000) or suffixes (1.5M).
// This helper bridges that gap so you can write readable numbers in config files.

/**
 * Parse a numeric value that may be:
 * - A number (returned as-is)
 * - A string with underscores like "1_200_000" or "15_000_000_000"
 * - A string with suffix like "1.5M", "2.3B", "500K"
 * - null / undefined (returned as-is)
 *
 * @param {number|string|null|undefined} value
 * @returns {number|null|undefined}
 */
export function parseNumeric(value) {
  if (value == null) return value;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number(value);

  const trimmed = value.trim();
  if (!trimmed) return NaN;

  // Strip underscores first: "1_200_000" -> "1200000"
  const noUnderscores = trimmed.replace(/_/g, '');

  // Handle suffixes: K, M, B, T (case insensitive)
  const suffixMatch = noUnderscores.match(/^([0-9.]+)\s*([kKmMbBtT]?)$/);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[2].toLowerCase();
    const multipliers = { '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
    return num * (multipliers[suffix] || 1);
  }

  // Plain number string
  return parseFloat(noUnderscores);
}

/**
 * Format a number with underscores for readability.
 * 1200000 -> "1_200_000"
 *
 * @param {number} value
 * @returns {string}
 */
export function formatNumeric(value) {
  if (!Number.isFinite(value)) return String(value);
  const [intPart, decPart] = String(value).split('.');
  const withUnderscores = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  return decPart ? `${withUnderscores}.${decPart}` : withUnderscores;
}

/**
 * Clean an entire array of values using parseNumeric.
 * Useful for processing worth/values arrays from JSON.
 *
 * @param {(number|string|null|undefined)[]} arr
 * @returns {number[]}
 */
export function cleanNumericArray(arr) {
  if (!arr) return [];
  return arr.map(parseNumeric).filter(v => v != null && Number.isFinite(v));
}

/**
 * Suffix multipliers for formatHumanNumber.
 */
const HUMAN_SUFFIXES = [
  { threshold: 1e15, suffix: 'QD', divisor: 1e15 },  // quadrillion
  { threshold: 1e12, suffix: 'T', divisor: 1e12 },   // trillion
  { threshold: 1e9, suffix: 'B', divisor: 1e9 },    // billion
  { threshold: 1e6, suffix: 'M', divisor: 1e6 },      // million
  { threshold: 1e3, suffix: 'K', divisor: 1e3 }       // thousand
];

/**
 * Format a number for human-readable display with K/M/B/T/QD suffixes.
 * Used for axis labels on charts.
 *
 *   100     -> "100"
 *   1000    -> "1000"
 *   2000    -> "2000"
 *   4000    -> "4000"
 *   5000    -> "5K"
 *   10000   -> "10K"
 *   10200   -> "10.2K"
 *   1000000 -> "1M"
 *   1500000 -> "1.5M"
 *   1e9     -> "1B"
 *
 * @param {number} value
 * @param {number} [precision=1] - decimal places for scaled values
 * @returns {string}
 */
export function formatHumanNumber(value, precision = 1) {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);

  // Small numbers: show as-is (no suffix)
  if (abs < 5000) {
    // For values like 1000-4999, show full number without commas
    return String(value);
  }

  // Find appropriate suffix
  for (const { threshold, suffix, divisor } of HUMAN_SUFFIXES) {
    if (abs >= threshold) {
      const scaled = value / divisor;
      // Don't show decimals for whole numbers
      const rounded = Math.abs(scaled - Math.round(scaled)) < 0.05
        ? Math.round(scaled)
        : parseFloat(scaled.toFixed(precision));
      return rounded + suffix;
    }
  }

  return String(value);
}
