#!/usr/bin/env node
// Simple example: Company market cap as a line chart
//
// Setup:
//   - Company config is right here in this file (name, symbol, shares)
//   - Worth values are loaded from JSON (just date + worth)
//   - Events are loaded from a separate JSON file
//
// Usage:
//   node render-line-chart.js

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { generateNetWorth, loadEvents, renderNetWorthChart } from '../../../src/index.js';

// === COMPANY CONFIG (right here in the JS file) ===
const COMPANY = {
  symbol: 'NOVA',
  name: 'NovaTech Industries',
  sector: 'Technology',
  sharesOutstanding: 100_000_000  // 100 million shares
};

// === LOAD WORTH VALUES FROM JSON ===
// The JSON has: { startDate, interval, values: [...] }
const worthData = JSON.parse(readFileSync(join(__dirname, 'nova-worth-values.json'), 'utf8'));

console.log(`${COMPANY.name} (${COMPANY.symbol})`);
console.log(`Shares outstanding: ${COMPANY.sharesOutstanding.toLocaleString()}`);
console.log(`Loaded ${worthData.values.length} market cap values`);
console.log(`Start date: ${worthData.startDate}`);
console.log(`Interval: ${worthData.interval}`);
console.log(`Latest market cap: $${(worthData.values[worthData.values.length - 1] / 1e9).toFixed(2)}B`);

// === GENERATE NET WORTH OBJECT FROM THE VALUES ===
// We use generateNetWorth with the custom values array.
// This gives us a NetWorth object that works with renderNetWorthChart.
const netWorth = generateNetWorth({
  name: COMPANY.name,
  startValue: worthData.values[0],
  values: worthData.values,
  startDate: worthData.startDate,
  interval: worthData.interval
});

// === LOAD EVENTS FROM JSON ===
const events = loadEvents(join(__dirname, 'nova-milestones.json'));
console.log(`Loaded ${events.length} events`);

// === RENDER LINE CHART ===
const svg = renderNetWorthChart(netWorth, {
  theme: 'light',
  events: events,
  title: `${COMPANY.symbol} — Market Cap`,
  width: 1200,
  height: 600
});

// === SAVE ===
const outputPath = join(__dirname, 'nova-market-cap-line.svg');
writeFileSync(outputPath, svg);

console.log(`\nLine chart saved: ${outputPath}`);
