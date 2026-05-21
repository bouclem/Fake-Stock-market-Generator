# HTML page builder

`renderHtmlPage(marketOrStock, options)` returns a complete, self-contained HTML document. No build step, no external assets — open it in any browser.

## Quick example

```js
import { generateMarket, renderHtmlPage } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({ count: 8, bars: 180, seed: 'dashboard' });
writeFileSync('dashboard.html', renderHtmlPage(market, { theme: 'dark' }));
```

Open `dashboard.html`. You get a responsive grid of cards — one per stock — each showing:

- symbol and name
- latest price + percent change since first bar (green if up, red if down)
- a small chart
- sector + bar count footer

Click a card and a detail view opens with a larger chart, key stats (period high/low, opening price, average volume), and a table of the most recent 50 bars. <kbd>Esc</kbd> or click the backdrop to close.

## Options

```js
renderHtmlPage(market, {
  title: 'My Portfolio',
  theme: 'dark',                 // 'light' | 'dark'
  chartType: 'candlestick',      // 'line' (default) | 'area' | 'bar' | 'candlestick'
  chartOptions: {                // forwarded to every chart
    showGrid: false,
    colors: { line: '#fbbf24' }
  }
});
```

| Option         | Type                                        | Default  | Notes |
|----------------|---------------------------------------------|----------|-------|
| `title`        | `string`                                    | `'Fake Stock Market'` | shown in the page heading and `<title>` |
| `theme`        | `'light' \| 'dark'`                         | `'light'`| applies to the page chrome and the embedded charts |
| `chartType`    | `'line' \| 'area' \| 'bar' \| 'candlestick'`| `'line'` | which chart to render in each card |
| `chartOptions` | `ChartOptions`                              | `{}`     | forwarded to the chart renderer |

## Single stock

Pass a single stock instead of an array — the page renders one big card:

```js
import { generateStock, renderHtmlPage } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ symbol: 'NOVA', bars: 250, seed: 'one' });
writeFileSync('nova.html', renderHtmlPage(stock, { theme: 'dark' }));
```

## What's in the page

The output is a single `.html` file containing:

- a `<style>` block with the theme palette and grid layout
- one `<div class="card">` per stock with the SVG chart inlined
- one hidden `<div class="detail">` per stock for the detail view
- a small vanilla-JS `<script>` (no framework) that handles open/close

No external network requests. Open the file offline, ship it as part of a static site, or serve it as a lightweight admin dashboard.

## Theming the page

Both themes coordinate the page chrome (background, card background, borders, text) and the embedded charts.

=== "Light"
    ```js
    renderHtmlPage(market, { theme: 'light' });
    ```

=== "Dark"
    ```js
    renderHtmlPage(market, { theme: 'dark' });
    ```

If you need fine-grained control, pass `chartOptions: { colors: { ... } }` — those overrides only affect the charts inside cards, not the page chrome.

## When to use it

`renderHtmlPage` is great for:

- quick demos and showcases
- internal dashboards where you don't want to set up a build
- sharing snapshots with a teammate ("here's a `.html`, just open it")
- generating preview images during a build pipeline

For interactive web apps, use the chart renderers directly and embed the returned SVG strings into your own components.

## Customising further

The HTML output is designed to be readable and easy to post-process. If you need a totally custom layout, generate the SVGs yourself and build the page however you like:

```js
import { generateMarket, renderLineChart } from 'stock-market-gen';

const market = generateMarket({ count: 4, bars: 120, seed: 'custom' });

const html = `<!doctype html>
<title>My Custom Page</title>
<body style="background: #111; padding: 24px;">
  ${market.map((s) => `
    <section style="margin-bottom: 32px;">
      <h2 style="color: white;">${s.symbol}</h2>
      ${renderLineChart(s, { theme: 'dark' })}
    </section>
  `).join('')}
</body>`;
```

You're not locked into the built-in layout — every renderer returns string output you can compose freely.
