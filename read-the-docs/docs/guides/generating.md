# Generating data

The two entry points for data generation are `generateStock` (one ticker) and `generateMarket` (many).

## Single stocks

```js
import { generateStock } from 'stock-market-gen';

const stock = generateStock({
  symbol: 'NOVA',
  name: 'Nova Corp',
  sector: 'Tech',
  startPrice: 180,
  drift: 0.12,         // +12% per year, on average
  volatility: 0.28,    // 28% annualised
  bars: 120,
  interval: '1d',
  startDate: '2024-01-01',
  seed: 'nova-demo'
});
```

Every option is optional. Here's what each one does:

| Option       | What it controls |
|--------------|------------------|
| `symbol`     | Ticker. If you skip it, a random 2-5 letter symbol is generated. |
| `name`       | Company name. Optional, you supply it — the package never invents one. |
| `sector`     | Sector label. Optional, same idea. |
| `kind`       | `'stock'` (default) or `'crypto'`. Picks default ranges for price, drift, volatility. |
| `startPrice` | First bar's open price. If skipped, picked from the `kind` profile. |
| `drift`      | Annualised drift (mean return). `0.05` = +5% per year. |
| `volatility` | Annualised volatility. `0.3` = roughly ±30% swings per year. |
| `bars`       | Number of bars. Defaults to `100`. |
| `interval`   | Bar size. See [Intervals](intervals.md). |
| `startDate`  | Timestamp of the first bar. Date object, ms epoch, or ISO string. |
| `endDate`    | Anchor the **last** bar at this timestamp instead — the start is computed backward. Can't be combined with `startDate`. |
| `pricePrecision` | Integer 0–8: fixed decimals for every price field. Omit for automatic rounding. |
| `seed`       | Anything (string or number). Same seed → same output. |
| `weekends`   | `true` to include Saturday/Sunday bars. Stocks skip them by default. |
| `extendedHours` | `true` to add pre-market and after-hours bars (intraday only). See below. |
| `sharesOutstanding` | Adds a `worth` field (close × shares) to every bar. Accepts `"1.5M"`, `"1_500_000"`. |

## Market hours & weekends

Generated **stock** bars follow a realistic market schedule on a **UTC clock**:

| Session       | UTC window      | Included by default?            |
|---------------|-----------------|---------------------------------|
| Pre-market    | 04:00 – 09:30   | only with `extendedHours: true` |
| Regular       | 09:30 – 16:00   | yes                             |
| After-hours   | 16:00 – 20:00   | only with `extendedHours: true` |
| Weekends      | Sat / Sun       | only with `weekends: true`      |

Bars that would land outside tradable times snap **forward** to the next valid slot, and charts compress the skipped gaps — so weekends and overnights never appear as empty space (the same thing Yahoo Finance does).

```js
// Default: weekdays only, regular session only
const weekdays = generateStock({ bars: 60, interval: '1d' });

// One line to add weekends back
const allWeek = generateStock({ bars: 60, interval: '1d', weekends: true });

// One line to add pre-market + after-hours (intraday intervals)
const extended = generateStock({ bars: 200, interval: '1h', extendedHours: true });
extended.bars[0].session; // 'pre' | 'regular' | 'post'
```

