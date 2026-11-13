import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simulate } from '../src/simulator.ts';
import { DEFAULT_CLASSES, meanPacketRate, offeredLoad, packetIntervalSec, sourcesForLoad } from '../src/traffic.ts';
import type { ClassParams, SimConfig } from '../src/types.ts';

function singleSource(params: ClassParams, durationSec: number): SimConfig {
  return {
    numNodes: 1,
    linkRateBps: 1e9,
    bufferPackets: 1000,
    durationSec,
    warmupSec: 10,
    seed: 11,
    model: 'onoff',
    classes: { ...DEFAULT_CLASSES, audio: params },
    crossTraffic: { audio: 0, video: 0, data: 0 },
    referenceClass: 'audio',
  };
}

test('packet interval is packet size x 8 / peak rate', () => {
  assert.equal(packetIntervalSec({ packetBytes: 120, peakRateBps: 64_000, meanOnSec: 1, meanOffSec: 1 }), 0.015);
});

test('ON/OFF mean packet rate matches a long simulation (within 3%)', () => {
  const p = DEFAULT_CLASSES.audio;
  const r = simulate(singleSource(p, 4000));
  const empirical = r.reference.generated / r.measuredSec;
  const expected = meanPacketRate(p, 'onoff');
  assert.ok(Math.abs(empirical - expected) / expected < 0.03, `empirical ${empirical}, expected ${expected}`);
});

test('edge case: ON period shorter than the packet interval still sends one packet per ON period', () => {
  // T = 0.1 s, mean ON = 0.02 s. Naive formula (peak x duty cycle) gives 0.2 pkt/s; real rate ~1 pkt/s.
  const p: ClassParams = { packetBytes: 1250, peakRateBps: 100_000, meanOnSec: 0.02, meanOffSec: 0.98 };
  const r = simulate(singleSource(p, 4000));
  const empirical = r.reference.generated / r.measuredSec;
  const naive = (1 / packetIntervalSec(p)) * (p.meanOnSec / (p.meanOnSec + p.meanOffSec));
  assert.ok(Math.abs(empirical - meanPacketRate(p, 'onoff')) / empirical < 0.05);
  assert.ok(empirical > 3 * naive, 'the naive duty-cycle formula should be clearly wrong here');
});

test('sourcesForLoad hits the target load after rounding (within 3%)', () => {
  for (const load of [0.3, 0.6, 0.9]) {
    const counts = sourcesForLoad(load, 10e6, DEFAULT_CLASSES, 'onoff', { audio: 1, video: 1, data: 1 });
    const cfg = { ...singleSource(DEFAULT_CLASSES.audio, 10), linkRateBps: 10e6, crossTraffic: counts };
    // offeredLoad includes the single reference source
    assert.ok(Math.abs(offeredLoad(cfg) - load) < 0.03 * load + 0.01, `load ${load} -> ${offeredLoad(cfg)}`);
  }
});

test('sourcesForLoad gives zero sources to classes with zero share', () => {
  const c = sourcesForLoad(0.5, 10e6, DEFAULT_CLASSES, 'poisson', { audio: 1, video: 0, data: 0 });
  assert.equal(c.video, 0);
  assert.equal(c.data, 0);
  assert.ok(c.audio > 0);
});

test('sourcesForLoad rejects an empty mix and negative load', () => {
  assert.throws(() => sourcesForLoad(0.5, 10e6, DEFAULT_CLASSES, 'onoff', { audio: 0, video: 0, data: 0 }));
  assert.throws(() => sourcesForLoad(-0.1, 10e6, DEFAULT_CLASSES, 'onoff', { audio: 1, video: 1, data: 1 }));
});
