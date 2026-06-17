// Price data generation.
//
// Three ways to get bars:
//   1. Pass `ohlc: Bar[]`     -> use your own bars verbatim
//   2. Pass `prices: number[]` -> we fill open/high/low/volume around your closes
//   3. Pass nothing            -> Geometric Brownian Motion does the whole thing
//
// GBM keeps prices positive and scales variance with price level:
//   S_{t+1} = S_t * exp((mu - sigma^2 / 2) * dt + sigma * sqrt(dt) * Z)
//
// Output is plain JSON-safe data. JSON.stringify(stock) round-trips cleanly.

import { createRng } from './prng.js';
import { makeSymbol } from './symbols.js';
import { parseIntervalSpec, stepTime } from './interval.js';
import { parseNumeric } from './numeric.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

/**
 * @typedef {Object} Bar
 * @property {number} time   - Unix epoch in milliseconds
 * @property {string} date   - ISO 8601 timestamp
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 * @property {number} [worth]  - Total company worth at close (close × sharesOutstanding). Present only when sharesOutstanding is set.
 */

/**
 * @typedef {Object} Stock
 * @property {string} symbol
 * @property {string|null} name
 * @property {string|null} sector
 * @property {number} startPrice
 * @property {number} interval - milliseconds between bars
 * @property {number|null} sharesOutstanding - Total shares outstanding (null when not set). Used to compute bar.worth.
 * @property {Bar[]} bars
 */

/**
 * @typedef {Object} GenerateStockOptions
 * @property {string} [symbol]
 * @property {string} [name]
 * @property {string} [sector]
 * @property {number} [startPrice]            - First bar's open price (default: 50-500)
 * @property {number} [drift]                 - Annualised drift, e.g. 0.05 = +5%/year
 * @property {number} [volatility]            - Annualised volatility, e.g. 0.3 = 30%/year
 * @property {number} [bars]                  - Number of bars to generate (default: 100)
 * @property {number|string} [interval]       - Bar size; ms or "1m"/"1h"/"1d"/"1w"/"1mo"/"1y"
 * @property {Date|number|string} [startDate] - First bar timestamp (default: now - bars*interval)
 * @property {number|string} [seed]           - Reproducible output
 * @property {'stock'|'crypto'} [kind]         - Sets defaults for price range, drift and volatility (default: 'stock')
 * @property {number[]} [prices]              - Custom close prices, one per bar.
 *   When set, `bars` is taken from this array's length and the random walk is
 *   skipped. Open/high/low/volume are still synthesised around your closes.
 * @property {Bar[]} [ohlc]                   - Full custom bars. Each entry must
 *   have `open`, `high`, `low`, `close`. `time`/`date`/`volume` are filled in if
 *   missing. Useful for round-tripping a previously generated stock.
 * @property {number} [sharesOutstanding]      - Total shares outstanding. When set, each bar gets a `worth` field
 *   equal to `close × sharesOutstanding`, representing total company valuation.
 */

const DEFAULTS = {
  bars: 100,
  interval: '1d',
  kind: 'stock'
};

const KIND_PROFILES = {
  stock: {
    startPriceMin: 50,
    startPriceMax: 500,
    logPrice: false,
    driftMin: -0.15,
    driftMax: 0.25,
    volMin: 0.1,
    volMax: 0.6
  },
  crypto: {
    // Wider price range (log-distributed) and much higher volatility.
    startPriceMin: 0.01,
    startPriceMax: 50000,
    logPrice: true,
    driftMin: -0.3,
    driftMax: 0.6,
    volMin: 0.6,
    volMax: 1.5
  }
};

function round2(n) {
  // Backwards-compatible name. Picks precision based on magnitude so that
  // small prices (crypto, sub-dollar tokens) keep 4 significant decimals
  // while normal stock prices stay readable at 2 decimals.
  if (!Number.isFinite(n)) return n;
  const abs = Math.abs(n);
  if (abs < 1) return Math.round(n * 10000) / 10000;
  if (abs < 100) return Math.round(n * 100) / 100;
  return Math.round(n * 100) / 100;
}

