# Changelog

All notable changes to this project are documented here.

## 1.3.5 — 2026-06-17

### Added
- `applySplit()` now works with **any time-series data**: stocks, net worth, companies, or custom objects with bars.
- `parseSplitRatio(value)` — parse split ratios from strings:
  - `"3:1"` → `3` (forward split)
  - `"1:2"` → `0.5` (reverse split)
  - `"1:10"` → `0.1`
  - Plain numbers work too: `2`, `0.5`
- `loadSplits()` / `loadSplitsSync()` — load splits from JSON files or arrays, similar to events.
- `applySplits(data, splits)` — apply multiple splits in chronological order.
- JSON support for splits: `{ "date": "2024-06-15", "split": "3:1" }` or `{ "date": "2024-06-15", "ratio": 2 }`

### Changed
- `applySplit()` auto-detects data type and adjusts appropriate fields:
  - Stocks: adjusts OHLC, volume, worth
  - Net worth: adjusts value
  - Custom objects: adjusts all numeric fields

## 1.3.4 — 2026-06-17

### Added
- `formatHumanNumber(value)` — format large numbers for readable axis labels:
  - `100` → `"100"`
  - `1000` → `"1000"`
  - `5000` → `"5K"`
  - `10000` → `"10K"`
  - `10200` → `"10.2K"`
  - `1500000` → `"1.5M"`
  - `2300000000` → `"2.3B"`
  - `1000000000000` → `"1T"`
  - `1e15` → `"1QD"` (quadrillion)
- **All chart axes** now automatically use human-readable formatting for large values (≥5000). Net worth charts, market cap charts, and multi-line comparisons show `15.2M` instead of `15200000`.
- `applySplit(stock, splitDate, ratio)` — apply stock splits to historical data:
  - Forward splits: `2` (2:1), `3` (3:1) — historical prices divided, volume multiplied
  - Reverse splits: `0.5` (1:2), `0.1` (1:10) — historical prices multiplied, volume divided
  - Records split history on `stock.splits` array with `{ date, ratio, type, display }`
  - Adjusts OHLC, volume, and `worth` fields automatically

## 1.3.3 — 2026-06-17

### Added
- `renderMixedChart(items, options)` — plot **NetWorth**, **company market cap**, and **stock prices** together on a single chart.
  - Pass an array of `{ data, valueField?, label?, color? }` objects
  - `valueField`: `'value'` (net worth), `'worth'` (market cap), `'close'` (stock price), or `'auto'` (picks best available)
  - `mode`: `'normalized'` (default, rebases all to 100), `'percent'` (change from start), or `'absolute'` (raw values)
  - Automatic legend with color-coded lines
  - Up to 8 items per chart
  - Event markers supported
  - All series aligned to a common time axis (handles different bar counts and date ranges)

## 1.3.2 — 2026-06-17

### Added
- `parseNumeric(value)` — parse numbers written with underscores (`"1_200_000"`) or suffixes (`"1.5M"`, `"2.3B"`, `"500K"`). Returns a plain number. Works with:
  - Underscore notation: `"15_000_000"` → `15000000`
  - Suffix shorthand: `"1.5M"` → `1500000`, `"2.3B"` → `2300000000`, `"500K"` → `500000`
  - Plain numbers: passed through as-is
  - `null`/`undefined`: returned as-is
- `formatNumeric(value)` — format a number with underscores for readability: `1200000` → `"1_200_000"`
- `cleanNumericArray(arr)` — map `parseNumeric` over an array, filtering out invalid entries
- `generateNetWorth({ values: [...] })` now auto-parses string values with underscores or suffixes, so JSON config files can use readable numbers.
- `generateStock({ sharesOutstanding: "100_000_000" })` also accepts underscore strings.

## 1.3.1 — 2026-06-14

### Added
- `loadEvents(source)` / `loadEventsSync(source)` — normalise the `events` option from any source:
  - Array → returned as-is
  - String ending in `.json` → read from disk (Node.js) and parsed
  - Plain object → wrapped in a single-element array
  - `{ name, events: [...] }` envelope object → the `events` array is extracted
  - `null` / `undefined` → empty array
