import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateStock,
  generateNetWorth,
  toJSON,
  fromJSON,
  renderLineChart,
  renderAreaChart,
  renderMultiLineChart,
  renderChartWithVolume,
  renderNetWorthChart
} from '../src/index.js';

// ── multi-line worth mode ────────────────────────────────────────────

test('renderMultiLineChart valueMode: worth plots market cap, not price', () => {
  const opts = { bars: 10, startDate: '2024-01-01', sharesOutstanding: 1_000_000 };
  const a = generateStock({ ...opts, seed: 'mlw-a', symbol: 'AAA' });
  const b = generateStock({ ...opts, seed: 'mlw-b', symbol: 'BBB' });

  const priceSvg = renderMultiLineChart([a, b], { mode: 'price' });
  const worthSvg = renderMultiLineChart([a, b], { mode: 'price', valueMode: 'worth' });
  assert.notEqual(priceSvg, worthSvg);
  // worth ≈ close × 1e6 → axis labels use human format like "50.0M"
  assert.match(worthSvg, />\d+(\.\d+)?[MB]</);
});

test('renderMultiLineChart worth mode works normalized and throws without sharesOutstanding', () => {
  const a = generateStock({ seed: 'mlw-c', symbol: 'CCC', bars: 10, sharesOutstanding: '1.5M' });
  // normalized + worth should not throw
  renderMultiLineChart([a], { valueMode: 'worth' });

  const noWorth = generateStock({ seed: 'mlw-d', symbol: 'DDD', bars: 10 });
  assert.throws(
    () => renderMultiLineChart([a, noWorth], { valueMode: 'worth' }),
    /sharesOutstanding/
  );
});

test('renderChartWithVolume supports valueMode: worth on line type', () => {
  const s = generateStock({ seed: 'vw', bars: 15, sharesOutstanding: 2_000_000, startDate: '2024-01-01' });
  const svg = renderChartWithVolume(s, 'line', { valueMode: 'worth' });
  assert.match(svg, />\d+(\.\d+)?[MB]</);
});

test('renderChartWithVolume rejects worth mode for OHLC types', () => {
  const s = generateStock({ seed: 'vw2', bars: 10, sharesOutstanding: 1_000_000 });
  assert.throws(
    () => renderChartWithVolume(s, 'candlestick', { valueMode: 'worth' }),
    /worth/
  );
  assert.throws(
    () => renderChartWithVolume(s, 'bar', { valueMode: 'worth' }),
    /worth/
  );
});

test('worth mode still throws on single-stock line/area without sharesOutstanding', () => {
  const s = generateStock({ seed: 'nw', bars: 10 });
  assert.throws(() => renderLineChart(s, { valueMode: 'worth' }), /sharesOutstanding/);
});

// ── multi-line area fill ─────────────────────────────────────────────

test('multi-line area uses flat translucent fills like the normal area chart', () => {
  const a = generateStock({ seed: 'mla-a', symbol: 'AAA', bars: 12 });
  const b = generateStock({ seed: 'mla-b', symbol: 'BBB', bars: 12 });
  const svg = renderMultiLineChart([a, b], { area: true });
  assert.ok(!svg.includes('linearGradient'), 'no per-series gradients');
  assert.ok(svg.includes('fill-opacity="0.18"'), 'flat translucent fills present');
});

// ── pricePrecision ───────────────────────────────────────────────────

const decimals = (n) => {
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
};

test('pricePrecision rounds every price field and is stored on the stock', () => {
  const s = generateStock({ seed: 'pp', bars: 30, pricePrecision: 2 });
  assert.equal(s.pricePrecision, 2);
  for (const b of s.bars) {
    for (const f of ['open', 'high', 'low', 'close']) {
      assert.ok(decimals(b[f]) <= 2, `${f}=${b[f]} has more than 2 decimals`);
    }
  }
});

test('pricePrecision: 0 produces integer prices', () => {
  const s = generateStock({ seed: 'pp0', bars: 20, pricePrecision: 0 });
  for (const b of s.bars) {
    assert.ok(Number.isInteger(b.close), `close=${b.close} not an integer`);
  }
});

test('pricePrecision applies to custom prices and ohlc paths too', () => {
  const s = generateStock({ prices: [1.2345, 2.3456, 3.4567], pricePrecision: 1, startDate: '2024-01-02' });
  for (const b of s.bars) assert.ok(decimals(b.close) <= 1);

  const o = generateStock({
    ohlc: [
      { open: 10.555, high: 11.111, low: 9.999, close: 10.789 },
      { open: 10.789, high: 12.345, low: 10.111, close: 11.999 }
    ],
    pricePrecision: 2
  });
  assert.equal(o.bars[0].close, 10.79);
  assert.equal(o.bars[1].high, 12.35);
});

