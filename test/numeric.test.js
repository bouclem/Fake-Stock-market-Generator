import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNumeric,
  formatNumeric,
  formatHumanNumber,
  cleanNumericArray,
  cleanJson,
  parseJson
} from '../src/numeric.js';

test('parseNumeric: numbers and suffixed/underscored strings', () => {
  assert.equal(parseNumeric(42), 42);
  assert.equal(parseNumeric('1.5M'), 1_500_000);
  assert.equal(parseNumeric('2.3B'), 2_300_000_000);
  assert.equal(parseNumeric('500K'), 500_000);
  assert.equal(parseNumeric('1_200_000'), 1_200_000);
  assert.equal(parseNumeric('1.5'), 1.5);
  assert.equal(parseNumeric(null), null);
  assert.equal(parseNumeric(undefined), undefined);
  assert.ok(Number.isNaN(parseNumeric('abc')));
});

test('formatNumeric: underscore grouping', () => {
  assert.equal(formatNumeric(1200000), '1_200_000');
  assert.equal(formatNumeric(10500.5), '10_500.5');
});

test('formatHumanNumber: suffix tiers', () => {
  assert.equal(formatHumanNumber(100), '100');
  assert.equal(formatHumanNumber(4999), '4999');
  assert.equal(formatHumanNumber(5000), '5K');
  assert.equal(formatHumanNumber(10200), '10.2K');
  assert.equal(formatHumanNumber(1_500_000), '1.5M');
  assert.equal(formatHumanNumber(1e9), '1B');
  assert.equal(formatHumanNumber(-6000), '-6K');
});

test('formatHumanNumber: rounding promotes to the next tier', () => {
  assert.equal(formatHumanNumber(999_999), '1M');
  assert.equal(formatHumanNumber(999_999_999), '1B');
  assert.equal(formatHumanNumber(999_950), '1M');
});

test('cleanNumericArray: filters junk', () => {
  assert.deepEqual(cleanNumericArray([1, '2K', null, 'abc', 3]), [1, 2000, 3]);
  assert.deepEqual(cleanNumericArray(null), []);
});

test('cleanJson: strips underscores in numbers', () => {
  assert.equal(cleanJson('{"v":10_500,"p":1_200_000.50}'), '{"v":10500,"p":1200000.50}');
});

test('cleanJson: does NOT corrupt string literals', () => {
  const raw = '{"symbol":"A1_000","name":"item_1_000","v":10_500}';
  const obj = parseJson(raw);
  assert.equal(obj.symbol, 'A1_000');
  assert.equal(obj.name, 'item_1_000');
  assert.equal(obj.v, 10500);
});

test('cleanJson: escaped quotes inside strings are preserved', () => {
  const raw = '{"note":"say \\"10_000\\" out loud","v":1_000}';
  const obj = parseJson(raw);
  assert.equal(obj.note, 'say "10_000" out loud');
  assert.equal(obj.v, 1000);
});
