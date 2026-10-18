// VideoChart — animated financial charts rendered to a real H.264 .mp4.
//
// A progressive line graph of company valuations (market cap = close ×
// sharesOutstanding) that draws as time advances, plus a dynamic horizontal
// bar ranking in the bottom-right corner that reorders and resizes in sync.
//
// Requires the optional dependency `h264-mp4-encoder` (WASM — no native build):
//   npm install h264-mp4-encoder

import { Framebuffer } from './framebuf.js';
import { formatHumanNumber } from './numeric.js';

const VIDEO_THEMES = {
  light: {
    bg: '#ffffff', grid: '#e5e7eb', axis: '#9ca3af',
    text: '#111827', subtext: '#6b7280', panel: '#f3f4f6', border: '#d1d5db'
  },
  dark: {
    bg: '#0b0f19', grid: '#1f2937', axis: '#6b7280',
    text: '#f9fafb', subtext: '#9ca3af', panel: '#111827', border: '#374151'
  }
};
const VIDEO_PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed', '#0ea5e9', '#ec4899', '#14b8a6'];

const VIDEO_DEFAULTS = {
  width: 1280,
  height: 720,          // even numbers required by yuv420
  fps: 30,
  seconds: 10,
  theme: 'dark',
  title: 'Market Cap',
  maxRanked: 10,        // rows shown in the ranking panel
  quality: 20,          // H.264 quantizer 1..51, lower = better
  supersample: 2,       // draw at N× then downsample (anti-aliasing), 1..4
  kbps: null            // optional bitrate override (kbit/s)
};

/**
 * Render an animated valuation chart video.
 *
 * @param {object[]} stocks - generated Stock objects. Every stock MUST carry
 *   `sharesOutstanding` so each bar has `worth` (close × sharesOutstanding).
 *   Only these companies appear in the ranking — nothing else is added.
 * @param {object} [options]
 * @param {number} [options.width=1280]  - frame width (snapped to even)
 * @param {number} [options.height=720]  - frame height (snapped to even)
 * @param {number} [options.fps=30]      - frames per second
 * @param {number} [options.seconds=10]  - video duration
 * @param {'light'|'dark'} [options.theme='dark']
 * @param {string} [options.title='Market Cap']
 * @param {object} [options.colors]      - override theme colors
 * @param {number} [options.maxRanked=10] - rows in the ranking panel
 * @param {number} [options.quality=20]  - H.264 quantizer (lower = better)
 * @param {number} [options.supersample=2] - draw at N× resolution then
 *   downsample for anti-aliased edges (1 = off, 4 = max)
 * @param {number} [options.kbps]        - optional bitrate override
 * @returns {Promise<Uint8Array>} the .mp4 file bytes — Buffer in Node,
 *   Uint8Array in the browser. Write to disk or upload.
 */
export async function renderVideoChart(stocks, options = {}) {
  const o = { ...VIDEO_DEFAULTS, ...options };
  o.width &= ~1;
  o.height &= ~1;
  const series = validateStocks(stocks, o);

  const { tMin, tMax, maxWorth } = globalRange(series);
  const frameCount = Math.max(2, Math.round(o.seconds * o.fps));

  const enc = await createEncoder(o);
  const ss = Math.max(1, Math.min(4, o.supersample | 0) || 1);
  const rgba = new Uint8Array(o.width * o.height * 4);
  const fb = new Framebuffer(o.width * ss, o.height * ss);

  for (let k = 0; k < frameCount; k++) {
    const curT = tMin + ((tMax - tMin) * k) / (frameCount - 1);
    drawFrame(fb, series, o, curT, tMin, tMax, maxWorth, ss);
    downsample(fb.data, rgba, o.width, o.height, ss);
    enc.addFrameRgba(rgba);
  }
  enc.finalize();
  const bytes = enc.FS.readFile(enc.outputFilename);
  enc.FS.unlink(enc.outputFilename);
  // Buffer in Node, plain Uint8Array in the browser bundle.
  return typeof Buffer !== 'undefined' ? Buffer.from(bytes) : bytes;
}

// ── validation & data helpers ───────────────────────────────────────

