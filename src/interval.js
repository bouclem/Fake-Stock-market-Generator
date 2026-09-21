// Interval parsing and stepping.
//
// Two kinds of intervals:
//   - Fixed length:    "1min", "5min", "1h", "1d", "1w" — every step is the same
//                      number of milliseconds.
//   - Calendar-aware:  "1mo"/"1m", "3mo", "1y" — stepping respects the calendar
//                      so "1st of every month" stays on the 1st, leap years are
//                      handled, and month-end dates clamp to the last day of
//                      the target month instead of overflowing into the next.
//
// Note (v2.0.0 breaking change): "m" now means month, not minute.
// Use "min" for minutes.

const MINUTE_MS = 60 * 1000;
const APPROX_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const APPROX_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const FIXED_MS = {
  min: MINUTE_MS,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000
};

// Approximate millisecond length used only when a single representative number
// is required (e.g. the `interval` field on Stock for downstream consumers).
const APPROX_MS = {
  ...FIXED_MS,
  m: APPROX_MONTH_MS,
  mo: APPROX_MONTH_MS,
  y: APPROX_YEAR_MS
};

const MONTH_UNITS = new Set(['mo', 'm']);
const CALENDAR_UNITS = new Set(['mo', 'm', 'y']);

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
  // "mo" must be tried before "m", and "min" before "m", so "1mo" doesn't
  // read as "1m" + "o" and "1min" doesn't read as "1m" + "in".
  const match = /^(\d+)\s*(mo|min|m|h|d|w|y)$/i.exec(interval.trim());
  if (!match) {
    throw new Error(
      `Invalid interval string: "${interval}". Use e.g. "1min", "1h", "1d", "1w", "1mo"/"1m", "1y".`
    );
  }
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (n <= 0) {
    throw new Error(`Invalid interval string: "${interval}". The numeric part must be > 0.`);
  }
  const calendar = CALENDAR_UNITS.has(unit);
  const ms = n * APPROX_MS[unit];
  return { unit, n, calendar, ms };
}

/**
 * Convert an interval into a representative millisecond duration.
 * For calendar units this is approximate (mo/m = 30d, y = 365d). Use stepTime()
 * for exact bar timestamps.
 * @param {number|string} interval
 * @returns {number}
 */
export function parseInterval(interval) {
  return parseIntervalSpec(interval).ms;
}

// Days in a given UTC month (month is 0-based). year < 100 is interpreted
// literally (Date.UTC would map 0-99 to 1900-1999).
function daysInMonth(year, month) {
  const d = new Date(0);
  d.setUTCFullYear(year, month + 1, 0);
  return d.getUTCDate();
}

/**
 * Compute the timestamp of bar `i` given a start time and an interval spec.
 * Calendar-aware for monthly/yearly steps so the day-of-month is preserved,
 * clamping to the last day of the target month when it is shorter
 * (e.g. Jan 31 + 1mo -> Feb 28/29, not Mar 2/3).
 * Negative `i` steps backwards, which is used to derive calendar-aligned
 * default start dates.
 * @param {number} startMs
 * @param {ReturnType<typeof parseIntervalSpec>} spec
 * @param {number} i - Zero-based bar index (may be negative)
 * @returns {number} Unix epoch in milliseconds
 */
export function stepTime(startMs, spec, i) {
  if (i === 0) return startMs;
  if (!spec.calendar) {
    return startMs + i * spec.ms;
  }
  const d = new Date(startMs);
  const day = d.getUTCDate();
  if (MONTH_UNITS.has(spec.unit)) {
    const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + spec.n * i;
    const y = Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12;
    d.setUTCFullYear(y, m, Math.min(day, daysInMonth(y, m)));
  } else {
    const y = d.getUTCFullYear() + spec.n * i;
    const m = d.getUTCMonth();
    d.setUTCFullYear(y, m, Math.min(day, daysInMonth(y, m)));
  }
  return d.getTime();
}
