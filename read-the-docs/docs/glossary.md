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

The time gap between consecutive bars. Can be `"1m"`, `"5m"`, `"1h"`, `"1d"`, `"1w"` (fixed) or `"1mo"`, `"1y"` (calendar-aware), or any positive number of milliseconds.

See [Intervals](guides/intervals.md) for full details.

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
