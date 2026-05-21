# Custom data

You don't have to use the random walk. The generator accepts your own prices in two flavours:

- **`prices`** — an array of close prices. Open, high, low and volume are synthesised around your closes.
- **`ohlc`** — an array of full OHLC bars. Every value is preserved verbatim.

## Close prices only

Useful when you have real or hand-picked closing values and don't care about exact open/high/low/volume.

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({
  symbol: 'MINE',
  name: 'My Series',
  startDate: '2024-01-01',
  interval: '1d',
  prices: [100, 101.5, 99.2, 103.8, 105.1, 102.4, 107.0]
});

writeFileSync('mine.svg', renderLineChart(stock));
```

The bar count is taken from your array length — you don't pass `bars` separately. Each open is the previous close, and the high/low wicks are sized in proportion to the move between bars (so quiet days stay tight, big moves get wide wicks).

!!! note "Validation"
    Every value in `prices` must be a positive finite number. Mixed `null`, `NaN` or negative entries throw immediately.

## Full OHLC bars

When you have authoritative open/high/low/close (e.g. real market data, or a previously generated stock), pass `ohlc`:

```js
const stock = generateStock({
  symbol: 'REAL',
  interval: '1d',
  startDate: '2024-06-01',
  ohlc: [
    { open: 100, high: 102, low: 99,  close: 101 },
    { open: 101, high: 105, low: 100, close: 104 },
    { open: 104, high: 106, low: 103, close: 105 }
  ]
});
```

If you also include `time`, `date`, or `volume`, those are kept. Anything missing is filled in (bar timestamps step by `interval`, volume gets a plausible synthetic number).

## Save and load

The output is plain JSON. Use `toJSON` and `fromJSON` for nicer ergonomics, or call `JSON.stringify` / `JSON.parse` directly — both work.

```js
import { generateStock, toJSON, fromJSON, renderLineChart } from 'stock-market-gen';
import { writeFileSync, readFileSync } from 'node:fs';

const stock = generateStock({ bars: 365, interval: '1d', seed: 'year' });
writeFileSync('stock.json', toJSON(stock));

// Later, in another script
const restored = fromJSON(readFileSync('stock.json', 'utf8'));
writeFileSync('stock.svg', renderLineChart(restored));
```

`fromJSON` validates the bars (rejects malformed data, negative prices, `high < low`, etc.) and returns a `Stock` ready to feed back into any chart renderer.

## Whole markets

`fromJSON` accepts arrays too:

```js
import { generateMarket, toJSON, fromJSON, renderMultiLineChart } from 'stock-market-gen';
import { writeFileSync, readFileSync } from 'node:fs';

const market = generateMarket({ count: 5, bars: 180, seed: 'json-demo' });
writeFileSync('market.json', toJSON(market));

const reloaded = fromJSON(readFileSync('market.json', 'utf8'));
writeFileSync('market.svg', renderMultiLineChart(reloaded));
```

So a market saved on Monday can be reloaded on Friday and rendered with no regenerative cost.

## Importing CSV-style data

Got data in CSV? Convert to OHLC bars yourself, then pass through:

```js
import { readFileSync } from 'node:fs';
import { generateStock, renderCandlestickChart } from 'stock-market-gen';

const csv = readFileSync('prices.csv', 'utf8').trim().split('\n');
const [header, ...rows] = csv;

const ohlc = rows.map((row) => {
  const [date, open, high, low, close, volume] = row.split(',');
  return {
    time: new Date(date).getTime(),
    open:  Number(open),
    high:  Number(high),
    low:   Number(low),
    close: Number(close),
    volume: Number(volume)
  };
});

const stock = generateStock({ symbol: 'REAL', interval: '1d', ohlc });
writeFileSync('real.svg', renderCandlestickChart(stock));
```

## Conflict rules

You can't mix the two custom-data inputs.

```js
generateStock({ prices: [...], ohlc: [...] }); // ❌ throws
```

If both are set, the package errors immediately. Pick one.

## Sub-cent prices

Prices below `$1` keep 4 decimal places automatically; below `$0.01`, 6 decimals. Axis labels follow suit, so a chart of $0.0008 tokens stays readable instead of rounding to zero.

```js
const tiny = generateStock({
  kind: 'crypto',
  symbol: 'TINY',
  startPrice: 0.0008,
  bars: 120,
  seed: 'tiny'
});
```

This applies to custom data too — pass any positive number down to `0.0001`.
