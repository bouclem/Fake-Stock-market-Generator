import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/prng.js';

test('createRng: same seed gives same stream', () => {
  const a = createRng('hello');
  const b = createRng('hello');
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
});

test('createRng: different seeds diverge', () => {
  const a = createRng('a');
  const b = createRng('b');
  assert.notEqual(a.next(), b.next());
});

test('createRng: int() stays within inclusive bounds', () => {
  const rng = createRng(123);
  for (let i = 0; i < 500; i++) {
    const v = rng.int(3, 7);
    assert.ok(Number.isInteger(v) && v >= 3 && v <= 7);
  }
});

test('createRng: gauss() is finite and roughly normal', () => {
  const rng = createRng('g');
  let sum = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) {
    const v = rng.gauss();
    assert.ok(Number.isFinite(v));
    sum += v;
  }
  // Sample mean of standard normal should be near 0
  assert.ok(Math.abs(sum / n) < 0.1);
});

test('createRng: pick() returns array members', () => {
  const rng = createRng(9);
  const arr = ['x', 'y', 'z'];
  for (let i = 0; i < 50; i++) assert.ok(arr.includes(rng.pick(arr)));
});
