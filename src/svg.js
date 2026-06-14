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
  width: 1200,
  height: 600,
  padding: { top: 28, right: 24, bottom: 44, left: 64 },
  theme: 'light',
  title: '',
  showGrid: true,
  showAxes: true,
  xTicks: 8,
  yTicks: 5
};

/**
 * @typedef {Object} ChartEvent
 * @property {Date|number|string} date  - Timestamp of the event
 * @property {string} label             - Short label shown at top of chart
 * @property {string} [color]           - Override line/label color (defaults to theme accent)
 */

/**
 * @typedef {Object} ChartOptions
 * @property {number} [width]
 * @property {number} [height]
 * @property {{top:number,right:number,bottom:number,left:number}} [padding]
 * @property {'light'|'dark'} [theme]
 * @property {string} [title]
 * @property {boolean} [showGrid]
 * @property {boolean} [showAxes]
 * @property {number} [xTicks]     - Number of date labels on the X axis (default: 8)
 * @property {number} [yTicks]     - Number of price labels on the Y axis (default: 5)
 * @property {ChartEvent[]} [events] - Annotate specific dates with a full-height marker and top label
 * @property {'price'|'worth'} [valueMode] - What to plot: 'price' (default) uses OHLC close/open/high/low;
 *   'worth' uses bar.worth (close × sharesOutstanding). Requires sharesOutstanding on the stock.
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

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
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
  // Pad the range a touch so the line doesn't kiss the edges.
  // Clip to zero so stock charts never show negative prices.
  const pad = (max - min) * 0.05;
  return { min: Math.max(0, min - pad), max: max + pad };
}

function formatPrice(n) {
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 100) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function formatDateShort(time, multiYear) {
  const d = new Date(time);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return multiYear ? `${yyyy}-${mm}-${dd}` : `${mm}/${dd}`;
}

function spansMultipleYears(bars) {
  if (bars.length < 2) return false;
  const first = new Date(bars[0].time).getUTCFullYear();
  const last = new Date(bars[bars.length - 1].time).getUTCFullYear();
  return last !== first;
}

function buildAxes(o, plot, range, bars) {
  if (!o.showAxes && !o.showGrid) return '';

  const yTicks = Math.max(2, Math.floor(o.yTicks || 5));
  const parts = [];

  // Y axis (price) ticks
  for (let i = 0; i <= yTicks; i++) {
    const t = i / yTicks;
    const y = plot.y + plot.h - t * plot.h;
    const value = range.min + t * (range.max - range.min);

    if (o.showGrid) {
      parts.push(
        `<line x1="${plot.x}" y1="${y}" x2="${plot.x + plot.w}" y2="${y}" stroke="${o.colors.grid}" stroke-width="1"/>`
      );
    }
    if (o.showAxes) {
      parts.push(
        `<text x="${plot.x - 8}" y="${y + 4}" text-anchor="end" font-family="system-ui, sans-serif" font-size="13" fill="${o.colors.text}">${formatPrice(value)}</text>`
      );
    }
  }

  // X axis (time) ticks — pick N evenly spaced bars (configurable via xTicks)
  if (o.showAxes) {
    const multiYear = spansMultipleYears(bars);
    const requested = Math.max(2, Math.floor(o.xTicks || 5));
    const xTicks = Math.min(requested, bars.length);
    for (let i = 0; i < xTicks; i++) {
      const idx = Math.round((i / Math.max(1, xTicks - 1)) * (bars.length - 1));
      const x = plot.x + (idx / Math.max(1, bars.length - 1)) * plot.w;
      // Anchor the first/last labels at the plot edges so they never crop.
      const anchor = i === 0 ? 'start' : i === xTicks - 1 ? 'end' : 'middle';
      parts.push(
        `<text x="${x}" y="${plot.y + plot.h + 20}" text-anchor="${anchor}" font-family="system-ui, sans-serif" font-size="13" fill="${o.colors.text}">${formatDateShort(bars[idx].time, multiYear)}</text>`
      );
    }
  }

  return parts.join('');
}

function buildTitle(o) {
  if (!o.title) return '';
  // Anchored to the right so the legend (top-left of the plot area)
  // never overlaps the title text.
  const x = o.width - o.padding.right;
  return `<text x="${x}" y="${o.padding.top - 8}" text-anchor="end" font-family="system-ui, sans-serif" font-size="15" font-weight="600" fill="${o.colors.text}">${escapeXml(o.title)}</text>`;
}

function defaultTitle(stock) {
  return stock.name ? `${stock.symbol} — ${stock.name}` : stock.symbol;
}

// Resolve the title to render: an explicit empty string from the caller
// suppresses the default (used by renderHtmlPage for cards that already show
// the symbol/name in their own header).
function resolveTitle(explicit, fallback) {
  return explicit === undefined || explicit === null ? fallback : explicit;
}

const EVENT_TOP_PAD = 20;

/**
 * Resolve event timestamps and clamp them to the chart's time domain.
 * Returns an array of { x, label, color } pixel-space records.
 */
