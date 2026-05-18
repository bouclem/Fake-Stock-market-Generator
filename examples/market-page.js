import { writeFileSync, mkdirSync } from 'node:fs';
import { generateMarket, renderHtmlPage } from '../src/index.js';

mkdirSync('out', { recursive: true });

// No company info is invented for you. Symbols are random tickers; if you
// want names or sectors, pass a `stocks` array with your own values.
const market = generateMarket({
  count: 8,
  bars: 90,
  interval: '1d',
  seed: 'market-demo'
});

const html = renderHtmlPage(market, {
  title: 'Fake Stock Market',
  theme: 'dark',
  chartType: 'area'
});

writeFileSync('out/market.html', html);
console.log(`Generated ${market.length} stocks. Open out/market.html`);
