# Intervals

The `interval` option controls the time gap between bars. Two flavours:

- **Fixed** — every step is the same number of milliseconds.
- **Calendar-aware** — months and years respect the calendar (real lengths, day-of-month preserved).

## Shorthand strings

| String       | Meaning            | Calendar-aware? |
|--------------|--------------------|-----------------|
| `"1m"`       | 1 minute           | no              |
| `"5m"`       | 5 minutes          | no              |
| `"1h"`       | 1 hour             | no              |
| `"1d"`       | 1 day              | no              |
| `"1w"`       | 1 week             | no              |
| `"1mo"`      | 1 calendar month   | **yes**         |
| `"3mo"`      | 3 calendar months  | **yes**         |
| `"1y"`       | 1 calendar year    | **yes**         |

The number can be any positive integer: `"15m"`, `"2h"`, `"6mo"`, `"5y"`, etc. Zero (`"0d"`) is rejected.

```js
generateStock({ bars: 100, interval: '15m', startDate: '2024-01-01T09:30:00Z' });
generateStock({ bars: 30,  interval: '1mo', startDate: '1999-08-01' });
generateStock({ bars: 25,  interval: '1y',  startDate: '2000-01-01' });
```

## Raw milliseconds

Pass any positive number to use that many ms per bar:

```js
const ms2h = 2 * 60 * 60 * 1000;
generateStock({ bars: 100, interval: ms2h });
```

This is fixed (no calendar awareness), useful for unusual intervals like 4 hours or 30 minutes.

## Calendar awareness

`"1mo"` and `"1y"` are calendar-aware. They step to the same day of the next month or year:

```js
generateStock({ bars: 6, interval: '1mo', startDate: '1999-08-01' });
// Bar timestamps: 1999-08-01, 1999-09-01, 1999-10-01, 1999-11-01, 1999-12-01, 2000-01-01
```

```js
generateStock({ bars: 5, interval: '1y', startDate: '1999-08-01' });
// Bar timestamps: 1999-08-01, 2000-08-01, 2001-08-01, 2002-08-01, 2003-08-01
```

Leap years are handled. `January 31 + 1mo` rolls over the way JavaScript's `Date.setUTCMonth` does (lands in early March).

!!! info "Why this matters"
    Without calendar awareness, "1 month" would mean 30 days, so a chart anchored to "1st of the month" would slowly drift over time. Calendar-aware stepping keeps the day-of-month aligned for the life of the chart.

## Where the interval shows up

The generated `Stock` carries an `interval` field expressed in milliseconds:

```js
const stock = generateStock({ interval: '1mo', bars: 12 });
stock.interval; // 2592000000  (30-day approximation)
```

For calendar-aware units this is an **approximate** number — useful for downstream consumers that just need a single representative duration. The actual bar timestamps are computed exactly via the calendar logic, not by repeatedly adding `interval`.

## Mixed intervals across a market

Each stock in a market can have its own interval. This is how you'd build, say, an FX dashboard mixing daily and intraday symbols:

```js
generateMarket({
  seed: 'mixed',
  stocks: [
    { symbol: 'EURUSD', interval: '1h', bars: 720 },  // 30 days of hourly
    { symbol: 'SPX',    interval: '1d', bars: 365 }   // 1 year of daily
  ]
});
```

When you put both on a [multi-line chart](multi-line.md), the union of their timelines becomes the X axis automatically.

## Helpers

If you want to step time the same way the generator does, the helpers are exported:

```js
import { parseInterval, parseIntervalSpec } from 'stock-market-gen';

parseInterval('1d');       // 86400000
parseInterval('1mo');      // 2592000000  (approximate)

parseIntervalSpec('1mo');
// { unit: 'mo', n: 1, calendar: true, ms: 2592000000 }
```

`parseIntervalSpec` is the structured version — useful if you need to know whether the interval is calendar-aware before stepping.
