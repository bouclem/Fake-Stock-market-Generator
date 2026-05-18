# stock-market-gen

Generate realistic fake stock market data plus SVG charts and standalone HTML pages. Pure JS, zero dependencies, works in Node and the browser.

A modern, more capable replacement for the old `fake-stock-market-generator` package.

## Install

```bash
npm install stock-market-gen
```

## Quick start

```js
import { generateStock, renderLineChart } from 'stock-market-gen';

const stock = generateStock({ bars: 100, interval: '1d', seed: 'demo' });
const svg = renderLineChart(stock);
```

CommonJS works too:

```js
const { generateStock, renderLineChart } = require('stock-market-gen');
```

## What you can generate

- single stocks or whole markets
- OHLCV bars (open, high, low, close, volume)
- pick any time interval — `"1m"`, `"5m"`, `"1h"`, `"1d"`, `"1w"`, `"1mo"`, `"1y"` or raw milliseconds
- override anything: symbol, name, sector, start price, drift, volatility, start date
- pass a `stocks` array to define each company yourself
- reproducible output via a seed

## Chart types

- `line` — close price line
- `area` — line plus filled area
- `bar` — OHLC bar (tick-left, tick-right)
- `candlestick` — classic candles, green up / red down

All renderers return a complete SVG string. Save it to a file, drop it into HTML, or pipe it anywhere.

## Customize anything

Every field is optional. Set the ones you care about, the rest are generated for you. The package only invents the symbol and the price series — `name`, `sector`, `startDate`, etc. are yours to provide.

```js
import { generateStock } from 'stock-market-gen';

const stock = generateStock({
  symbol: 'YOUR_SYMBOL',
  name: 'Your Company Name',
  sector: 'Your Sector',
  startPrice: 180,
  drift: 0.12,         // +12% per year
  volatility: 0.28,    // 28% per year
  bars: 60,
  interval: '1w',      // weekly bars
  startDate: '2024-01-01',
  seed: 'anything'
});
```

Same idea for a market — pass a `stocks` array and pin whatever you want per company:

```js
import { generateMarket } from 'stock-market-gen';

const market = generateMarket({
  bars: 90,
  interval: '1mo',
  startDate: '2023-01-01',
  seed: 'demo',
  stocks: [
    { symbol: 'YOUR1', name: 'Your Company 1', sector: 'Your Sector' },
    { symbol: 'YOUR2', name: 'Your Company 2', sector: 'Your Sector', volatility: 0.45 },
    { symbol: 'YOUR3' } // name and sector left empty
  ]
});
```

Or skip the array entirely and just get random tickers with no company info:

```js
const market = generateMarket({ count: 8, bars: 90, seed: 'demo' });
```

## API

### `generateStock(options) -> Stock`

| Option        | Type                       | Default          | Notes |
|---------------|----------------------------|------------------|-------|
| `symbol`      | `string`                   | random 2-5 chars |       |
| `name`        | `string`                   | none (you supply it) | optional company name |
| `sector`      | `string`                   | none (you supply it) | optional sector label |
| `startPrice`  | `number`                   | 50–500           |       |
| `drift`       | `number`                   | random           | annualised, e.g. `0.05` = +5%/yr |
| `volatility`  | `number`                   | random           | annualised, e.g. `0.3` = 30%/yr |
| `bars`        | `number`                   | `100`            | positive integer |
| `interval`    | `number \| string`         | `"1d"`           | ms or `"1m"`/`"1h"`/`"1d"`/`"1w"`/`"1mo"`/`"1y"` |
| `startDate`   | `Date \| number \| string` | `now - bars*interval` | first bar timestamp |
| `seed`        | `number \| string`         | random           | reproducible output |

### `generateMarket({ count, stocks, ...stockOptions }) -> Stock[]`

Generate several unique tickers in one call. Pass `count` for an auto-generated market (random symbols, no name or sector), or `stocks` to define each company yourself. Any other option is applied as a shared default.

```js
// Auto-generated, 8 random tickers, all daily, same seed -> same market
const market = generateMarket({ count: 8, bars: 90, interval: '1d', seed: 'demo' });

// Hand-picked companies, with shared defaults
const market = generateMarket({
  bars: 60,
  interval: '1w',
  seed: 'custom',
  stocks: [
    { symbol: 'YOUR1', name: 'Your Company 1', sector: 'Your Sector', startPrice: 180 },
    { symbol: 'YOUR2', name: 'Your Company 2', sector: 'Your Sector', volatility: 0.45 },
    { symbol: 'YOUR3' }
  ]
});
```

### `renderChart(stock, type, options)`

`type` is `"line"`, `"area"`, `"bar"` or `"candlestick"`. Or call the dedicated renderers: `renderLineChart`, `renderAreaChart`, `renderBarChart`, `renderCandlestickChart`.

Chart options:

```js
{
  width: 800,
  height: 400,
  theme: 'light',          // 'light' | 'dark'
  title: 'AAPL — daily',
  showGrid: true,
  showAxes: true,
  padding: { top: 24, right: 16, bottom: 36, left: 56 },
  colors: { line: '#2563eb' } // override any single color
}
```

### `renderHtmlPage(marketOrStock, options) -> string`

Builds a self-contained HTML page with embedded SVG charts. Pass an array (whole market) or a single stock.

```js
import { generateMarket, renderHtmlPage } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({ count: 8, bars: 90, seed: 'page' });
writeFileSync('market.html', renderHtmlPage(market, { theme: 'dark', chartType: 'area' }));
```

## Examples

```bash
npm run example       # writes out/line.svg and out/candle.svg
npm run example:page  # writes out/market.html
```

## License

MIT
