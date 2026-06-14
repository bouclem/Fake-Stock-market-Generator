# API reference

Every function and option exported by `stock-market-gen`.

```js
import {
  // data
  generateStock,
  generateMarket,
  generateNetWorth,
  toJSON,
  fromJSON,

  // charts
  renderChart,
  renderLineChart,
  renderAreaChart,
  renderBarChart,
  renderCandlestickChart,
  renderMultiLineChart,
  renderNetWorthChart,

  // pages
  renderHtmlPage,

  // helpers
  createRng,
  parseInterval,
  parseIntervalSpec
} from 'stock-market-gen';
```

CommonJS works too:

```js
const { generateStock, renderLineChart } = require('stock-market-gen');
```

---

## Data generation

### `generateStock(options) -> Stock`

Generate price data for a single ticker.

```js
const stock = generateStock({ symbol: 'NOVA', bars: 120, seed: 'demo' });
```

| Option        | Type                       | Default               | Notes |
|---------------|----------------------------|-----------------------|-------|
| `symbol`      | `string`                   | random 2-5 chars      | uppercase ticker |
| `name`        | `string`                   | none                  | optional company name |
| `sector`      | `string`                   | none                  | optional sector label |
| `kind`        | `'stock' \| 'crypto'`      | `'stock'`             | sets default ranges for price, drift, volatility |
| `startPrice`  | `number`                   | random in range       | first bar's open price |
| `drift`       | `number`                   | random                | annualised, e.g. `0.05` = +5%/yr |
| `volatility`  | `number`                   | random                | annualised, e.g. `0.3` = 30%/yr |
| `bars`        | `number`                   | `100`                 | positive integer |
| `interval`    | `number \| string`         | `"1d"`                | see [Intervals](guides/intervals.md) |
| `startDate`   | `Date \| number \| string` | `now - bars*interval` | first bar timestamp |
| `seed`        | `number \| string`         | random                | reproducible output |
| `prices`      | `number[]`                 | none                  | use your own close prices; `bars` becomes the array length |
| `ohlc`        | `Bar[]`                    | none                  | use your own full OHLC bars verbatim |

`prices` and `ohlc` are mutually exclusive — passing both throws.

#### Returns

A `Stock` object:

```ts
{
  symbol: string;
  name: string | null;
  sector: string | null;
  kind: 'stock' | 'crypto';
  startPrice: number;
  interval: number;            // milliseconds (approximate for calendar units)
  bars: Bar[];
}
```

Where `Bar` is:

