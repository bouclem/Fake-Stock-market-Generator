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

// ---------------------------------------------------------------------------
// Trading sessions (used when `kind: 'stock'` follows a market schedule).
//
// Simulated exchange on a fixed UTC clock — no timezone/DST handling:
//   pre-market   04:00 – 09:30
//   regular      09:30 – 16:00
//   after-hours  16:00 – 20:00
//
// Crypto and net worth never use this — they run 24/7.

const DAY_LEN_MS = 24 * 60 * 60 * 1000;
const PRE_OPEN_MIN = 4 * 60;        // 04:00
const REG_OPEN_MIN = 9 * 60 + 30;   // 09:30
const REG_CLOSE_MIN = 16 * 60;      // 16:00
const POST_CLOSE_MIN = 20 * 60;     // 20:00

function msOfDay(ms) {
  return ((ms % DAY_LEN_MS) + DAY_LEN_MS) % DAY_LEN_MS;
}

/**
 * True when `ms` falls on a Saturday or Sunday (UTC).
 * @param {number} ms
 * @returns {boolean}
 */
export function isWeekendUTC(ms) {
  const day = new Date(ms).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Which market session a timestamp belongs to.
 * @param {number} ms
 * @returns {'pre'|'regular'|'post'|'closed'} 'closed' = overnight (20:00–04:00)
 */
export function sessionAt(ms) {
  const min = msOfDay(ms) / MINUTE_MS;
  if (min < PRE_OPEN_MIN || min >= POST_CLOSE_MIN) return 'closed';
  if (min < REG_OPEN_MIN) return 'pre';
  if (min < REG_CLOSE_MIN) return 'regular';
  return 'post';
}

/**
 * Snap a timestamp forward to the next tradable moment.
 * - Weekends are skipped unless `weekends` is true.
 * - With `intraday`, times outside the session window jump to the next
 *   session open (09:30, or 04:00 when `extendedHours` is true).
 * - `intraday: false` only applies the weekend rule (daily+ bars).
 *
 * @param {number} ms - candidate timestamp (kept verbatim when already tradable)
 * @param {{weekends?: boolean, extendedHours?: boolean, intraday?: boolean}} [opts]
 * @returns {number} the first tradable timestamp >= the snapped candidate
 */
export function snapToTradingTime(ms, { weekends = false, extendedHours = false, intraday = false } = {}) {
  const openMin = extendedHours ? PRE_OPEN_MIN : REG_OPEN_MIN;
  const closeMin = extendedHours ? POST_CLOSE_MIN : REG_CLOSE_MIN;
  let t = ms;
  // Bounded loop: at most a handful of jumps (weekend + session open + next day).
  for (let i = 0; i < 8; i++) {
    if (!weekends && isWeekendUTC(t)) {
      const dayStart = t - msOfDay(t);
      t = intraday ? dayStart + DAY_LEN_MS + openMin * MINUTE_MS : t + DAY_LEN_MS;
      continue;
    }
    if (!intraday) return t;
    const tod = msOfDay(t);
    const min = tod / MINUTE_MS;
    if (min < openMin) {
      t = t - tod + openMin * MINUTE_MS;
      continue;
    }
    if (min >= closeMin) {
      t = t - tod + DAY_LEN_MS + openMin * MINUTE_MS;
      continue;
    }
    return t;
  }
  return t;
}

// Session windows as [openMin, closeMin) pairs — the bar grid re-anchors at
// each session's open, so hourly bars land on 04:00..09:00 (pre),
// 09:30..15:30 (regular) and 16:00..19:00 (post) instead of stepping blindly
// across the boundaries.
const REG_SESSION = [REG_OPEN_MIN, REG_CLOSE_MIN];
const EXT_SESSIONS = [
  [PRE_OPEN_MIN, REG_OPEN_MIN],
  [REG_OPEN_MIN, REG_CLOSE_MIN],
  [REG_CLOSE_MIN, POST_CLOSE_MIN]
];

/**
 * Next intraday bar time on the session-anchored grid.
 * @param {number} t - earliest allowed timestamp (inclusive)
 * @param {number} stepMs - bar step in milliseconds (< 1 day)
 * @param {{weekends?: boolean, extendedHours?: boolean}} [opts]
 * @returns {number} first grid timestamp >= t
 */
export function nextSessionBarTime(t, stepMs, { weekends = false, extendedHours = false } = {}) {
  const sessions = extendedHours ? EXT_SESSIONS : [REG_SESSION];
  let dayStart = t - msOfDay(t);
  for (let d = 0; d < 10; d++) {
    if (weekends || !isWeekendUTC(dayStart)) {
      for (const [open, close] of sessions) {
        const openT = dayStart + open * MINUTE_MS;
        const closeT = dayStart + close * MINUTE_MS;
        if (t >= closeT) continue;         // this session is already over
        if (t <= openT) return openT;      // before the open → bar at the open
        const k = Math.ceil((t - openT) / stepMs);
        const cand = openT + k * stepMs;
        if (cand < closeT) return cand;    // next grid point inside the session
      }
    }
    dayStart += DAY_LEN_MS;                // try the next day
  }
  return t;
}

/**
 * Snap a timestamp forward to the next Monday, keeping the time-of-day.
 * Used to anchor weekly stock bars so they always land on Mondays
 * (the convention used by real weekly candles).
 * @param {number} ms
 * @returns {number}
 */
export function anchorToMonday(ms) {
  const day = new Date(ms).getUTCDay();
  return ms + ((8 - day) % 7) * DAY_LEN_MS;
}
