# Recipes

Copy-paste patterns for common tasks. Every snippet is self-contained.

## A single chart, fastest path

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
const svg = renderLineChart(generateStock({ bars: 100 }));
```

## Every chart type, side by side

```js
import { generateStock, renderChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ bars: 60, seed: 'demo' });
for (const t of ['line', 'area', 'bar', 'candlestick']) {
  writeFileSync(`${t}.svg`, renderChart(stock, t));
}
```

## A bigger market with random tickers

```js
import { generateMarket, renderHtmlPage } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({ count: 25, bars: 90, seed: 'demo' });
writeFileSync('market.html', renderHtmlPage(market, { theme: 'dark' }));
```

## Hand-picked companies with shared defaults

```js
import { generateMarket } from 'stock-market-gen';

const market = generateMarket({
  bars: 60,
  interval: '1w',
  seed: 'custom',
  stocks: [
    { symbol: 'NOVA', name: 'Nova Corp',     sector: 'Tech',     startPrice: 250 },
    { symbol: 'HRBR', name: 'Harbor Bank',   sector: 'Finance',  volatility: 0.18 },
    { symbol: 'PEAK', name: 'Peak Energy',   sector: 'Energy',   drift: -0.05, volatility: 0.45 },
    { symbol: 'GRVN' }
  ]
});
```

## Compare companies with gradient area fills

```js
import { generateMarket, renderMultiLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({
  bars: 365,
  interval: '1d',
  startDate: '2024-01-01',
  seed: 'compare',
  stocks: [
    { symbol: 'ALPHA' },
    { symbol: 'BRAVO' },
    { symbol: 'CHARL', color: '#dc2626' }
  ]
});

writeFileSync('compare.svg', renderMultiLineChart(market, {
  title: 'My Portfolio — 2024',
  mode: 'price',
  area: true,
  theme: 'dark'
}));
```

## Generate crypto instead of stocks

```js
import { generateStock, generateMarket } from 'stock-market-gen';

const btc   = generateStock({ kind: 'crypto', symbol: 'BTC', bars: 365 });
const coins = generateMarket({ count: 5, bars: 90, kind: 'crypto', seed: 'coins' });
```

Crypto uses log-distributed start prices (sub-$1 to $50k+), wider drift and much higher volatility than stocks.

## Sub-cent precision

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const tiny = generateStock({ kind: 'crypto', symbol: 'TINY', startPrice: 0.0008, bars: 120, seed: 'tiny' });
writeFileSync('tiny.svg', renderLineChart(tiny, { theme: 'dark' }));
```

Prices below `$1` keep 4 decimals, below `$0.01` keep 6. Axis labels follow suit.

## Compute a simple moving average

```js
import { generateStock, renderLineChart } from 'stock-market-gen';

const stock = generateStock({ bars: 250, seed: 'sma' });
const closes = stock.bars.map((b) => b.close);

const window = 20;
const sma = closes.map((_, i, a) => {
  if (i < window - 1) return null;
  const slice = a.slice(i - window + 1, i + 1);
  return slice.reduce((s, n) => s + n, 0) / window;
});

console.log(`Latest close: ${closes.at(-1)}`);
console.log(`20d SMA:      ${sma.at(-1).toFixed(2)}`);
```

The package keeps to data + chart rendering — analysis is yours, but it's plain numbers so any library or hand-written code works.

## Save and reload a whole market

```js
import { generateMarket, toJSON, fromJSON, renderMultiLineChart } from 'stock-market-gen';
import { writeFileSync, readFileSync } from 'node:fs';

const market = generateMarket({ count: 5, bars: 180, seed: 'json' });
writeFileSync('market.json', toJSON(market));

// Later
const reloaded = fromJSON(readFileSync('market.json', 'utf8'));
writeFileSync('market.svg', renderMultiLineChart(reloaded));
```

## Bring your own close prices

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const myCloses = [100, 102.3, 101.1, 105.7, 108.2, 106.9, 110.5, 113.0];

const stock = generateStock({
  symbol: 'MINE',
  startDate: '2024-06-01',
  interval: '1d',
  prices: myCloses
});

writeFileSync('mine.svg', renderLineChart(stock));
```

## Bring your own full OHLC bars

```js
import { generateStock, renderCandlestickChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

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

writeFileSync('real.svg', renderCandlestickChart(stock));
```

## Embed a chart inside your own HTML

```js
import { generateStock, renderAreaChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ bars: 120, seed: 'embed' });
const svg = renderAreaChart(stock, { width: 1000, height: 400, theme: 'light' });

writeFileSync('chart.html', `<!doctype html>
<title>${stock.symbol}</title>
<body style="font-family: system-ui; padding: 24px;">
  <h1>${stock.symbol}</h1>
  ${svg}
</body>`);
```

In a browser bundle, the same SVG string can be assigned to `element.innerHTML`.

## Custom colors per chart

```js
import { generateStock, renderLineChart } from 'stock-market-gen';

renderLineChart(generateStock({ bars: 100 }), {
  theme: 'dark',
  colors: {
    line: '#fbbf24',  // amber line
    grid: '#444'
  }
});
```

## Mixed intervals in one market

```js
import { generateMarket, renderMultiLineChart } from 'stock-market-gen';

const mixed = generateMarket({
  seed: 'mixed',
  stocks: [
    { symbol: 'EURUSD', interval: '1h', bars: 720 },
    { symbol: 'SPX',    interval: '1d', bars: 365 }
  ]
});

const svg = renderMultiLineChart(mixed, { mode: 'normalized' });
```

The chart spans the union of both timelines, with each line plotted at its actual timestamps.

## Build a sector dashboard

```js
import { generateMarket, renderHtmlPage } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({
  bars: 365,
  interval: '1d',
  startDate: '2024-01-01',
  seed: 'sectors',
  stocks: [
    { symbol: 'NOVA', name: 'Nova Corp',     sector: 'Tech',     drift: 0.18 },
    { symbol: 'BYTE', name: 'Bytecoin Lab',  sector: 'Tech',     drift: 0.12 },
    { symbol: 'HRBR', name: 'Harbor Bank',   sector: 'Finance',  drift: 0.06 },
    { symbol: 'GLDX', name: 'Gold Exchange', sector: 'Finance',  drift: 0.04 },
    { symbol: 'PEAK', name: 'Peak Energy',   sector: 'Energy',   drift: -0.05 },
    { symbol: 'GRVN', name: 'Greenvine Co.', sector: 'Consumer', drift: 0.10 }
  ]
});

writeFileSync('sectors.html', renderHtmlPage(market, {
  title: 'Sector Snapshot — 2024',
  theme: 'dark',
  chartType: 'area'
}));
```