- `sharesOutstanding` option on `generateStock()` — when set, every bar gets a `worth` field (`close × sharesOutstanding`) representing total company valuation.
- `valueMode: 'worth'` chart option — all single-stock renderers (`renderLineChart`, `renderAreaChart`, `renderBarChart`, `renderCandlestickChart`) accept `valueMode: 'worth'` to plot `bar.worth` instead of `bar.close`/OHLC prices.
- `fromJSON` preserves `sharesOutstanding` and `bar.worth` on round-trips.

## 1.3.0 — 2026-06-14

### Added
- `generateNetWorth(options)` — generate a net worth time series for a person or entity. Uses Geometric Brownian Motion with wealth-accumulation defaults (low volatility, positive drift). Returns a `NetWorth` object with `name`, `startValue`, `interval`, and `bars: [{time, date, value}]`.
- `renderNetWorthChart(netWorth, options)` — render a net worth series as a line+area SVG chart. Accepts the same `ChartOptions` as all other renderers (theme, events, size, etc.).
- `toJSON` / `fromJSON` now support `NetWorth` objects. `fromJSON` detects net worth data via the `_type: 'networth'` field and round-trips it correctly.
- `events` option on all chart renderers (`renderLineChart`, `renderAreaChart`, `renderBarChart`, `renderCandlestickChart`, `renderMultiLineChart`, `renderNetWorthChart`). Pass an array of `{ date, label, color? }` objects to annotate specific dates with a full-height dashed vertical line and a short label displayed above the plot area.

### Changed
- Default chart size increased to **1200 × 600** (was 1000 × 500) for better readability and more room for date labels.
- When `events` are present, `padding.top` is automatically increased by 20 px to ensure event labels don't overlap the chart title.

## 1.2.3 — 2026-05-21

### Fixed
- Multi-line area fills now layer correctly when one series is bigger in some regions and smaller in others. The previous version sorted whole series by their global peak, so a series that had one tall spike would sit on top of (or under) every other series across the entire chart. Areas are now split into per-segment trapezoids and sorted by their **local** height, so layering can flip from segment to segment and a small bar in one region no longer "phases through" a taller neighbour.
- HTML page card charts no longer print a duplicated title in the SVG. Passing `title: ''` to any renderer now suppresses the default title fallback (the cards already show the symbol/name in their own header).
- `renderBarChart` and `renderCandlestickChart` insets the first and last bar by half their width so they sit fully inside the plot rectangle instead of overflowing into the axis area.
- `parseInterval` / `parseIntervalSpec` now reject zero-length intervals like `"0d"` or `"0mo"` (previously accepted, would have produced bars sharing the same timestamp).

## 1.2.2 — 2026-05-19

### Added
- Multi-line chart `area: true` option. Each series gets a translucent gradient fill from the line down to the chart bottom. Areas are painted from largest peak to smallest so smaller series stay visible on top of taller ones.
- Sub-cent price support. Internal floor moved from `0.01` to `0.0001`, and prices below `$1` keep 4 decimal places (below `$0.01` keeps 6). Custom `prices`/`ohlc` arrays accept any positive number down to `0.0001`.
- Axis labels auto-format with extra decimals when prices are small, so a chart of $0.0008 tokens shows readable values instead of rounding to zero.

## 1.2.1 — 2026-05-19

### Changed
- Multi-line chart legend now sits in the **top-left** of the plot area instead of top-right
- Chart titles move to the top-right so they don't overlap the legend
- Default chart size is now **1000×500** (was 800×400)
- Default `xTicks` is now **8** (was 5) so timelines have more date labels out of the box

## 1.2.0 — 2026-05-18

### Added
- `renderMultiLineChart(stocks, options)` — render multiple companies on a single chart with a built-in legend. Series are plotted against actual timestamps, so stocks with different `startDate` values land at the right horizontal position (a 2020 series sits on the left, a 2022 series on the right). Supports `mode: 'price'` (raw prices) or `mode: 'normalized'` (rebased to 100, the default).
- `kind: 'stock' | 'crypto'` option on `generateStock`. Crypto uses log-distributed start prices (sub-$1 coins to $50k+), wider drift and much higher volatility. Defaults to `'stock'`.
- Stock objects now carry a `kind` field, preserved through `toJSON` / `fromJSON`.
- Per-stock `color` field is honored by the multi-line renderer; otherwise a built-in palette assigns colors automatically.
- `xTicks` and `yTicks` chart options to control the number of date / price labels (defaults to 5 each).
- `fromJSON` now accepts arrays of stocks, so a market saved with `toJSON(market)` round-trips back into an array you can pass straight to `renderMultiLineChart`.

