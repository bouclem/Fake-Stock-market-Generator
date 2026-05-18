// Price data generation.
//
// Uses Geometric Brownian Motion so prices stay positive and the variance
// scales with the current price — closer to how real markets behave than a
// plain random walk.
//
//   S_{t+1} = S_t * exp((mu - sigma^2 / 2) * dt + sigma * sqrt(dt) * Z)
//
// Each bar then gets an open/high/low/close and a synthetic volume.

import { createRng } from './prng.js';
import { makeSymbol } from './symbols.js';
import { parseInterval } from './interval.js';

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
 */

/**
 * @typedef {Object} Stock
 * @property {string} symbol
 * @property {string} name
 * @property {string} sector
 * @property {number} startPrice
 * @property {number} interval - milliseconds between bars
 * @property {Bar[]} bars
 */

/**
 * @typedef {Object} GenerateStockOptions
 * @property {string} [symbol]      - Override the generated symbol
 * @property {string} [name]        - Override the generated company name
 * @property {string} [sector]      - Override the generated sector
 * @property {number} [startPrice]  - First bar's open price (default: 50-500)
 * @property {number} [drift]       - Annualised drift, e.g. 0.05 = +5%/year
 * @property {number} [volatility]  - Annualised volatility, e.g. 0.3 = 30%/year
 * @property {number} [bars]        - Number of bars to generate (default: 100)
 * @property {number|string} [interval] - Bar size; ms or "1m"/"1h"/"1d" (default: "1d")
 * @property {Date|number|string} [startDate] - First bar timestamp (default: now - bars*interval)
 * @property {number|string} [seed] - Reproducible output
 */

const DEFAULTS = {
  bars: 100,
  interval: '1d'
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * Generate price data for a single stock.
 * @param {GenerateStockOptions} [options]
 * @returns {Stock}
 */
export function generateStock(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const rng = createRng(opts.seed);

  if (!Number.isInteger(opts.bars) || opts.bars < 1) {
    throw new Error(`"bars" must be a positive integer, got ${opts.bars}`);
  }

  // Optional fields: only validated when the caller actually provided them.
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

  const intervalMs = parseInterval(opts.interval);

  const symbol = opts.symbol ?? makeSymbol(rng);
  const name = opts.name ?? null;
  const sector = opts.sector ?? null;

  const startPrice = opts.startPrice ?? round2(rng.next() * 450 + 50); // 50..500
  // Drift roughly in [-15%, +25%] per year, vol in [10%, 60%] per year.
  const drift = opts.drift ?? rng.next() * 0.4 - 0.15;
  const volatility = opts.volatility ?? rng.next() * 0.5 + 0.1;

  const startTime =
    opts.startDate !== undefined
      ? new Date(opts.startDate).getTime()
      : Date.now() - opts.bars * intervalMs;

  const dt = intervalMs / YEAR_MS;
  const drift2 = (drift - (volatility * volatility) / 2) * dt;
  const diffusion = volatility * Math.sqrt(dt);

  const bars = new Array(opts.bars);
  let price = startPrice;

  for (let i = 0; i < opts.bars; i++) {
    const open = price;

    // Step the close using GBM
    let close = open * Math.exp(drift2 + diffusion * rng.gauss());
    if (close < 0.01) close = 0.01;

    // High/low wick around the open-close range, scaled by volatility
    const wick = Math.abs(open - close) + open * diffusion * (0.5 + rng.next());
    const high = Math.max(open, close) + wick * rng.next();
    const low = Math.max(0.01, Math.min(open, close) - wick * rng.next());

    // Volume: log-normal-ish around 1M, with a kick on bigger moves
    const move = Math.abs(close - open) / open;
    const volume = Math.max(
      1,
      Math.round((500_000 + rng.next() * 1_500_000) * (1 + move * 20))
    );

    const time = startTime + i * intervalMs;
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

  return {
    symbol,
    name,
    sector,
    startPrice: round2(startPrice),
    interval: intervalMs,
    bars
  };
}

/**
 * @typedef {Object} GenerateMarketOptions
 * @property {number} [count]                  - Number of stocks (default: 5)
 * @property {GenerateStockOptions[]} [stocks] - Per-stock overrides. When
 *   provided, the market size matches this array's length and each entry can
 *   pin its own `symbol`, `name`, `sector`, `startPrice`, etc.
 *
 * Any other field is treated as a shared default applied to every stock.
 */

/**
 * Generate a whole market of stocks. Symbols stay unique within the market.
 * @param {GenerateMarketOptions} [options]
 * @returns {Stock[]}
 */
export function generateMarket(options = {}) {
  const { count, stocks, seed, ...sharedOpts } = options;

  // Decide how many stocks we're producing
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

  // A master RNG drives per-stock seeds so the whole market is reproducible
  // from a single user seed.
  const master = createRng(seed);
  const used = new Set();

  // Reserve any symbols the caller pinned, so generated ones don't collide.
  for (const entry of perStock) {
    if (entry && typeof entry.symbol === 'string') used.add(entry.symbol);
  }

  return perStock.map((entry) => {
    const stockSeed = master.int(0, 0xFFFFFFFF);
    const merged = { ...sharedOpts, ...entry, seed: entry?.seed ?? stockSeed };

    if (typeof merged.symbol !== 'string') {
      // Build a deterministic rng just to pick a unique symbol up front
      const rng = createRng(merged.seed);
      merged.symbol = makeSymbol(rng, used);
    }

    return generateStock(merged);
  });
}
