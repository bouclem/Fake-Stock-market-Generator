import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateStock,
  renderLineChart,
  renderHtmlPage
} from '../src/index.js';

// Y-axis labels are the `text-anchor="end"` labels just left of the plot area
// (x = padding.left - 8 = 56 with default padding).
const yLabels = (svg) =>
  [...svg.matchAll(/x="56"[^>]*>([^<]+)</g)].map((m) => m[1]);

const worthStock = () =>
  generateStock({ seed: 'v211-w', bars: 40, sharesOutstanding: 10_000_000, startPrice: 120_000 });

// ── pricePrecision on worth mode ────────────────────────────────────

test('worth mode: pricePrecision sets the decimals on the K/M/B/T label', () => {
  const labels = yLabels(renderLineChart(worthStock(), { valueMode: 'worth', pricePrecision: 3 }));
  assert.ok(
    labels.some((t) => /\d+\.\d{3}[KMBT]/.test(t)),
    `expected a 3-decimal suffix label, got ${labels}`
  );
  assert.ok(
    !labels.some((t) => /\d{5,}/.test(t)),
    `raw un-suffixed numbers leaked onto the axis: ${labels}`
  );
});

test('worth mode: default precision is 2', () => {
  const labels = yLabels(renderLineChart(worthStock(), { valueMode: 'worth' }));
  assert.ok(
    labels.some((t) => /\d+\.\d{2}[KMBT]/.test(t)),
    `expected a 2-decimal suffix label, got ${labels}`
  );
});

test('stock.pricePrecision drives worth labels too', () => {
  const s = generateStock({
    seed: 'v211-sp', bars: 30, sharesOutstanding: 1_000_000, startPrice: 50_000, pricePrecision: 4
  });
  const labels = yLabels(renderLineChart(s, { valueMode: 'worth' }));
  assert.ok(
    labels.some((t) => /\d+\.\d{4}[KMBT]/.test(t)),
    `expected a 4-decimal suffix label, got ${labels}`
  );
});

test('price mode: default precision is 2', () => {
  const s = generateStock({ seed: 'v211-p', bars: 20, startPrice: 100 });
  const labels = yLabels(renderLineChart(s));
  assert.ok(labels.length > 0);
  assert.ok(
    labels.every((t) => /\.\d{2}$/.test(t)),
    `expected 2-decimal labels, got ${labels}`
  );
});

// ── ATL floor ───────────────────────────────────────────────────────

test('grown chart: y-axis floor is the ATL, not 0', () => {
  const stock = {
    symbol: 'G',
    bars: [0, 1, 2, 3, 4].map((i) => ({
      time: Date.UTC(2024, 0, 1 + i),
      open: i ? 4000 : 50,
      high: i ? 5000 : 50,
      low: i ? 3000 : 50,
      close: i ? 5000 : 50
    }))
  };
  const labels = yLabels(renderLineChart(stock));
  // ATL = 50 → the bottom tick is the ATL, not a clamped 0
  assert.equal(labels[0], '50.00');
});

test('normal chart: floor keeps the usual padding', () => {
  const closes = [90, 95, 105, 110];
  const stock = {
    symbol: 'N',
    bars: closes.map((close, i) => ({
      time: Date.UTC(2024, 0, 1 + i),
      open: close, high: close, low: close, close
    }))
  };
  const labels = yLabels(renderLineChart(stock));
  // min 90, max 110 → pad 1 → floor 89, not the ATL
  assert.equal(labels[0], '89.00');
});

// ── chart-size injection ────────────────────────────────────────────

test('crafted chart sizes throw instead of injecting markup', () => {
  const s = generateStock({ seed: 'v211-x', bars: 10 });
  assert.throws(
    () => renderLineChart(s, { width: '600"><script>alert(1)</script>' }),
    /finite number/
  );
  assert.throws(
    () => renderLineChart(s, { height: '600" onload="alert(1)' }),
    /finite number/
  );
  assert.throws(
    () => renderLineChart(s, { padding: { left: '10"><svg onload=alert(1)>' } }),
    /finite number/
  );
  assert.throws(
    () => renderHtmlPage(s, { chartOptions: { width: '600"><img src=x onerror=alert(1)>' } }),
    /renderHtmlPage: chartOptions\.width must be a finite number/
  );
});

test('numeric size strings still work', () => {
  const s = generateStock({ seed: 'v211-n', bars: 10 });
  assert.match(renderLineChart(s, { width: '800', height: '400' }), /width="800"/);
});
