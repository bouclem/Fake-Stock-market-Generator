// SVG chart rendering. Pure string output, no DOM, no deps.
// Each renderer returns a complete <svg>...</svg> document you can save as
// a .svg file or inline into an HTML page.

const THEMES = {
  light: {
    bg: '#ffffff',
    grid: '#e5e7eb',
    text: '#374151',
    axis: '#9ca3af',
    line: '#2563eb',
    area: 'rgba(37, 99, 235, 0.18)',
    up: '#16a34a',
    down: '#dc2626'
  },
  dark: {
    bg: '#0b1220',
    grid: '#1f2937',
    text: '#e5e7eb',
    axis: '#6b7280',
    line: '#60a5fa',
    area: 'rgba(96, 165, 250, 0.22)',
    up: '#22c55e',
    down: '#ef4444'
  }
};

const DEFAULTS = {
  width: 800,
  height: 400,
  padding: { top: 24, right: 16, bottom: 36, left: 56 },
  theme: 'light',
  title: '',
  showGrid: true,
  showAxes: true
};

/**
 * @typedef {Object} ChartOptions
 * @property {number} [width]
 * @property {number} [height]
 * @property {{top:number,right:number,bottom:number,left:number}} [padding]
 * @property {'light'|'dark'} [theme]
 * @property {string} [title]
 * @property {boolean} [showGrid]
 * @property {boolean} [showAxes]
 * @property {Partial<typeof THEMES.light>} [colors] - Override individual colors
 */

function resolve(options) {
  const o = { ...DEFAULTS, ...options };
  o.padding = { ...DEFAULTS.padding, ...(options?.padding || {}) };
  const baseTheme = THEMES[o.theme] || THEMES.light;
  o.colors = { ...baseTheme, ...(options?.colors || {}) };
  return o;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function plotArea(o) {
  return {
    x: o.padding.left,
    y: o.padding.top,
    w: o.width - o.padding.left - o.padding.right,
    h: o.height - o.padding.top - o.padding.bottom
  };
}

function priceRange(bars, useOHLC) {
  let min = Infinity;
  let max = -Infinity;
  for (const b of bars) {
    const lo = useOHLC ? b.low : b.close;
    const hi = useOHLC ? b.high : b.close;
    if (lo < min) min = lo;
    if (hi > max) max = hi;
  }
  if (min === max) {
    // Avoid divide-by-zero on flat data
    min -= 1;
    max += 1;
  }
  // Pad the range a touch so the line doesn't kiss the edges
  const pad = (max - min) * 0.05;
  return { min: min - pad, max: max + pad };
}

function formatPrice(n) {
  if (n >= 1000) return n.toFixed(0);
  if (n >= 100) return n.toFixed(1);
  return n.toFixed(2);
}

function formatDateShort(time) {
  const d = new Date(time);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function buildAxes(o, plot, range, bars) {
  if (!o.showAxes && !o.showGrid) return '';

  const ticks = 5;
  const parts = [];

  // Y axis (price) ticks
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const y = plot.y + plot.h - t * plot.h;
    const value = range.min + t * (range.max - range.min);

    if (o.showGrid) {
      parts.push(
        `<line x1="${plot.x}" y1="${y}" x2="${plot.x + plot.w}" y2="${y}" stroke="${o.colors.grid}" stroke-width="1"/>`
      );
    }
    if (o.showAxes) {
      parts.push(
        `<text x="${plot.x - 8}" y="${y + 4}" text-anchor="end" font-family="system-ui, sans-serif" font-size="11" fill="${o.colors.text}">${formatPrice(value)}</text>`
      );
    }
  }

  // X axis (time) ticks — pick ~5 evenly spaced bars
  if (o.showAxes) {
    const xTicks = Math.min(5, bars.length);
    for (let i = 0; i < xTicks; i++) {
      const idx = Math.round((i / Math.max(1, xTicks - 1)) * (bars.length - 1));
      const x = plot.x + (idx / Math.max(1, bars.length - 1)) * plot.w;
      parts.push(
        `<text x="${x}" y="${plot.y + plot.h + 18}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="${o.colors.text}">${formatDateShort(bars[idx].time)}</text>`
      );
    }
  }

  return parts.join('');
}

function buildTitle(o) {
  if (!o.title) return '';
  return `<text x="${o.padding.left}" y="${o.padding.top - 8}" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="${o.colors.text}">${escapeXml(o.title)}</text>`;
}

function defaultTitle(stock) {
  return stock.name ? `${stock.symbol} — ${stock.name}` : stock.symbol;
}

function svgWrap(o, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.width} ${o.height}" width="${o.width}" height="${o.height}">` +
    `<rect width="${o.width}" height="${o.height}" fill="${o.colors.bg}"/>` +
    body +
    `</svg>`;
}

function xAt(plot, i, n) {
  if (n <= 1) return plot.x + plot.w / 2;
  return plot.x + (i / (n - 1)) * plot.w;
}

function yAt(plot, value, range) {
  const t = (value - range.min) / (range.max - range.min);
  return plot.y + plot.h - t * plot.h;
}

/**
 * Render a line chart (close prices).
 * @param {import('./generator.js').Stock} stock
 * @param {ChartOptions} [options]
 * @returns {string} SVG document
 */
