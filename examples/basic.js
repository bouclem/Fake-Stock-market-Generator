import { writeFileSync, mkdirSync } from 'node:fs';
import {
  generateStock,
  renderLineChart,
  renderCandlestickChart
} from '../src/index.js';

mkdirSync('out', { recursive: true });

// Reproducible: same seed -> same prices and same chart.
const stock = generateStock({
  bars: 120,
  interval: '1d',
  seed: 'demo'
});

const label = stock.name
  ? `${stock.symbol} — ${stock.name}${stock.sector ? ` (${stock.sector})` : ''}`
  : stock.symbol;
console.log(label);
console.log(`First close: ${stock.bars[0].close}`);
console.log(`Last close:  ${stock.bars[stock.bars.length - 1].close}`);

writeFileSync('out/line.svg', renderLineChart(stock, { theme: 'light' }));
writeFileSync('out/candle.svg', renderCandlestickChart(stock, { theme: 'dark' }));
console.log('Wrote out/line.svg and out/candle.svg');
