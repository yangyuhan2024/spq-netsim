import assert from 'node:assert/strict';
import { test } from 'node:test';
import { md1WaitSec, nonPreemptivePriorityWaitSec } from '../src/theory.ts';
import { validateMd1, validatePriority } from '../src/validation.ts';

test('M/D/1 formula: known value and overload', () => {
  // lambda = 0.5, S = 1 -> rho = 0.5, W = 0.5 / (2 * 0.5) = 0.5
  assert.equal(md1WaitSec(0.5, 1), 0.5);
  assert.equal(md1WaitSec(1, 1), Infinity);
});

test('priority formula reduces to M/D/1 with a single class', () => {
  assert.equal(nonPreemptivePriorityWaitSec([{ lambda: 0.5, serviceSec: 1 }])[0], md1WaitSec(0.5, 1));
});

test('simulator matches M/D/1 mean wait (within 6%)', () => {
  for (const load of [0.3, 0.5, 0.7]) {
    const row = validateMd1(load, 1, 20);
    assert.ok(Math.abs(row.relError) < 0.06, `load ${load}: sim ${row.simWaitSec}, theory ${row.theoryWaitSec}`);
  }
});

test('simulator matches the non-preemptive priority formula (audio/video 6%, data 10%)', () => {
  const [audio, video, data] = validatePriority({ audio: 31, video: 5, data: 2 }, 1, 60);
  assert.ok(Math.abs(audio.relError) < 0.06, `audio ${audio.relError}`);
  assert.ok(Math.abs(video.relError) < 0.06, `video ${video.relError}`);
  assert.ok(Math.abs(data.relError) < 0.1, `data ${data.relError}`);
});