test('omitted pricePrecision stays automatic and reports null', () => {
  const s = generateStock({ seed: 'ppauto', bars: 5 });
  assert.equal(s.pricePrecision, null);
});

test('pricePrecision validation rejects bad values', () => {
  for (const bad of [-1, 9, 1.5, 'x', NaN]) {
    assert.throws(() => generateStock({ pricePrecision: bad }), /pricePrecision/);
  }
});

test('pricePrecision survives a JSON round-trip and drives axis labels', () => {
  const s = generateStock({ seed: 'ppj', bars: 15, pricePrecision: 2 });
  const back = fromJSON(toJSON(s));
  assert.equal(back.pricePrecision, 2);

  const svg = renderLineChart(s);
  assert.match(svg, />\d+\.\d{2}</, 'expected 2-decimal axis labels');
});

test('chart-level pricePrecision overrides axis decimals', () => {
  const s = generateStock({ seed: 'ppo', bars: 15 });
  const svg = renderLineChart(s, { pricePrecision: 0 });
  assert.ok(!/>\d+\.\d+</.test(svg), 'expected integer-only axis labels');
});

// ── endDate ──────────────────────────────────────────────────────────

test('crypto endDate lands the last bar exactly on the timestamp', () => {
  const end = '2024-03-05T12:00:00Z';
  const c = generateStock({ kind: 'crypto', seed: 'ed', bars: 10, interval: '1h', endDate: end });
  assert.equal(c.bars[9].time, Date.parse(end));
  for (let i = 1; i < 10; i++) {
    assert.ok(c.bars[i].time > c.bars[i - 1].time);
  }
});

test('stock endDate snaps back to a tradable day (Sunday → Friday)', () => {
  const s = generateStock({ seed: 'ed2', bars: 5, interval: '1d', endDate: '2024-01-07' }); // Sunday
  const last = s.bars[s.bars.length - 1];
  assert.equal(new Date(last.time).getUTCDay(), 5); // Friday
  assert.ok(last.time <= Date.parse('2024-01-07'));
  for (let i = 1; i < s.bars.length; i++) {
    assert.ok(s.bars[i].time > s.bars[i - 1].time, 'strictly increasing');
  }
});

test('stock endDate on a trading day lands on it exactly (daily grid)', () => {
  const s = generateStock({ seed: 'ed3', bars: 5, interval: '1d', endDate: '2024-01-05' }); // Friday
  const last = s.bars[s.bars.length - 1];
  assert.equal(last.time, Date.parse('2024-01-05'));
});

test('stock endDate anchors weekly bars to Monday', () => {
  const s = generateStock({ seed: 'ed4', bars: 4, interval: '1w', endDate: '2024-01-10' }); // Wednesday
  const last = s.bars[s.bars.length - 1];
  assert.equal(new Date(last.time).getUTCDay(), 1); // Monday
  assert.ok(last.time <= Date.parse('2024-01-10'));
});

test('intraday stock endDate lands on a session grid slot', () => {
  const s = generateStock({ seed: 'ed5', bars: 12, interval: '1h', endDate: '2024-01-03T14:00:00Z' });
  const last = s.bars[s.bars.length - 1];
  // 1h grid inside regular session = …, 11:30, 12:30, 13:30, 14:30 → last ≤ 14:00 is 13:30
  assert.equal(last.time, Date.parse('2024-01-03T13:30:00Z'));
});

test('startDate and endDate together throw', () => {
  assert.throws(
    () => generateStock({ startDate: '2024-01-01', endDate: '2024-02-01' }),
    /either "startDate" or "endDate"/
  );
  assert.throws(
    () => generateNetWorth({ startDate: '2024-01-01', endDate: '2024-02-01' }),
    /either "startDate" or "endDate"/
  );
});

test('invalid endDate throws', () => {
  assert.throws(() => generateStock({ endDate: 'not a date' }), /endDate/);
});

test('net worth endDate lands exactly on uniform grids', () => {
  const nw = generateNetWorth({ seed: 'ednw', bars: 5, interval: '1d', endDate: '2024-03-10' });
  assert.equal(nw.bars[4].time, Date.parse('2024-03-10T00:00:00Z'));
});

