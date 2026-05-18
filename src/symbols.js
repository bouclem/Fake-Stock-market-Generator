// Symbol generation only.
// The package does not invent company names or sectors — those are the
// caller's responsibility. We only build a random uppercase ticker when the
// user did not provide one.

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Build a unique-ish ticker symbol of 2-5 uppercase letters.
 * The `used` set lets the caller avoid duplicates within a market.
 * @param {{ next: () => number, int: (min: number, max: number) => number }} rng
 * @param {Set<string>} [used]
 * @returns {string}
 */
export function makeSymbol(rng, used) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const length = rng.int(2, 5);
    let s = '';
    for (let i = 0; i < length; i++) s += ALPHA[rng.int(0, 25)];
    if (!used || !used.has(s)) {
      if (used) used.add(s);
      return s;
    }
  }
  // Fallback: append a digit to guarantee uniqueness
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHA[rng.int(0, 25)];
  s += String(rng.int(0, 9));
  if (used) used.add(s);
  return s;
}