export function renderLineChart(stock, options) {
  const o = resolve(options);
  const plot = plotArea(o);
  const range = priceRange(stock.bars, false);

  const points = stock.bars
    .map((b, i) => `${xAt(plot, i, stock.bars.length).toFixed(2)},${yAt(plot, b.close, range).toFixed(2)}`)
    .join(' ');

  const body =
    buildAxes(o, plot, range, stock.bars) +
    `<polyline points="${points}" fill="none" stroke="${o.colors.line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    buildTitle({ ...o, title: o.title || defaultTitle(stock) });

  return svgWrap(o, body);
}

/**
 * Render an area chart (close prices with filled gradient-ish area).
 * @param {import('./generator.js').Stock} stock
 * @param {ChartOptions} [options]
 * @returns {string} SVG document
 */
export function renderAreaChart(stock, options) {
  const o = resolve(options);
  const plot = plotArea(o);
  const range = priceRange(stock.bars, false);

  const n = stock.bars.length;
  const linePoints = stock.bars
    .map((b, i) => `${xAt(plot, i, n).toFixed(2)},${yAt(plot, b.close, range).toFixed(2)}`)
    .join(' ');

  const firstX = xAt(plot, 0, n).toFixed(2);
  const lastX = xAt(plot, n - 1, n).toFixed(2);
  const baseY = (plot.y + plot.h).toFixed(2);
  const areaPoints = `${firstX},${baseY} ${linePoints} ${lastX},${baseY}`;

  const body =
    buildAxes(o, plot, range, stock.bars) +
    `<polygon points="${areaPoints}" fill="${o.colors.area}" stroke="none"/>` +
    `<polyline points="${linePoints}" fill="none" stroke="${o.colors.line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    buildTitle({ ...o, title: o.title || defaultTitle(stock) });

  return svgWrap(o, body);
}

/**
 * Render an OHLC bar chart (the classic tick-left-tick-right notation).
 * @param {import('./generator.js').Stock} stock
 * @param {ChartOptions} [options]
 * @returns {string} SVG document
 */
export function renderBarChart(stock, options) {
  const o = resolve(options);
  const plot = plotArea(o);
  const range = priceRange(stock.bars, true);
  const n = stock.bars.length;

  const slot = plot.w / Math.max(1, n);
  const tick = Math.max(1, Math.min(slot * 0.35, 6));

  const bars = stock.bars
    .map((b, i) => {
      const x = xAt(plot, i, n);
      const yHigh = yAt(plot, b.high, range);
      const yLow = yAt(plot, b.low, range);
      const yOpen = yAt(plot, b.open, range);
      const yClose = yAt(plot, b.close, range);
      const color = b.close >= b.open ? o.colors.up : o.colors.down;
      return (
        `<line x1="${x.toFixed(2)}" y1="${yHigh.toFixed(2)}" x2="${x.toFixed(2)}" y2="${yLow.toFixed(2)}" stroke="${color}" stroke-width="1.2"/>` +
        `<line x1="${(x - tick).toFixed(2)}" y1="${yOpen.toFixed(2)}" x2="${x.toFixed(2)}" y2="${yOpen.toFixed(2)}" stroke="${color}" stroke-width="1.2"/>` +
        `<line x1="${x.toFixed(2)}" y1="${yClose.toFixed(2)}" x2="${(x + tick).toFixed(2)}" y2="${yClose.toFixed(2)}" stroke="${color}" stroke-width="1.2"/>`
      );
    })
    .join('');

  const body =
    buildAxes(o, plot, range, stock.bars) +
    bars +
    buildTitle({ ...o, title: o.title || defaultTitle(stock) });

  return svgWrap(o, body);
}

/**
 * Render a candlestick chart.
 * @param {import('./generator.js').Stock} stock
 * @param {ChartOptions} [options]
 * @returns {string} SVG document
 */
export function renderCandlestickChart(stock, options) {
  const o = resolve(options);
  const plot = plotArea(o);
  const range = priceRange(stock.bars, true);
  const n = stock.bars.length;

  const slot = plot.w / Math.max(1, n);
  const candleW = Math.max(1, slot * 0.6);

  const candles = stock.bars
    .map((b, i) => {
      const x = xAt(plot, i, n);
      const yHigh = yAt(plot, b.high, range);
      const yLow = yAt(plot, b.low, range);
      const yOpen = yAt(plot, b.open, range);
      const yClose = yAt(plot, b.close, range);
      const up = b.close >= b.open;
      const color = up ? o.colors.up : o.colors.down;
      const top = Math.min(yOpen, yClose);
      const bodyH = Math.max(1, Math.abs(yClose - yOpen));
      return (
        `<line x1="${x.toFixed(2)}" y1="${yHigh.toFixed(2)}" x2="${x.toFixed(2)}" y2="${yLow.toFixed(2)}" stroke="${color}" stroke-width="1"/>` +
        `<rect x="${(x - candleW / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${candleW.toFixed(2)}" height="${bodyH.toFixed(2)}" fill="${color}" stroke="${color}"/>`
      );
    })
    .join('');

  const body =
    buildAxes(o, plot, range, stock.bars) +
    candles +
    buildTitle({ ...o, title: o.title || defaultTitle(stock) });

  return svgWrap(o, body);
}

/**
 * Universal renderer. Pick a chart type by name.
 * @param {import('./generator.js').Stock} stock
 * @param {'line'|'area'|'bar'|'candlestick'} type
 * @param {ChartOptions} [options]
 * @returns {string} SVG document
 */
export function renderChart(stock, type = 'line', options) {
  switch (type) {
    case 'line': return renderLineChart(stock, options);
    case 'area': return renderAreaChart(stock, options);
    case 'bar': return renderBarChart(stock, options);
    case 'candle':
    case 'candlestick': return renderCandlestickChart(stock, options);
    default:
      throw new Error(`Unknown chart type: "${type}". Use "line", "area", "bar" or "candlestick".`);
  }
}