// ── trend-colored segments ───────────────────────────────────────────

test('trend: true draws each segment green when rising, red when falling', () => {
  // Deterministic direction changes: up, down, up
  const s = generateStock({ prices: [10, 12, 11, 13], startDate: '2024-01-02' });
  const svg = renderLineChart(s, { trend: true });
  assert.ok(svg.includes('stroke="#16a34a"'), 'expected green (up) segment');
  assert.ok(svg.includes('stroke="#dc2626"'), 'expected red (down) segment');
});

test('trend: true works in worth mode too', () => {
  const s = generateStock({
    prices: [10, 12, 11],
    sharesOutstanding: 1_000_000,
    startDate: '2024-01-02'
  });
  const svg = renderLineChart(s, { trend: true, valueMode: 'worth' });
  assert.ok(svg.includes('stroke="#16a34a"'));
  assert.ok(svg.includes('stroke="#dc2626"'));
});

test('trend: true keeps extended-hours bars grey', () => {
  const s = generateStock({
    seed: 'tx', bars: 30, interval: '1h',
    startDate: '2024-01-02T04:00:00Z', extendedHours: true
  });
  const svg = renderLineChart(s, { trend: true });
  // grey dotted connector + grey dots survive alongside the trend lines
  assert.ok(svg.includes('stroke-dasharray="1 5"'));
  assert.ok(svg.includes('<circle'));
});

test('without trend, a single polyline is still emitted', () => {
  const s = generateStock({ seed: 'nt', bars: 15 });
  const svg = renderLineChart(s);
  assert.ok(svg.includes('<polyline'));
});


// ── 2.0.3: trend-colored area fill + areaColor ──────────────────────

test('trend: true colors the area fill per direction on renderAreaChart', () => {
  const s = generateStock({ prices: [10, 12, 11, 13], startDate: '2024-01-02' });
  const svg = renderAreaChart(s, { trend: true });
  assert.ok(svg.includes('fill="#16a34a"'), 'expected green fill segment');
  assert.ok(svg.includes('fill="#dc2626"'), 'expected red fill segment');
  assert.ok(svg.includes('fill-opacity="0.18"'));
});

test('trend area fill works on renderNetWorthChart', () => {
  const nw = generateNetWorth({ values: [100, 120, 90], startDate: '2024-01-01', interval: '1d' });
  const svg = renderNetWorthChart(nw, { trend: true });
  assert.ok(svg.includes('fill="#16a34a"'));
  assert.ok(svg.includes('fill="#dc2626"'));
});

test('trend area fill works on renderChartWithVolume area type', () => {
  const s = generateStock({ prices: [10, 12, 11], startDate: '2024-01-02' });
  const svg = renderChartWithVolume(s, 'area', { trend: true });
  assert.ok(svg.includes('fill="#16a34a"'));
  assert.ok(svg.includes('fill="#dc2626"'));
});

test('flat segments fall back to the neutral color', () => {
  const s = generateStock({ prices: [10, 12, 12, 11], startDate: '2024-01-02' });
  const svg = renderAreaChart(s, { trend: true });
  // 12→12 is flat: fill uses the neutral line color
  assert.ok(svg.includes('fill="#2563eb"'));
});

test('area without trend keeps the single flat fill', () => {
  const s = generateStock({ prices: [10, 12, 11], startDate: '2024-01-02' });
  const svg = renderAreaChart(s);
  assert.ok(!svg.includes('fill="#16a34a"'));
  assert.ok(!svg.includes('fill-opacity="0.18"'));
});

test('areaColor fills the whole area with the given color', () => {
  const s = generateStock({ prices: [10, 12, 11], startDate: '2024-01-02' });
  const svg = renderAreaChart(s, { areaColor: '#aabbcc' });
  assert.ok(svg.includes('fill="#aabbcc"'));
});

test('areaColor wins over trend: fill stays flat, line still trends', () => {
  const s = generateStock({ prices: [10, 12, 11, 13], startDate: '2024-01-02' });
  const svg = renderAreaChart(s, { areaColor: '#aabbcc', trend: true });
  assert.ok(svg.includes('fill="#aabbcc"'), 'custom flat fill');
  assert.ok(!svg.includes('fill="#16a34a"'), 'no trend fill');
  assert.ok(svg.includes('stroke="#16a34a"'), 'line segment still green');
  assert.ok(svg.includes('stroke="#dc2626"'), 'line segment still red');
});
