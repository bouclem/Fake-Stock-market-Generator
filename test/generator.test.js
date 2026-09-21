import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateStock,
  generateMarket,
  generateNetWorth,
  toJSON,
  fromJSON,
  applySplit,
  parseSplitRatio
} from '../src/index.js';

test('generateStock: seeded output is reproducible', () => {
  const a = generateStock({ seed: 's', bars: 30, startDate: '2024-01-01' });
  const b = generateStock({ seed: 's', bars: 30, startDate: '2024-01-01' });
  assert.deepEqual(a, b);
});

test('generateStock: bars are well-formed', () => {
  const s = generateStock({ seed: 1, bars: 50 });
  assert.equal(s.bars.length, 50);
  for (const b of s.bars) {
    assert.ok(b.high >= b.low, 'high >= low');
    assert.ok(b.low > 0, 'positive low');
    assert.ok(b.open > 0 && b.close > 0, 'positive prices');
    assert.ok(Number.isFinite(b.time) && typeof b.date === 'string');
    assert.ok(b.volume >= 1);
  }
});

test('generateStock: prices mode synthesises OHLC around closes', () => {
  const s = generateStock({ prices: [10, 12, 11], seed: 1 });
  assert.equal(s.bars.length, 3);
  assert.deepEqual(s.bars.map(b => b.close), [10, 12, 11]);
  for (const b of s.bars) {
    assert.ok(b.high >= Math.max(b.open, b.close));
    assert.ok(b.low <= Math.min(b.open, b.close));
  }
});

test('generateStock: ohlc mode preserves caller bars', () => {
  const bars = [
    { open: 1, high: 2, low: 1, close: 2 },
    { open: 2, high: 3, low: 2, close: 3 }
  ];
  const s = generateStock({ ohlc: bars, seed: 1 });
  assert.equal(s.bars.length, 2);
  assert.equal(s.bars[0].close, 2);
  assert.ok(Number.isFinite(s.bars[0].volume));
});

test('generateStock: rejects bad options', () => {
  assert.throws(() => generateStock({ bars: 0 }), /"bars" must be a positive integer/);
  assert.throws(() => generateStock({ startPrice: -1 }), /"startPrice"/);
  assert.throws(() => generateStock({ prices: [1, -2] }), /prices\[1\]/);
  assert.throws(() => generateStock({ prices: [1], ohlc: [{ open: 1, high: 1, low: 1, close: 1 }] }), /not both/);
  assert.throws(() => generateStock({ kind: 'forex' }), /"kind"/);
});

test('generateStock: sharesOutstanding accepts "1.5M" and computes worth', () => {
  const s = generateStock({ seed: 2, bars: 5, sharesOutstanding: '1.5M' });
  assert.equal(s.sharesOutstanding, 1_500_000);
  for (const b of s.bars) {
    assert.equal(b.worth, Math.round(b.close * 1_500_000 * 100) / 100);
  }
});

test('generateStock: rejects invalid sharesOutstanding', () => {
  assert.throws(() => generateStock({ sharesOutstanding: 'abc' }), /sharesOutstanding/);
  assert.throws(() => generateStock({ sharesOutstanding: -5 }), /sharesOutstanding/);
});

test('generateMarket: unique symbols and seeded reproducibility', () => {
  const a = generateMarket({ count: 8, seed: 'mkt', startDate: '2024-01-01' });
  const b = generateMarket({ count: 8, seed: 'mkt', startDate: '2024-01-01' });
  assert.deepEqual(a, b);
  const symbols = new Set(a.map(s => s.symbol));
  assert.equal(symbols.size, 8);
});

test('generateNetWorth: values accept suffixed strings', () => {
  const nw = generateNetWorth({ values: ['1M', '1.5M', 2_000_000], seed: 1 });
  assert.deepEqual(nw.bars.map(b => b.value), [1_000_000, 1_500_000, 2_000_000]);
  assert.equal(nw._type, 'networth');
});

test('toJSON/fromJSON: round-trips a stock including splits', () => {
  const s = generateStock({ seed: 'rt', bars: 20, sharesOutstanding: 1e6 });
  const split = applySplit(s, s.bars[10].date, '2:1');
  const restored = fromJSON(toJSON(split));
  assert.equal(restored.symbol, s.symbol);
  assert.deepEqual(restored.bars.map(b => b.close), split.bars.map(b => b.close));
  assert.deepEqual(restored.splits, split.splits);
  assert.equal(restored.bars[0].worth, restored.bars[0].close * 1e6);
});

test('applySplit: adjusts history and copies bars (no shared refs)', () => {
  const s = generateStock({ seed: 'sp', bars: 20 });
  const split = applySplit(s, s.bars[10].date, '2:1');
  // Pre-split prices halve, volume doubles
  assert.equal(split.bars[0].close, Math.round(s.bars[0].close / 2 * 100) / 100);
  assert.equal(split.bars[0].volume, s.bars[0].volume * 2);
  // Post-split bars unchanged
  assert.equal(split.bars[15].close, s.bars[15].close);
  // Mutating the result must not touch the input
  split.bars[15].close = 999;
  assert.notEqual(s.bars[15].close, 999);
  assert.equal(split.splits[0].ratio, 2);
  assert.equal(split.splits[0].display, '2:1');
});

test('applySplit: fractional ratios display exactly', () => {
  const s = generateStock({ seed: 'sp2', bars: 20 });
  const split = applySplit(s, s.bars[10].date, 1.5);
  assert.equal(split.splits[0].display, '1.5:1');
});

test('parseSplitRatio: formats and errors', () => {
  assert.equal(parseSplitRatio('3:1'), 3);
  assert.equal(parseSplitRatio('1:2'), 0.5);
  assert.equal(parseSplitRatio(2), 2);
  assert.equal(parseSplitRatio(null), null);
  assert.throws(() => parseSplitRatio('0:1'), /invalid split numbers/);
  assert.throws(() => parseSplitRatio('abc'), /invalid ratio/);
});
