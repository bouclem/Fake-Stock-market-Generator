// Tiny software rasterizer — RGB framebuffer, primitives, Hershey Simplex
// vector font (public domain stroke glyphs, anti-aliased via supersampling).
// Zero dependencies. Used by renderVideoChart to draw video frames.

/** Parse '#rrggbb' | '#rgb' | [r,g,b] into [r,g,b]. */
export function parseColor(c) {
  if (Array.isArray(c)) return [c[0] | 0, c[1] | 0, c[2] | 0];
  if (typeof c === 'number') return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const s = String(c).trim();
  if (s[0] === '#') {
    const h = s.length === 4
      ? s.slice(1).split('').map((x) => x + x).join('')
      : s.slice(1, 7);
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  throw new Error(`parseColor: unrecognized color "${c}"`);
}

// Hershey Simplex vector font — public domain stroke glyphs (95 printable
// ASCII chars). Per glyph: "advance:x1,y1 x2,y2;x3,y3 ..." — strokes are
// separated by ';', each is a polyline of "x,y" points. Baseline y=0,
// cap height 21, descenders go below 0.
const VFONT = {
  " ":"16:",
  "!":"10:5,21 5,7;5,2 4,1 5,0 6,1 5,2",
  "\"":"16:4,21 4,14;12,21 12,14",
  "#":"21:11,25 4,-7;17,25 10,-7;4,12 18,12;3,6 17,6",
  "$":"20:8,25 8,-4;12,25 12,-4;17,18 15,20 12,21 8,21 5,20 3,18 3,16 4,14 5,13 7,12 13,10 15,9 16,8 17,6 17,3 15,1 12,0 8,0 5,1 3,3",
  "%":"24:21,21 3,0;8,21 10,19 10,17 9,15 7,14 5,14 3,16 3,18 4,20 6,21 8,21 10,20 13,19 16,19 19,20 21,21;17,7 15,6 14,4 14,2 16,0 18,0 20,1 21,3 21,5 19,7 17,7",
  "&":"26:23,12 23,13 22,14 21,14 20,13 19,11 17,6 15,3 13,1 11,0 7,0 5,1 4,2 3,4 3,6 4,8 5,9 12,13 13,14 14,16 14,18 13,20 11,21 9,20 8,18 8,16 9,13 11,10 16,3 18,1 20,0 22,0 23,1 23,2",
  "'":"10:5,19 4,20 5,21 6,20 6,18 5,16 4,15",
  "(":"14:11,25 9,23 7,20 5,16 4,11 4,7 5,2 7,-2 9,-5 11,-7",
  ")":"14:3,25 5,23 7,20 9,16 10,11 10,7 9,2 7,-2 5,-5 3,-7",
  "*":"16:8,21 8,9;3,18 13,12;13,18 3,12",
  "+":"26:13,18 13,0;4,9 22,9",
  ",":"10:6,1 5,0 4,1 5,2 6,1 6,-1 5,-3 4,-4",
  "-":"26:4,9 22,9",
  ".":"10:5,2 4,1 5,0 6,1 5,2",
  "/":"22:20,25 2,-7",
  "0":"20:9,21 6,20 4,17 3,12 3,9 4,4 6,1 9,0 11,0 14,1 16,4 17,9 17,12 16,17 14,20 11,21 9,21",
  "1":"20:6,17 8,18 11,21 11,0",
  "2":"20:4,16 4,17 5,19 6,20 8,21 12,21 14,20 15,19 16,17 16,15 15,13 13,10 3,0 17,0",
  "3":"20:5,21 16,21 10,13 13,13 15,12 16,11 17,8 17,6 16,3 14,1 11,0 8,0 5,1 4,2 3,4",
  "4":"20:13,21 3,7 18,7;13,21 13,0",
  "5":"20:15,21 5,21 4,12 5,13 8,14 11,14 14,13 16,11 17,8 17,6 16,3 14,1 11,0 8,0 5,1 4,2 3,4",
  "6":"20:16,18 15,20 12,21 10,21 7,20 5,17 4,12 4,7 5,3 7,1 10,0 11,0 14,1 16,3 17,6 17,7 16,10 14,12 11,13 10,13 7,12 5,10 4,7",
  "7":"20:17,21 7,0;3,21 17,21",
  "8":"20:8,21 5,20 4,18 4,16 5,14 7,13 11,12 14,11 16,9 17,7 17,4 16,2 15,1 12,0 8,0 5,1 4,2 3,4 3,7 4,9 6,11 9,12 13,13 15,14 16,16 16,18 15,20 12,21 8,21",
  "9":"20:16,14 15,11 13,9 10,8 9,8 6,9 4,11 3,14 3,15 4,18 6,20 9,21 10,21 13,20 15,18 16,14 16,9 15,4 13,1 10,0 8,0 5,1 4,3",
  ":":"10:5,14 4,13 5,12 6,13 5,14;5,2 4,1 5,0 6,1 5,2",
  ";":"10:5,14 4,13 5,12 6,13 5,14;6,1 5,0 4,1 5,2 6,1 6,-1 5,-3 4,-4",
  "<":"24:20,18 4,9 20,0",
  "=":"26:4,12 22,12;4,6 22,6",
  ">":"24:4,18 20,9 4,0",
  "?":"18:3,16 3,17 4,19 5,20 7,21 11,21 13,20 14,19 15,17 15,15 14,13 13,12 9,10 9,7;9,2 8,1 9,0 10,1 9,2",
  "@":"27:18,13 17,15 15,16 12,16 10,15 9,14 8,11 8,8 9,6 11,5 14,5 16,6 17,8;12,16 10,14 9,11 9,8 10,6 11,5;18,16 17,8 17,6 19,5 21,5 23,7 24,10 24,12 23,15 22,17 20,19 18,20 15,21 12,21 9,20 7,19 5,17 4,15 3,12 3,9 4,6 5,4 7,2 9,1 12,0 15,0 18,1 20,2 21,3;19,16 18,8 18,6 19,5",
  "A":"18:9,21 1,0;9,21 17,0;4,7 14,7",
  "B":"21:4,21 4,0;4,21 13,21 16,20 17,19 18,17 18,15 17,13 16,12 13,11;4,11 13,11 16,10 17,9 18,7 18,4 17,2 16,1 13,0 4,0",
  "C":"21:18,16 17,18 15,20 13,21 9,21 7,20 5,18 4,16 3,13 3,8 4,5 5,3 7,1 9,0 13,0 15,1 17,3 18,5",
  "D":"21:4,21 4,0;4,21 11,21 14,20 16,18 17,16 18,13 18,8 17,5 16,3 14,1 11,0 4,0",
  "E":"19:4,21 4,0;4,21 17,21;4,11 12,11;4,0 17,0",
  "F":"18:4,21 4,0;4,21 17,21;4,11 12,11",
  "G":"21:18,16 17,18 15,20 13,21 9,21 7,20 5,18 4,16 3,13 3,8 4,5 5,3 7,1 9,0 13,0 15,1 17,3 18,5 18,8;13,8 18,8",
  "H":"22:4,21 4,0;18,21 18,0;4,11 18,11",
  "I":"8:4,21 4,0",
  "J":"16:12,21 12,5 11,2 10,1 8,0 6,0 4,1 3,2 2,5 2,7",
  "K":"21:4,21 4,0;18,21 4,7;9,12 18,0",
  "L":"17:4,21 4,0;4,0 16,0",
  "M":"24:4,21 4,0;4,21 12,0;20,21 12,0;20,21 20,0",
  "N":"22:4,21 4,0;4,21 18,0;18,21 18,0",
  "O":"22:9,21 7,20 5,18 4,16 3,13 3,8 4,5 5,3 7,1 9,0 13,0 15,1 17,3 18,5 19,8 19,13 18,16 17,18 15,20 13,21 9,21",
  "P":"21:4,21 4,0;4,21 13,21 16,20 17,19 18,17 18,14 17,12 16,11 13,10 4,10",
  "Q":"22:9,21 7,20 5,18 4,16 3,13 3,8 4,5 5,3 7,1 9,0 13,0 15,1 17,3 18,5 19,8 19,13 18,16 17,18 15,20 13,21 9,21;12,4 18,-2",
  "R":"21:4,21 4,0;4,21 13,21 16,20 17,19 18,17 18,15 17,13 16,12 13,11 4,11;11,11 18,0",
  "S":"20:17,18 15,20 12,21 8,21 5,20 3,18 3,16 4,14 5,13 7,12 13,10 15,9 16,8 17,6 17,3 15,1 12,0 8,0 5,1 3,3",
  "T":"16:8,21 8,0;1,21 15,21",
  "U":"22:4,21 4,6 5,3 7,1 10,0 12,0 15,1 17,3 18,6 18,21",
  "V":"18:1,21 9,0;17,21 9,0",
  "W":"24:2,21 7,0;12,21 7,0;12,21 17,0;22,21 17,0",
  "X":"20:3,21 17,0;17,21 3,0",
  "Y":"18:1,21 9,11 9,0;17,21 9,11",
  "Z":"20:17,21 3,0;3,21 17,21;3,0 17,0",
  "[":"14:4,25 4,-7;5,25 5,-7;4,25 11,25;4,-7 11,-7",
  "\\":"14:0,21 14,-3",
  "]":"14:9,25 9,-7;10,25 10,-7;3,25 10,25;3,-7 10,-7",
  "^":"16:6,15 8,18 10,15;3,12 8,17 13,12;8,17 8,0",
  "_":"16:0,-2 16,-2",
  "`":"10:6,21 5,20 4,18 4,16 5,15 6,16 5,17",
  "a":"19:15,14 15,0;15,11 13,13 11,14 8,14 6,13 4,11 3,8 3,6 4,3 6,1 8,0 11,0 13,1 15,3",
  "b":"19:4,21 4,0;4,11 6,13 8,14 11,14 13,13 15,11 16,8 16,6 15,3 13,1 11,0 8,0 6,1 4,3",
  "c":"18:15,11 13,13 11,14 8,14 6,13 4,11 3,8 3,6 4,3 6,1 8,0 11,0 13,1 15,3",
  "d":"19:15,21 15,0;15,11 13,13 11,14 8,14 6,13 4,11 3,8 3,6 4,3 6,1 8,0 11,0 13,1 15,3",
  "e":"18:3,8 15,8 15,10 14,12 13,13 11,14 8,14 6,13 4,11 3,8 3,6 4,3 6,1 8,0 11,0 13,1 15,3",
  "f":"12:10,21 8,21 6,20 5,17 5,0;2,14 9,14",
  "g":"19:15,14 15,-2 14,-5 13,-6 11,-7 8,-7 6,-6;15,11 13,13 11,14 8,14 6,13 4,11 3,8 3,6 4,3 6,1 8,0 11,0 13,1 15,3",
  "h":"19:4,21 4,0;4,10 7,13 9,14 12,14 14,13 15,10 15,0",
  "i":"8:3,21 4,20 5,21 4,22 3,21;4,14 4,0",
  "j":"10:5,21 6,20 7,21 6,22 5,21;6,14 6,-3 5,-6 3,-7 1,-7",
  "k":"17:4,21 4,0;14,14 4,4;8,8 15,0",
  "l":"8:4,21 4,0",
  "m":"30:4,14 4,0;4,10 7,13 9,14 12,14 14,13 15,10 15,0;15,10 18,13 20,14 23,14 25,13 26,10 26,0",
  "n":"19:4,14 4,0;4,10 7,13 9,14 12,14 14,13 15,10 15,0",
  "o":"19:8,14 6,13 4,11 3,8 3,6 4,3 6,1 8,0 11,0 13,1 15,3 16,6 16,8 15,11 13,13 11,14 8,14",
  "p":"19:4,14 4,-7;4,11 6,13 8,14 11,14 13,13 15,11 16,8 16,6 15,3 13,1 11,0 8,0 6,1 4,3",
  "q":"19:15,14 15,-7;15,11 13,13 11,14 8,14 6,13 4,11 3,8 3,6 4,3 6,1 8,0 11,0 13,1 15,3",
  "r":"13:4,14 4,0;4,8 5,11 7,13 9,14 12,14",
  "s":"17:14,11 13,13 10,14 7,14 4,13 3,11 4,9 6,8 11,7 13,6 14,4 14,3 13,1 10,0 7,0 4,1 3,3",
  "t":"12:5,21 5,4 6,1 8,0 10,0;2,14 9,14",
  "u":"19:4,14 4,4 5,1 7,0 10,0 12,1 15,4;15,14 15,0",
  "v":"16:2,14 8,0;14,14 8,0",
  "w":"22:3,14 7,0;11,14 7,0;11,14 15,0;19,14 15,0",
  "x":"17:3,14 14,0;14,14 3,0",
  "y":"16:2,14 8,0;14,14 8,0 6,-4 4,-6 2,-7 1,-7",
  "z":"17:14,14 3,0;3,14 14,14;3,0 14,0",
  "{":"14:9,25 7,24 6,23 5,21 5,19 6,17 7,16 8,14 8,12 6,10;7,24 6,22 6,20 7,18 8,17 9,15 9,13 8,11 4,9 8,7 9,5 9,3 8,1 7,0 6,-2 6,-4 7,-6;6,8 8,6 8,4 7,2 6,1 5,-1 5,-3 6,-5 7,-6 9,-7",
  "|":"8:4,25 4,-7",
  "}":"14:5,25 7,24 8,23 9,21 9,19 8,17 7,16 6,14 6,12 8,10;7,24 8,22 8,20 7,18 6,17 5,15 5,13 6,11 10,9 6,7 5,5 5,3 6,1 7,0 8,-2 8,-4 7,-6;8,8 6,6 6,4 7,2 8,1 9,-1 9,-3 8,-5 7,-6 5,-7",
  "~":"24:3,6 3,8 4,11 6,12 8,12 10,11 14,8 16,7 18,7 20,8 21,10;3,8 4,10 6,11 8,11 10,10 14,7 16,6 18,6 20,7 21,10 21,12"
};

// Lazily parsed glyph cache: char -> { w, strokes: [[[x,y],...],...] }
const _glyphs = new Map();
function glyph(ch) {
  let g = _glyphs.get(ch);
  if (g === undefined) {
    const raw = VFONT[ch];
    g = null;
    if (raw) {
      const wi = raw.indexOf(':');
      g = {
        w: +raw.slice(0, wi),
        strokes: raw.slice(wi + 1).split(';').filter(Boolean).map(
          (s) => s.split(' ').map((p) => p.split(',').map(Number))
        )
      };
    }
    _glyphs.set(ch, g);
  }
  return g;
}
const UNKNOWN_ADVANCE = 16;

class Framebuffer {
  /** @param {number} width @param {number} height */
  constructor(width, height) {
    this.width = width | 0;
    this.height = height | 0;
    this.data = new Uint8ClampedArray(this.width * this.height * 3);
  }

  fill(color) {
    const [r, g, b] = parseColor(color);
    const d = this.data;
    for (let i = 0; i < d.length; i += 3) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    return this;
  }

  set(x, y, color) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return this;
    const [r, g, b] = parseColor(color);
    const i = (y * this.width + x) * 3;
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b;
    return this;
  }

  fillRect(x, y, w, h, color, alpha = 1) {
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + w)), y1 = Math.min(this.height, Math.round(y + h));
    const [r, g, b] = parseColor(color);
    const d = this.data, W = this.width;
    if (alpha >= 1) {
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * W + x0) * 3;
        for (let xx = x0; xx < x1; xx++) {
          d[i] = r; d[i + 1] = g; d[i + 2] = b; i += 3;
        }
      }
    } else {
      const a = Math.max(0, alpha), ia = 1 - a;
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * W + x0) * 3;
        for (let xx = x0; xx < x1; xx++) {
          d[i] = r * a + d[i] * ia;
          d[i + 1] = g * a + d[i + 1] * ia;
          d[i + 2] = b * a + d[i + 2] * ia;
          i += 3;
        }
      }
    }
    return this;
  }

  rect(x, y, w, h, color) {
    this.line(x, y, x + w - 1, y, color, 1);
    this.line(x, y + h - 1, x + w - 1, y + h - 1, color, 1);
    this.line(x, y, x, y + h - 1, color, 1);
    this.line(x + w - 1, y, x + w - 1, y + h - 1, color, 1);
    return this;
  }

  /** Bresenham line with square thickness. */
  line(x0, y0, x1, y1, color, thickness = 1) {
    const c = parseColor(color);
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    const half = (thickness - 1) / 2;
    const t = Math.max(0, Math.round(thickness - 1));
    while (true) {
      if (t > 0) {
        this.fillRect(x0 - Math.floor(half), y0 - Math.floor(half), t + 1, t + 1, c);
      } else {
        this.set(x0, y0, c);
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  polyline(pts, color, thickness = 1) {
    for (let i = 0; i < pts.length - 1; i++) {
      this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], color, thickness);
    }
    return this;
  }

  /** Scanline polygon fill. pts: [[x,y],...] */
  fillPoly(pts, color) {
    const c = parseColor(color);
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    for (let y = Math.max(0, Math.ceil(minY)); y <= Math.min(this.height - 1, Math.floor(maxY)); y++) {
      const xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
          xs.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        this.fillRect(Math.ceil(xs[k]), y, Math.floor(xs[k + 1]) - Math.ceil(xs[k]) + 1, 1, c);
      }
    }
    return this;
  }

  circle(cx, cy, r, color) {
    const c = parseColor(color);
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(r * r - y * y));
      this.fillRect(cx - w, cy + y, 2 * w + 1, 1, c);
    }
    return this;
  }

  /** Draw text with the vector font. scale 1 ≈ 10px cap height. */
  text(x, y, str, color, scale = 1) {
    const u = scale * 0.5;
    const thick = Math.max(1, Math.round(scale * 1.2));
    let cx = x;
    for (const ch of String(str)) {
      const g = glyph(ch);
      if (g) {
        for (const stroke of g.strokes) {
          const pts = stroke.map(([vx, vy]) => [cx + vx * u, y + (21 - vy) * u]);
          if (pts.length === 1) this.circle(pts[0][0], pts[0][1], Math.max(1, thick / 2), color);
          else this.polyline(pts, color, thick);
        }
      }
      cx += ((g ? g.w : UNKNOWN_ADVANCE) + 2) * u;
    }
    return this;
  }

  textWidth(str, scale = 1) {
    const u = scale * 0.5;
    let w = 0;
    for (const ch of String(str)) {
      const g = glyph(ch);
      w += (g ? g.w : UNKNOWN_ADVANCE) + 2;
    }
    return Math.max(0, w - 2) * u;
  }

  textRight(xRight, y, str, color, scale = 1) {
    return this.text(xRight - this.textWidth(str, scale), y, str, color, scale);
  }
}

export { Framebuffer };
