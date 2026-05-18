# Changelog

All notable changes to this project are documented here.

## 1.0.0 — 2026-05-18

Initial release. A modern rewrite of the old `fake-stock-market-generator`.

### Added
- `generateStock(options)` — single ticker with OHLCV bars
- `generateMarket({ count, stocks, ...options })` — whole markets, with optional per-company overrides
- Geometric Brownian Motion price model (prices stay positive, configurable drift and volatility)
- User-driven metadata: `symbol` defaults to a random ticker, `name` and `sector` are yours to set
- Configurable: `symbol`, `name`, `sector`, `startPrice`, `drift`, `volatility`, `bars`, `interval`, `startDate`, `seed`
- Input validation: rejects negative `startPrice`, non-string `name`/`sector`/`symbol`, negative `volatility`, non-finite `drift`, invalid `startDate`, and non-positive `bars`
- Interval shorthands: `"1m"`, `"1h"`, `"1d"`, `"1w"`, `"1mo"`, `"1y"`, plus raw milliseconds
- Seeded PRNG (Mulberry32 + Box-Muller) for reproducible output
- `renderLineChart`, `renderAreaChart`, `renderBarChart`, `renderCandlestickChart` — SVG renderers
- `renderChart(stock, type, options)` — single entry point
- `renderHtmlPage(marketOrStock, options)` — self-contained HTML page builder
- Light and dark themes, with per-color overrides
- Dual ESM + CJS publish, zero runtime dependencies
- Node 14+ support
