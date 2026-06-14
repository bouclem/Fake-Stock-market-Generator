// Event loading helper.
//
// loadEvents(source) normalises the `events` option accepted by all chart
// renderers. It handles three cases:
//
//   1. Already an array  -> returned as-is
//   2. A string ending in ".json" -> read from filesystem (Node only) and parsed
//   3. A plain object    -> wrapped in an array (single event shorthand)
//
// In a browser bundle the fs path is never hit because no string argument
// ending in ".json" would make sense there. Callers that only run in Node can
// safely use this helper to load event lists from separate files, keeping them
// decoupled from the price data.

/**
 * @typedef {import('./svg.js').ChartEvent} ChartEvent
 */

/**
 * Normalise an events source into a flat `ChartEvent[]`.
 *
 * Accepted inputs:
 * - `ChartEvent[]`                 — returned as-is
 * - `string` ending with `.json`   — path read from disk (Node.js only)
 * - plain `object`                 — treated as a single event, wrapped in array
 * - `null` / `undefined`           — returns `[]`
 *
 * The JSON file must contain either a single `ChartEvent` object or an array
 * of them. A top-level `{ name, events }` envelope is also accepted, so you can
 * give the file a human-readable name while keeping the events array inside:
 *
 * ```json
 * {
 *   "name": "NOVA milestones",
 *   "events": [
 *     { "date": "2024-03-15", "label": "Q4 Earnings", "color": "#f59e0b" },
 *     { "date": "2024-07-01", "label": "2-for-1 Split" }
 *   ]
 * }
 * ```
 *
 * This is a synchronous function. In Node.js it reads the file with
 * `readFileSync`. In a browser bundle, only array/object inputs are supported
 * (string paths would throw at runtime, which is expected).
 *
 * @param {ChartEvent[] | string | object | null | undefined} source
 * @returns {ChartEvent[]}
 */
export function loadEvents(source) {
  return loadEventsSync(source);
}

/**
 * Synchronous variant — preferred in Node.js contexts where you don't want
 * async/await. Identical to loadEvents() but the file read is sync.
 *
 * @param {ChartEvent[] | string | object | null | undefined} source
 * @returns {ChartEvent[]}
 */
export function loadEventsSync(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;

  if (typeof source === 'string') {
    if (!source.endsWith('.json')) {
      throw new Error(
        `loadEventsSync: string argument must be a path ending in ".json", got "${source}"`
      );
    }
    if (!_fsReadFileSync) {
      throw new Error('loadEventsSync: filesystem access is not available in this environment (browser?)');
    }
    let raw;
    try {
      raw = _fsReadFileSync(source, 'utf8');
    } catch (err) {
      throw new Error(`loadEventsSync: could not read "${source}": ${err.message}`);
    }
    return _parseEventsJson(raw, source);
  }

  if (typeof source === 'object') {
    if (Array.isArray(source.events)) return source.events;
    return [source];
  }

  throw new Error(`loadEventsSync: unsupported source type "${typeof source}"`);
}

function _parseEventsJson(raw, filePath) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`loadEvents: invalid JSON in "${filePath}": ${err.message}`);
  }

  // Envelope: { name?: string, events: [...] }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (Array.isArray(parsed.events)) return parsed.events;
    // Single event object in the file
    return [parsed];
  }

  if (Array.isArray(parsed)) return parsed;

  throw new Error(
    `loadEvents: JSON in "${filePath}" must be an array of events or an envelope object with an "events" array`
  );
}

let _fsReadFileSync = null;
try {
  // Top-level try so bundlers can tree-shake. Only resolves in Node.js.
  _fsReadFileSync = (await import('fs')).readFileSync;
} catch (_) {
  // Browser environment — file reading is not available.
}
