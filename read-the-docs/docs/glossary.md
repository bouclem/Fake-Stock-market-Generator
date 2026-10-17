# Glossary

A few finance and statistics terms used throughout the package.

## Bar

A single data point covering one time period. Has open, high, low, close, and volume — five numbers describing what happened during that interval.

100 bars on a daily chart = 100 days of data. The "bar chart" type is just one way to *draw* bars; line, area, and candlestick all render the same bar data, just differently.

## OHLC / OHLCV

OHLC = open, high, low, close. The four prices per bar:

- **open** — first price of the period
- **high** — highest price reached
- **low**  — lowest price reached
- **close** — last price of the period

OHLCV = OHLC + volume (number of units traded).

## Drift

The average expected return per year. A drift of `0.1` means a 10% expected gain per year on average. Negative drift means an expected loss.

In the price model, drift sets the long-run direction. Day-to-day moves still come from volatility, so a positive-drift stock can still drop on any given day.

## Volatility

How wild the price swings are, expressed annually. `0.3` (30%) means roughly ±30% swings per year — a typical stock figure. Crypto is usually 60-150%.

Higher volatility means bigger wicks, more dramatic candles, and a wider distribution of possible outcomes.

## Geometric Brownian Motion (GBM)

The stochastic process powering the price model:

```
S_{t+1} = S_t * exp((mu - sigma^2 / 2) * dt + sigma * sqrt(dt) * Z)
```

Where:

- `S_t` = price at time `t`
- `mu`  = drift (annualised)
- `sigma` = volatility (annualised)
- `dt` = time step in years
- `Z` = standard normal random number

GBM keeps prices positive (it's exponential), and variance scales with price level — a $500 stock can swing $10 just like a $5 stock can swing $0.10. Both feel equally volatile in percentage terms.

## Seed

Any string or number that pins the random sequence. Same seed → same output, every run, every machine.

```js
generateStock({ bars: 50, seed: 'pinned' });
// produces identical bars every single time
```

Drop the seed for fresh random output each run.

## Bar interval

The time gap between consecutive bars. Can be `"1min"`, `"5min"`, `"1h"`, `"1d"`, `"1w"` (fixed) or `"1mo"`/`"1m"`, `"1y"` (calendar-aware), or any positive number of milliseconds. Since v2.0.0, `"m"` means **month** — use `"min"` for minutes.

See [Intervals](guides/intervals.md) for full details.

## Session

Which part of the trading day an intraday stock bar belongs to. The package uses a UTC clock: `pre` = pre-market (04:00–09:30), `regular` = regular session (09:30–16:00), `post` = after-hours (16:00–20:00). Bars carry `session` only when generated with `extendedHours: true`.

## Pre-market / after-hours (extended hours)

Trading outside the regular 09:30–16:00 window. Generated stock bars include them only when you pass `extendedHours: true`; on charts they render as grey semi-transparent dots (Yahoo Finance–style) instead of the solid regular-session line. Intraday bars are anchored to each session's open, so hourly bars land on `04:00…09:00` / `09:30…15:30` / `16:00…19:00`.

## Weekends

Saturday and Sunday. Generated stock bars skip them by default (charts compress the gap); pass `weekends: true` to include them. Crypto is unaffected — it trades 24/7.

## endDate

Generation option that anchors the **last** bar at a given timestamp instead of the first — `startDate` is computed backward from it. The two are mutually exclusive. Lands exactly on uniform grids (crypto, net worth); stocks snap to the nearest earlier tradable slot.

## pricePrecision

Generation option (integer 0–8) that fixes the number of decimals on every price/value field. When omitted, the package rounds automatically by magnitude. The value is stored on the generated object and reused by chart y-axis labels.

## Trend coloring

Chart option (`trend: true`) for single-series line charts: every segment between two bars is drawn green when the value rose and red when it fell — on area charts the fill under each segment is colored the same way. Works for both `price` and `worth` modes; extended-hours dots stay grey. The `areaColor` option overrides the fill with one flat color for the whole area.

## Market

In this package, "market" just means an array of stocks generated together with shared options and a single seed. There's no order book, no trading mechanics — just a bundle of price series you can compare or display side by side.

## Normalized vs price mode (multi-line)

When comparing multiple stocks on one chart:

- **Normalized** — every series rebased to 100 at its first bar. Compares performance regardless of price level.
- **Price** — raw closing values on a shared Y axis. Best when scales are similar.

A $5 stock and a $5,000 stock are basically incomparable in price mode (the $5 line looks flat). Normalized mode is the safe default.

## Crypto kind

A profile preset that picks log-distributed start prices ($0.01 to $50,000) and much higher drift/volatility than stocks. Set with `kind: 'crypto'`.

## Stock kind

The default profile: linear-uniform start prices ($50 to $500), modest drift (-15% to +25%/yr), modest volatility (10% to 60%/yr). Set explicitly with `kind: 'stock'` if you want.
