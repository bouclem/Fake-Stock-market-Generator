# stock-market-gen

Generate realistic fake stock market and net worth data plus SVG charts and standalone HTML pages. Pure JS, zero dependencies, works in Node and the browser.

A modern, more capable replacement for the old `fake-stock-market-generator` package.

📖 **Full documentation:** [stock-market-gen.readthedocs.io](https://stock-market-gen.readthedocs.io)

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
- **net worth time series** for a person or entity (`generateNetWorth`)
- **company total worth** via `sharesOutstanding` — each bar gets a `worth` field (`close × shares`)
- `kind: 'stock'` (default) or `'crypto'` for wildly different defaults
- pick any time interval — `"1m"`, `"5m"`, `"1h"`, `"1d"`, `"1w"`, `"1mo"`, `"1y"` or raw milliseconds (calendar-aware for `1mo` / `1y`)
- override anything: symbol, name, sector, start price, drift, volatility, start date
- supply your **own** close prices (`prices`) or full OHLC bars (`ohlc`)
- save to JSON and reload it later — output is plain data (net worth + worth fields included)
- pass a `stocks` array to define each company yourself
- compare several companies on a single chart with `renderMultiLineChart` — including translucent gradient fills under each line
- sub-cent precision: prices below `$1` keep 4 decimals (below `$0.01` keeps 6), so crypto-style series stay readable
- reproducible output via a seed

## Chart types

- `line` — close price line
- `area` — line plus filled area
- `bar` — OHLC bar (tick-left, tick-right)
- `candlestick` — classic candles, green up / red down
- `renderNetWorthChart` — dedicated line+area chart for net worth series

All renderers return a complete SVG string. Save it to a file, drop it into HTML, or pipe it anywhere.

Every chart supports **event markers** — annotate specific dates with a full-height dashed line and a short label at the top of the chart. Load events from a separate `.json` file with `loadEvents()`.

All single-stock renderers support `valueMode: 'worth'` to plot total company valuation instead of per-share price.

Default chart size is **1200 × 600** for better readability and more room for date labels.

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

## Bring your own prices

Got real prices, hand-picked numbers, or output from another model? Pass them straight in. The generator skips its random walk and uses your data.

```js
import { generateStock } from 'stock-market-gen';

// Just the close prices — open/high/low/volume are synthesised around them
const stock = generateStock({
  symbol: 'MINE',
  name: 'My Series',
  startDate: '2024-01-01',
  interval: '1d',
  prices: [100, 101.5, 99.2, 103.8, 105.1, 102.4, 107.0]
});

// Or full OHLC bars, kept exactly as-is
const stock2 = generateStock({
  interval: '1d',
  startDate: '2024-01-01',
  ohlc: [
    { open: 100, high: 102, low: 99,  close: 101 },
    { open: 101, high: 105, low: 100, close: 104 }
  ]
});
```

## Save and load with JSON

The output is plain JSON-safe data, so saving and reloading is trivial:

```js
import { generateStock, toJSON, fromJSON } from 'stock-market-gen';
import { writeFileSync, readFileSync } from 'node:fs';

const stock = generateStock({ bars: 365, interval: '1d', seed: 'year' });

// Save
writeFileSync('stock.json', toJSON(stock));

// Load — bars are validated, then ready to render or analyse
const restored = fromJSON(readFileSync('stock.json', 'utf8'));
```

`toJSON(stock)` is a thin wrapper around `JSON.stringify`. `fromJSON(text)` parses, validates, and returns a `Stock` ready to feed back into any chart renderer.

## API

### `generateStock(options) -> Stock`

| Option        | Type                       | Default          | Notes |
|---------------|----------------------------|------------------|-------|
| `symbol`      | `string`                   | random 2-5 chars |       |
| `name`        | `string`                   | none (you supply it) | optional company name |
| `sector`      | `string`                   | none (you supply it) | optional sector label |
| `kind`        | `'stock' \| 'crypto'`      | `'stock'`        | sets defaults for price range, drift and volatility |
| `startPrice`  | `number`                   | random in range  | range depends on `kind` (50–500 for stocks, log-uniform 0.01–50000 for crypto) |
| `drift`       | `number`                   | random           | annualised, e.g. `0.05` = +5%/yr |
| `volatility`  | `number`                   | random           | annualised, e.g. `0.3` = 30%/yr |
| `bars`        | `number`                   | `100`            | positive integer |
| `interval`    | `number \| string`         | `"1d"`           | ms or `"1m"`/`"1h"`/`"1d"`/`"1w"`/`"1mo"`/`"1y"` (calendar-aware for `1mo` / `1y`) |
| `startDate`   | `Date \| number \| string` | `now - bars*interval` | first bar timestamp |
| `seed`        | `number \| string`         | random           | reproducible output |
| `prices`      | `number[]`                 | none             | use your own close prices; `bars` becomes the array length |
| `ohlc`        | `Bar[]`                    | none             | use your own full OHLC bars verbatim |

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

### Per-line start prices and start dates on a multi-line chart

Every stock can have its own `startPrice` and `startDate`. When you render them with `renderMultiLineChart` in `mode: 'price'`, each line begins at its own value:

```js
import { generateStock, renderMultiLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const a = generateStock({ symbol: 'LOW',  startPrice: 1.0, bars: 120, startDate: '2024-01-01', seed: 'a' });
const b = generateStock({ symbol: 'MID',  startPrice: 1.8, bars: 120, startDate: '2024-02-01', seed: 'b' });
const c = generateStock({ symbol: 'TINY', startPrice: 0.7, bars: 120, startDate: '2024-03-01', seed: 'c' });

writeFileSync(
  'starts.svg',
  renderMultiLineChart([a, b, c], { mode: 'price', title: 'Custom starts' })
);
```

`mode: 'normalized'` (the default) is great for comparing relative performance — every line starts at 100. `mode: 'price'` keeps the actual values, so different starting points stay visible.

### `generateNetWorth(options) -> NetWorth`

Generate a net worth time series for a person or entity. Uses GBM with wealth-accumulation defaults (positive drift, low volatility). Returns `{ name, startValue, interval, bars: [{time, date, value}] }`.

| Option        | Type                       | Default              | Notes |
|---------------|----------------------------|----------------------|-------|
| `name`        | `string`                   | none                 | label for this series |
| `startValue`  | `number`                   | random 10k–5M        | starting net worth |
| `drift`       | `number`                   | random +2–15%/yr     | annualised |
| `volatility`  | `number`                   | random 5–25%/yr      | annualised |
| `bars`        | `number`                   | `100`                | data points |
| `interval`    | `number \| string`         | `"1mo"`              | default monthly |
| `startDate`   | `Date \| number \| string` | `now - bars*interval`| |
| `seed`        | `number \| string`         | random               | reproducible |
| `values`      | `number[]`                 | none                 | custom net worth values |

```js
import { generateNetWorth, renderNetWorthChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const nw = generateNetWorth({
  name: 'Alice',
  startValue: 50000,
  bars: 120,
  interval: '1mo',
  startDate: '2015-01-01',
  seed: 'alice'
});

writeFileSync('alice.svg', renderNetWorthChart(nw, { theme: 'dark' }));
```

`toJSON` / `fromJSON` work with net worth objects too — they round-trip cleanly.

### `sharesOutstanding` and company worth

Pass `sharesOutstanding` to `generateStock()` and every bar gets a `worth` field:

```js
const stock = generateStock({
  symbol: 'NOVA',
  sharesOutstanding: 50_000_000,
  startPrice: 250,
  bars: 365,
  interval: '1d',
  seed: 'nova'
});

console.log(stock.bars[0].worth); // ~12.5B (250 * 50M)
```

Render with `valueMode: 'worth'` to plot the valuation instead of the price:

```js
writeFileSync('nova-worth.svg', renderAreaChart(stock, { valueMode: 'worth', theme: 'dark' }));
```

### `loadEvents(source)` / `loadEventsSync(source)`

Normalise the `events` option from any source — array, `.json` file path, single object, or envelope:

```js
const events = loadEvents('milestones.json');
writeFileSync('chart.svg', renderLineChart(stock, { events }));
```

The JSON file can be a plain array or an envelope `{ name, events: [...] }`. `loadEvents` also accepts an array (passthrough), a single event object, or `null`/`undefined` (returns `[]`).

### `renderChart(stock, type, options)`

`type` is `"line"`, `"area"`, `"bar"` or `"candlestick"`. Or call the dedicated renderers: `renderLineChart`, `renderAreaChart`, `renderBarChart`, `renderCandlestickChart`.

### `renderNetWorthChart(netWorth, options) -> string`

Render a `NetWorth` object as a line+area SVG chart. Accepts the same options as all other renderers.

Chart options:

```js
{
  width: 1200,             // default 1200
  height: 600,             // default 600
  theme: 'light',          // 'light' | 'dark'
  title: 'AAPL — daily',   // pass '' to suppress the default symbol/name title
  showGrid: true,
  showAxes: true,
  xTicks: 8,               // number of date labels on the X axis (default 8)
  yTicks: 5,               // number of price labels on the Y axis (default 5)
  padding: { top: 28, right: 24, bottom: 44, left: 64 },
  colors: { line: '#2563eb' }, // override any single color
  events: [                // annotate specific dates
    { date: '2024-03-15', label: 'Earnings', color: '#f59e0b' },
    { date: '2024-07-01', label: 'Split' }
  ]
}
```

#### Events

All chart renderers accept an `events` option — an array of `{ date, label, color? }` objects. Each event gets a full-height dashed vertical line and a short label at the top of the chart. The chart's top padding is automatically increased to keep labels clear of the title.

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ bars: 365, interval: '1d', startDate: '2024-01-01', seed: 'ev' });
writeFileSync('events.svg', renderLineChart(stock, {
  events: [
    { date: '2024-02-14', label: 'Earnings', color: '#f59e0b' },
    { date: '2024-05-20', label: 'Split',    color: '#7c3aed' },
    { date: '2024-10-01', label: 'CEO change' }
  ]
}));
```

### `renderMultiLineChart(stocks, options) -> string`

Render several companies on the same chart, with a built-in legend in the top-left. Series are plotted against actual timestamps, so stocks with different `startDate` values land at the right horizontal position.

```js
import { generateMarket, renderMultiLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({
  bars: 365, interval: '1d', startDate: '2024-01-01', seed: 'compare',
  stocks: [
    { symbol: 'ALPHA' },
    { symbol: 'BRAVO' },
    { symbol: 'CHARL', color: '#dc2626' } // optional explicit color
  ]
});

writeFileSync('compare.svg', renderMultiLineChart(market, {
  title: 'My Portfolio — 2024',
  mode: 'normalized', // or 'price' for raw values
  area: true,         // add translucent gradient fills under each line
  theme: 'dark'
}));
```

Multi-line specific options on top of the standard chart options:

| Option       | Type                          | Default        | Notes |
|--------------|-------------------------------|----------------|-------|
| `mode`       | `'normalized' \| 'price'`     | `'normalized'` | `'normalized'` rebases each series to 100 at its first bar (great for comparing relative performance regardless of price level). `'price'` keeps actual values. |
| `area`       | `boolean`                     | `false`        | also draw a translucent gradient fill under each line |
| `legend`     | `boolean`                     | `true`         | show the symbol legend in the top-left of the plot |

Per-stock `color` (hex string) is honored if set on the `Stock` object; otherwise a built-in palette is used.

### `renderHtmlPage(marketOrStock, options) -> string`

Builds a self-contained HTML page with embedded SVG charts. Pass an array (whole market) or a single stock.

```js
import { generateMarket, renderHtmlPage } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({ count: 8, bars: 90, seed: 'page' });
writeFileSync('market.html', renderHtmlPage(market, { theme: 'dark' })); // line is the default
```

## Examples

```bash
npm run example       # writes out/line.svg and out/candle.svg
npm run example:page  # writes out/market.html
```

## Glossary

A few finance terms that show up in this package:

- **bar** — a single data point covering one time period (open, high, low, close, volume). 100 bars on a daily chart = 100 days of data. The "bar chart" type is just one way to draw bars; line, area and candlestick all render the same bar data, just differently.
- **OHLC** — open / high / low / close, the four prices per bar.
- **OHLCV** — OHLC plus volume.
- **drift** — average expected return per year. `0.1` = +10%/year on average.
- **volatility** — how wild the swings are, annualised. `0.3` = roughly ±30% swings per year.
- **seed** — any string or number. Same seed = same output every time.

## Tutorial — building a market dashboard

Walk through a complete project from scratch. Output: a `dashboard.html` you can open in a browser.

### 1. Install

```bash
mkdir my-dashboard
cd my-dashboard
npm init -y
npm install stock-market-gen
```

Open `package.json` and add `"type": "module"` so you can use `import`.

### 2. Generate a market

Create `dashboard.js`:

```js
import { generateMarket, renderHtmlPage } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({
  bars: 365,                 // one year of daily data
  interval: '1d',
  startDate: '2024-01-01',
  seed: 'my-dashboard',      // change this for a different market
  stocks: [
    { symbol: 'NOVA', name: 'Nova Corp',     sector: 'Tech',     startPrice: 250, drift: 0.18, volatility: 0.35 },
    { symbol: 'HRBR', name: 'Harbor Bank',   sector: 'Finance',  startPrice: 120, drift: 0.06, volatility: 0.18 },
    { symbol: 'PEAK', name: 'Peak Energy',   sector: 'Energy',   startPrice: 60,  drift: -0.05, volatility: 0.45 },
    { symbol: 'GRVN', name: 'Greenvine Co.', sector: 'Consumer', startPrice: 80,  drift: 0.10, volatility: 0.22 }
  ]
});

writeFileSync('dashboard.html', renderHtmlPage(market, {
  title: 'My Portfolio',
  theme: 'dark'
}));

console.log('Open dashboard.html');
```

Run it:

```bash
node dashboard.js
```

Open `dashboard.html` in any browser. You get a dark-themed grid with one card per stock, each with a line chart, the latest price, and the percent change since day one.

### 3. Save the data

Want to keep the data so you can re-render later without regenerating?

```js
import { toJSON } from 'stock-market-gen';
writeFileSync('market.json', toJSON(market));
```

### 4. Reload and analyse

```js
import { fromJSON, renderCandlestickChart } from 'stock-market-gen';
import { readFileSync, writeFileSync } from 'node:fs';

const stocks = JSON.parse(readFileSync('market.json', 'utf8'));
const nova = fromJSON(stocks[0]);

// Compute simple moving average over the closes
const window = 20;
const closes = nova.bars.map((b) => b.close);
const sma = closes.map((_, i, a) => {
  if (i < window - 1) return null;
  const slice = a.slice(i - window + 1, i + 1);
  return slice.reduce((s, n) => s + n, 0) / window;
});

console.log(`${nova.symbol} latest close: ${closes.at(-1)}`);
console.log(`${nova.symbol} 20d SMA:      ${sma.at(-1).toFixed(2)}`);

writeFileSync('nova.svg', renderCandlestickChart(nova, { theme: 'light' }));
```

### 5. Use your own prices

Have real data, hand-picked numbers, or output from another system? Skip the random walk:

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const myCloses = [100, 102.3, 101.1, 105.7, 108.2, 106.9, 110.5, 113.0, 111.4, 115.8];

const stock = generateStock({
  symbol: 'MINE',
  name: 'My Series',
  startDate: '2024-06-01',
  interval: '1d',
  prices: myCloses           // bar count is taken from this array
});

writeFileSync('mine.svg', renderLineChart(stock));
```

`prices` gives close prices only and the package fills in plausible open/high/low/volume. If you have full OHLC, pass `ohlc: [...]` instead and every value is preserved exactly.

### 6. Embed a chart in a web page

Every render function returns an SVG string, which is just text. Drop it directly into HTML:

```js
import { generateStock, renderAreaChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ bars: 120, seed: 'web' });
const svg = renderAreaChart(stock, { width: 1000, height: 400, theme: 'light' });

const html = `<!doctype html>
<title>${stock.symbol}</title>
<body style="font-family: system-ui; padding: 24px;">
  <h1>${stock.symbol}</h1>
  ${svg}
</body>`;

writeFileSync('chart.html', html);
```

Or in a browser bundle, use it the same way — just inject the returned string into the DOM with `innerHTML`.

### 7. Reproducibility

Pass the same `seed` and you get the exact same output, on any machine, in any version of Node. This is useful for tests, demos, and golden snapshots:

```js
const a = generateStock({ bars: 50, seed: 'pinned' });
const b = generateStock({ bars: 50, seed: 'pinned' });
// a.bars deep-equals b.bars
```

Drop the seed and you get fresh random data every run.

### Compare multiple companies with gradient area fills

```js
import { generateMarket, renderMultiLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({
  bars: 365,
  interval: '1d',
  startDate: '2024-01-01',
  seed: 'compare',
  stocks: [
    { symbol: 'ALPHA' },
    { symbol: 'BRAVO' },
    { symbol: 'CHARL', color: '#dc2626' }
  ]
});

writeFileSync('compare.svg', renderMultiLineChart(market, {
  title: 'My Portfolio — 2024',
  mode: 'price',
  area: true,
  theme: 'dark'
}));
```

When `area: true`, fills are split into per-segment trapezoids. A series that's tall in one region but small in another only sits *under* its neighbours where it actually is taller — layering can flip across the chart, so a small spike won't get hidden by a big one elsewhere.

### Generate crypto instead of stocks

```js
import { generateStock, generateMarket } from 'stock-market-gen';

const btc  = generateStock({ kind: 'crypto', symbol: 'BTC', bars: 365 });
const coins = generateMarket({ count: 5, bars: 90, kind: 'crypto', seed: 'coins' });
```

Crypto uses log-distributed start prices (anywhere from sub-$1 to $50k+), higher drift and much higher volatility than stocks.

### Sub-cent prices

Prices below `$1` keep 4 decimals automatically; below `$0.01` they keep 6. Axis labels follow suit, so a chart of $0.0008 tokens stays readable.

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const tiny = generateStock({ kind: 'crypto', symbol: 'TINY', startPrice: 0.0008, bars: 120, seed: 'tiny' });
writeFileSync('tiny.svg', renderLineChart(tiny, { theme: 'dark' }));
```

### Just one chart

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
const svg = renderLineChart(generateStock({ bars: 100 }));
```

### A bigger market with random tickers

```js
const market = generateMarket({ count: 25, bars: 90, seed: 'demo' });
```

### Every chart type, side by side

```js
import { generateStock, renderChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ bars: 60, seed: 'demo' });
for (const t of ['line', 'area', 'bar', 'candlestick']) {
  writeFileSync(`${t}.svg`, renderChart(stock, t));
}
```

### Custom colors

```js
renderLineChart(stock, {
  theme: 'dark',
  colors: { line: '#fbbf24', grid: '#444' }
});
```

## License

MIT
