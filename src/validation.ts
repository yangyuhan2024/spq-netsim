import { simulate } from './simulator.ts';
import { DEFAULT_CLASSES, meanPacketRate, packetIntervalSec, sourcesPerNode } from './traffic.ts';
import { md1WaitSec, nonPreemptivePriorityWaitSec } from './theory.ts';
import { CLASS_NAMES } from './types.ts';
import type { ClassName, SimConfig } from './types.ts';

export interface ValidationRow {
  label: string;
  offeredLoad: number;
  simWaitSec: number;
  theoryWaitSec: number;
  relError: number;
}

const LINK_BPS = 10_000_000;

function poissonConfig(counts: Record<ClassName, number>, seed: number, durationSec: number): SimConfig {
  return {
    numNodes: 1,
    linkRateBps: LINK_BPS,
    bufferPackets: 1_000_000, // effectively infinite: theory assumes no loss
    durationSec,
    warmupSec: Math.min(5, durationSec / 10),
    seed,
    model: 'poisson',
    classes: DEFAULT_CLASSES,
    crossTraffic: counts,
    referenceClass: 'audio',
  };
}

function rates(cfg: SimConfig) {
  const counts = sourcesPerNode(cfg);
  return CLASS_NAMES.map((c) => ({
    cls: c,
    lambda: counts[c] * meanPacketRate(cfg.classes[c], 'poisson'),
    serviceSec: (cfg.classes[c].packetBytes * 8) / cfg.linkRateBps,
  }));
}

/** Single node, audio only: simulated mean wait vs M/D/1. */
export function validateMd1(load: number, seed = 1, durationSec = 30): ValidationRow {
  const audio = DEFAULT_CLASSES.audio;
  const perSourceLoad = (audio.packetBytes * 8) / packetIntervalSec(audio) / LINK_BPS;
  const n = Math.max(0, Math.round(load / perSourceLoad) - 1); // -1: the reference source is also audio
  const cfg = poissonConfig({ audio: n, video: 0, data: 0 }, seed, durationSec);
  const [a] = rates(cfg);
  const theory = md1WaitSec(a.lambda, a.serviceSec);
  const sim = simulate(cfg).nodes[0].audio.avgWaitSec ?? NaN;
  return {
    label: 'M/D/1 audio',
    offeredLoad: a.lambda * a.serviceSec,
    simWaitSec: sim,
    theoryWaitSec: theory,
    relError: (sim - theory) / theory,
  };
}

/** Single node, three Poisson classes: simulated waits vs non-preemptive priority formula. */
export function validatePriority(
  counts: Record<ClassName, number>,
  seed = 1,
  durationSec = 60,
): ValidationRow[] {
  const cfg = poissonConfig(counts, seed, durationSec);
  const r = rates(cfg);
  const theory = nonPreemptivePriorityWaitSec(r);
  const result = simulate(cfg);
  const total = r.reduce((s, x) => s + x.lambda * x.serviceSec, 0);
  return r.map((x, i) => {
    const sim = result.nodes[0][x.cls].avgWaitSec ?? NaN;
    return {
      label: `priority ${x.cls}`,
      offeredLoad: total,
      simWaitSec: sim,
      theoryWaitSec: theory[i],
      relError: (sim - theory[i]) / theory[i],
    };
  });
}