const PRICE_FLOOR = 0.0001;

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function isPositiveNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function validateOptions(opts) {
  if (opts.symbol !== undefined && (typeof opts.symbol !== 'string' || opts.symbol.length === 0)) {
    throw new Error(`"symbol" must be a non-empty string, got ${typeOf(opts.symbol)}`);
  }
  if (opts.name !== undefined && opts.name !== null && typeof opts.name !== 'string') {
    throw new Error(`"name" must be a string, got ${typeOf(opts.name)}`);
  }
  if (opts.sector !== undefined && opts.sector !== null && typeof opts.sector !== 'string') {
    throw new Error(`"sector" must be a string, got ${typeOf(opts.sector)}`);
  }
  if (opts.startPrice !== undefined && (!Number.isFinite(opts.startPrice) || opts.startPrice <= 0)) {
    throw new Error(`"startPrice" must be a positive number, got ${opts.startPrice}`);
  }
  if (opts.drift !== undefined && !Number.isFinite(opts.drift)) {
    throw new Error(`"drift" must be a finite number, got ${opts.drift}`);
  }
  if (opts.volatility !== undefined && (!Number.isFinite(opts.volatility) || opts.volatility < 0)) {
    throw new Error(`"volatility" must be a non-negative number, got ${opts.volatility}`);
  }
  if (opts.startDate !== undefined) {
    const t = new Date(opts.startDate).getTime();
    if (!Number.isFinite(t)) {
      throw new Error(`"startDate" is not a valid date: ${opts.startDate}`);
    }
  }
  if (opts.kind !== undefined && opts.kind !== 'stock' && opts.kind !== 'crypto') {
    throw new Error(`"kind" must be "stock" or "crypto", got ${opts.kind}`);
  }
  if (opts.prices !== undefined) {
    if (!Array.isArray(opts.prices) || opts.prices.length < 1) {
      throw new Error(`"prices" must be a non-empty array of numbers`);
    }
    for (let i = 0; i < opts.prices.length; i++) {
      if (!isPositiveNumber(opts.prices[i])) {
        throw new Error(`"prices[${i}]" must be a positive finite number, got ${opts.prices[i]}`);
      }
    }
  }
  if (opts.ohlc !== undefined) {
    if (!Array.isArray(opts.ohlc) || opts.ohlc.length < 1) {
      throw new Error(`"ohlc" must be a non-empty array of bars`);
    }
    for (let i = 0; i < opts.ohlc.length; i++) {
      const b = opts.ohlc[i];
      if (!b || typeof b !== 'object') {
        throw new Error(`"ohlc[${i}]" must be a bar object`);
      }
      for (const f of ['open', 'high', 'low', 'close']) {
        if (!isPositiveNumber(b[f])) {
          throw new Error(`"ohlc[${i}].${f}" must be a positive finite number, got ${b[f]}`);
        }
      }
      if (b.high < b.low) {
        throw new Error(`"ohlc[${i}]" has high < low`);
      }
    }
  }
  if (opts.prices !== undefined && opts.ohlc !== undefined) {
    throw new Error(`Pass either "prices" or "ohlc", not both`);
  }
  if (opts.sharesOutstanding !== undefined &&
      (!Number.isFinite(opts.sharesOutstanding) || opts.sharesOutstanding <= 0)) {
    throw new Error(`"sharesOutstanding" must be a positive finite number, got ${opts.sharesOutstanding}`);
  }
}

/**
 * Build a synthetic bar around a known close, using the previous close as the
 * open. Wick width follows the per-bar move size so quiet bars stay tight.
 */
function synthBarFromClose(prevClose, close, rng) {
  const open = prevClose;
  const move = Math.abs(close - open);
  const wick = move + open * 0.005 * (0.5 + rng.next());
  const high = Math.max(open, close) + wick * rng.next();
  const low = Math.max(PRICE_FLOOR, Math.min(open, close) - wick * rng.next());
  const relMove = move / open;
  const volume = Math.max(
    1,
    Math.round((500_000 + rng.next() * 1_500_000) * (1 + relMove * 20))
  );
  return { open, high, low, close, volume };
}

/**
 * Generate price data for a single stock.
 * @param {GenerateStockOptions} [options]
 * @returns {Stock}
 */
