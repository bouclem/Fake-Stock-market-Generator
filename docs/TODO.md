# TODO

Things that could ship in future versions. Nothing here is committed.

## Generation
- [x] Calendar-aware mode for `1mo` and `1y` — shipped in 1.1.1
- [ ] Skip weekends / holidays for daily bars
- [ ] Correlated stocks within a market (sector cohorts move together)
- [ ] Event injection (earnings spikes, gaps, splits)
- [x] Bring-your-own price data (`prices`, `ohlc`) — shipped in 1.1.0
- [x] JSON helpers (`toJSON`, `fromJSON`) — shipped in 1.1.0

## Charts
- [ ] Volume sub-panel under price charts
- [ ] Optional moving averages (SMA, EMA)
- [ ] Tooltips and hover state when used in HTML pages
- [ ] PNG export helper (likely opt-in, not bundled, to stay zero-dep)

## Tooling
- [ ] CLI: `npx stock-market-gen --count 5 --bars 100 --out market.html`
- [ ] Tests (only on request — currently skipped per project policy)
