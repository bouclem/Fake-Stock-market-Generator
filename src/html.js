// Standalone HTML page renderer. Builds a self-contained document with the
// market summary and embedded SVG charts. No external assets, no JS.

import { renderChart } from './svg.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function changePct(stock) {
  const first = stock.bars[0].open;
  const last = stock.bars[stock.bars.length - 1].close;
  return ((last - first) / first) * 100;
}

function buildStyles(theme) {
  const dark = theme === 'dark';
  return `
    :root {
      --bg: ${dark ? '#0b1220' : '#f9fafb'};
      --card: ${dark ? '#111827' : '#ffffff'};
      --border: ${dark ? '#1f2937' : '#e5e7eb'};
      --text: ${dark ? '#e5e7eb' : '#111827'};
      --muted: ${dark ? '#9ca3af' : '#6b7280'};
      --up: ${dark ? '#22c55e' : '#16a34a'};
      --down: ${dark ? '#ef4444' : '#dc2626'};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    h1 { margin: 0 0 4px; font-size: 22px; }
    p.lead { margin: 0 0 24px; color: var(--muted); }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 8px;
      gap: 12px;
    }
    .symbol { font-weight: 700; font-size: 16px; }
    .name { color: var(--muted); font-size: 13px; }
    .price { font-variant-numeric: tabular-nums; font-weight: 600; }
    .up { color: var(--up); }
    .down { color: var(--down); }
    .meta {
      display: flex;
      gap: 12px;
      color: var(--muted);
      font-size: 12px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    svg { display: block; width: 100%; height: auto; }
  `;
}

/**
 * @typedef {Object} HtmlPageOptions
 * @property {string} [title]                                   - Page title
 * @property {'light'|'dark'} [theme]                           - Page + chart theme
 * @property {'line'|'area'|'bar'|'candlestick'} [chartType]    - Chart style
 * @property {import('./svg.js').ChartOptions} [chartOptions]   - Forwarded to renderer
 */

/**
 * Render a self-contained HTML page for a single stock or a market.
 * @param {import('./generator.js').Stock | import('./generator.js').Stock[]} marketOrStock
 * @param {HtmlPageOptions} [options]
 * @returns {string} HTML document
 */
export function renderHtmlPage(marketOrStock, options = {}) {
  const stocks = Array.isArray(marketOrStock) ? marketOrStock : [marketOrStock];
  const theme = options.theme === 'dark' ? 'dark' : 'light';
  const chartType = options.chartType || 'line';
  const chartOptions = {
    width: 520,
    height: 260,
    theme,
    ...(options.chartOptions || {})
  };
  const title = options.title || 'Fake Stock Market';

  const cards = stocks
    .map((stock) => {
      const last = stock.bars[stock.bars.length - 1].close;
      const pct = changePct(stock);
      const cls = pct >= 0 ? 'up' : 'down';
      const sign = pct >= 0 ? '+' : '';
      const chart = renderChart(stock, chartType, {
        ...chartOptions,
        title: '' // header in card already shows the symbol
      });
      return `
        <div class="card">
          <div class="header">
            <div>
              <div class="symbol">${escapeHtml(stock.symbol)}</div>
              ${stock.name ? `<div class="name">${escapeHtml(stock.name)}</div>` : ''}
            </div>
            <div>
              <span class="price">${last.toFixed(2)}</span>
              <span class="${cls}">${sign}${pct.toFixed(2)}%</span>
            </div>
          </div>
          ${chart}
          <div class="meta">
            ${stock.sector ? `<span>${escapeHtml(stock.sector)}</span>` : ''}
            <span>${stock.bars.length} bars</span>
          </div>
        </div>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${buildStyles(theme)}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="lead">Generated with stock-market-gen — fake data, no real market info.</p>
<div class="grid">
${cards}
</div>
</body>
</html>`;
}