export function generateStock(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  validateOptions(opts);

  const rng = createRng(opts.seed);
  const intervalSpec = parseIntervalSpec(opts.interval);
  const intervalMs = intervalSpec.ms;

  // Determine bar count from the inputs we have
  let barCount;
  if (opts.ohlc) barCount = opts.ohlc.length;
  else if (opts.prices) barCount = opts.prices.length;
  else {
    if (!Number.isInteger(opts.bars) || opts.bars < 1) {
      throw new Error(`"bars" must be a positive integer, got ${opts.bars}`);
    }
    barCount = opts.bars;
  }

  const symbol = opts.symbol ?? makeSymbol(rng);
  const name = opts.name ?? null;
  const sector = opts.sector ?? null;

  const startTime =
    opts.startDate !== undefined
      ? new Date(opts.startDate).getTime()
      : Date.now() - barCount * intervalMs;

  const bars = new Array(barCount);
  let firstOpen;

  if (opts.ohlc) {
    // Mode 1: caller supplied full bars. Fill in time/date/volume if missing.
    for (let i = 0; i < barCount; i++) {
      const src = opts.ohlc[i];
      const time = Number.isFinite(src.time) ? src.time : stepTime(startTime, intervalSpec, i);
      bars[i] = {
        time,
        date: typeof src.date === 'string' ? src.date : new Date(time).toISOString(),
        open: round2(src.open),
        high: round2(src.high),
        low: round2(src.low),
        close: round2(src.close),
        volume: Number.isFinite(src.volume) ? src.volume : Math.max(1, Math.round(500_000 + rng.next() * 1_500_000))
      };
    }
    firstOpen = bars[0].open;
  } else if (opts.prices) {
    // Mode 2: caller supplied closes only. Synthesise the rest.
    let prevClose = opts.startPrice ?? opts.prices[0];
    firstOpen = prevClose;
    for (let i = 0; i < barCount; i++) {
      const close = opts.prices[i];
      const synth = synthBarFromClose(prevClose, close, rng);
      const time = stepTime(startTime, intervalSpec, i);
      bars[i] = {
        time,
        date: new Date(time).toISOString(),
        open: round2(synth.open),
        high: round2(synth.high),
        low: round2(synth.low),
        close: round2(synth.close),
        volume: synth.volume
      };
      prevClose = close;
    }
  } else {
    // Mode 3: full GBM walk.
    const profile = KIND_PROFILES[opts.kind];
    let startPrice;
    if (opts.startPrice !== undefined) {
      startPrice = opts.startPrice;
    } else if (profile.logPrice) {
      // Log-uniform so crypto picks both small (sub-$1) and big ($10k+) coins.
      const logMin = Math.log(profile.startPriceMin);
      const logMax = Math.log(profile.startPriceMax);
      startPrice = round2(Math.exp(logMin + rng.next() * (logMax - logMin)));
    } else {
      startPrice = round2(profile.startPriceMin + rng.next() * (profile.startPriceMax - profile.startPriceMin));
    }
    const drift = opts.drift ?? profile.driftMin + rng.next() * (profile.driftMax - profile.driftMin);
    const volatility = opts.volatility ?? profile.volMin + rng.next() * (profile.volMax - profile.volMin);
    const dt = intervalMs / YEAR_MS;
    const drift2 = (drift - (volatility * volatility) / 2) * dt;
    const diffusion = volatility * Math.sqrt(dt);

    let price = startPrice;
    firstOpen = startPrice;

    for (let i = 0; i < barCount; i++) {
      const open = price;
      let close = open * Math.exp(drift2 + diffusion * rng.gauss());
      if (close < PRICE_FLOOR) close = PRICE_FLOOR;

      const wick = Math.abs(open - close) + open * diffusion * (0.5 + rng.next());
      const high = Math.max(open, close) + wick * rng.next();
      const low = Math.max(PRICE_FLOOR, Math.min(open, close) - wick * rng.next());

      const move = Math.abs(close - open) / open;
      const volume = Math.max(
        1,
        Math.round((500_000 + rng.next() * 1_500_000) * (1 + move * 20))
      );

      const time = stepTime(startTime, intervalSpec, i);
      bars[i] = {
        time,
        date: new Date(time).toISOString(),
        open: round2(open),
        high: round2(high),
        low: round2(low),
        close: round2(close),
        volume
      };
      price = close;
    }
  }

  const sharesOutstanding = parseNumeric(opts.sharesOutstanding) ?? null;
  if (sharesOutstanding !== null) {
    for (let i = 0; i < bars.length; i++) {
      bars[i].worth = round2(bars[i].close * sharesOutstanding);
    }
  }

  return {
    symbol,
    name,
    sector,
    kind: opts.kind,
    startPrice: round2(opts.startPrice ?? firstOpen),
    interval: intervalMs,
    sharesOutstanding,
    bars
  };
}

