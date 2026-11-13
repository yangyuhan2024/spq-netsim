import { DEFAULT_CLASSES, sourcesForLoad } from './traffic.ts';
import type { ArrivalModel, ClassName, SimConfig } from './types.ts';

export interface Scenario {
  id: string;
  title: string;
  numNodes: number;
  bufferPackets: number;
  referenceClass: ClassName;
  model: ArrivalModel;
  /** Share of the offered load carried by each class of cross traffic. */
  mix: Record<ClassName, number>;
}

const EVEN_MIX = { audio: 1, video: 1, data: 1 };

/** Q1–Q6 from the original course project; Q6 uses Poisson so theory applies. */
export const SCENARIOS: Scenario[] = [
  { id: 'q1', title: '5 nodes, K=900, audio reference', numNodes: 5, bufferPackets: 900, referenceClass: 'audio', model: 'onoff', mix: EVEN_MIX },
  { id: 'q2', title: '5 nodes, small buffer K=100, audio reference', numNodes: 5, bufferPackets: 100, referenceClass: 'audio', model: 'onoff', mix: EVEN_MIX },
  { id: 'q3', title: '10 nodes, K=900, audio reference', numNodes: 10, bufferPackets: 900, referenceClass: 'audio', model: 'onoff', mix: EVEN_MIX },
  { id: 'q4', title: '5 nodes, K=900, video reference', numNodes: 5, bufferPackets: 900, referenceClass: 'video', model: 'onoff', mix: EVEN_MIX },
  { id: 'q5', title: '5 nodes, K=900, data (best-effort) reference', numNodes: 5, bufferPackets: 900, referenceClass: 'data', model: 'onoff', mix: EVEN_MIX },
  { id: 'q6', title: 'single node, audio only, Poisson (validate vs M/D/1)', numNodes: 1, bufferPackets: 100_000, referenceClass: 'audio', model: 'poisson', mix: { audio: 1, video: 0, data: 0 } },
];

export const DEFAULT_RUN = {
  linkRateBps: 10_000_000,
  durationSec: 60,
  warmupSec: 5,
  seed: 1,
};

export interface ScenarioOverrides {
  seed?: number;
  durationSec?: number;
  warmupSec?: number;
  bufferPackets?: number;
  numNodes?: number;
}

export function findScenario(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id.toLowerCase());
  if (!s) {
    throw new Error(`Unknown scenario "${id}". Available: ${SCENARIOS.map((x) => x.id).join(', ')}`);
  }
  return s;
}

/** Build a full config for a scenario at a target offered load (0 < load < 1). */
export function buildConfig(s: Scenario, load: number, o: ScenarioOverrides = {}): SimConfig {
  if (!(load > 0 && load < 1)) throw new Error(`load must be between 0 and 1 (exclusive), got ${load}`);
  return {
    numNodes: o.numNodes ?? s.numNodes,
    linkRateBps: DEFAULT_RUN.linkRateBps,
    bufferPackets: o.bufferPackets ?? s.bufferPackets,
    durationSec: o.durationSec ?? DEFAULT_RUN.durationSec,
    warmupSec: o.warmupSec ?? DEFAULT_RUN.warmupSec,
    seed: o.seed ?? DEFAULT_RUN.seed,
    model: s.model,
    classes: DEFAULT_CLASSES,
    crossTraffic: sourcesForLoad(load, DEFAULT_RUN.linkRateBps, DEFAULT_CLASSES, s.model, s.mix),
    referenceClass: s.referenceClass,
  };
}

/** Loads from `from` to `to` inclusive, built from integer steps to avoid 0.30000000000000004. */
export function loadRange(from: number, to: number, step: number): number[] {
  if (!(step > 0)) throw new Error('step must be > 0');
  if (!(to >= from)) throw new Error('to must be >= from');
  const n = Math.floor((to - from) / step + 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => Number((from + i * step).toFixed(6)));
}