function validateStocks(stocks, o) {
  if (!Array.isArray(stocks) || stocks.length === 0) {
    throw new Error('renderVideoChart: stocks must be a non-empty array');
  }
  return stocks.map((s, i) => {
    if (!s || !Array.isArray(s.bars) || s.bars.length === 0) {
      throw new Error(`renderVideoChart: stocks[${i}] has no bars`);
    }
    if (!s.bars.every((b) => Number.isFinite(b.worth))) {
      throw new Error(
        `renderVideoChart: VideoChart supports company valuations only — ` +
        `stocks[${i}] (${s.symbol || '?'}) is missing 'worth' on one or more bars. ` +
        `Generate it with sharesOutstanding so worth = close × sharesOutstanding.`
      );
    }
    return {
      symbol: s.symbol || `S${i + 1}`,
      color: s.color || VIDEO_PALETTE[i % VIDEO_PALETTE.length],
      bars: s.bars.slice().sort((a, b) => a.time - b.time)
    };
  });
}

function globalRange(series) {
  let tMin = Infinity, tMax = -Infinity, maxWorth = 0;
  for (const s of series) {
    tMin = Math.min(tMin, s.bars[0].time);
    tMax = Math.max(tMax, s.bars[s.bars.length - 1].time);
    for (const b of s.bars) if (b.worth > maxWorth) maxWorth = b.worth;
  }
  return { tMin, tMax, maxWorth };
}

/** Interpolated worth at time t (linear between adjacent bars). */
function worthAt(bars, t) {
  if (t < bars[0].time) return null;
  let lo = 0, hi = bars.length - 1;
  if (t >= bars[hi].time) return bars[hi].worth;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].time <= t) lo = mid; else hi = mid;
  }
  const a = bars[lo], b = bars[hi];
  const f = (t - a.time) / (b.time - a.time);
  return a.worth + f * (b.worth - a.worth);
}

async function createEncoder(o) {
  let mod;
  try {
    mod = await import('h264-mp4-encoder');
  } catch {
    throw new Error(
      "renderVideoChart requires the optional dependency 'h264-mp4-encoder' " +
      '(a WASM H.264 encoder — no native build). Install it with:\n' +
      '  npm install h264-mp4-encoder'
    );
  }
  const HME = mod.default ?? mod;
  const enc = await HME.createH264MP4Encoder();
  enc.width = o.width;
  enc.height = o.height;
  enc.frameRate = o.fps;
  enc.quantizationParameter = Math.max(1, Math.min(51, o.quality | 0));
  if (o.kbps != null) enc.kbps = o.kbps;
  enc.speed = 10;
  enc.initialize();
  return enc;
}

// ── frame drawing ───────────────────────────────────────────────────

/** Box-average the ss×supersampled RGB buffer down to w×h RGBA. */
function downsample(src, dst, w, h, ss) {
  const sw = w * ss, n = ss * ss;
  let j = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < ss; dy++) {
        let i = ((y * ss + dy) * sw + x * ss) * 3;
        for (let dx = 0; dx < ss; dx++) {
          r += src[i]; g += src[i + 1]; b += src[i + 2]; i += 3;
        }
      }
      dst[j] = r / n; dst[j + 1] = g / n; dst[j + 2] = b / n; dst[j + 3] = 255;
      j += 4;
    }
  }
}

function drawFrame(fb, series, o, curT, tMin, tMax, maxWorth, s = 1) {
  const c = { ...(VIDEO_THEMES[o.theme] || VIDEO_THEMES.dark), ...(o.colors || {}) };
  const k = (v) => v * s;

  // dynamic y-scale: highest worth seen so far (+8% headroom) — grows
  // as valuations grow but never shrinks back
  let curMax = 0;
  for (const sr of series) {
    for (const b of sr.bars) {
      if (b.time > curT) break;
      if (b.worth > curMax) curMax = b.worth;
    }
    const tip = worthAt(sr.bars, curT);
    if (tip != null && tip > curMax) curMax = tip;
  }
  const yMax = (curMax || maxWorth) * 1.08;

  // left margin sized for the widest possible label so it never clips —
  // "$999.9M" is the worst case (millions need more chars than billions)
  const leftPad = k(8) + fb.textWidth('$999.9M', s) + k(4);
  const plot = { x: leftPad, y: k(44), w: fb.width - leftPad - k(16), h: fb.height - k(74) };
  fb.fill(c.bg);

  if (o.title) fb.text(k(12), k(12), o.title, c.text, 2 * s);
  const date = fmtVideoDate(curT);
  fb.textRight(fb.width - k(12), k(16), date, c.subtext, 2 * s);

  drawAxes(fb, plot, c, yMax, tMin, tMax, s);
  const xOf = (t) => plot.x + ((t - tMin) / (tMax - tMin)) * plot.w;
  const yOf = (v) => plot.y + plot.h - (v / yMax) * plot.h;

  // series lines up to the time cursor
  for (const sr of series) {
    const pts = [];
    for (const b of sr.bars) {
      if (b.time > curT) break;
      pts.push([xOf(b.time), yOf(b.worth)]);
    }
    const tip = worthAt(sr.bars, curT);
    if (tip == null) continue;
    pts.push([xOf(curT), yOf(tip)]);
    if (pts.length > 1) fb.polyline(pts, sr.color, k(2));
    const [tx, ty] = pts[pts.length - 1];
    fb.circle(tx, ty, k(3), sr.color);
    // flip the ticker to the left of the dot when it would leave the frame
    const tw = fb.textWidth(sr.symbol, s);
    const lx = tx + k(8) + tw <= fb.width - k(2) ? tx + k(8) : tx - k(8) - tw;
    fb.text(lx, Math.max(k(2), ty - k(6)), sr.symbol, sr.color, s);
  }

  // time cursor
  const cx = xOf(curT);
  fb.line(cx, plot.y, cx, plot.y + plot.h, c.axis, s);

  drawRanking(fb, series, o, curT, yMax, c, plot, s);
}

