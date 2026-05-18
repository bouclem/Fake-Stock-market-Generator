// Seeded pseudo-random number generator.
// Mulberry32 is small, fast and good enough for fake data.
// Reference: https://stackoverflow.com/a/47593316

/**
 * Hash a string seed into a 32-bit integer.
 * @param {string} str
 * @returns {number}
 */
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Create a seeded random generator.
 * @param {number|string|undefined} seed
 * @returns {{ next: () => number, int: (min: number, max: number) => number, gauss: () => number, pick: <T>(arr: T[]) => T }}
 */
export function createRng(seed) {
  let state;
  if (seed === undefined || seed === null) {
    state = (Math.random() * 2 ** 32) >>> 0;
  } else if (typeof seed === 'number') {
    state = seed >>> 0;
  } else {
    state = hashSeed(String(seed));
  }

  // Mulberry32 — uniform [0, 1)
  function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Integer in [min, max] inclusive
  function int(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  // Standard normal via Box-Muller. Cached pair to avoid wasting samples.
  let cached = null;
  function gauss() {
    if (cached !== null) {
      const v = cached;
      cached = null;
      return v;
    }
    let u1 = next();
    let u2 = next();
    // Avoid log(0)
    if (u1 < 1e-12) u1 = 1e-12;
    const mag = Math.sqrt(-2 * Math.log(u1));
    const z0 = mag * Math.cos(2 * Math.PI * u2);
    const z1 = mag * Math.sin(2 * Math.PI * u2);
    cached = z1;
    return z0;
  }

  function pick(arr) {
    return arr[int(0, arr.length - 1)];
  }

  return { next, int, gauss, pick };
}
