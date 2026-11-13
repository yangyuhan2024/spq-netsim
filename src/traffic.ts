import { CLASS_NAMES } from './types.ts';
import type { ArrivalModel, ClassName, ClassParams, SimConfig } from './types.ts';

/**
 * Default traffic parameters.
 * These are typical textbook values (voice, video, bulk data). Replace
 * them with the course handout values if you need to match old results.
 */
export const DEFAULT_CLASSES: Record<ClassName, ClassParams> = {
  audio: { packetBytes: 120, peakRateBps: 64_000, meanOnSec: 0.36, meanOffSec: 0.64 },
  video: { packetBytes: 1000, peakRateBps: 384_000, meanOnSec: 0.33, meanOffSec: 0.73 },
  data: { packetBytes: 1500, peakRateBps: 1_000_000, meanOnSec: 0.5, meanOffSec: 1.5 },
};

/** Packet spacing while a source is ON: packet size x 8 / peak rate. */
export function packetIntervalSec(p: ClassParams): number {
  return (p.packetBytes * 8) / p.peakRateBps;
}

/**
 * Long-run mean packet rate of ONE source (packets per second).
 *
 * ON/OFF model: a source sends a packet the moment it turns ON and then
 * every T seconds while still ON. With an exponential ON period of mean m,
 * the expected packets per ON period is
 *     1 + sum_{k>=1} P(ON > kT) = 1 / (1 - exp(-T/m)),
 * and one ON+OFF cycle lasts meanOn + meanOff on average.
 *
 * Note: the "obvious" formula peakRate x meanOn / (meanOn + meanOff)
 * underestimates the rate when T is not small compared with meanOn.
 */
export function meanPacketRate(p: ClassParams, model: ArrivalModel): number {
  const T = packetIntervalSec(p);
  if (model === 'poisson') return 1 / T;
  return 1 / ((1 - Math.exp(-T / p.meanOnSec)) * (p.meanOnSec + p.meanOffSec));
}

export function meanBitRate(p: ClassParams, model: ArrivalModel): number {
  return meanPacketRate(p, model) * p.packetBytes * 8;
}

/**
 * Number of cross-traffic sources per class needed for a target load.
 * `mix` gives the share of the load carried by each class (normalised here).
 */
export function sourcesForLoad(
  load: number,
  linkRateBps: number,
  classes: Record<ClassName, ClassParams>,
  model: ArrivalModel,
  mix: Record<ClassName, number>,
): Record<ClassName, number> {
  if (!(load >= 0)) throw new Error(`load must be >= 0, got ${load}`);
  const total = CLASS_NAMES.reduce((s, c) => s + mix[c], 0);
  if (!(total > 0)) throw new Error('traffic mix must have at least one positive share');
  const out = { audio: 0, video: 0, data: 0 };
  for (const c of CLASS_NAMES) {
    const share = mix[c] / total;
    out[c] = Math.round((load * share * linkRateBps) / meanBitRate(classes[c], model));
  }
  return out;
}

/** Sources of each class feeding one node, including the reference source. */
export function sourcesPerNode(cfg: SimConfig): Record<ClassName, number> {
  const counts = { ...cfg.crossTraffic };
  counts[cfg.referenceClass] += 1;
  return counts;
}

/** Offered load at a node = mean arriving bit rate / link rate. */
export function offeredLoad(cfg: SimConfig): number {
  const counts = sourcesPerNode(cfg);
  let bits = 0;
  for (const c of CLASS_NAMES) bits += counts[c] * meanBitRate(cfg.classes[c], cfg.model);
  return bits / cfg.linkRateBps;
}
