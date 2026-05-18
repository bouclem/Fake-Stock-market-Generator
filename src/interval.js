// Interval parsing and stepping.
//
// Two kinds of intervals:
//   - Fixed length:    "1m", "5m", "1h", "1d", "1w" — every step is the same
//                      number of milliseconds.
//   - Calendar-aware:  "1mo", "3mo", "1y" — stepping respects the calendar so
//                      "1st of every month" stays on the 1st, leap years are
//                      handled, etc.

const FIXED_MS = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000
};

// Approximate millisecond length used only when a single representative number
// is required (e.g. the `interval` field on Stock for downstream consumers).
const APPROX_MS = {
  ...FIXED_MS,
  mo: 30 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000
};

/**
 * Parse an interval string into a structured spec.
 * Number input is treated as raw milliseconds (fixed).
 * @param {number|string} interval
 * @returns {{ unit: string, n: number, calendar: boolean, ms: number }}
 */
export function parseIntervalSpec(interval) {
  if (typeof interval === 'number') {
    if (!Number.isFinite(interval) || interval <= 0) {
      throw new Error(`Invalid interval: ${interval}`);
    }
    return { unit: 'ms', n: interval, calendar: false, ms: interval };
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
  const calendar = unit === 'mo' || unit === 'y';
  const ms = n * APPROX_MS[unit];
  return { unit, n, calendar, ms };
}

/**
 * Convert an interval into a representative millisecond duration.
 * For calendar units this is approximate (mo = 30d, y = 365d). Use stepTime()
 * for exact bar timestamps.
 * @param {number|string} interval
 * @returns {number}
 */
export function parseInterval(interval) {
  return parseIntervalSpec(interval).ms;
}

/**
 * Compute the timestamp of bar `i` given a start time and an interval spec.
 * Calendar-aware for monthly/yearly steps so the day-of-month is preserved.
 * @param {number} startMs
 * @param {ReturnType<typeof parseIntervalSpec>} spec
 * @param {number} i - Zero-based bar index
 * @returns {number} Unix epoch in milliseconds
 */
export function stepTime(startMs, spec, i) {
  if (i === 0) return startMs;
  if (!spec.calendar) {
    return startMs + i * spec.ms;
  }
  const d = new Date(startMs);
  if (spec.unit === 'mo') {
    d.setUTCMonth(d.getUTCMonth() + spec.n * i);
  } else {
    d.setUTCFullYear(d.getUTCFullYear() + spec.n * i);
  }
  return d.getTime();
}
