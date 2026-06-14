# Charts

Every chart renderer returns a complete SVG document as a string. Save it to a file, drop it into HTML, send it over a wire — it's just text.

## The four single-stock chart types

### Line — close prices

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ bars: 120, seed: 'line' });
writeFileSync('line.svg', renderLineChart(stock));
```

Best for: trends, simple comparisons, dashboards.

### Area — line plus filled area

```js
import { renderAreaChart } from 'stock-market-gen';
writeFileSync('area.svg', renderAreaChart(stock));
```

Best for: emphasising magnitude over time.

### Bar — OHLC ticks

```js
import { renderBarChart } from 'stock-market-gen';
writeFileSync('bar.svg', renderBarChart(stock));
```

Classic Western-style OHLC bars: vertical line from low to high, left tick = open, right tick = close. Green when close ≥ open, red otherwise.

### Candlestick

```js
import { renderCandlestickChart } from 'stock-market-gen';
writeFileSync('candle.svg', renderCandlestickChart(stock));
```

Filled rectangles between open and close, with thin wicks for high/low. Same green/red convention.

### Pick by name

`renderChart(stock, type, options)` is a single entry point that takes the chart type as a string:

```js
import { renderChart } from 'stock-market-gen';

for (const t of ['line', 'area', 'bar', 'candlestick']) {
  writeFileSync(`${t}.svg`, renderChart(stock, t));
}
```

`'candle'` works as a shorthand for `'candlestick'`.

## Themes

Two built-in themes:

```js
renderLineChart(stock, { theme: 'light' });  // default
renderLineChart(stock, { theme: 'dark' });
```

Each theme defines a coordinated palette for background, grid, text, line, and the up/down candle colors.

### Color overrides

Override any single color without redefining the whole theme:

```js
renderLineChart(stock, {
  theme: 'dark',
  colors: {
    line: '#fbbf24',     // amber
    grid: '#444'
  }
});
```

Available keys: `bg`, `grid`, `text`, `axis`, `line`, `area`, `up`, `down`.

## Sizing and padding

Defaults are 1200 × 600 with generous padding so price labels and date strings fit cleanly.

```js
renderLineChart(stock, {
  width: 1600,
  height: 700,
  padding: { top: 32, right: 32, bottom: 56, left: 80 }
});
```

`padding` is merged with the defaults — you only have to set the fields you want to change.

## Title

By default each chart gets a title in the top-right based on the stock's symbol and name.

```js
// "NOVA — Nova Corp"
renderLineChart({ symbol: 'NOVA', name: 'Nova Corp', bars: [/* ... */] });
```

Override or suppress it:

```js
renderLineChart(stock, { title: 'Q1 2024 Review' });  // custom string
renderLineChart(stock, { title: '' });                // suppressed
```

!!! tip "Empty string suppresses the default"
    Passing `title: ''` is different from omitting `title`. An empty string explicitly says "no title" and skips the default fallback.

## Grids and axes

Both visible by default:

```js
renderLineChart(stock, {
  showGrid: false,   // hide horizontal price grid lines
  showAxes: false    // hide tick labels (X dates and Y prices)
});
```

Tick density is configurable:

```js
renderLineChart(stock, {
  xTicks: 12,   // 12 evenly-spaced date labels
  yTicks: 4     // 4 evenly-spaced price labels
});
```

The first and last X labels are anchored to the plot edges so long dates like `2023-12-31` never get cropped. When the chart spans more than one calendar year, X labels switch to full `YYYY-MM-DD` so years are always unambiguous.

## What you get back

A self-contained SVG. No external CSS, no fonts to load, no JavaScript dependencies inside.

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" width="1000" height="500">
  <rect width="1000" height="500" fill="#ffffff"/>
  ...
</svg>
```

That means you can:

- save it as a `.svg` file and open it in any browser
- inline it into HTML with `innerHTML = svg`
- pipe it through a converter to PNG (using something like `sharp` or `librsvg`)
- send it over an API as `Content-Type: image/svg+xml`

## Event markers

Annotate specific dates with a full-height dashed vertical line and a short label at the top of the chart. Useful for earnings reports, splits, macro events, or any milestone you want to highlight.

```js
import { generateStock, renderLineChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const stock = generateStock({ bars: 365, interval: '1d', startDate: '2024-01-01', seed: 'ev' });

writeFileSync('events.svg', renderLineChart(stock, {
  events: [
    { date: '2024-02-14', label: 'Q4 Earnings', color: '#f59e0b' },
    { date: '2024-05-20', label: '2-for-1 Split', color: '#7c3aed' },
    { date: '2024-10-01', label: 'CEO change' }  // uses theme line color
  ]
}));
```

Each entry in the `events` array is a `ChartEvent`:

| Field   | Type                       | Required | Notes |
|---------|----------------------------|----------|-------|
| `date`  | `Date \| number \| string` | yes      | any value accepted by `new Date()` |
| `label` | `string`                   | yes      | short text; keep it brief |
| `color` | `string`                   | no       | CSS color; defaults to the theme's line color |

Behaviour:
- Events are drawn as dashed lines (`4 3` dash pattern) spanning the full plot height
- Labels appear above the plot area, centred on the event x-position
- When events are present, `padding.top` is automatically increased by 20 px to prevent overlap with the chart title
- Events outside the chart's time domain are silently ignored
- Works on all renderers: `renderLineChart`, `renderAreaChart`, `renderBarChart`, `renderCandlestickChart`, `renderMultiLineChart`, and `renderNetWorthChart`

## See also

- [Multi-line comparison](multi-line.md) — multiple companies on one chart.
- [Net worth](net-worth.md) — generate and render people’s net worth data.
- [HTML page builder](html-page.md) — full dashboard with clickable cards.
- [API reference](../api-reference.md#chart-options) — every chart option in one place.
