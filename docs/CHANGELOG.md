# Changelog

All notable changes to this project are documented here.

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
