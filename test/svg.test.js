import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateStock,
  generateNetWorth,
  renderLineChart,
  renderAreaChart,
  renderBarChart,
  renderCandlestickChart,
  renderMultiLineChart,
  renderNetWorthChart,
  renderMixedChart,
  renderChartWithVolume,
  renderChart,
  renderHtmlPage
} from '../src/index.js';

const stock = generateStock({ seed: 'svg', bars: 60, sharesOutstanding: '2M' });
const netWorth = generateNetWorth({ seed: 'svg', bars: 24 });

function assertValidSvg(svg) {
  assert.match(svg, /^<svg[^>]*>[\s\S]*<\/svg>$/);
  assert.ok(!svg.includes('NaN'), 'no NaN coordinates');
  assert.ok(!svg.includes('undefined'), 'no undefined leaks');
}

test('renderLineChart/AreaChart: valid SVG, no NaN', () => {
  assertValidSvg(renderLineChart(stock));
  assertValidSvg(renderAreaChart(stock));
});

test('renderBarChart/CandlestickChart: valid SVG', () => {
  assertValidSvg(renderBarChart(stock));
  assertValidSvg(renderCandlestickChart(stock));
});

test('line/area charts: valueMode worth works; OHLC charts reject it', () => {
  assertValidSvg(renderLineChart(stock, { valueMode: 'worth' }));
  assertValidSvg(renderAreaChart(stock, { valueMode: 'worth' }));
  assert.throws(() => renderBarChart(stock, { valueMode: 'worth' }), /not supported/);
  assert.throws(() => renderCandlestickChart(stock, { valueMode: 'worth' }), /not supported/);
});

test('renderers reject empty/invalid stock data with a clear error', () => {
  assert.throws(() => renderLineChart({ bars: [] }), /non-empty bars/);
  assert.throws(() => renderAreaChart(null), /non-empty bars/);
  assert.throws(() => renderBarChart({}), /non-empty bars/);
  assert.throws(() => renderCandlestickChart({ bars: [] }), /non-empty bars/);
});

test('events: array, single object, and bad input', () => {
  const ev = [{ date: stock.bars[30].date, label: 'Split' }];
  assertValidSvg(renderLineChart(stock, { events: ev }));
  assertValidSvg(renderLineChart(stock, { events: ev[0] }));
  assert.match(renderLineChart(stock, { events: ev }), /Split/);
  assert.throws(() => renderLineChart(stock, { events: 'events.txt' }), /"\.json"/);
});

test('events: positioned by timestamp, aligned with data points', () => {
  // Irregularly spaced bars — event at t=500 lands halfway across the plot
  const s = generateStock({
    ohlc: [
      { time: 0, open: 1, high: 2, low: 1, close: 2 },
      { time: 1000, open: 2, high: 3, low: 2, close: 3 },
      { time: 1_000_000, open: 3, high: 4, low: 3, close: 4 }
    ]
  });
  const svg = renderLineChart(s, { events: [{ date: new Date(500_500).toISOString(), label: 'mid' }] });
  // plot area: x=64, width = 1200-64-24 = 1112 -> midpoint x = 64 + 0.5005*1112 ≈ 620.6
  const line = svg.match(/<line x1="([\d.]+)" y1="[\d.]+" x2="[\d.]+" y2="[\d.]+" stroke="[^"]+" stroke-width="1.2" stroke-dasharray="4 3"/);
  assert.ok(line, 'event line present');
  assert.ok(Math.abs(Number(line[1]) - 620.56) < 1, `event x≈620.56, got ${line && line[1]}`);
});

test('colors and labels are escaped in SVG output', () => {
  const evil = generateStock({ seed: 'x', bars: 5 });
  evil.symbol = '"><script>alert(1)</script>';
  const svg = renderLineChart(evil, { events: [{ date: evil.bars[2].date, label: 'x', color: '"><script>' }] });
  assert.ok(!svg.includes('<script>'), 'no raw script injection');
});

test('renderMultiLineChart: modes, legend, validation', () => {
  const market = [stock, generateStock({ seed: 'other', bars: 30 })];
  assertValidSvg(renderMultiLineChart(market));
  assertValidSvg(renderMultiLineChart(market, { mode: 'price' }));
  assertValidSvg(renderMultiLineChart(market, { area: true }));
  assert.throws(() => renderMultiLineChart(market, { mode: 'bogus' }), /unknown mode/);
  assert.throws(() => renderMultiLineChart([]), /non-empty array/);
});

test('renderNetWorthChart and renderMixedChart', () => {
  assertValidSvg(renderNetWorthChart(netWorth));
  assertValidSvg(renderMixedChart([{ data: netWorth }, { data: stock }]));
  assertValidSvg(renderMixedChart([{ data: stock, valueField: 'worth' }], { mode: 'percent' }));
  assert.throws(() => renderMixedChart([{ data: stock }], { mode: 'bogus' }), /unknown mode/);
});

test('renderChartWithVolume: all types, stock and networth', () => {
  for (const t of ['line', 'area', 'bar', 'candlestick']) {
    assertValidSvg(renderChartWithVolume(stock, t));
    assertValidSvg(renderChartWithVolume(netWorth, t)); // no NaN even for bar/candlestick
  }
  assert.throws(() => renderChartWithVolume({ bars: [] }), /volume/);
  assert.throws(() => renderChartWithVolume(stock, 'bogus'), /unknown chart type/);
});

test('renderChart dispatcher', () => {
  assertValidSvg(renderChart(stock, 'candle'));
  assert.throws(() => renderChart(stock, 'nope'), /Unknown chart type/);
});

test('renderHtmlPage: produces a full document', () => {
  const html = renderHtmlPage([stock], { title: 'T', theme: 'dark' });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.ok(html.includes('</html>'));
  assert.ok(!html.includes('NaN'));
});

test('single-bar stock renders without crashing', () => {
  const one = generateStock({ seed: 'one', bars: 1 });
  assertValidSvg(renderLineChart(one));
  assertValidSvg(renderChartWithVolume(one));
});
