# Getting started

A 5-minute walkthrough from `npm install` to a chart in your browser.

## 1. Install

=== "npm"
    ```bash
    npm install stock-market-gen
    ```

=== "pnpm"
    ```bash
    pnpm add stock-market-gen
    ```

=== "yarn"
    ```bash
    yarn add stock-market-gen
    ```

## 2. Generate a stock

Create `demo.js` in an empty folder. If you're using ESM, also add `"type": "module"` to your `package.json`.

=== "ESM"
    ```js
    import { generateStock } from 'stock-market-gen';

    const stock = generateStock({
      symbol: 'DEMO',
      bars: 100,
      interval: '1d',
      seed: 'hello'
    });

    console.log(stock.bars[0]);
    console.log(`Generated ${stock.bars.length} bars for ${stock.symbol}`);
    ```

=== "CommonJS"
    ```js
    const { generateStock } = require('stock-market-gen');

    const stock = generateStock({
      symbol: 'DEMO',
      bars: 100,
      interval: '1d',
      seed: 'hello'
    });

    console.log(stock.bars[0]);
    console.log(`Generated ${stock.bars.length} bars for ${stock.symbol}`);
    ```

Run it:

```bash
node demo.js
```

You'll see the first bar — an object with `time`, `date`, `open`, `high`, `low`, `close`, and `volume`.

## 3. Render a chart

Add a chart renderer:

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ symbol: 'DEMO', bars: 100, seed: 'hello' });
writeFileSync('demo.svg', renderLineChart(stock));
```

Open `demo.svg` in any browser. That's a complete, standalone SVG you can embed anywhere.

## 4. Try other chart types

```js
import { generateStock, renderChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ bars: 60, seed: 'hello' });

for (const t of ['line', 'area', 'bar', 'candlestick']) {
  writeFileSync(`${t}.svg`, renderChart(stock, t));
}
```

Each renderer returns a string. No DOM, no canvas, no headless browser.

## 5. Build a market dashboard

```js
import { generateMarket, renderHtmlPage } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({ count: 8, bars: 180, seed: 'dashboard' });
writeFileSync('dashboard.html', renderHtmlPage(market, { theme: 'dark' }));
```

Open `dashboard.html` — you get a dark-themed grid of clickable stock cards. Click one to open a detailed view with a larger chart, key stats, and recent bars.

## What's next

- [Generating data](guides/generating.md) — every option for `generateStock` and `generateMarket`.
- [Charts](guides/charts.md) — every chart type, themed and customised.
- [Multi-line comparison](guides/multi-line.md) — plot several companies on one chart.
- [Custom data](guides/custom-data.md) — bring your own prices.

!!! tip "Reproducibility"
    Pass the same `seed` to any function and you get identical output every run. Drop the seed for fresh random data each time.