/**
 * Convert a stock (or market) to a JSON string. Just a thin wrapper around
 * JSON.stringify for discoverability — the output is already plain data.
 * @param {Stock | Stock[]} stockOrMarket
 * @param {number} [indent]
 * @returns {string}
 */
export function toJSON(stockOrMarket, indent = 2) {
  return JSON.stringify(stockOrMarket, null, indent);
}

/**
 * Rebuild a stock (or a market — array of stocks) from a JSON string or
 * parsed object produced by toJSON. The shape is preserved: pass an array,
 * get an array; pass a single object, get a single stock.
 * @param {string | Stock | Stock[]} input
 * @returns {Stock | Stock[]}
 */
export function fromJSON(input) {
  const obj = typeof input === 'string' ? JSON.parse(input) : input;

  // Array -> rebuild every entry. Useful with renderMultiLineChart.
  if (Array.isArray(obj)) {
    return obj.map((entry, i) => {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.bars)) {
        throw new Error(`fromJSON: array entry ${i} is missing a "bars" array`);
      }
      return entry._type === 'networth' ? rebuildNetWorth(entry) : rebuildOne(entry);
    });
  }

  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.bars)) {
    throw new Error('fromJSON: expected an object with a "bars" array, or an array of such objects');
  }
  if (obj._type === 'networth') return rebuildNetWorth(obj);
  return rebuildOne(obj);
}

function rebuildNetWorth(obj) {
  return generateNetWorth({
    name: obj.name ?? undefined,
    startValue: obj.startValue,
    interval: obj.interval,
    values: obj.bars.map((b) => b.value),
    startDate: obj.bars[0]?.time
  });
}

function rebuildOne(obj) {
  // Reuse the OHLC path so we get full validation for free.
  return generateStock({
    symbol: obj.symbol,
    name: obj.name ?? undefined,
    sector: obj.sector ?? undefined,
    kind: obj.kind ?? undefined,
    startPrice: obj.startPrice,
    interval: obj.interval,
    sharesOutstanding: obj.sharesOutstanding ?? undefined,
    ohlc: obj.bars
  });
}

/**
 * @typedef {Object} NetWorthBar
 * @property {number} time   - Unix epoch in milliseconds
 * @property {string} date   - ISO 8601 timestamp
 * @property {number} value  - Net worth value at this point in time
 * @property {number} volume - Synthetic activity/volume indicator for this period
 */

/**
 * @typedef {Object} NetWorth
 * @property {string|null} name
 * @property {number} startValue
 * @property {number} interval - milliseconds between bars
 * @property {NetWorthBar[]} bars
 */

/**
 * @typedef {Object} GenerateNetWorthOptions
 * @property {string} [name]                   - Label for this net worth series (e.g. "John Doe")
 * @property {number} [startValue]             - Starting net worth (default: 10,000–5,000,000)
 * @property {number} [drift]                  - Annualised drift (default: random +2% to +15%)
 * @property {number} [volatility]             - Annualised volatility (default: random 5%–25%)
 * @property {number} [bars]                   - Number of data points (default: 100)
 * @property {number|string} [interval]        - Bar size; ms or "1d"/"1w"/"1mo"/"1y" etc.
 * @property {Date|number|string} [startDate]  - First bar timestamp
 * @property {number|string} [seed]            - Reproducible output
 * @property {number[]} [values]               - Custom net worth values, one per bar
 * @property {number[]} [volumes]              - Custom volume values, one per bar (optional)
 */

