// Showcase of every feature added through 1.2.0.
// Run with: npm run example:showcase
// Outputs go to ./out/

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import {
  generateStock,
  generateMarket,
  renderLineChart,
  renderAreaChart,
  renderBarChart,
  renderCandlestickChart,
  renderMultiLineChart,
  renderHtmlPage,
  toJSON,
  fromJSON
} from '../src/index.js';

mkdirSync('out', { recursive: true });

// 1. Custom image title (separate from symbol / name)
const branded = generateStock({
  symbol: 'AAPL',
  name: 'Apple Inc',
  bars: 120,
  interval: '1d',
  startDate: '2024-01-01',
  seed: 'apple'
});
writeFileSync(
  'out/custom-title.svg',
  renderLineChart(branded, { title: 'Q1 2024 — Internal Review' })
);

// 2. Crypto kind
const btc = generateStock({
  kind: 'crypto',
  symbol: 'BTC',
  name: 'Bitcoin',
  bars: 365,
  interval: '1d',
  startDate: '2023-01-01',
  seed: 'btc-2023'
});
writeFileSync(
  'out/crypto.svg',
  renderCandlestickChart(btc, {
    title: 'BTC — daily candles',
    theme: 'dark'
  })
);

// 3. Configurable date tick count
writeFileSync(
  'out/ticks-3.svg',
  renderLineChart(branded, { title: '3 date ticks', xTicks: 3 })
);
writeFileSync(
  'out/ticks-12.svg',
  renderLineChart(branded, { title: '12 date ticks', xTicks: 12, width: 1100 })
);

// 4. Multi-line chart — three companies starting at different dates
const a = generateStock({ symbol: 'OLD', startDate: '2020-01-01', bars: 365, seed: 'old' });
const b = generateStock({ symbol: 'MID', startDate: '2021-01-01', bars: 365, seed: 'mid' });
const c = generateStock({ symbol: 'NEW', startDate: '2022-01-01', bars: 365, seed: 'new' });
writeFileSync(
  'out/multi-line.svg',
  renderMultiLineChart([a, b, c], {
    title: 'Three tickers, three start dates',
    width: 1000,
    height: 400,
    theme: 'dark'
  })
);

// 5. Multi-line in raw price mode (not normalised)
writeFileSync(
  'out/multi-price-mode.svg',
  renderMultiLineChart([a, b, c], {
    title: 'Same data, raw prices',
    mode: 'price',
    width: 1000,
    height: 400
  })
);

// 5b. Multi-line where each company sets its own startPrice (1.0, 1.8, 0.7).
//     In `mode: 'price'` each line keeps its real starting value.
const lowStart  = generateStock({ symbol: 'LOW',  startPrice: 1.0, bars: 120, interval: '1d', startDate: '2024-01-01', seed: 'low' });
const midStart  = generateStock({ symbol: 'MID2', startPrice: 1.8, bars: 120, interval: '1d', startDate: '2024-01-01', seed: 'mid2' });
const tinyStart = generateStock({ symbol: 'TINY', startPrice: 0.7, bars: 120, interval: '1d', startDate: '2024-01-01', seed: 'tiny' });
writeFileSync(
  'out/multi-custom-starts.svg',
  renderMultiLineChart([lowStart, midStart, tinyStart], {
    title: 'Each line starts at its own price (1.0 / 1.8 / 0.7)',
    mode: 'price',
    width: 1000,
    height: 400
  })
);

// 6. JSON round-trip — save a market, load it back, render
const market = generateMarket({
  count: 5,
  bars: 180,
  interval: '1d',
  startDate: '2024-01-01',
  seed: 'json-demo'
});
writeFileSync('out/market.json', toJSON(market));
const reloaded = fromJSON(readFileSync('out/market.json', 'utf8'));
writeFileSync(
  'out/multi-from-json.svg',
  renderMultiLineChart(reloaded, {
    title: 'Loaded from JSON, then rendered',
    width: 1000,
    height: 400
  })
);

// 7. Hand-built JSON with your own OHLC, then a multi-line chart
const handCrafted = JSON.parse(`[
  {
    "symbol": "MINE1",
    "name": "Hand Crafted A",
    "interval": 86400000,
    "bars": [
      { "time": ${Date.parse('2024-06-01')}, "open": 10.0, "high": 11.0, "low": 9.5,  "close": 10.5, "volume": 1000 },
      { "time": ${Date.parse('2024-06-02')}, "open": 10.5, "high": 12.0, "low": 10.2, "close": 11.8, "volume": 1100 },
      { "time": ${Date.parse('2024-06-03')}, "open": 11.8, "high": 12.5, "low": 11.5, "close": 12.0, "volume": 1200 },
      { "time": ${Date.parse('2024-06-04')}, "open": 12.0, "high": 13.0, "low": 11.9, "close": 12.7, "volume": 1300 },
      { "time": ${Date.parse('2024-06-05')}, "open": 12.7, "high": 13.5, "low": 12.5, "close": 13.2, "volume": 1400 }
    ]
  },
  {
    "symbol": "MINE2",
    "name": "Hand Crafted B",
    "interval": 86400000,
    "bars": [
      { "time": ${Date.parse('2024-06-01')}, "open": 100, "high": 102, "low": 99,  "close": 101, "volume": 5000 },
      { "time": ${Date.parse('2024-06-02')}, "open": 101, "high": 103, "low": 100, "close": 100, "volume": 5100 },
      { "time": ${Date.parse('2024-06-03')}, "open": 100, "high": 101, "low": 98,  "close": 99,  "volume": 5200 },
      { "time": ${Date.parse('2024-06-04')}, "open": 99,  "high": 100, "low": 97,  "close": 98,  "volume": 5300 },
      { "time": ${Date.parse('2024-06-05')}, "open": 98,  "high": 99,  "low": 96,  "close": 97,  "volume": 5400 }
    ]
  }
]`);
const fromHand = fromJSON(handCrafted);
writeFileSync(
  'out/multi-handcrafted.svg',
  renderMultiLineChart(fromHand, {
    title: 'Multi-line from hand-built JSON',
    mode: 'price',
    width: 900
  })
);

// 8. Updated market HTML page with all the polish
writeFileSync(
  'out/market.html',
  renderHtmlPage(market, {
    title: 'Showcase Market',
    theme: 'dark'
  })
);

console.log('Wrote:');
console.log('  out/custom-title.svg     - custom image title');
console.log('  out/crypto.svg           - crypto kind, candlesticks, dark');
console.log('  out/ticks-3.svg          - xTicks: 3');
console.log('  out/ticks-12.svg         - xTicks: 12');
console.log('  out/multi-line.svg       - 3 stocks, 3 start dates, normalised');
console.log('  out/multi-price-mode.svg - same, raw prices');
console.log('  out/multi-custom-starts.svg - per-line startPrice (1.0 / 1.8 / 0.7)');
console.log('  out/market.json          - saved market data');
console.log('  out/multi-from-json.svg  - market loaded from JSON');
console.log('  out/multi-handcrafted.svg - multi-line from hand-built JSON');
console.log('  out/market.html          - clickable market dashboard');
