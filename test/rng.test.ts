import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/rng.ts';

test('same seed gives the same sequence', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 1000; i++) assert.equal(a.next(), b.next());
});

test('different seeds give different sequences', () => {
  assert.notEqual(new Rng(1).next(), new Rng(2).next());
});

test('uniform samples stay in [0, 1)', () => {
  const r = new Rng(7);
  for (let i = 0; i < 100_000; i++) {
    const x = r.next();
    assert.ok(x >= 0 && x < 1, `out of range: ${x}`);
  }
});

test('exponential samples have the requested mean (within 2%)', () => {
  const r = new Rng(3);
  const n = 200_000;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += r.exponential(0.5);
  assert.ok(Math.abs(sum / n - 0.5) / 0.5 < 0.02, `mean ${sum / n}`);
});

test('rejects non-integer seeds and non-positive means', () => {
  assert.throws(() => new Rng(1.5));
  assert.throws(() => new Rng(1).exponential(0));
});