const NET_WORTH_DEFAULTS = {
  bars: 100,
  interval: '1mo'
};

/**
 * Generate a net worth time series for a person (or entity).
 * Uses Geometric Brownian Motion just like stock prices, but defaults
 * to lower volatility and positive drift to simulate wealth accumulation.
 * @param {GenerateNetWorthOptions} [options]
 * @returns {NetWorth}
 */
export function generateNetWorth(options = {}) {
  const opts = { ...NET_WORTH_DEFAULTS, ...options };

  if (opts.name !== undefined && opts.name !== null && typeof opts.name !== 'string') {
    throw new Error(`"name" must be a string, got ${typeOf(opts.name)}`);
  }
  if (opts.startValue !== undefined && (!Number.isFinite(opts.startValue) || opts.startValue <= 0)) {
    throw new Error(`"startValue" must be a positive number, got ${opts.startValue}`);
  }
  if (opts.drift !== undefined && !Number.isFinite(opts.drift)) {
    throw new Error(`"drift" must be a finite number, got ${opts.drift}`);
  }
  if (opts.volatility !== undefined && (!Number.isFinite(opts.volatility) || opts.volatility < 0)) {
    throw new Error(`"volatility" must be a non-negative number, got ${opts.volatility}`);
  }
  if (opts.startDate !== undefined) {
    const t = new Date(opts.startDate).getTime();
    if (!Number.isFinite(t)) {
      throw new Error(`"startDate" is not a valid date: ${opts.startDate}`);
    }
  }
  if (opts.values !== undefined) {
    if (!Array.isArray(opts.values) || opts.values.length < 1) {
      throw new Error(`"values" must be a non-empty array of numbers`);
    }
    for (let i = 0; i < opts.values.length; i++) {
      if (!isPositiveNumber(opts.values[i])) {
        throw new Error(`"values[${i}]" must be a positive finite number, got ${opts.values[i]}`);
      }
    }
  }

  const rng = createRng(opts.seed);
  const intervalSpec = parseIntervalSpec(opts.interval);
  const intervalMs = intervalSpec.ms;

  const barCount = opts.values ? opts.values.length : (
    (!Number.isInteger(opts.bars) || opts.bars < 1)
      ? (() => { throw new Error(`"bars" must be a positive integer, got ${opts.bars}`); })()
      : opts.bars
  );

  const name = opts.name ?? null;

  const startTime =
    opts.startDate !== undefined
      ? new Date(opts.startDate).getTime()
      : Date.now() - barCount * intervalMs;

  // Start value: log-uniform between 10k and 5M if not given
  let startValue;
  if (opts.startValue !== undefined) {
    startValue = opts.startValue;
  } else {
    const logMin = Math.log(10_000);
    const logMax = Math.log(5_000_000);
    startValue = round2(Math.exp(logMin + rng.next() * (logMax - logMin)));
  }

  const drift = opts.drift ?? (0.02 + rng.next() * 0.13);
  const volatility = opts.volatility ?? (0.05 + rng.next() * 0.20);
  const dt = intervalMs / YEAR_MS;
  const drift2 = (drift - (volatility * volatility) / 2) * dt;
  const diffusion = volatility * Math.sqrt(dt);

  const bars = new Array(barCount);

  // Validate volumes if provided
  if (opts.volumes !== undefined) {
    if (!Array.isArray(opts.volumes) || opts.volumes.length !== barCount) {
      throw new Error(`"volumes" must be an array of the same length as bars/values (${barCount})`);
    }
    for (let i = 0; i < opts.volumes.length; i++) {
      if (!Number.isFinite(opts.volumes[i]) || opts.volumes[i] < 0) {
        throw new Error(`"volumes[${i}]" must be a non-negative finite number, got ${opts.volumes[i]}`);
      }
    }
  }

  if (opts.values) {
    for (let i = 0; i < barCount; i++) {
      const time = stepTime(startTime, intervalSpec, i);
      bars[i] = {
        time,
        date: new Date(time).toISOString(),
        value: round2(parseNumeric(opts.values[i])),
        volume: opts.volumes ? Math.round(opts.volumes[i]) : Math.round(100 + rng.next() * 900)
      };
    }
  } else {
    let value = startValue;
    let prevValue = startValue;
    for (let i = 0; i < barCount; i++) {
      const time = stepTime(startTime, intervalSpec, i);
      // Synthetic volume based on value movement (more activity when net worth changes more)
      const move = Math.abs(value - prevValue) / prevValue;
      const volume = opts.volumes
        ? Math.round(opts.volumes[i])
        : Math.max(1, Math.round((100 + rng.next() * 900) * (1 + move * 50)));
      bars[i] = {
        time,
        date: new Date(time).toISOString(),
        value: round2(value),
        volume
      };
      prevValue = value;
      value = Math.max(PRICE_FLOOR, value * Math.exp(drift2 + diffusion * rng.gauss()));
    }
  }

  return {
    name,
    startValue: round2(startValue),
    interval: intervalMs,
    bars,
    _type: 'networth'
  };
}

