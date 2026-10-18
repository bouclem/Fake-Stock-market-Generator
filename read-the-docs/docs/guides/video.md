# Video charts (VideoChart)

`renderVideoChart(stocks, options)` renders an animated financial chart to a
real H.264 **`.mp4`** file — the kind you can upload to YouTube or attach
anywhere video is accepted.

```js
import { generateMarket, renderVideoChart } from 'stock-market-gen';
import { writeFileSync } from 'node:fs';

const market = generateMarket({
  count: 5, bars: 120, seed: 'race',
  sharesOutstanding: [5e6, 12e6, 2e7, 8e6, 3e7]
});

writeFileSync('chart-race.mp4', await renderVideoChart(market, {
  title: 'MARKET CAP RACE',
  seconds: 8,
  fps: 30
}));
```

## What the video shows

- **Progressive line graph** — each company's valuation line draws itself
  left-to-right as video time advances, with a time cursor sweeping the chart
  and the current date displayed top-right.
- **Dynamic ranking** — a horizontal bar chart in the bottom-right corner
  ranks companies by current valuation. Positions and bar lengths update every
  frame, synchronized with the line graph.
- Ranking is computed **exclusively from the stocks you pass in** — nothing is
  added or invented.

## Company valuations only

VideoChart plots `bar.worth` — market cap (`close × sharesOutstanding`) —
not share price. Every stock must be generated with `sharesOutstanding`;
otherwise `renderVideoChart` throws a clear error.

```js
generateStock({ symbol: 'ACME', sharesOutstanding: 10_000_000, /* ... */ });
```

## Install the encoder

Video encoding uses the **optional peer dependency**
[`h264-mp4-encoder`](https://www.npmjs.com/package/h264-mp4-encoder) — a pure
WASM H.264 encoder with no native build step:

```bash
npm install h264-mp4-encoder
```

The rest of the package stays zero-dependency — you only need the encoder if
you render videos. Without it, `renderVideoChart` throws an error telling you
to install it.

## Options

| Option        | Type                  | Default        | Description |
| ------------- | --------------------- | -------------- | ----------- |
| `width`       | `number`              | `1280`         | frame width in px (snapped to even) |
| `height`      | `number`              | `720`          | frame height in px (snapped to even) |
| `fps`         | `number`              | `30`           | frames per second |
| `seconds`     | `number`              | `10`           | video duration |
| `theme`       | `'light' \| 'dark'`   | `'dark'`       | color theme |
| `title`       | `string`              | `'Market Cap'` | title drawn at the top |
| `colors`      | `object`              | —              | override theme colors (e.g. `{ bg: '#000' }`) |
| `maxRanked`   | `number`              | `10`           | rows in the ranking panel |
| `quality`     | `number`              | `20`           | H.264 quantizer 1–51, lower = better |
| `supersample` | `number`              | `2`            | render at N× then downsample — anti-aliased edges (1 = off, 4 = max) |
| `kbps`        | `number`              | auto           | bitrate override in kbit/s |

## Return value

`Promise<Uint8Array>` — the `.mp4` file bytes (`Buffer` in Node). Write them
to disk with `writeFileSync` or stream them to an upload endpoint.

## Notes

- Valuations are linearly interpolated between bars, so lines and ranking bars
  move smoothly between data points.
- A company's line starts at its first bar — stocks with a later `startDate`
  appear in the ranking only once their data begins.
- `supersample` has the biggest effect on visual quality; `quality`/`kbps`
  control file size.