### Notes
- The chart `title` option (already in the API) is the **image title** — completely separate from a stock's `symbol` and `name`. Pass any string and it appears at the top of the SVG: `renderLineChart(stock, { title: 'Q1 Review' })`.

## 1.1.2 — 2026-05-18

### Fixed
- Edge axis labels no longer get cropped: the first X-axis label is left-anchored at the plot edge and the last is right-anchored, so long dates like `2023-12-31` stay fully inside the chart
- Slightly bigger default padding (`top: 28, right: 24, bottom: 44, left: 64`) so longer price labels and date strings have breathing room

## 1.1.1 — 2026-05-18

### Fixed
- `1mo` and `1y` intervals are now calendar-aware. Bars step to the same day of the next month/year instead of advancing by 30 or 365 fixed days, so `startDate: '1999-08-01'` with `1mo` produces `1999-08-01, 1999-09-01, 1999-10-01, …` and `1y` produces `1999-08-01, 2000-08-01, 2001-08-01, …`
- Y-axis padding is clipped at zero so charts of low-priced series never show negative tick labels
- X-axis labels switch to full `YYYY-MM-DD` when the chart spans more than one calendar year (instead of ambiguous `MM/DD`)

### Added
- `parseIntervalSpec` and `stepTime` helpers in `src/interval.js` for calendar-aware time stepping

## 1.1.0 — 2026-05-18

### Added
- `prices` option on `generateStock` — pass your own close prices, the package fills in open/high/low/volume around them
- `ohlc` option on `generateStock` — pass full OHLC bars verbatim
- `toJSON(stockOrMarket)` — convenience wrapper around `JSON.stringify`
- `fromJSON(text|object)` — parse and validate previously saved data, ready to render again
- Validation for the new inputs: rejects negative prices, malformed bars, and the prices/ohlc conflict
- README rewritten with a glossary, a step-by-step tutorial, and a recipes section

### Changed
- `examples/market-page.js` now uses the default `line` chart instead of `area`
- `renderHtmlPage` now produces clickable cards: clicking one opens a detail view with a larger chart, key stats, and a recent-bars table; press Escape or click outside to close
- Larger fonts and bigger card charts on the generated HTML page so labels are readable
- SVG axis and title fonts bumped from 11/13 px to 13/15 px

## 1.0.0 — 2026-05-18

Initial release. A modern rewrite of the old `fake-stock-market-generator`.

### Added
- `generateStock(options)` — single ticker with OHLCV bars
- `generateMarket({ count, stocks, ...options })` — whole markets, with optional per-company overrides
- Geometric Brownian Motion price model (prices stay positive, configurable drift and volatility)
- User-driven metadata: `symbol` defaults to a random ticker, `name` and `sector` are yours to set
- Configurable: `symbol`, `name`, `sector`, `startPrice`, `drift`, `volatility`, `bars`, `interval`, `startDate`, `seed`
- Interval shorthands: `"1m"`, `"1h"`, `"1d"`, `"1w"`, `"1mo"`, `"1y"`, plus raw milliseconds
- Seeded PRNG (Mulberry32 + Box-Muller) for reproducible output
- `renderLineChart`, `renderAreaChart`, `renderBarChart`, `renderCandlestickChart` — SVG renderers
- `renderChart(stock, type, options)` — single entry point
- `renderHtmlPage(marketOrStock, options)` — self-contained HTML page builder
- Light and dark themes, with per-color overrides
- Dual ESM + CJS publish, zero runtime dependencies
- Node 14+ support
- Input validation: rejects negative `startPrice`, non-string `name`/`sector`/`symbol`, negative `volatility`, non-finite `drift`, invalid `startDate`, and non-positive `bars`