/**
 * @typedef {Object} GenerateMarketOptions
 * @property {number} [count]                  - Number of stocks (default: 5)
 * @property {GenerateStockOptions[]} [stocks] - Per-stock overrides
 */

/**
 * Generate a whole market of stocks. Symbols stay unique within the market.
 * @param {GenerateMarketOptions} [options]
 * @returns {Stock[]}
 */
export function generateMarket(options = {}) {
  const { count, stocks, seed, ...sharedOpts } = options;

  let perStock;
  if (Array.isArray(stocks)) {
    if (stocks.length < 1) {
      throw new Error('"stocks" array must contain at least one entry');
    }
    perStock = stocks;
  } else {
    const n = count ?? 5;
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`"count" must be a positive integer, got ${n}`);
    }
    perStock = new Array(n).fill(null).map(() => ({}));
  }

  const master = createRng(seed);
  const used = new Set();
  for (const entry of perStock) {
    if (entry && typeof entry.symbol === 'string') used.add(entry.symbol);
  }

  return perStock.map((entry) => {
    const stockSeed = master.int(0, 0xFFFFFFFF);
    const merged = { ...sharedOpts, ...entry, seed: entry?.seed ?? stockSeed };
    if (typeof merged.symbol !== 'string') {
      const rng = createRng(merged.seed);
      merged.symbol = makeSymbol(rng, used);
    }
    return generateStock(merged);
  });
}

/**
 * Parse a split ratio string like "3:1", "2:1", "1:2", "1:10" into a numeric ratio.
 * Forward splits (3:1) return 3, reverse splits (1:2) return 0.5.
 * Also accepts plain numbers.
 *
 * @param {string|number} value - Split specification: "3:1", "1:2", or numeric ratio
 * @returns {number} Numeric ratio (3 for 3:1, 0.5 for 1:2)
 * @example
 * parseSplitRatio("3:1");   // 3
 * parseSplitRatio("1:2");   // 0.5
 * parseSplitRatio("1:10");  // 0.1
 * parseSplitRatio(2);       // 2
 */
export function parseSplitRatio(value) {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`parseSplitRatio: invalid ratio number: ${value}`);
    }
    return value;
  }
  const str = String(value).trim();
  if (str.includes(':')) {
    const parts = str.split(':');
    if (parts.length !== 2) {
      throw new Error(`parseSplitRatio: invalid split format "${value}" (expected "X:Y")`);
    }
    const left = parseFloat(parts[0]);
    const right = parseFloat(parts[1]);
    if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
      throw new Error(`parseSplitRatio: invalid split numbers in "${value}"`);
    }
    // "3:1" = 3/1 = 3 (forward split)
    // "1:2" = 1/2 = 0.5 (reverse split)
    return left / right;
  }
  // Plain number as string
  const num = parseFloat(str);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`parseSplitRatio: invalid ratio: ${value}`);
  }
  return num;
}

/**
 * @typedef {Object} SplitEntry
 * @property {string} date - ISO date string
 * @property {number|string} [split] - Split ratio: "3:1", "1:2", or numeric (3, 0.5)
 * @property {number} [ratio] - Numeric ratio (alternative to split)
 */