function resolveEvents(events, o, plot, tMin, tMax, xForTime) {
  if (!events || events.length === 0) return [];
  const fallbackColor = o.colors.line || '#2563eb';
  return events
    .map((ev) => {
      const t = new Date(ev.date).getTime();
      if (!Number.isFinite(t)) return null;
      const x = xForTime ? xForTime(t) : plot.x + ((t - tMin) / Math.max(1, tMax - tMin)) * plot.w;
      if (x < plot.x - 1 || x > plot.x + plot.w + 1) return null;
      return {
        x,
        label: String(ev.label || ''),
        color: ev.color || fallbackColor
      };
    })
    .filter(Boolean);
}

/**
 * Build the SVG for event markers: full-height dashed lines + top labels.
 * Assumes padding.top has been increased by EVENT_TOP_PAD before calling.
 */
function buildEvents(resolvedEvents, plot, o) {
  if (!resolvedEvents || resolvedEvents.length === 0) return '';
  return resolvedEvents
    .map((ev) => {
      const x = ev.x.toFixed(2);
      const lineTop = plot.y.toFixed(2);
      const lineBot = (plot.y + plot.h).toFixed(2);
      // Label sits above plot area (inside the extra EVENT_TOP_PAD space)
      const labelY = (plot.y - 6).toFixed(2);
      return (
        `<line x1="${x}" y1="${lineTop}" x2="${x}" y2="${lineBot}" stroke="${ev.color}" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.8"/>` +
        `<text x="${x}" y="${labelY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="${ev.color}">${escapeXml(ev.label)}</text>`
      );
    })
    .join('');
}

/**
 * Patch options to add extra top padding when events are present.
 */
function withEventPadding(o, hasEvents) {
  if (!hasEvents) return o;
  return { ...o, padding: { ...o.padding, top: o.padding.top + EVENT_TOP_PAD } };
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
  const o = withEventPadding(resolve(options), options?.events?.length);
  const plot = plotArea(o);
  const worthMode = o.valueMode === 'worth';
  if (worthMode) _assertWorth(stock);
  const getValue = worthMode ? (b) => b.worth : (b) => b.close;
  const range = worthMode ? worthRange(stock.bars) : priceRange(stock.bars, false);

  const n = stock.bars.length;
  const tMin = stock.bars[0].time;
  const tMax = stock.bars[n - 1].time;
  const xForTime = (t) => plot.x + ((t - tMin) / Math.max(1, tMax - tMin)) * plot.w;
  const evs = resolveEvents(o.events, o, plot, tMin, tMax, xForTime);

  const points = stock.bars
    .map((b, i) => `${xAt(plot, i, n).toFixed(2)},${yAt(plot, getValue(b), range).toFixed(2)}`)
    .join(' ');

  const body =
    buildAxes(o, plot, range, stock.bars) +
    buildEvents(evs, plot, o) +
    `<polyline points="${points}" fill="none" stroke="${o.colors.line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    buildTitle({ ...o, title: resolveTitle(o.title, defaultTitle(stock)) });

  return svgWrap(o, body);
}

/**
 * Render an area chart (close prices with filled gradient-ish area).
 * @param {import('./generator.js').Stock} stock
 * @param {ChartOptions} [options]
 * @returns {string} SVG document
 */
export function renderAreaChart(stock, options) {
  const o = withEventPadding(resolve(options), options?.events?.length);
  const plot = plotArea(o);
  const worthMode = o.valueMode === 'worth';
  if (worthMode) _assertWorth(stock);
  const getValue = worthMode ? (b) => b.worth : (b) => b.close;
  const range = worthMode ? worthRange(stock.bars) : priceRange(stock.bars, false);

  const n = stock.bars.length;
  const tMin = stock.bars[0].time;
  const tMax = stock.bars[n - 1].time;
  const xForTime = (t) => plot.x + ((t - tMin) / Math.max(1, tMax - tMin)) * plot.w;
  const evs = resolveEvents(o.events, o, plot, tMin, tMax, xForTime);

  const linePoints = stock.bars
    .map((b, i) => `${xAt(plot, i, n).toFixed(2)},${yAt(plot, getValue(b), range).toFixed(2)}`)
    .join(' ');

  const firstX = xAt(plot, 0, n).toFixed(2);
  const lastX = xAt(plot, n - 1, n).toFixed(2);
  const baseY = (plot.y + plot.h).toFixed(2);
  const areaPoints = `${firstX},${baseY} ${linePoints} ${lastX},${baseY}`;

  const body =
    buildAxes(o, plot, range, stock.bars) +
    buildEvents(evs, plot, o) +
    `<polygon points="${areaPoints}" fill="${o.colors.area}" stroke="none"/>` +
    `<polyline points="${linePoints}" fill="none" stroke="${o.colors.line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    buildTitle({ ...o, title: resolveTitle(o.title, defaultTitle(stock)) });

  return svgWrap(o, body);
}

