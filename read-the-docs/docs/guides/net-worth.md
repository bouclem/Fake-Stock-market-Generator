# Net worth

`generateNetWorth` creates a synthetic net worth time series for a person or entity. It uses the same Geometric Brownian Motion engine as stock prices but defaults to wealth-accumulation parameters — positive drift, lower volatility, and a monthly interval.

## Basic usage

```js
import { generateNetWorth, renderNetWorthChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const nw = generateNetWorth({
  name: 'Alice',
  startValue: 80000,
  bars: 120,
  interval: '1mo',
  startDate: '2015-01-01',
  seed: 'alice'
});

writeFileSync('alice.svg', renderNetWorthChart(nw));
```

`renderNetWorthChart` renders a line+area SVG, the same style as `renderAreaChart` for stocks.

## Options

| Option        | Type                       | Default               | Notes |
|---------------|----------------------------|-----------------------|-------|
| `name`        | `string`                   | none                  | label shown in the chart title |
| `startValue`  | `number`                   | random 10k–5M (log)   | starting net worth |
| `drift`       | `number`                   | random +2–15%/yr      | annualised expected growth |
| `volatility`  | `number`                   | random 5–25%/yr       | annualised standard deviation |
| `bars`        | `number`                   | `100`                 | number of data points |
| `interval`    | `number \| string`         | `"1mo"`               | step size; any interval string or ms |
| `startDate`   | `Date \| number \| string` | `now - bars*interval` | first bar timestamp |
| `seed`        | `number \| string`         | random                | reproducible output |
| `values`      | `number[]`                 | none                  | supply your own net worth values |

## The returned object

```ts
{
  name: string | null;
  startValue: number;
  interval: number;     // ms
  bars: Array<{
    time: number;       // unix epoch in ms
    date: string;       // ISO 8601
    value: number;
  }>;
  _type: 'networth';
}
```

## Themes

Works the same as stock charts:

```js
renderNetWorthChart(nw, { theme: 'dark' });
```

## Event markers

Add annotations for life events or financial milestones:

```js
renderNetWorthChart(nw, {
  theme: 'dark',
  events: [
    { date: '2016-06-01', label: 'Promotion',      color: '#22c55e' },
    { date: '2018-03-15', label: 'Home purchase',  color: '#ef4444' },
    { date: '2020-03-23', label: 'COVID low',       color: '#f59e0b' },
    { date: '2022-01-01', label: 'Inheritance',     color: '#22c55e' }
  ]
});
```

Each event draws a full-height dashed vertical line and a short label at the top of the chart. The top padding is automatically extended by 20 px when events are present.

## Custom values

Supply your own net worth data points:

```js
const myValues = [50000, 52000, 51500, 54000, 58000, 63000];

const nw = generateNetWorth({
  name: 'Bob',
  startDate: '2024-01-01',
  interval: '1mo',
  values: myValues
});
```

`bars` is ignored when `values` is set — bar count comes from the array length.

## Saving and loading

`toJSON` and `fromJSON` work with net worth objects:

```js
import { generateNetWorth, toJSON, fromJSON, renderNetWorthChart } from 'stock-market-gen';
import { writeFileSync, readFileSync } from 'node:fs';

const nw = generateNetWorth({ name: 'Carol', bars: 240, seed: 'carol' });

// Save
writeFileSync('carol.json', toJSON(nw));

// Reload
const restored = fromJSON(readFileSync('carol.json', 'utf8'));
writeFileSync('carol.svg', renderNetWorthChart(restored, { theme: 'light' }));
```

`fromJSON` detects net worth objects via the `_type: 'networth'` field and returns a `NetWorth` instead of a `Stock`.

## Comparing multiple people

Use `renderMultiLineChart` by adapting net worth bars to the stock format, or render each person separately and composite the SVGs in your own layout.

## See also

- [Charts guide](charts.md) — chart types, themes, sizing, event markers.
- [API reference](../api-reference.md) — all options in one place.
