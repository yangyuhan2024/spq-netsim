/** Traffic classes, highest priority first. */
export const CLASS_NAMES = ['audio', 'video', 'data'] as const;
export type ClassName = (typeof CLASS_NAMES)[number];

/** Strict priority: 0 is served first (audio > video > data). */
export const PRIORITY: Record<ClassName, number> = { audio: 0, video: 1, data: 2 };

/** DiffServ-style label used in reports. */
export const SERVICE_LABEL: Record<ClassName, string> = {
  audio: 'Premium (EF)',
  video: 'Assured Forwarding',
  data: 'Best Effort',
};

/**
 * 'onoff'   – exponential ON/OFF source, constant packet spacing while ON.
 * 'poisson' – always-on source with exponential inter-arrival times
 *             (used to validate against closed-form queueing results).
 */
export type ArrivalModel = 'onoff' | 'poisson';

export interface ClassParams {
  packetBytes: number;
  /** Sending rate while ON, in bits per second. */
  peakRateBps: number;
  meanOnSec: number;
  meanOffSec: number;
}

export interface SimConfig {
  /** Number of nodes (hops) in tandem that the reference flow crosses. */
  numNodes: number;
  /** Output link rate of every node, bits per second. */
  linkRateBps: number;
  /**
   * Waiting room per class queue, in packets (the packet in service is
   * not counted). An arrival that finds its class queue full is dropped.
   */
  bufferPackets: number;
  durationSec: number;
  /** Statistics ignore everything before this time. */
  warmupSec: number;
  seed: number;
  model: ArrivalModel;
  classes: Record<ClassName, ClassParams>;
  /** Cross-traffic sources per class at EACH node (enter and leave at that node). */
  crossTraffic: Record<ClassName, number>;
  /** One tagged source that enters node 1 and is followed end to end. */
  referenceClass: ClassName;
}

export interface NodeClassResult {
  arrivals: number;
  drops: number;
  departures: number;
  /** drops / arrivals */
  blockingRatio: number | null;
  /** Mean time from arrival to start of transmission. */
  avgWaitSec: number | null;
  /** Mean time from arrival to end of transmission (wait + service). */
  avgDelaySec: number | null;
  /** Time-averaged number of packets waiting in this class queue. */
  avgBacklog: number;
  maxBacklog: number;
  /** Packets of this class still waiting or in service when the run ended. */
  remainingAtEnd: number;
}

export interface ReferenceResult {
  cls: ClassName;
  generated: number;
  dropped: number;
  delivered: number;
  /** dropped / generated */
  blockingRatio: number | null;
  avgEndToEndDelaySec: number | null;
  maxEndToEndDelaySec: number | null;
}

export interface SimResult {
  config: SimConfig;
  /** Offered load at each node (cross traffic + reference) / link rate. */
  offeredLoad: number;
  nodes: Record<ClassName, NodeClassResult>[];
  reference: ReferenceResult;
  eventsProcessed: number;
  measuredSec: number;
}

/** One row of the optional reference-packet trace. */
export interface TraceRow {
  packetId: number;
  createdAt: number;
  /** End time (delivery or drop). */
  endedAt: number;
  outcome: 'delivered' | 'dropped';
  /** 1-based node where the packet was dropped, or null. */
  dropNode: number | null;
}
