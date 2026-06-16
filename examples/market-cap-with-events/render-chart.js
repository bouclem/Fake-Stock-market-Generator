#!/usr/bin/env node
// Example: Company market cap chart with external events JSON
//
// Files:
//   - nova-market-cap.json  : Stock data with sharesOutstanding and bar.worth values
//   - nova-events.json      : Events in envelope format ({ name, events: [...] })
//   - render-chart.js       : This script — loads both JSONs and renders the chart
//
// Usage:
//   node render-chart.js
//
// Output:
//   - nova-market-cap-chart.svg

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// In ESM, __dirname is not defined — compute it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import stock-market-gen functions
import { fromJSON, loadEvents, renderAreaChart } from '../../src/index.js';

// Load the stock data (with market cap / worth values)
const stockDataRaw = readFileSync(join(__dirname, 'nova-market-cap.json'), 'utf8');
const stock = fromJSON(stockDataRaw);

console.log(`Loaded ${stock.symbol}: ${stock.name}`);
console.log(`Shares outstanding: ${stock.sharesOutstanding?.toLocaleString()}`);
console.log(`Latest market cap: $${(stock.bars[stock.bars.length - 1].worth / 1e9).toFixed(2)}B`);
console.log(`Date range: ${stock.bars[0].date.slice(0, 10)} to ${stock.bars[stock.bars.length - 1].date.slice(0, 10)}`);

// Load events from the separate JSON file
// loadEvents accepts:
//   - A file path ending in .json (Node.js only)
//   - An array of events
//   - A single event object
//   - An envelope object { name, events: [...] }
const events = loadEvents(join(__dirname, 'nova-events.json'));

console.log(`Loaded ${events.length} events`);
events.forEach(ev => {
  console.log(`  - ${ev.date?.slice(0, 10) || ev.date}: ${ev.label}`);
});

// Render the chart with valueMode: 'worth' to show market cap instead of stock price
// The Y-axis will show total company valuation (price × shares outstanding)
const svg = renderAreaChart(stock, {
  valueMode: 'worth',      // Plot bar.worth (market cap) instead of bar.close
  theme: 'light',
  events: events,          // Events from the JSON file
  title: `${stock.symbol} — Market Cap`,
  width: 1400,
  height: 700,
  padding: { top: 48, right: 32, bottom: 56, left: 100 }
});

// Save the SVG
const outputPath = join(__dirname, 'nova-market-cap-chart.svg');
writeFileSync(outputPath, svg);

console.log(`\nChart saved to: ${outputPath}`);
console.log(`Open it in a browser to view the market cap chart with event markers.`);