function drawAxes(fb, plot, c, maxWorth, tMin, tMax, s) {
  const k = (v) => v * s;
  // y grid + labels
  for (let i = 0; i <= 4; i++) {
    const v = (maxWorth * i) / 4;
    const y = plot.y + plot.h - (plot.h * i) / 4;
    fb.line(plot.x, y, plot.x + plot.w, y, c.grid, s);
    fb.textRight(plot.x - k(6), y - k(3), fmtWorth(v), c.subtext, s);
  }
  // x tick labels (~5 evenly spaced dates, skipped when they'd overlap)
  let prevLabelRight = -Infinity;
  for (let i = 0; i <= 4; i++) {
    const t = tMin + ((tMax - tMin) * i) / 4;
    const x = plot.x + (plot.w * i) / 4;
    fb.line(x, plot.y + plot.h, x, plot.y + plot.h + k(3), c.axis, s);
    const lbl = fmtVideoDate(t);
    const lx = Math.min(Math.max(k(2), x - k(15)), plot.x + plot.w - fb.textWidth(lbl, s));
    if (lx < prevLabelRight + k(8)) continue;
    fb.text(lx, plot.y + plot.h + k(8), lbl, c.subtext, s);
    prevLabelRight = lx + fb.textWidth(lbl, s);
  }
  fb.rect(plot.x, plot.y, plot.w, plot.h, c.grid);
}

function drawRanking(fb, series, o, curT, maxWorth, c, plot, s) {
  const k = (v) => v * s;
  const rows = series
    .map((sr) => ({ sr, w: worthAt(sr.bars, curT) }))
    .filter((r) => r.w != null)
    .sort((a, b) => b.w - a.w)
    .slice(0, Math.max(1, o.maxRanked));
  if (rows.length === 0) return;

  const rowH = k(16), pad = k(8);
  const pw = Math.min(k(300), Math.round(plot.w * 0.4));
  const ph = pad * 2 + k(12) + rows.length * rowH;
  const px = plot.x + plot.w - pw - k(6);
  const py = plot.y + plot.h - ph - k(6);
  // columns sized from the actual text so nothing can overflow
  const symCol = Math.max(...rows.map(({ sr }, i) => fb.textWidth(`${i + 1} ${sr.symbol}`, s))) + k(10);
  const valW = Math.max(...rows.map(({ w }) => fb.textWidth(fmtWorth(w), s))) + k(8);
  const barMax = Math.max(k(10), pw - pad * 2 - symCol - valW);

  // translucent so chart lines remain visible behind the panel
  fb.fillRect(px, py, pw, ph, c.panel, 0.78);
  fb.rect(px, py, pw, ph, c.border);
  fb.text(px + pad, py + k(5), 'RANK', c.subtext, s);

  rows.forEach(({ sr, w }, i) => {
    const y = py + k(12) + pad + i * rowH;
    const bw = Math.max(1, (w / maxWorth) * barMax);
    fb.text(px + pad, y + k(4), `${i + 1} ${sr.symbol}`, c.text, s);
    fb.fillRect(px + pad + symCol, y + k(2), bw, rowH - k(6), sr.color);
    fb.textRight(px + pw - pad, y + k(4), fmtWorth(w), c.text, s);
  });
}

function fmtWorth(v) {
  return '$' + formatHumanNumber(Math.round(v));
}
function fmtVideoDate(t) {
  const d = new Date(t);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}
