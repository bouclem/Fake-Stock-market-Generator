// Split loading utilities for JSON configs.
// Supports loading splits from JSON files, arrays, or single objects.
// Splits can be specified as { date, split: "3:1" } or { date, ratio: 3 }.

import { parseSplitRatio, applySplit } from './generator.js';

/**
 * @typedef {Object} SplitDef
 * @property {string} date - ISO date string (YYYY-MM-DD)
 * @property {string|number} [split] - Split ratio in "X:Y" format (e.g., "3:1", "1:2")
 * @property {number} [ratio] - Numeric ratio (alternative to split)
 * @property {string} [label] - Optional label for the split
 */

function isNode() {
  return typeof process !== 'undefined' && process.versions && process.versions.node;
}

function displayRatio(ratio) {
  // Print the exact ratio instead of rounding to integers, so 1.5 shows
  // as "1.5:1" and 0.4 as "1:2.5" rather than the misleading "2:1" / "1:3".
  return ratio > 1
    ? `${parseFloat(ratio.toFixed(4))}:1`
    : `1:${parseFloat((1 / ratio).toFixed(4))}`;
}

function normalizeSplitEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  // Support both { date, split: "3:1" } and { date, ratio: 3 } formats
  const ratio = entry.split != null
    ? parseSplitRatio(entry.split)
    : entry.ratio;

  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return null;
  if (!entry.date) return null;

  return {
    date: String(entry.date),
    ratio,
    display: displayRatio(ratio),
    type: ratio > 1 ? 'forward' : 'reverse',
    label: entry.label || null
  };
}

// Shared post-load normalization for both the sync and async loaders.
function normalizeSplits(raw) {
  if (!Array.isArray(raw)) {
    if (raw && typeof raw === 'object') {
      // Could be an envelope { splits: [...] } or a single split
      if (Array.isArray(raw.splits)) {
        raw = raw.splits;
      } else if (raw.date) {
        raw = [raw];
      } else {
        return [];
      }
    } else {
      return [];
    }
  }
  return raw.map(normalizeSplitEntry).filter(Boolean);
}

/**
 * Load and normalize splits from various sources.
 * Supports: array of split objects, single split object, JSON file path, or JSON envelope.
 *
 * @param {string|SplitDef|SplitDef[]} source - JSON file path, split object, or array
 * @returns {SplitDef[]} Normalized split definitions
 * @example
 * loadSplitsSync('./splits.json')
 * loadSplitsSync([{ date: '2024-06-15', split: '2:1' }])
 * loadSplitsSync({ date: '2024-06-15', ratio: 3 })
 */
export function loadSplitsSync(source) {
  if (!source) return [];

  let raw = source;

  // If it's a string, treat as JSON file path
  if (typeof source === 'string') {
    if (!_readFileSync) {
      throw new Error('loadSplitsSync: filesystem access is not available in this environment (browser?)');
    }
    let content;
    try {
      content = _readFileSync(source, 'utf-8');
    } catch (err) {
      throw new Error(`loadSplitsSync: could not read "${source}": ${err.message}`);
    }
    raw = JSON.parse(content);
  }

  return normalizeSplits(raw);
}

/**
 * Async version of loadSplitsSync.
 * Supports the same sources but works in both Node and browser with file input.
 *
 * @param {string|SplitDef|SplitDef[]} source
 * @returns {Promise<SplitDef[]>}
 */
export async function loadSplits(source) {
  if (!source) return [];

  let raw = source;

  // If it's a string, treat as JSON file path or fetch URL
  if (typeof source === 'string') {
    if (isNode()) {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(source, 'utf-8');
      raw = JSON.parse(content);
    } else {
      // Browser: fetch
      const res = await fetch(source);
      raw = await res.json();
    }
  }

  return normalizeSplits(raw);
}

/**
 * Apply multiple splits to a data object in order.
 * Splits are applied chronologically (sorted by date before applying).
 *
 * @param {Object} data - Object with bars array (Stock, NetWorth, etc.)
 * @param {SplitDef[]} splits - Array of split definitions
 * @returns {Object} New object with all splits applied
 * @example
 * const splits = loadSplitsSync([
 *   { date: '2024-03-15', split: '2:1' },
 *   { date: '2024-09-20', split: '3:1' }
 * ]);
 * const adjusted = applySplits(stock, splits);
 */
export function applySplits(data, splits) {
  if (!splits || splits.length === 0) return data;

  // Sort by date ascending
  const sorted = [...splits].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Apply each split in order, updating the data each time
  return sorted.reduce((current, split) => {
    return applySplit(current, split.date, split.ratio);
  }, data);
}

let _readFileSync = null;
try {
  // Top-level try so bundlers can tree-shake. Only resolves in Node.js.
  _readFileSync = (await import('node:fs')).readFileSync;
} catch (_) {
  // Browser environment — file reading is not available.
}