!!! info "Details that matter"
    - `extendedHours` only affects **intraday** intervals (< 1 day). Daily/weekly/monthly bars have no session.
    - Intraday bars are **anchored to each session's open** — hourly bars land on `04:00…09:00` (pre), `09:30…15:30` (regular), `16:00…19:00` (post). A start time like `09:47` snaps forward to the next grid point (`10:30`).
    - **Weekly (`"1w"`) stock bars always land on Mondays**, matching real weekly candles.
    - Both options are **ignored for `kind: 'crypto'`** — crypto trades 24/7, gets no `session` field, and its timestamps are untouched.
    - Bars built from your own `prices`/`ohlc` still get schedule-aligned timestamps for stocks.
    - On charts, extended-hours bars render **Yahoo Finance–style**: grey semi-transparent dots on line/area charts, grey bars/candles/volume elsewhere. Override via `colors.ext` (see [Charts](charts.md#color-overrides)).

## Stock vs crypto

The `kind` option picks between two preset profiles:

| Profile | `startPrice` range          | `drift`         | `volatility`     |
|---------|------------------------------|-----------------|-------------------|
| `stock` | $50 – $500 (uniform)         | -15% to +25%/yr | 10% to 60%/yr     |
| `crypto`| $0.01 – $50,000 (log-uniform)| -30% to +60%/yr | 60% to 150%/yr    |

```js
const tech = generateStock({ kind: 'stock', symbol: 'TECH', bars: 365 });
const btc  = generateStock({ kind: 'crypto', symbol: 'BTC',  bars: 365 });
```

You can still override anything individually — `kind` only affects values you didn't set.

Crypto series also ignore the market schedule entirely: `weekends` and `extendedHours` have no effect, bars run 24/7 including Saturdays and Sundays, and no `session` field is added.

## Anchor the series with `endDate`

By default the first bar sits at `startDate` (or `now - bars*interval`). Pass `endDate` instead to pin the **last** bar — the start is computed backward:

```js
// 30 daily bars ending on 2024-12-31
const s = generateStock({ bars: 30, interval: '1d', endDate: '2024-12-31' });
s.bars.at(-1).date; // → '2024-12-31T00:00:00.000Z'
```

- `endDate` and `startDate` are mutually exclusive — passing both throws.
- Uniform grids (crypto, net worth) land **exactly** on `endDate`.
- Stocks snap to the nearest **earlier tradable slot**: a Sunday `endDate` ends the series on Friday, weekly bars end on the prior Monday, intraday bars end on the last session-grid point at or before the timestamp.

## Control decimals with `pricePrecision`

Prices are rounded automatically by magnitude (2dp for normal prices, more for sub-dollar). Set `pricePrecision` to pin every OHLC field — and `worth` — to a fixed number of decimals (0–8):

```js
const s = generateStock({ bars: 20, pricePrecision: 2 });
s.bars[0].close; // e.g. 61.37 — always exactly ≤2 decimals
```

The value is stored on the returned object as `stock.pricePrecision` and survives `toJSON`/`fromJSON`; charts reuse it for their y-axis labels unless you pass a chart-level `pricePrecision` override.

## Markets

A market is just an array of stocks. Two ways to build one:

### Auto-generated (random tickers)

```js
import { generateMarket } from 'stock-market-gen';

const market = generateMarket({
  count: 8,
  bars: 90,
  interval: '1d',
  seed: 'demo'
});
```

You get 8 stocks with random symbols and no `name` / `sector`. Same seed → same market every time.

### Hand-picked companies

Pass a `stocks` array. Any field you set is honored, anything else falls back to the shared options.

```js
const market = generateMarket({
  bars: 90,
  interval: '1w',
  startDate: '2024-01-01',
  seed: 'custom',
  stocks: [
    { symbol: 'NOVA', name: 'Nova Corp',     sector: 'Tech',     startPrice: 250 },
    { symbol: 'HRBR', name: 'Harbor Bank',   sector: 'Finance',  volatility: 0.18 },
    { symbol: 'PEAK', name: 'Peak Energy',   sector: 'Energy',   drift: -0.05, volatility: 0.45 },
    { symbol: 'GRVN' } // name and sector left empty
  ]
});
```

!!! info "Symbol uniqueness"
    `generateMarket` keeps symbols unique within the market. If you supply some explicit symbols and let others auto-generate, the auto-generated ones avoid collisions.

## Reproducibility

Same `seed`, same output. Forever. On any version of Node.

```js
const a = generateStock({ bars: 50, seed: 'pinned' });
const b = generateStock({ bars: 50, seed: 'pinned' });
// a.bars deep-equals b.bars
```

When you call `generateMarket` with a seed, that seed deterministically picks per-stock seeds, so the whole market is reproducible too.

## What you get back

Every stock looks like:

```js
{
  symbol: 'NOVA',
  name: 'Nova Corp',
  sector: 'Tech',
  kind: 'stock',
  startPrice: 180,
  interval: 86400000,        // ms representation of '1d'
  bars: [
    {
      time: 1704067200000,                    // unix epoch in ms
      date: '2024-01-01T00:00:00.000Z',       // ISO 8601
      open:  180.00,
      high:  182.34,
      low:   179.10,
      close: 181.27,
      volume: 1820411
    },
    // ...
  ]
}
```

It's plain JSON-safe data. `JSON.stringify(stock)` round-trips cleanly — see [Custom data](custom-data.md) for save/load patterns.

## Next steps

- [Intervals](intervals.md) — every bar size, including calendar-aware months and years.
- [Custom data](custom-data.md) — supply your own prices or full OHLC bars.
- [Charts](charts.md) — render what you generated.