/**
 * Render an OHLC bar chart (the classic tick-left-tick-right notation).
 * @param {import('./generator.js').Stock} stock
 * @param {ChartOptions} [options]
 * @returns {string} SVG document
 */
export function renderBarChart(stock, options) {
  const o = withEventPadding(resolve(options), options?.events?.length);
  const plot = plotArea(o);
  const worthMode = o.valueMode === 'worth';
  if (worthMode) _assertWorth(stock);
  const range = worthMode ? worthRange(stock.bars) : priceRange(stock.bars, true);
  const n = stock.bars.length;

  const slot = plot.w / Math.max(1, n);
  const tick = Math.max(1, Math.min(slot * 0.35, 6));
  // Inset the X mapping by `tick` so the leftmost open-tick and the rightmost
  // close-tick stay inside the plot area instead of overflowing into the axis.
  const innerX = plot.x + tick;
  const innerW = Math.max(0, plot.w - 2 * tick);

  const bars = stock.bars
    .map((b, i) => {
      const x = n <= 1 ? innerX + innerW / 2 : innerX + (i / (n - 1)) * innerW;
      const yHigh = yAt(plot, worthMode ? b.worth : b.high, range);
      const yLow  = yAt(plot, worthMode ? b.worth : b.low,  range);
      const yOpen  = yAt(plot, worthMode ? b.worth : b.open,  range);
      const yClose = yAt(plot, worthMode ? b.worth : b.close, range);
      const color = b.close >= b.open ? o.colors.up : o.colors.down;
      return (
        `<line x1="${x.toFixed(2)}" y1="${yHigh.toFixed(2)}" x2="${x.toFixed(2)}" y2="${yLow.toFixed(2)}" stroke="${color}" stroke-width="1.2"/>` +
        `<line x1="${(x - tick).toFixed(2)}" y1="${yOpen.toFixed(2)}" x2="${x.toFixed(2)}" y2="${yOpen.toFixed(2)}" stroke="${color}" stroke-width="1.2"/>` +
        `<line x1="${x.toFixed(2)}" y1="${yClose.toFixed(2)}" x2="${(x + tick).toFixed(2)}" y2="${yClose.toFixed(2)}" stroke="${color}" stroke-width="1.2"/>`
      );
    })
    .join('');

  const n2 = stock.bars.length;
  const tMin2 = stock.bars[0].time;
  const tMax2 = stock.bars[n2 - 1].time;
  const xForTime2 = (t) => plot.x + ((t - tMin2) / Math.max(1, tMax2 - tMin2)) * plot.w;
  const evs2 = resolveEvents(o.events, o, plot, tMin2, tMax2, xForTime2);

  const body =
    buildAxes(o, plot, range, stock.bars) +
    buildEvents(evs2, plot, o) +
    bars +
    buildTitle({ ...o, title: resolveTitle(o.title, defaultTitle(stock)) });

  return svgWrap(o, body);
}

