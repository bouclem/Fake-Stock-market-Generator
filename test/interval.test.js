import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInterval, parseIntervalSpec, stepTime } from '../src/interval.js';

test('parseInterval: fixed units', () => {
  assert.equal(parseInterval('1min'), 60_000);
  assert.equal(parseInterval('5min'), 300_000);
  assert.equal(parseInterval('1h'), 3_600_000);
  assert.equal(parseInterval('1d'), 86_400_000);
  assert.equal(parseInterval('1w'), 604_800_000);
  assert.equal(parseInterval(90_000), 90_000);
});

test('parseInterval: calendar units — m means month, not minute', () => {
  assert.equal(parseInterval('1m'), 30 * 86_400_000);
  assert.equal(parseInterval('1mo'), 30 * 86_400_000);
  assert.equal(parseInterval('1M'), 30 * 86_400_000); // case-insensitive: also month
  assert.equal(parseIntervalSpec('1m').calendar, true);
  assert.equal(parseIntervalSpec('1mo').calendar, true);
  assert.equal(parseIntervalSpec('1min').calendar, false);
  assert.equal(parseInterval('1y'), 365 * 86_400_000);
});

test('parseInterval: rejects invalid input', () => {
  assert.throws(() => parseInterval('0d'), /numeric part must be > 0/);
  assert.throws(() => parseInterval('x1h'), /Invalid interval/);
  assert.throws(() => parseInterval(-5), /Invalid interval/);
  assert.throws(() => parseInterval(''), /Invalid interval/);
});

test('stepTime: fixed intervals step by exact ms', () => {
  const spec = parseIntervalSpec('1h');
  const t0 = Date.UTC(2024, 0, 1);
  assert.equal(stepTime(t0, spec, 3), t0 + 3 * 3_600_000);
});

test('stepTime: monthly preserves day-of-month', () => {
  const spec = parseIntervalSpec('1mo');
  const t0 = Date.UTC(2024, 0, 15);
  assert.equal(new Date(stepTime(t0, spec, 1)).toISOString(), '2024-02-15T00:00:00.000Z');
  assert.equal(new Date(stepTime(t0, spec, 13)).toISOString(), '2025-02-15T00:00:00.000Z');
});

test('stepTime: month-end clamps instead of overflowing', () => {
  const spec = parseIntervalSpec('1mo');
  const jan31 = Date.UTC(2024, 0, 31);
  // Jan 31 + 1mo -> Feb 29 (leap year), not Mar 2
  assert.equal(new Date(stepTime(jan31, spec, 1)).toISOString(), '2024-02-29T00:00:00.000Z');
  // +2mo lands back on Mar 31
  assert.equal(new Date(stepTime(jan31, spec, 2)).toISOString(), '2024-03-31T00:00:00.000Z');
});

test('stepTime: yearly clamps Feb 29 to Feb 28 on non-leap years', () => {
  const spec = parseIntervalSpec('1y');
  const feb29 = Date.UTC(2024, 1, 29);
  assert.equal(new Date(stepTime(feb29, spec, 1)).toISOString(), '2025-02-28T00:00:00.000Z');
  assert.equal(new Date(stepTime(feb29, spec, 4)).toISOString(), '2028-02-29T00:00:00.000Z');
});

test('stepTime: "m" is a calendar month', () => {
  const spec = parseIntervalSpec('1m');
  const t0 = Date.UTC(2024, 0, 15);
  assert.equal(new Date(stepTime(t0, spec, 1)).toISOString(), '2024-02-15T00:00:00.000Z');
});

test('stepTime: negative index steps backwards', () => {
  const spec = parseIntervalSpec('1mo');
  const t0 = Date.UTC(2024, 5, 15);
  assert.equal(new Date(stepTime(t0, spec, -3)).toISOString(), '2024-03-15T00:00:00.000Z');
});
