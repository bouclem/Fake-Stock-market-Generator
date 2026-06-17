# TODO

Things that could ship in future versions. Nothing here is committed.

## Generation
- [x] Calendar-aware mode for `1mo` and `1y` — shipped in 1.1.1
- [x] Bring-your-own price data (`prices`, `ohlc`) — shipped in 1.1.0
- [x] JSON helpers (`toJSON`, `fromJSON`) — shipped in 1.1.0
- [x] Net worth time series (`generateNetWorth`) — shipped in 1.3.0
- [x] `sharesOutstanding` — company total worth per bar — shipped in 1.3.1
- [x] `loadEvents` / `loadEventsSync` — events from `.json` files or objects — shipped in 1.3.1
- [x] `parseNumeric` — underscore notation ("1_200_000") and suffixes ("1.5M", "2.3B") — shipped in 1.3.2
- [x] `renderMixedChart` — plot net worth + company worth + stocks together — shipped in 1.3.3
- [x] `formatHumanNumber` — readable axis labels (5K, 10.2K, 1.5M, 2.3B) — shipped in 1.3.4
- [x] `applySplit` — stock splits (2:1, 3:1, reverse 1:10) — shipped in 1.3.4
- [x] `applySplit` generalized — works with net worth, companies, any time-series — shipped in 1.3.5
- [x] `parseSplitRatio` — parse "3:1" split notation — shipped in 1.3.5
- [x] `loadSplits` / `applySplits` — JSON split loading and batch application — shipped in 1.3.5
- [x] Include README.md in npm package — shipped in 1.3.6
- [x] Volume on net worth bars — shipped in 1.3.7
- [x] `renderChartWithVolume` — volume sub-panel charts — shipped in 1.3.7
- [x] `cleanJson` / `parseJson` — parse JSON with numeric underscores — shipped in 1.3.7
- [ ] Skip weekends / holidays for daily bars
- [ ] Correlated stocks within a market (sector cohorts move together)
- [ ] Event injection that affects price data (earnings spikes, gaps, splits)

## Charts
- [x] Event markers on specific dates (full-height dashed lines + top labels) — shipped in 1.3.0
- [x] `valueMode: 'worth'` to plot company total valuation instead of per-share price — shipped in 1.3.1
- [x] Volume sub-panel under price charts — shipped in 1.3.7
- [ ] Optional moving averages (SMA, EMA)
- [ ] Tooltips and hover state when used in HTML pages
- [ ] PNG export helper (likely opt-in, not bundled, to stay zero-dep)
- [ ] `renderHtmlPage` support for `NetWorth` objects alongside stocks

## Tooling
- [ ] CLI: `npx stock-market-gen --count 5 --bars 100 --out market.html`
- [ ] Tests (only on request — currently skipped per project policy)
