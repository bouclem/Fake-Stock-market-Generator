import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateStock,
  generateMarket,
  toJSON,
  fromJSON,
  renderLineChart,
  renderAreaChart,
  renderCandlestickChart,
  renderChartWithVolume,
  renderMultiLineChart
} from '../src/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const utcDay = (t) => new Date(t).getUTCDay();
const todMin = (t) => new Date(t).getUTCHours() * 60 + new Date(t).getUTCMinutes();
const isWeekend = (t) => utcDay(t) === 0 || utcDay(t) === 6;

// 2024-01-01 is a Monday, 2024-01-05 a Friday, 2024-01-06 a Saturday.

test('daily stock bars skip weekends by default', () => {
  const s = generateStock({ seed: 'wk', bars: 60, interval: '1d', startDate: '2024-01-01' });
  assert.equal(s.bars.length, 60);
  for (const b of s.bars) {
    assert.ok(!isWeekend(b.time), `bar on a weekend: ${b.date}`);
  }
  for (let i = 1; i < s.bars.length; i++) {
    assert.ok(s.bars[i].time > s.bars[i - 1].time, 'timestamps strictly increasing');
  }
});

test('weekends: true keeps Saturday/Sunday bars', () => {
  const s = generateStock({ seed: 'wk', bars: 21, interval: '1d', startDate: '2024-01-01', weekends: true });
  const days = new Set(s.bars.map((b) => utcDay(b.time)));
  assert.ok(days.has(0) && days.has(6), 'expected weekend bars to be present');
});

test('a startDate on a weekend snaps to the next trading day', () => {
  const s = generateStock({ seed: 'snap', bars: 10, interval: '1d', startDate: '2024-01-06' }); // Saturday
  assert.equal(utcDay(s.bars[0].time), 1); // Monday
});

test('intraday bars stay inside the regular session by default', () => {
  const s = generateStock({ seed: 'sess', bars: 200, interval: '1h', startDate: '2024-01-01T00:00:00Z' });
  assert.equal(todMin(s.bars[0].time), 570); // snapped to 09:30
  for (const b of s.bars) {
    const m = todMin(b.time);
    assert.ok(m >= 570 && m < 960, `outside regular session: ${b.date}`);
    assert.ok(!isWeekend(b.time), `weekend bar: ${b.date}`);
    assert.ok(b.session === undefined, 'no session tag without extendedHours');
  }
});

test('extendedHours: true adds pre/regular/post sessions on a UTC clock', () => {
  const s = generateStock({
    seed: 'sess',
    bars: 400,
    interval: '1h',
    startDate: '2024-01-01T00:00:00Z',
    extendedHours: true
  });
  const sessions = new Set(s.bars.map((b) => b.session));
  assert.ok(sessions.has('pre'), 'has pre-market bars');
  assert.ok(sessions.has('regular'), 'has regular bars');
  assert.ok(sessions.has('post'), 'has after-hours bars');
  for (const b of s.bars) {
    const m = todMin(b.time);
    assert.ok(m >= 240 && m < 1200, `outside extended window: ${b.date}`);
    const want = m < 570 ? 'pre' : m < 960 ? 'regular' : 'post';
    assert.equal(b.session, want, `${b.date} tagged ${want}`);
  }
});

test('crypto ignores the market schedule entirely', () => {
  const s = generateStock({
    kind: 'crypto',
    seed: 'c',
    bars: 72,
    interval: '1h',
    startDate: '2024-01-06T00:00:00Z' // Saturday
  });
  assert.equal(utcDay(s.bars[0].time), 6, 'crypto bars start on the given Saturday');
  const days = new Set(s.bars.map((b) => utcDay(b.time)));
  assert.ok(days.has(0) && days.has(6), 'crypto trades through the weekend');
  assert.ok(s.bars.every((b) => b.session === undefined), 'no session tags on crypto');
});

test('weekly stock bars are anchored to Mondays', () => {
  const s = generateStock({ seed: 'mon', bars: 12, interval: '1w', startDate: '2024-01-03' }); // Wednesday
  for (const b of s.bars) {
    assert.equal(utcDay(b.time), 1, `weekly bar not on Monday: ${b.date}`);
  }
});