```ts
{
  time: number;                // unix epoch in ms
  date: string;                // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

---

### `generateMarket(options) -> Stock[]`

Generate multiple unique tickers in one call.

```js
const market = generateMarket({ count: 8, bars: 90, seed: 'demo' });
```

| Option    | Type                          | Default | Notes |
|-----------|-------------------------------|---------|-------|
| `count`   | `number`                      | `5`     | how many random-symbol stocks to make (ignored if `stocks` is set) |
| `stocks`  | `GenerateStockOptions[]`      | none    | per-stock overrides; any field is honored |
| `seed`    | `number \| string`            | random  | reproducible output across the whole market |
| ...       | any `generateStock` option    |         | applied as a shared default to every stock |

Symbols are kept unique within the market. If you supply some explicit symbols and let others auto-generate, the auto-generated ones avoid collisions.

---

### `generateNetWorth(options) -> NetWorth`

Generate a net worth time series for a person or entity. Uses Geometric Brownian Motion with wealth-accumulation defaults (positive drift, lower volatility).

```js
const nw = generateNetWorth({ name: 'Alice', startValue: 50000, bars: 120, interval: '1mo', seed: 'alice' });
```

| Option        | Type                       | Default               | Notes |
|---------------|----------------------------|-----------------------|-------|
| `name`        | `string`                   | none                  | label for this series |
| `startValue`  | `number`                   | random 10k–5M (log)   | starting net worth |
| `drift`       | `number`                   | random +2–15%/yr      | annualised |
| `volatility`  | `number`                   | random 5–25%/yr       | annualised |
| `bars`        | `number`                   | `100`                 | positive integer |
| `interval`    | `number \| string`         | `"1mo"`               | bar size |
| `startDate`   | `Date \| number \| string` | `now - bars*interval` | first bar timestamp |
| `seed`        | `number \| string`         | random                | reproducible output |
| `values`      | `number[]`                 | none                  | custom net worth values, one per bar |

#### Returns

A `NetWorth` object:

```ts
{
  name: string | null;
  startValue: number;
  interval: number;            // milliseconds
  bars: NetWorthBar[];
  _type: 'networth';           // used by fromJSON for type detection
}
```

Where `NetWorthBar` is:

```ts
{
  time: number;                // unix epoch in ms
  date: string;                // ISO 8601
  value: number;
}
```

---

### `toJSON(stockOrMarket, indent?) -> string`

Serialise a stock, market, or net worth object to a JSON string. Thin wrapper around `JSON.stringify` for discoverability — the output is already plain data.

```js
toJSON(stock);          // pretty (2-space indent)
toJSON(market, 0);      // compact
toJSON(netWorth);       // net worth round-trips cleanly
```

---

### `fromJSON(input) -> Stock | Stock[] | NetWorth`

Parse and validate a JSON string (or already-parsed object/array). Automatically detects `NetWorth` objects via `_type: 'networth'`. Returns the same shape it received.

```js
const stock   = fromJSON(readFileSync('stock.json', 'utf8'));
const market  = fromJSON(readFileSync('market.json', 'utf8'));
const netWorth = fromJSON(readFileSync('networth.json', 'utf8'));
```

Validation rejects negative prices/values, malformed bars, `high < low`, etc.

---

## Charts

All chart renderers return a complete SVG document as a string.

### `renderChart(stock, type, options?) -> string`

Single entry point. `type` is `'line'`, `'area'`, `'bar'`, or `'candlestick'` (`'candle'` is also accepted as a shorthand).

```js
renderChart(stock, 'candlestick', { theme: 'dark' });
```

### `renderLineChart(stock, options?) -> string`
### `renderAreaChart(stock, options?) -> string`
### `renderBarChart(stock, options?) -> string`
### `renderCandlestickChart(stock, options?) -> string`

Dedicated renderers for each chart type. Functionally equivalent to calling `renderChart` with the matching string.

### `renderNetWorthChart(netWorth, options?) -> string`

Render a `NetWorth` object as a line+area SVG chart. Accepts all standard [chart options](#chart-options) including `events`.

```js
renderNetWorthChart(nw, { theme: 'dark', events: [{ date: '2008-09-15', label: 'Crisis' }] });
```

The Y-axis shows net worth values formatted like prices. The default title is `"<name> — Net Worth"` (or just `"Net Worth"` when `name` is null).

See [Net worth guide](guides/net-worth.md) for usage details.

---

### `renderMultiLineChart(stocks, options?) -> string`

Plot several companies on the same axes with a built-in legend.

```js
renderMultiLineChart([a, b, c], { mode: 'normalized', area: true });
```

Multi-line specific options on top of [chart options](#chart-options):

| Option   | Type                       | Default        | Notes |
|----------|----------------------------|----------------|-------|
| `mode`   | `'normalized' \| 'price'`  | `'normalized'` | rebase to 100, or use raw values |
| `area`   | `boolean`                  | `false`        | translucent gradient fills under each line |
| `legend` | `boolean`                  | `true`         | show the symbol legend in top-left |

See [Multi-line comparison](guides/multi-line.md) for the full guide.

---

## Chart options

Shared by every chart renderer:

```js
{
  width: 1200,                                  // default 1200
  height: 600,                                  // default 600
  theme: 'light',                               // 'light' | 'dark'
  title: 'NOVA — daily',                        // pass '' to suppress default
  showGrid: true,
  showAxes: true,
  xTicks: 8,                                    // X-axis date label count
  yTicks: 5,                                    // Y-axis price label count
  padding: { top: 28, right: 24, bottom: 44, left: 64 },
  colors: { line: '#2563eb' },                  // override any single color
  events: [                                     // annotate specific dates
    { date: '2024-03-15', label: 'Earnings', color: '#f59e0b' },
    { date: '2024-07-01', label: 'Split' }      // color defaults to theme line color
  ]
}
```

### Events

All renderers accept an `events` array. Each entry is a `ChartEvent`:

```ts
type ChartEvent = {
  date: Date | number | string;  // any value parseable by new Date()
  label: string;                 // short text shown at the top of the chart
  color?: string;                // CSS color; defaults to the theme's line color
};
```

Each event renders as:
- a full-height dashed vertical line at that date
- a short label above the plot area

When events are present, `padding.top` is automatically increased by 20 px so labels don't overlap the chart title. Events outside the chart's time domain are silently ignored.

### Color keys

`bg`, `grid`, `text`, `axis`, `line`, `area`, `up`, `down`. Each theme provides defaults; `colors` overrides individual values without redefining the whole palette.

### Title behaviour

- `title` not set → default title is the stock's symbol (and name if present).
- `title: 'something'` → that string is used.
- `title: ''` → no title at all.

---

## HTML page

### `renderHtmlPage(marketOrStock, options?) -> string`

Returns a complete, self-contained HTML document with embedded SVG charts.

```js
renderHtmlPage(market, { theme: 'dark', chartType: 'candlestick' });
```

| Option         | Type                                        | Default               | Notes |
|----------------|---------------------------------------------|-----------------------|-------|
| `title`        | `string`                                    | `'Fake Stock Market'` | page heading and `<title>` |
| `theme`        | `'light' \| 'dark'`                         | `'light'`             | applies to the page chrome and embedded charts |
| `chartType`    | `'line' \| 'area' \| 'bar' \| 'candlestick'`| `'line'`              | chart type for every card |
| `chartOptions` | `ChartOptions`                              | `{}`                  | forwarded to each chart renderer |

See [HTML page builder](guides/html-page.md) for usage details and customisation.

---

## Helpers

### `createRng(seed?) -> Rng`

Create a seeded pseudo-random generator. Mostly used internally, but exposed in case you want reproducible random numbers in your own code.

```js
const rng = createRng('any-string');
rng.next();        // float in [0, 1)
rng.int(1, 6);     // integer in [1, 6]
rng.gauss();       // standard normal
rng.pick(array);   // random element
```

Same seed → same sequence, every time, on every machine.

### `parseInterval(interval) -> number`

Parse an interval into a representative millisecond duration. For calendar units (`1mo`, `1y`) this is approximate — see [Intervals](guides/intervals.md).

```js
parseInterval('1d');    // 86400000
parseInterval('5m');    // 300000
parseInterval(60_000);  // 60000  (numbers pass through, after validation)
```

### `parseIntervalSpec(interval) -> IntervalSpec`

Like `parseInterval`, but returns a structured object so you can branch on calendar vs fixed:

```ts
{ unit: string; n: number; calendar: boolean; ms: number }
```

```js
parseIntervalSpec('1mo');
// { unit: 'mo', n: 1, calendar: true, ms: 2592000000 }
```

---

## Type signatures (TypeScript-ish)

```ts
type Bar = {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Stock = {
  symbol: string;
  name: string | null;
  sector: string | null;
  kind: 'stock' | 'crypto';
  startPrice: number;
  interval: number;
  bars: Bar[];
};

type NetWorthBar = {
  time: number;
  date: string;
  value: number;
};

type NetWorth = {
  name: string | null;
  startValue: number;
  interval: number;
  bars: NetWorthBar[];
  _type: 'networth';
};

type ChartEvent = {
  date: Date | number | string;
  label: string;
  color?: string;
};

type ChartOptions = {
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  title?: string;
  showGrid?: boolean;
  showAxes?: boolean;
  xTicks?: number;
  yTicks?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  colors?: Partial<{
    bg: string; grid: string; text: string; axis: string;
    line: string; area: string; up: string; down: string;
  }>;
  events?: ChartEvent[];
};
```

The package itself ships as JS — these are descriptive only.
