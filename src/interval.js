// Interval parsing. Accepts a number of milliseconds or a shorthand string
// like "1m", "5m", "1h", "1d", "1w", "1y".

const UNIT_MS = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  mo: 30 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000
};

/**
 * Convert an interval (number in ms, or shorthand string) into milliseconds.
 * @param {number|string} interval
 * @returns {number}
 */
export function parseInterval(interval) {
  if (typeof interval === 'number') {
    if (!Number.isFinite(interval) || interval <= 0) {
      throw new Error(`Invalid interval: ${interval}`);
    }
    return interval;
  }
  if (typeof interval !== 'string') {
    throw new Error(`Invalid interval: ${interval}`);
  }
  // "mo" must be matched before "m" so "1mo" doesn't read as "1m" + "o".
  const match = /^(\d+)\s*(mo|m|h|d|w|y)$/i.exec(interval.trim());
  if (!match) {
    throw new Error(
      `Invalid interval string: "${interval}". Use e.g. "1m", "1h", "1d", "1w", "1mo", "1y".`
    );
  }
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  return n * UNIT_MS[unit];
}
