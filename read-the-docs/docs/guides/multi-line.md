# Multi-line comparison

`renderMultiLineChart(stocks, options)` plots several companies on the same axes with a built-in legend. It's the right tool for portfolio comparisons, sector dashboards, or any side-by-side view.

## Basics

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
  title: 'My Portfolio — 2024'
}));
```

The legend sits in the top-left of the plot area; the title (if any) is anchored top-right so they never overlap.

## Two display modes

### `mode: 'normalized'` (default)

Each series is rebased to 100 at its first bar. This is what you want when you're comparing **performance**, regardless of price level.

```js
renderMultiLineChart(market, { mode: 'normalized' });
```

A $5 stock and a $5,000 stock end up on the same scale, so the chart shows whose performance you'd be happier with.

### `mode: 'price'`

Raw closing prices on a shared Y axis. Use this when the scales are similar, or when seeing the actual values matters.

```js
renderMultiLineChart(market, { mode: 'price' });
```

## Different start dates

Each stock can have its own `startDate`. The chart spans the union of all timelines, so a stock that starts later just doesn't show until its first bar:

```js
import { generateStock, renderMultiLineChart } from 'stock-market-gen';

const a = generateStock({ symbol: 'OLD', startDate: '2020-01-01', bars: 365, seed: 'old' });
const b = generateStock({ symbol: 'MID', startDate: '2021-01-01', bars: 365, seed: 'mid' });
const c = generateStock({ symbol: 'NEW', startDate: '2022-01-01', bars: 365, seed: 'new' });

writeFileSync('multi.svg', renderMultiLineChart([a, b, c], {
  title: 'Three tickers, three start dates',
  theme: 'dark'
}));
```

`OLD` lines up on the left, `NEW` on the right, both on the same time axis.

## Per-line start prices

Combine custom `startPrice` with `mode: 'price'` to keep each line at its own absolute level:

```js
const low  = generateStock({ symbol: 'LOW',  startPrice: 1.0, bars: 120, seed: 'low' });
const mid  = generateStock({ symbol: 'MID',  startPrice: 1.8, bars: 120, seed: 'mid' });
const tiny = generateStock({ symbol: 'TINY', startPrice: 0.7, bars: 120, seed: 'tiny' });

writeFileSync('starts.svg', renderMultiLineChart([low, mid, tiny], {
  mode: 'price',
  title: 'Each line starts at its own price'
}));
```

## Area fills

Add translucent gradient fills under each line with `area: true`:

```js
renderMultiLineChart(market, {
  area: true,
  mode: 'price',
  theme: 'dark'
});
```

!!! info "How layering works"
    The fill under each line is split into per-segment trapezoids. At every X position, trapezoids are sorted by their **local** height — biggest at that segment painted first, smallest on top. So a series that's tall in one region but small in another only sits *under* its neighbours where it actually is taller. Layering can flip across the chart, which means a small spike won't get hidden by a big one elsewhere.

## Per-stock colors

Each stock can carry its own `color` (any CSS-valid color). Otherwise a built-in 8-color palette is used in order.

```js
const stocks = [
  { symbol: 'GREEN', color: '#16a34a' },
  { symbol: 'BLUE',  color: '#2563eb' },
  { symbol: 'AMBER' } // gets the next palette color
];
```

## Hide the legend

```js
renderMultiLineChart(market, { legend: false });
```

The legend takes up real estate and sometimes you don't need it (e.g. when you're labelling lines yourself in surrounding HTML).

## All options at a glance

In addition to all the standard [chart options](../api-reference.md#chart-options) (theme, width/height, padding, ticks, etc.):

| Option   | Type                          | Default        | Notes |
|----------|-------------------------------|----------------|-------|
| `mode`   | `'normalized' \| 'price'`     | `'normalized'` | rebase to 100 at start, or keep raw values |
| `area`   | `boolean`                     | `false`        | translucent gradient fills under each line |
| `legend` | `boolean`                     | `true`         | symbol legend in top-left of plot area |

## See also

- [Charts](charts.md) — the four single-stock chart types.
- [Recipes](../recipes.md) — quick patterns for sector dashboards, ratio charts, etc.