/**
 * Render a candlestick chart.
 * @param {import('./generator.js').Stock} stock
 * @param {ChartOptions} [options]
 * @returns {string} SVG document
 */
export function renderCandlestickChart(stock, options) {
  const o = withEventPadding(resolve(options), options?.events?.length);
  const plot = plotArea(o);
  const worthMode = o.valueMode === 'worth';
  if (worthMode) _assertWorth(stock);
  const range = worthMode ? worthRange(stock.bars) : priceRange(stock.bars, true);
  const n = stock.bars.length;

  const slot = plot.w / Math.max(1, n);
  const candleW = Math.max(1, slot * 0.6);
  // Inset the X mapping by half a candle width so the first and last bodies
  // sit fully inside the plot rectangle.
  const inset = candleW / 2;
  const innerX = plot.x + inset;
  const innerW = Math.max(0, plot.w - 2 * inset);

  const candles = stock.bars
    .map((b, i) => {
      const x = n <= 1 ? innerX + innerW / 2 : innerX + (i / (n - 1)) * innerW;
      const yHigh = yAt(plot, worthMode ? b.worth : b.high,  range);
      const yLow  = yAt(plot, worthMode ? b.worth : b.low,   range);
      const yOpen  = yAt(plot, worthMode ? b.worth : b.open,  range);
      const yClose = yAt(plot, worthMode ? b.worth : b.close, range);
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

  const nc = stock.bars.length;
  const tMinC = stock.bars[0].time;
  const tMaxC = stock.bars[nc - 1].time;
  const xForTimeC = (t) => plot.x + ((t - tMinC) / Math.max(1, tMaxC - tMinC)) * plot.w;
  const evsC = resolveEvents(o.events, o, plot, tMinC, tMaxC, xForTimeC);

  const body =
    buildAxes(o, plot, range, stock.bars) +
    buildEvents(evsC, plot, o) +
    candles +
    buildTitle({ ...o, title: resolveTitle(o.title, defaultTitle(stock)) });

  return svgWrap(o, body);
}

/**
 * Render a single chart with multiple companies on the same axes.
 * Series are plotted against actual timestamps, so stocks that start at
 * different dates appear at the correct horizontal position. Each line spans
 * only the period its data covers.
 *
 * @param {import('./generator.js').Stock[]} stocks
 * @param {ChartOptions & { mode?: 'price'|'normalized', legend?: boolean }} [options]
 *   `mode` controls how the series are stacked:
 *     - `'price'`      — raw closing prices (good when scales are similar)
 *     - `'normalized'` — each series rebased to 100 at its first bar (default;
 *                        works regardless of price differences)
 *   When `area: true`, each series is also drawn as a translucent gradient
 *   filled down to the chart bottom. The fill is split into per-segment
 *   trapezoids and trapezoids are painted from tallest to shortest *locally*,
 *   so a series that is small in one region but tall in another sits on top
 *   of its neighbours only where it actually is smaller.
 *   Each stock can also carry a `color` field; otherwise a built-in palette is used.
 * @returns {string} SVG document
 */
export function renderMultiLineChart(stocks, options = {}) {
  if (!Array.isArray(stocks) || stocks.length === 0) {
    throw new Error('renderMultiLineChart: stocks must be a non-empty array');
  }
  const o = withEventPadding(resolve(options), options?.events?.length);
  const plot = plotArea(o);
  const mode = options.mode || 'normalized';
  const showLegend = options.legend !== false;
  const showArea = options.area === true;
  const palette = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed', '#0ea5e9', '#ec4899', '#14b8a6'];

  // Build per-series data: time-indexed values, each series may span its own range
  const series = stocks.map((s, i) => {
    if (!s || !Array.isArray(s.bars) || s.bars.length === 0) {
      throw new Error(`renderMultiLineChart: stock at index ${i} has no bars`);
    }
    const closes = s.bars.map((b) => b.close);
    const base = closes[0] || 1;
    const values = mode === 'normalized' ? closes.map((c) => (c / base) * 100) : closes;
    const points = s.bars.map((b, j) => ({ time: b.time, value: values[j] }));
    return {
      stock: s,
      points,
      color: s.color || palette[i % palette.length]
    };
  });

  // Compute a shared time domain (union of every series) and a shared price domain
  let tMin = Infinity;
  let tMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.time < tMin) tMin = p.time;
      if (p.time > tMax) tMax = p.time;
      if (p.value < vMin) vMin = p.value;
      if (p.value > vMax) vMax = p.value;
    }
  }
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const vPad = (vMax - vMin) * 0.05;
  const range = { min: Math.max(0, vMin - vPad), max: vMax + vPad };
  if (tMax === tMin) tMax = tMin + 1;

  function xForTime(time) {
    const t = (time - tMin) / (tMax - tMin);
    return plot.x + t * plot.w;
  }

  // Pre-compute pixel points for each series and the area polygon if needed
  const baseY = plot.y + plot.h;
  for (const s of series) {
    s.pixels = s.points.map((p) => ({
      x: xForTime(p.time),
      y: yAt(plot, p.value, range),
      v: p.value
    }));
  }

  // Painting order for area segments: each pair of adjacent points becomes
  // its own trapezoid, and trapezoids across all series are sorted by their
  // local height (max of the two endpoint values) — biggest first. This way
  // a series that is tall in one region but tiny in another is painted
  // *under* its taller neighbours only where it actually is taller, instead
  // of one global rank deciding for the whole chart.
  let areas = '';
  if (showArea) {
    // One gradient <defs> per series, reused across segments.
    const defs = series
      .map((s, idx) => {
        const id = `mlg-${idx}-${Math.abs(hashString(s.stock.symbol + s.color)).toString(36)}`;
        s.gradientId = id;
        return (
          `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0%" stop-color="${s.color}" stop-opacity="0.45"/>` +
          `<stop offset="100%" stop-color="${s.color}" stop-opacity="0"/>` +
          `</linearGradient>`
        );
      })
      .join('');

    const segments = [];
    for (const s of series) {
      for (let i = 0; i < s.pixels.length - 1; i++) {
        const a = s.pixels[i];
        const b = s.pixels[i + 1];
        // Local height for this segment = the larger of the two endpoint
        // values (in data units, before y-flip). Used purely as a paint
        // order key.
        const height = Math.max(s.points[i].value, s.points[i + 1].value);
        segments.push({ a, b, height, gradientId: s.gradientId });
      }
    }
    // Tallest segments painted first → smaller segments end up on top in the
    // regions where they are smaller. Identical heights keep their original
    // order, which is fine.
    segments.sort((p, q) => q.height - p.height);

    const polys = segments
      .map(({ a, b, gradientId }) =>
        `<polygon points="${a.x.toFixed(2)},${baseY.toFixed(2)} ${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.x.toFixed(2)},${baseY.toFixed(2)}" fill="url(#${gradientId})" stroke="none"/>`
      )
      .join('');

    areas = `<defs>${defs}</defs>${polys}`;
  }

  const lines = series
    .map((s) => {
      const points = s.pixels.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join('');

  // Build a synthetic "bars" array spanning the union, for axis labels
  const axisBars = [];
  const xTicksCount = Math.max(2, Math.floor(o.xTicks || 5));
  for (let i = 0; i < xTicksCount; i++) {
    const t = tMin + (i / (xTicksCount - 1)) * (tMax - tMin);
    axisBars.push({ time: t });
  }

  // Legend at top-right of the plot area — drawn last on a solid background
  // so price lines never pass through the labels.
  let legend = '';
  if (showLegend) {
    const lh = 18;
    const swatchW = 18;
    const gap = 8;
    const padX = 10;
    const padY = 6;
    const charPx = 9; // generous estimate so long symbols never crowd the swatch

    // Size the box to fit the widest symbol
    const maxChars = Math.max(...series.map((s) => String(s.stock.symbol).length));
    const labelPx = maxChars * charPx;
    const boxW = padX + swatchW + gap + labelPx + padX;
    const boxH = padY * 2 + series.length * lh;
    // Top-left of the plot area
    const boxX = plot.x + 4;
    const boxY = plot.y + 4;

    const items = series
      .map((s, i) => {
        const y = boxY + padY + i * lh;
        const safeLabel = escapeXml(s.stock.symbol);
        const swatchX = boxX + padX;
        const textX = swatchX + swatchW + gap;
        return (
          `<line x1="${swatchX}" y1="${y + 7}" x2="${swatchX + swatchW}" y2="${y + 7}" stroke="${s.color}" stroke-width="3" stroke-linecap="round"/>` +
          `<text x="${textX}" y="${y + 11}" text-anchor="start" font-family="system-ui, sans-serif" font-size="13" fill="${o.colors.text}">${safeLabel}</text>`
        );
      })
      .join('');

    legend =
      `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="6" ry="6" fill="${o.colors.bg}" fill-opacity="0.7" stroke="${o.colors.grid}" stroke-width="1"/>` +
      items;
  }

  const xForTimeML = (t) => plot.x + ((t - tMin) / Math.max(1, tMax - tMin)) * plot.w;
  const evsML = resolveEvents(o.events, o, plot, tMin, tMax, xForTimeML);

  const body =
    buildAxes(o, plot, range, axisBars) +
    buildEvents(evsML, plot, o) +
    areas +
    lines +
    legend +
    buildTitle({
      ...o,
      title: resolveTitle(
        o.title,
        mode === 'normalized' ? 'Comparison (rebased to 100)' : 'Comparison'
      )
    });

  return svgWrap(o, body);
}


/**
 * Compute value range from bar.worth values.
 * @param {import('./generator.js').Bar[]} bars
 * @returns {{min:number,max:number}}
 */
function worthRange(bars) {
  let min = Infinity;
  let max = -Infinity;
  for (const b of bars) {
    if (b.worth < min) min = b.worth;
    if (b.worth > max) max = b.worth;
  }
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.05;
  return { min: Math.max(0, min - pad), max: max + pad };
}

/**
 * Assert that every bar has a `worth` field (i.e. sharesOutstanding was set).
 */
function _assertWorth(stock) {
  if (stock.sharesOutstanding == null || stock.bars[0]?.worth == null) {
    throw new Error(
      `valueMode: 'worth' requires sharesOutstanding to be set on the stock. ` +
      `Generate the stock with { sharesOutstanding: <number> }.`
    );
  }
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

/**
 * Render a net worth time series as a line+area chart.
 * @param {import('./generator.js').NetWorth} netWorth
 * @param {ChartOptions} [options]
 * @returns {string} SVG document
 */
export function renderNetWorthChart(netWorth, options) {
  if (!netWorth || !Array.isArray(netWorth.bars) || netWorth.bars.length === 0) {
    throw new Error('renderNetWorthChart: expected a NetWorth object with a non-empty bars array');
  }

  const o = withEventPadding(resolve(options), options?.events?.length);
  const plot = plotArea(o);

  const values = netWorth.bars.map((b) => b.value);
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const v of values) {
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const vPad = (vMax - vMin) * 0.05;
  const range = { min: Math.max(0, vMin - vPad), max: vMax + vPad };

  const n = netWorth.bars.length;
  const tMin = netWorth.bars[0].time;
  const tMax = netWorth.bars[n - 1].time;
  const xForTime = (t) => plot.x + ((t - tMin) / Math.max(1, tMax - tMin)) * plot.w;
  const evs = resolveEvents(o.events, o, plot, tMin, tMax, xForTime);

  // Synthetic axis bars using the actual timestamps
  const axisBars = netWorth.bars;

  const linePoints = netWorth.bars
    .map((b, i) => `${xAt(plot, i, n).toFixed(2)},${yAt(plot, b.value, range).toFixed(2)}`)
    .join(' ');

  const firstX = xAt(plot, 0, n).toFixed(2);
  const lastX = xAt(plot, n - 1, n).toFixed(2);
  const baseY = (plot.y + plot.h).toFixed(2);
  const areaPoints = `${firstX},${baseY} ${linePoints} ${lastX},${baseY}`;

  const defaultLabel = netWorth.name ? `${netWorth.name} — Net Worth` : 'Net Worth';

  const body =
    buildAxes(o, plot, range, axisBars) +
    buildEvents(evs, plot, o) +
    `<polygon points="${areaPoints}" fill="${o.colors.area}" stroke="none"/>` +
    `<polyline points="${linePoints}" fill="none" stroke="${o.colors.line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    buildTitle({ ...o, title: resolveTitle(o.title, defaultLabel) });

  return svgWrap(o, body);
}
