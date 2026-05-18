// Standalone HTML page renderer. Builds a self-contained document with the
// market summary, a clickable card per stock, and an in-page detail view.
// No external assets, no framework — just CSS + a tiny vanilla-JS toggle.

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

function fmt(n, digits = 2) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function fmtVolume(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(time) {
  const d = new Date(time);
  return d.toISOString().slice(0, 10);
}

function buildStyles(theme) {
  const dark = theme === 'dark';
  return `
    :root {
      --bg: ${dark ? '#0b1220' : '#f9fafb'};
      --card: ${dark ? '#111827' : '#ffffff'};
      --card-hover: ${dark ? '#1a2435' : '#f3f4f6'};
      --border: ${dark ? '#1f2937' : '#e5e7eb'};
      --text: ${dark ? '#e5e7eb' : '#111827'};
      --muted: ${dark ? '#9ca3af' : '#6b7280'};
      --up: ${dark ? '#22c55e' : '#16a34a'};
      --down: ${dark ? '#ef4444' : '#dc2626'};
      --overlay: ${dark ? 'rgba(0,0,0,0.7)' : 'rgba(17,24,39,0.5)'};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      font-size: 16px;
    }
    h1 { margin: 0 0 4px; font-size: 26px; }
    p.lead { margin: 0 0 24px; color: var(--muted); font-size: 15px; }
    .grid {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      cursor: pointer;
      transition: background 0.15s, transform 0.15s, border-color 0.15s;
    }
    .card:hover {
      background: var(--card-hover);
      border-color: var(--muted);
      transform: translateY(-1px);
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 10px;
      gap: 12px;
    }
    .symbol { font-weight: 700; font-size: 18px; }
    .name { color: var(--muted); font-size: 14px; margin-top: 2px; }
    .price { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 17px; }
    .pct { font-size: 14px; margin-left: 6px; font-variant-numeric: tabular-nums; }
    .up { color: var(--up); }
    .down { color: var(--down); }
    .meta {
      display: flex;
      gap: 12px;
      color: var(--muted);
      font-size: 13px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    svg { display: block; width: 100%; height: auto; }

    /* Detail overlay */
    .detail {
      position: fixed;
      inset: 0;
      background: var(--overlay);
      display: none;
      align-items: flex-start;
      justify-content: center;
      padding: 32px 16px;
      overflow-y: auto;
      z-index: 100;
    }
    .detail.open { display: flex; }
    .detail-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      max-width: 1100px;
      width: 100%;
      padding: 24px;
    }
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }
    .detail-title { font-size: 28px; font-weight: 700; }
    .detail-sub { color: var(--muted); font-size: 15px; margin-top: 4px; }
    .detail-price { text-align: right; }
    .detail-price .price { font-size: 28px; }
    .detail-price .pct { font-size: 17px; }
    .close-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      width: 36px;
      height: 36px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
    }
    .close-btn:hover { background: var(--card-hover); }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
    }
    .stat-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .stat-value { font-size: 18px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .table-wrap {
      max-height: 280px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-top: 16px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td {
      padding: 8px 12px;
      text-align: right;
      border-bottom: 1px solid var(--border);
      font-variant-numeric: tabular-nums;
    }
    th:first-child, td:first-child { text-align: left; }
    th {
      position: sticky;
      top: 0;
      background: var(--card);
      color: var(--muted);
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
    }
    @media (max-width: 600px) {
      .grid { grid-template-columns: 1fr; }
      .detail-header { flex-direction: column; }
      .detail-price { text-align: left; }
    }
  `;
}

function buildStats(stock) {
  const closes = stock.bars.map((b) => b.close);
  const highs = stock.bars.map((b) => b.high);
  const lows = stock.bars.map((b) => b.low);
  const volumes = stock.bars.map((b) => b.volume);
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const avgVolume = volumes.reduce((s, n) => s + n, 0) / volumes.length;
  const last = closes[closes.length - 1];

  return [
    ['Last',         fmt(last)],
    ['Period high',  fmt(high)],
    ['Period low',   fmt(low)],
    ['Open (first)', fmt(stock.bars[0].open)],
    ['Bars',         String(stock.bars.length)],
    ['Avg volume',   fmtVolume(avgVolume)]
  ];
}

function buildTable(stock) {
  // Show the most recent 50 bars to keep the page small
  const rows = stock.bars.slice(-50).reverse();
  return rows
    .map(
      (b) => `<tr>
        <td>${escapeHtml(fmtDate(b.time))}</td>
        <td>${fmt(b.open)}</td>
        <td>${fmt(b.high)}</td>
        <td>${fmt(b.low)}</td>
        <td>${fmt(b.close)}</td>
        <td>${fmtVolume(b.volume)}</td>
      </tr>`
    )
    .join('');
}

const SCRIPT = `
(function () {
  var details = document.querySelectorAll('.detail');
  var byId = {};
  details.forEach(function (d) { byId[d.dataset.id] = d; });

  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('click', function () {
      var d = byId[card.dataset.id];
      if (d) { d.classList.add('open'); document.body.style.overflow = 'hidden'; }
    });
  });

  function close(d) { d.classList.remove('open'); document.body.style.overflow = ''; }

  details.forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) close(d); });
    d.querySelector('.close-btn').addEventListener('click', function () { close(d); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') details.forEach(close);
  });
})();
`;

/**
 * @typedef {Object} HtmlPageOptions
 * @property {string} [title]                                   - Page title
 * @property {'light'|'dark'} [theme]                           - Page + chart theme
 * @property {'line'|'area'|'bar'|'candlestick'} [chartType]    - Chart style
 * @property {import('./svg.js').ChartOptions} [chartOptions]   - Forwarded to renderer
 */

/**
 * Render a self-contained HTML page for a single stock or a market.
 * Cards are clickable: clicking one opens an in-page detail view with
 * a larger chart, key stats, and a recent-bars table. Esc or click
 * outside to close.
 *
 * @param {import('./generator.js').Stock | import('./generator.js').Stock[]} marketOrStock
 * @param {HtmlPageOptions} [options]
 * @returns {string} HTML document
 */
export function renderHtmlPage(marketOrStock, options = {}) {
  const stocks = Array.isArray(marketOrStock) ? marketOrStock : [marketOrStock];
  const theme = options.theme === 'dark' ? 'dark' : 'light';
  const chartType = options.chartType || 'line';
  const baseChartOpts = {
    theme,
    ...(options.chartOptions || {})
  };
  const title = options.title || 'Fake Stock Market';

  const cardChartOpts = { width: 600, height: 320, ...baseChartOpts };
  const detailChartOpts = { width: 1040, height: 460, ...baseChartOpts };

  const cards = stocks
    .map((stock, idx) => {
      const id = `s${idx}`;
      const last = stock.bars[stock.bars.length - 1].close;
      const pct = changePct(stock);
      const cls = pct >= 0 ? 'up' : 'down';
      const sign = pct >= 0 ? '+' : '';
      const chart = renderChart(stock, chartType, { ...cardChartOpts, title: '' });
      return `
        <div class="card" data-id="${id}">
          <div class="header">
            <div>
              <div class="symbol">${escapeHtml(stock.symbol)}</div>
              ${stock.name ? `<div class="name">${escapeHtml(stock.name)}</div>` : ''}
            </div>
            <div>
              <span class="price">${fmt(last)}</span>
              <span class="pct ${cls}">${sign}${pct.toFixed(2)}%</span>
            </div>
          </div>
          ${chart}
          <div class="meta">
            ${stock.sector ? `<span>${escapeHtml(stock.sector)}</span>` : ''}
            <span>${stock.bars.length} bars</span>
            <span style="margin-left:auto;color:var(--muted);font-size:12px;">click for details →</span>
          </div>
        </div>
      `;
    })
    .join('\n');

  const detailViews = stocks
    .map((stock, idx) => {
      const id = `s${idx}`;
      const last = stock.bars[stock.bars.length - 1].close;
      const pct = changePct(stock);
      const cls = pct >= 0 ? 'up' : 'down';
      const sign = pct >= 0 ? '+' : '';
      const chart = renderChart(stock, chartType, { ...detailChartOpts, title: '' });
      const stats = buildStats(stock)
        .map(
          ([k, v]) =>
            `<div class="stat"><div class="stat-label">${escapeHtml(k)}</div><div class="stat-value">${escapeHtml(v)}</div></div>`
        )
        .join('');
      return `
        <div class="detail" data-id="${id}" role="dialog" aria-modal="true">
          <div class="detail-card">
            <div class="detail-header">
              <div>
                <div class="detail-title">${escapeHtml(stock.symbol)}</div>
                <div class="detail-sub">
                  ${stock.name ? escapeHtml(stock.name) : ''}${stock.name && stock.sector ? ' · ' : ''}${stock.sector ? escapeHtml(stock.sector) : ''}
                </div>
              </div>
              <div style="display:flex; gap:12px; align-items:flex-start;">
                <div class="detail-price">
                  <div><span class="price">${fmt(last)}</span><span class="pct ${cls}">${sign}${pct.toFixed(2)}%</span></div>
                  <div style="color:var(--muted);font-size:13px;margin-top:4px;">
                    ${escapeHtml(fmtDate(stock.bars[0].time))} → ${escapeHtml(fmtDate(stock.bars[stock.bars.length - 1].time))}
                  </div>
                </div>
                <button class="close-btn" aria-label="Close">×</button>
              </div>
            </div>
            <div class="stats">${stats}</div>
            ${chart}
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr>
                </thead>
                <tbody>${buildTable(stock)}</tbody>
              </table>
            </div>
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
<p class="lead">Generated with stock-market-gen — fake data, no real market info. Click a card for details.</p>
<div class="grid">
${cards}
</div>
${detailViews}
<script>${SCRIPT}</script>
</body>
</html>`;
}
