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
  renderChartWithVolume,
  renderMixedChart,

  // pages
  renderHtmlPage,

  // splits
  applySplit,
  applySplits,
  loadSplits,
  loadSplitsSync,

  // events
  loadEvents,
  loadEventsSync,

  // numeric helpers
  parseNumeric,
  formatNumeric,
  formatHumanNumber,
  cleanNumericArray,
  cleanJson,
  parseJson,

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
| `sharesOutstanding` | `number \| string`  | none                  | adds `worth` (close × shares) to every bar; accepts `"1.5M"`, `"1_500_000"` |
| `weekends`    | `boolean`                  | `false`               | stocks only: include Saturday/Sunday bars |
| `extendedHours` | `boolean`                | `false`               | stocks only, intraday: add pre-market + after-hours bars tagged via `bar.session` |

`prices` and `ohlc` are mutually exclusive — passing both throws.

#### Market hours & weekends (stocks)

Generated stock bars follow a **UTC** market clock: regular session **09:30–16:00**, pre-market **04:00–09:30**, after-hours **16:00–20:00**. Weekends are skipped by default, and a `startDate` outside tradable times snaps forward to the next slot. `extendedHours: true` adds pre/post bars (intraday intervals only) and tags each bar with `session: 'pre' | 'regular' | 'post'`. `weekends: true` re-enables Saturday/Sunday bars. Intraday bars anchor to each session's open, and `"1w"` bars always land on Mondays. Both options are ignored for `kind: 'crypto'` (24/7). See [Generating data — Market hours](guides/generating.md#market-hours-weekends).

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
  worth?: number;              // close × sharesOutstanding — only when sharesOutstanding is set
  session?: 'pre' | 'regular' | 'post';  // only on intraday bars generated with extendedHours: true
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

### `renderChartWithVolume(data, type?, options?) -> string`

Render a chart with a volume sub-panel below the price chart. `type` defaults to `'line'`; `'line'`, `'area'`, `'bar'`, and `'candlestick'` are supported. Works with stocks, net worth objects, or any data whose bars carry a `volume` field.

```js
renderChartWithVolume(stock, 'candlestick', { theme: 'dark' });
renderChartWithVolume(netWorth);               // line chart + volume panel
```

Extra option on top of [chart options](#chart-options):

| Option         | Type     | Default | Notes |
|----------------|----------|---------|-------|
| `volumeHeight` | `number` | `0.25`  | fraction of total height used by the volume panel (0–0.5) |

### `renderMixedChart(items, options?) -> string`

Plot **net worth**, **company market cap**, and **stock prices** together on one chart.

```js
renderMixedChart([
  { data: person,  label: 'Alice Net Worth', valueField: 'value' },
  { data: company, label: 'NOVA Market Cap', valueField: 'worth' },
  { data: stock,   label: 'TECH Price',      valueField: 'close' }
], { mode: 'normalized' });
```

Per item: `data` (`Stock` or `NetWorth`), `valueField` (`'value'`, `'worth'`, `'close'`, or `'auto'`), `label`, `color`.

| Option   | Type                                       | Default        | Notes |
|----------|--------------------------------------------|----------------|-------|
| `mode`   | `'normalized' \| 'percent' \| 'absolute'`  | `'normalized'` | rebase to 100, show % change, or use raw values |

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

`bg`, `grid`, `text`, `axis`, `line`, `area`, `up`, `down`, `ext`. Each theme provides defaults; `colors` overrides individual values without redefining the whole palette. `ext` is the extended-hours color — grey by default — used for pre-market/after-hours bars generated with `extendedHours: true` (dots on line charts, grey candles/OHLC/volume bars).

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
parseInterval('5min');  // 300000
parseInterval('5m');    // 12960000000  ('m' = month since v2.0.0 — use 'min' for minutes)
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

## Splits

### `applySplit(data, splitDate, ratio) -> Object`

Apply a value split to any time-series data — stocks, net worth, companies, or custom objects with a `bars` array. Adjusts historical values before `splitDate` so the series stays continuous. Ratio accepts `"3:1"`, `"1:10"`, or plain numbers (`3`, `0.1`).

```js
const splitStock = applySplit(stock, '2024-06-15', '2:1');
```

### `applySplits(data, splits) -> Object`

Apply a chronological list of splits in one call.

```js
const adjusted = applySplits(stock, [
  { date: '2024-03-15', split: '2:1' },
  { date: '2024-09-20', ratio: 0.5 }   // reverse split
]);
```

### `loadSplits(source)` / `loadSplitsSync(source) -> SplitDef[]`

Normalise splits from an array, a `{ splits: [...] }` envelope, or a `.json` file path (`loadSplits` is the async variant for file sources).

```js
const splits = loadSplitsSync('./splits.json');
const adjusted = applySplits(stock, splits);
```

---

## Events

### `loadEvents(source)` / `loadEventsSync(source) -> ChartEvent[]`

Normalise the `events` chart option from an array, a `.json` file path, a single event object, or a `{ name, events: [...] }` envelope. `null`/`undefined` returns `[]`.

```js
const events = loadEventsSync('milestones.json');
renderLineChart(stock, { events });
```

---

## Numeric helpers

### `parseNumeric(value) -> number`

Parse numbers written with underscores (`"1_200_000"`) or suffixes (`"1.5M"`, `"2.3B"`, `"500K"`). Plain numbers pass through; `null`/`undefined` are returned as-is.

### `formatNumeric(value) -> string`

Format a number with underscore grouping: `1200000` → `"1_200_000"`.

### `formatHumanNumber(value) -> string`

Short suffixes for axis labels: `5000` → `"5K"`, `10200` → `"10.2K"`, `1500000` → `"1.5M"`, `1e15` → `"1QD"`. Used automatically on chart axes for values ≥ 5000.

### `cleanNumericArray(arr) -> number[]`

Map `parseNumeric` over an array, filtering out unparseable entries.

### `cleanJson(text) -> string` / `parseJson(text) -> Object`

`cleanJson` strips underscores from numeric literals in a JSON string (so `JSON.parse` accepts it); `parseJson` does both steps in one call.

```js
const config = parseJson(readFileSync('config.json', 'utf8'));
// or: JSON.parse(cleanJson(rawText))
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
  worth?: number;                       // when sharesOutstanding is set
  session?: 'pre' | 'regular' | 'post'; // when extendedHours is true
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
    line: string; area: string; up: string; down: string; ext: string;
  }>;
  events?: ChartEvent[];
};
```

The package itself ships as JS — these are descriptive only.
