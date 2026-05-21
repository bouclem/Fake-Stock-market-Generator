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
| `seed`       | Anything (string or number). Same seed → same output. |

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
