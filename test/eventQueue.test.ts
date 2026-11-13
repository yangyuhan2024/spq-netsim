import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventQueue } from '../src/eventQueue.ts';
import { Rng } from '../src/rng.ts';

test('pops events in time order', () => {
  const q = new EventQueue<number>();
  const rng = new Rng(9);
  for (let i = 0; i < 5000; i++) q.push(rng.next() * 100, i);
  let last = -1;
  while (q.size > 0) {
    const { time } = q.pop()!;
    assert.ok(time >= last);
    last = time;
  }
});

test('events at the same time come out in insertion order (FIFO tie-break)', () => {
  const q = new EventQueue<string>();
  q.push(1, 'a');
  q.push(0.5, 'first');
  q.push(1, 'b');
  q.push(1, 'c');
  assert.deepEqual([q.pop()!.item, q.pop()!.item, q.pop()!.item, q.pop()!.item], ['first', 'a', 'b', 'c']);
});

test('empty queue returns undefined', () => {
  const q = new EventQueue<number>();
  assert.equal(q.pop(), undefined);
  assert.equal(q.peekTime(), undefined);
});

test('rejects NaN, Infinity and negative times', () => {
  const q = new EventQueue<number>();
  assert.throws(() => q.push(NaN, 1));
  assert.throws(() => q.push(Infinity, 1));
  assert.throws(() => q.push(-1, 1));
});