test('intraday bars land on the session-anchored grid', () => {
  const s = generateStock({ seed: 'grid', bars: 40, interval: '1h', startDate: '2024-01-01T09:47:00Z' });
  assert.equal(todMin(s.bars[0].time), 630, '09:47 start snaps to the next grid point 10:30');
  for (const b of s.bars) {
    const m = todMin(b.time);
    assert.ok(m >= 570 && m < 960);
    assert.equal(m % 60, 30, `off the :30 grid: ${b.date}`); // anchored at 09:30 open
  }
});

test('extended-hours grid re-anchors at each session open', () => {
  const s = generateStock({ seed: 'grid2', bars: 60, interval: '1h', startDate: '2024-01-01T00:00:00Z', extendedHours: true });
  const tods = new Set(s.bars.map((b) => todMin(b.time)));
  assert.ok(tods.has(240), 'has a 04:00 pre-market bar');
  assert.ok(tods.has(570), 'has the 09:30 regular-open bar');
  assert.ok(tods.has(960), 'has the 16:00 after-hours-open bar');
});

test('crypto weekly bars keep the start weekday', () => {
  const s = generateStock({ kind: 'crypto', seed: 'cw', bars: 8, interval: '1w', startDate: '2024-01-03' }); // Wednesday
  for (const b of s.bars) {
    assert.equal(utcDay(b.time), 3, 'crypto weekly should not anchor to Monday');
  }
});

test('prices mode timestamps follow the trading schedule', () => {
  const s = generateStock({ prices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], interval: '1d', startDate: '2024-01-05' }); // Friday
  for (const b of s.bars) {
    assert.ok(!isWeekend(b.time), `prices bar on weekend: ${b.date}`);
  }
});

test('generateMarket passes schedule options through', () => {
  const m = generateMarket({ count: 3, bars: 30, interval: '1d', startDate: '2024-01-01', extendedHours: false, seed: 'm' });
  for (const s of m) {
    for (const b of s.bars) assert.ok(!isWeekend(b.time));
  }
});

test('session survives a toJSON/fromJSON round-trip', () => {
  const s = generateStock({ seed: 'rt', bars: 50, interval: '1h', startDate: '2024-01-01T00:00:00Z', extendedHours: true });
  const r = fromJSON(toJSON(s));
  assert.deepEqual(r.bars.map((b) => b.session), s.bars.map((b) => b.session));
});

test('validation rejects non-boolean schedule flags', () => {
  assert.throws(() => generateStock({ weekends: 'yes' }), /"weekends"/);
  assert.throws(() => generateStock({ extendedHours: 1 }), /"extendedHours"/);
});

test('line/area charts draw grey dots for extended-hours bars only', () => {
  const ext = generateStock({ seed: 'ext', bars: 100, interval: '1h', startDate: '2024-01-01T00:00:00Z', extendedHours: true });
  const svg = renderLineChart(ext);
  assert.match(svg, /<circle /, 'extended-hours dots');
  assert.match(svg, /stroke-dasharray="1 5"/, 'dotted grey connector');
  const area = renderAreaChart(ext);
  assert.match(area, /<circle /);

  const plain = renderLineChart(generateStock({ seed: 'ext', bars: 100 }));
  assert.ok(!plain.includes('<circle'), 'regular session has no dots');
  assert.ok(!plain.includes('stroke-dasharray="1 5"'));
});

test('candlestick and volume charts grey extended-hours bars', () => {
  const ext = generateStock({ seed: 'ext2', bars: 100, interval: '1h', startDate: '2024-01-01T00:00:00Z', extendedHours: true });
  assert.ok(renderCandlestickChart(ext).includes('#9ca3af'), 'grey candles in light theme');
  assert.ok(renderChartWithVolume(ext).includes('#9ca3af'), 'grey volume bars / line');
  const multi = renderMultiLineChart([ext]);
  assert.match(multi, /<circle /);
});

test('no NaN or undefined leaks in extended-hours charts', () => {
  const ext = generateStock({ seed: 'clean', bars: 120, interval: '1h', startDate: '2024-01-01T00:00:00Z', extendedHours: true, weekends: true });
  for (const svg of [renderLineChart(ext), renderAreaChart(ext), renderCandlestickChart(ext), renderChartWithVolume(ext)]) {
    assert.ok(!svg.includes('NaN'), 'no NaN coordinates');
    assert.ok(!svg.includes('undefined'), 'no undefined leaks');
  }
});