/**
 * Apply a value split to historical time-series data.
 * Works with stocks, net worth, company market cap, or any object with bars array.
 *
 * For stocks: adjusts OHLC, volume, and worth
 * For net worth: adjusts the value field
 * For companies: adjusts worth and per-share metrics if present
 *
 * @param {Object} data - Object with bars array (Stock, NetWorth, etc.)
 * @param {Date|number|string} splitDate - When the split occurs
 * @param {number|string} ratio - Split ratio:
 *   - "3:1" or 3 = triple the value (e.g., stock split)
 *   - "1:2" or 0.5 = halve the value (e.g., reverse split)
 *   - "2:1" or 2 = double the value
 * @param {Object} [options] - Optional configuration
 * @param {string[]} [options.fields] - Fields to adjust (auto-detected if not provided)
 * @returns {Object} New object with adjusted bars and split history
 * @example
 * // Stock 2:1 split
 * const splitStock = applySplit(stock, '2024-06-15', '2:1');
 *
 * // Net worth adjustment (inheritance 3:1 wealth increase)
 * const adjusted = applySplit(netWorth, '2024-06-15', '3:1');
 *
 * // Company market cap adjustment
 * const adjustedCompany = applySplit(company, '2024-06-15', 2);
 */
export function applySplit(data, splitDate, ratio, options = {}) {
  if (!data || !Array.isArray(data.bars) || data.bars.length === 0) {
    throw new Error('applySplit: expected an object with non-empty bars array');
  }

  const numericRatio = parseSplitRatio(ratio);
  if (numericRatio == null) {
    throw new Error(`applySplit: invalid ratio "${ratio}"`);
  }

  const splitTime = new Date(splitDate).getTime();
  if (!Number.isFinite(splitTime)) {
    throw new Error(`applySplit: invalid split date: ${splitDate}`);
  }

  // Find the first bar at or after the split date
  const splitIndex = data.bars.findIndex(b => b.time >= splitTime);
  if (splitIndex === -1) {
    throw new Error(`applySplit: split date ${splitDate} is after all bars`);
  }
  if (splitIndex === 0) {
    throw new Error(`applySplit: split date ${splitDate} is before or at first bar`);
  }

  // Detect data type and fields to adjust
  const firstBar = data.bars[0];
  const isStock = firstBar && typeof firstBar.close === 'number';
  const isNetWorth = firstBar && typeof firstBar.value === 'number' && !firstBar.close;
  const isCompany = isStock && data.sharesOutstanding;

  // Determine which fields to adjust
  let fields = options.fields;
  if (!fields) {
    if (isStock) {
      fields = ['open', 'high', 'low', 'close'];
      if (isCompany) fields.push('worth');
    } else if (isNetWorth) {
      fields = ['value'];
    } else {
      // Generic: find numeric fields in first bar
      fields = Object.keys(firstBar).filter(k =>
        k !== 'time' && k !== 'date' && typeof firstBar[k] === 'number'
      );
    }
  }

  const factor = 1 / numericRatio;

  // Adjust historical bars (before split)
  const adjustedBars = data.bars.map((b, i) => {
    if (i >= splitIndex) return b; // Bars at/after split stay the same

    const adjusted = { ...b };
    for (const field of fields) {
      if (b[field] != null && typeof b[field] === 'number') {
        adjusted[field] = round2(b[field] * factor);
      }
    }

    // For stocks: volume moves opposite to price (maintain value)
    if (isStock && b.volume != null) {
      adjusted.volume = Math.round(b.volume * numericRatio);
    }

    return adjusted;
  });

  // Build split history entry
  const splitEntry = {
    date: data.bars[splitIndex].date,
    time: splitTime,
    ratio: numericRatio,
    type: numericRatio > 1 ? 'forward' : 'reverse',
    display: numericRatio > 1
      ? `${Math.round(numericRatio)}:1`
      : `1:${Math.round(1 / numericRatio)}`
  };

  // Update appropriate start value based on type
  const result = {
    ...data,
    bars: adjustedBars,
    splits: [...(data.splits || []), splitEntry]
  };

  if (isStock && adjustedBars[0].open != null) {
    result.startPrice = adjustedBars[0].open;
  } else if (isNetWorth && adjustedBars[0].value != null) {
    result.startValue = adjustedBars[0].value;
  }

  return result;
}
