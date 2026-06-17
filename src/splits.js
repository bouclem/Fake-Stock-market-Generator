// Split loading utilities for JSON configs.
// Supports loading splits from JSON files, arrays, or single objects.
// Splits can be specified as { date, split: "3:1" } or { date, ratio: 3 }.

import { readFileSync } from 'node:fs';
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
    display: ratio > 1
      ? `${Math.round(ratio)}:1`
      : `1:${Math.round(1 / ratio)}`,
    type: ratio > 1 ? 'forward' : 'reverse',
    label: entry.label || null
  };
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
    if (!isNode()) {
      throw new Error('loadSplitsSync with file path only works in Node.js');
    }
    const content = readFileSync(source, 'utf-8');
    raw = JSON.parse(content);
  }

  // Handle single object
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

  // Handle single object
  if (!Array.isArray(raw)) {
    if (raw && typeof raw === 'object') {
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
