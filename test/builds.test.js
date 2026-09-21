import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Rebuild dist/ once so these tests always check the current src/.
before(() => {
  execFileSync(process.execPath, [join(root, 'scripts', 'build-cjs.js')], { cwd: root });
  execFileSync(process.execPath, [join(root, 'scripts', 'build-browser.js')], { cwd: root });
});

test('CJS bundle loads via require() and generates data', () => {
  const require = createRequire(import.meta.url);
  const lib = require(join(root, 'dist', 'index.cjs'));
  const s = lib.generateStock({ seed: 'cjs', bars: 10 });
  assert.equal(s.bars.length, 10);
  // loadEventsSync path resolves in CJS too (fs guarded)
  assert.deepEqual(lib.loadEventsSync([{ date: '2024-01-01', label: 'x' }]).length, 1);
});

test('browser bundle loads as ESM and exposes the full API', async () => {
  const lib = await import('../dist/browser.js');
  for (const name of [
    'generateStock', 'generateMarket', 'generateNetWorth', 'toJSON', 'fromJSON',
    'applySplit', 'parseSplitRatio', 'loadSplits', 'loadSplitsSync', 'applySplits',
    'loadEvents', 'loadEventsSync', 'parseNumeric', 'formatNumeric',
    'formatHumanNumber', 'cleanNumericArray', 'cleanJson', 'parseJson',
    'renderChart', 'renderLineChart', 'renderAreaChart', 'renderBarChart',
    'renderCandlestickChart', 'renderMultiLineChart', 'renderNetWorthChart',
    'renderMixedChart', 'renderChartWithVolume', 'renderHtmlPage',
    'createRng', 'parseInterval'
  ]) {
    assert.equal(typeof lib[name], 'function', `missing export: ${name}`);
  }
  const s = lib.generateStock({ seed: 'br', bars: 5 });
  assert.equal(s.bars.length, 5);
});
