import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConfig, findScenario, loadRange } from '../src/scenarios.ts';
import { simulate, validateConfig } from '../src/simulator.ts';
import { DEFAULT_CLASSES } from '../src/traffic.ts';
import { CLASS_NAMES } from '../src/types.ts';
import type { SimConfig, TraceRow } from '../src/types.ts';

const q1 = findScenario('q1');

test('same seed gives identical results; different seed differs', () => {
  const cfg = buildConfig(q1, 0.5, { durationSec: 10, warmupSec: 1 });
  assert.deepEqual(simulate(cfg), simulate(cfg));
  const other = simulate({ ...cfg, seed: 2 });
  assert.notDeepEqual(other.nodes[0].audio.arrivals, simulate(cfg).nodes[0].audio.arrivals);
});

test('packet conservation at every node: arrivals = drops + departures + remaining (no warm-up)', () => {
  const cfg = buildConfig(findScenario('q2'), 0.95, { durationSec: 10, warmupSec: 0, bufferPackets: 5 });
  const r = simulate(cfg);
  let anyDrops = false;
  r.nodes.forEach((node, i) => {
    for (const c of CLASS_NAMES) {
      const s = node[c];
      assert.equal(s.arrivals, s.drops + s.departures + s.remainingAtEnd, `node ${i + 1} ${c}`);
      if (s.drops > 0) anyDrops = true;
    }
  });
  assert.ok(anyDrops, 'test setup should actually produce drops');
});

test('strict priority: at high load, delay is audio < video < data at every node', () => {
  const r = simulate(buildConfig(q1, 0.9, { durationSec: 20, warmupSec: 2 }));
  for (const node of r.nodes) {
    assert.ok(node.audio.avgDelaySec! < node.video.avgDelaySec!);
    assert.ok(node.video.avgDelaySec! < node.data.avgDelaySec!);
  }
});

test('smaller buffer trades higher blocking for lower delay (Q2 vs Q1 finding)', () => {
  const opts = { durationSec: 30, warmupSec: 3, seed: 5 };
  const big = simulate(buildConfig(findScenario('q5'), 0.95, opts));
  const small = simulate(buildConfig(findScenario('q5'), 0.95, { ...opts, bufferPackets: 20 }));
  assert.ok(small.reference.blockingRatio! > big.reference.blockingRatio!);
  assert.ok(small.reference.avgEndToEndDelaySec! < big.reference.avgEndToEndDelaySec!);
});

test('end-to-end delay of the reference flow is at least one transmission time per hop', () => {
  const cfg = buildConfig(findScenario('q3'), 0.3, { durationSec: 10, warmupSec: 1 });
  const r = simulate(cfg);
  const perHop = (DEFAULT_CLASSES.audio.packetBytes * 8) / cfg.linkRateBps;
  assert.ok(r.reference.delivered > 0);
  assert.ok(r.reference.avgEndToEndDelaySec! >= cfg.numNodes * perHop - 1e-12);
});

test('more hops means more end-to-end delay (Q3 vs Q1)', () => {
  const opts = { durationSec: 30, warmupSec: 3 };
  const five = simulate(buildConfig(q1, 0.7, opts));
  const ten = simulate(buildConfig(findScenario('q3'), 0.7, opts));
  assert.ok(ten.reference.avgEndToEndDelaySec! > five.reference.avgEndToEndDelaySec!);
});

test('an idle network has zero waiting: one source on a fast link', () => {
  const cfg: SimConfig = {
    numNodes: 3,
    linkRateBps: 1e9,
    bufferPackets: 10,
    durationSec: 50,
    warmupSec: 0,
    seed: 1,
    model: 'onoff',
    classes: DEFAULT_CLASSES,
    crossTraffic: { audio: 0, video: 0, data: 0 },
    referenceClass: 'audio',
  };
  const r = simulate(cfg);
  const perHop = (DEFAULT_CLASSES.audio.packetBytes * 8) / cfg.linkRateBps;
  assert.equal(r.reference.dropped, 0);
  assert.ok(Math.abs(r.reference.avgEndToEndDelaySec! - 3 * perHop) < 1e-12);
  assert.equal(r.nodes[0].audio.avgWaitSec, 0);
});

test('buffer K=0 still serves packets that find the link idle', () => {
  const cfg = buildConfig(q1, 0.5, { durationSec: 5, warmupSec: 0, bufferPackets: 0 });
  const r = simulate(cfg);
  assert.ok(r.nodes[0].audio.departures > 0);
  assert.ok(r.nodes[0].audio.drops > 0);
  assert.equal(r.nodes[0].audio.maxBacklog, 0);
});

test('trace callback reports every reference packet exactly once', () => {
  const rows: TraceRow[] = [];
  const r = simulate(buildConfig(findScenario('q2'), 0.9, { durationSec: 10, warmupSec: 1, bufferPackets: 3 }), {
    onReferencePacket: (row) => rows.push(row),
  });
  assert.equal(rows.length, r.reference.delivered + r.reference.dropped);
  assert.equal(new Set(rows.map((x) => x.packetId)).size, rows.length);
  for (const row of rows) assert.ok(row.endedAt >= row.createdAt);
});

test('invalid configs are rejected with every problem listed', () => {
  const cfg = buildConfig(q1, 0.5);
  assert.throws(() => validateConfig({ ...cfg, numNodes: 0, linkRateBps: -1 }), /numNodes[\s\S]*linkRateBps/);
  assert.throws(() => validateConfig({ ...cfg, durationSec: 5, warmupSec: 5 }), /durationSec/);
  assert.throws(() => validateConfig({ ...cfg, crossTraffic: { audio: 1.5, video: 0, data: 0 } }), /crossTraffic.audio/);
});

test('scenario helpers: unknown id and bad load are rejected; load range avoids float drift', () => {
  assert.throws(() => findScenario('q9'), /Available/);
  assert.throws(() => buildConfig(q1, 1));
  assert.deepEqual(loadRange(0.1, 0.9, 0.1), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
});
