# stock-market-gen

Generate realistic fake stock market data plus SVG charts and standalone HTML pages. Pure JS, zero dependencies, works in Node and the browser.

A modern, more capable replacement for the old `fake-stock-market-generator` package.

---

## Why this package

- **Zero dependencies.** One small package, no bundled bloat.
- **Works everywhere.** Node 14+, modern browsers, ESM and CommonJS.
- **Reproducible.** Pass a `seed` and you get the same output every time, on every machine.
- **Realistic.** Geometric Brownian Motion price model — prices stay positive, volatility scales with price level.
- **Bring your own data.** Supply close prices or full OHLC bars, the generator fills in whatever's missing.
- **Charts included.** Line, area, OHLC bar, candlestick, multi-line comparison — all return self-contained SVG strings.
- **Standalone HTML.** Drop a market into `renderHtmlPage()` and get a self-contained dashboard with clickable cards.

## At a glance

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ bars: 250, interval: '1d', seed: 'demo' });
writeFileSync('chart.svg', renderLineChart(stock));
```

That's it. One stock, one year of daily bars, one SVG chart.

## Where to next

<div class="grid cards" markdown>

- :material-rocket-launch: **[Getting started](getting-started.md)**
  Install the package and render your first chart.

- :material-book-open: **[Guides](guides/generating.md)**
  Step-by-step walkthroughs for every feature.

- :material-api: **[API reference](api-reference.md)**
  Every function, every option.

- :material-chef-hat: **[Recipes](recipes.md)**
  Copy-paste examples for common tasks.

</div>

## Install

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

## Compatibility

| Runtime         | Status                |
|-----------------|-----------------------|
| Node 14+        | :material-check: ESM and CJS |
| Modern browsers | :material-check: ESM bundlers (Vite, esbuild, Rollup, webpack) |
| Deno            | :material-check: ESM via npm specifier |
| Bun             | :material-check: ESM and CJS |

## License

MIT.
