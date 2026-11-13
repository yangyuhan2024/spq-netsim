import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const cli = (args: string[]) =>
  spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/cli.ts', ...args], { encoding: 'utf8' });

test('run prints a per-node table and the reference summary', () => {
  const r = cli(['run', '--scenario', 'q6', '--load', '0.4', '--duration', '5', '--warmup', '1']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Reference flow \(audio, 1 hops\)/);
});

test('sweep writes a CSV with a header and one row per load', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'spq-')), 'sweep.csv');
  const r = cli(['sweep', '--scenario', 'q1', '--from', '0.2', '--to', '0.4', '--step', '0.1', '--duration', '3', '--warmup', '0.5', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, 'utf8').trim().split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^scenario,target_load,offered_load/);
});

test('bad input exits with code 1 and a readable message', () => {
  const r = cli(['run', '--scenario', 'q9']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown scenario "q9"/);
  const r2 = cli(['run', '--load', 'abc']);
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /--load must be a number/);
});
