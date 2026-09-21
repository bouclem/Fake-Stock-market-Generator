import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadSplits,
  loadSplitsSync,
  applySplits,
  loadEvents,
  loadEventsSync,
  generateStock
} from '../src/index.js';

test('loadSplitsSync: array, object, and envelope sources', () => {
  assert.equal(loadSplitsSync([{ date: '2024-06-15', split: '2:1' }])[0].ratio, 2);
  assert.equal(loadSplitsSync({ date: '2024-06-15', ratio: 3 })[0].ratio, 3);
  assert.equal(loadSplitsSync({ splits: [{ date: '2024-01-01', ratio: 2 }] })[0].ratio, 2);
  assert.equal(loadSplitsSync(null).length, 0);
});

test('loadSplitsSync: reads a JSON file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'smg-'));
  const file = join(dir, 'splits.json');
  writeFileSync(file, JSON.stringify({ splits: [{ date: '2024-06-15', split: '3:1' }] }));
  const splits = loadSplitsSync(file);
  assert.equal(splits[0].ratio, 3);
  assert.equal(splits[0].display, '3:1');
  assert.equal(splits[0].type, 'forward');
});

test('loadSplits: async variant matches sync', async () => {
  const src = [{ date: '2024-06-15', split: '2:1' }];
  assert.deepEqual(await loadSplits(src), loadSplitsSync(src));
});

test('applySplits: applies chronologically', () => {
  const s = generateStock({ seed: 'as', bars: 30, interval: '1d', startDate: '2024-01-01' });
  const splits = loadSplitsSync([
    { date: '2024-01-20', split: '2:1' },
    { date: '2024-01-10', split: '2:1' } // earlier split listed second on purpose
  ]);
  const out = applySplits(s, splits);
  assert.equal(out.splits.length, 2);
  // first bar went through two halvings
  assert.equal(out.bars[0].close, Math.round(Math.round(s.bars[0].close / 2 * 100) / 100 / 2 * 100) / 100);
});

test('loadEventsSync: array, object, envelope, and errors', () => {
  assert.deepEqual(loadEventsSync([{ date: '2024-01-01', label: 'x' }]), [{ date: '2024-01-01', label: 'x' }]);
  assert.deepEqual(loadEventsSync({ date: '2024-01-01', label: 'x' }), [{ date: '2024-01-01', label: 'x' }]);
  assert.deepEqual(loadEventsSync({ name: 'n', events: [{ date: '2024-01-01', label: 'y' }] }), [{ date: '2024-01-01', label: 'y' }]);
  assert.deepEqual(loadEventsSync(null), []);
  assert.throws(() => loadEventsSync('events.txt'), /must be a path ending in/);
});

test('loadEventsSync: reads a JSON file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'smg-'));
  const file = join(dir, 'events.json');
  writeFileSync(file, JSON.stringify([{ date: '2024-03-01', label: 'Earnings' }]));
  assert.equal(loadEventsSync(file)[0].label, 'Earnings');
});

test('loadEvents: matches sync for non-file sources', () => {
  const src = [{ date: '2024-01-01', label: 'x' }];
  assert.deepEqual(loadEvents(src), loadEventsSync(src));
});
