import { EventQueue } from './eventQueue.ts';
import { Rng } from './rng.ts';
import { offeredLoad, packetIntervalSec } from './traffic.ts';
import { CLASS_NAMES, PRIORITY } from './types.ts';
import type {
  ClassName,
  ClassParams,
  NodeClassResult,
  SimConfig,
  SimResult,
  TraceRow,
} from './types.ts';

interface Packet {
  id: number;
  cls: ClassName;
  bits: number;
  createdAt: number;
  isRef: boolean;
  arrivedAtNode: number;
  serviceStart: number;
}

interface Source {
  cls: ClassName;
  params: ClassParams;
  /** 0-based node where packets enter. */
  node: number;
  isRef: boolean;
  /** End of the current ON period (Infinity for Poisson sources). */
  onUntil: number;
}

type SimEvent =
  | { kind: 'turnOn'; src: Source }
  | { kind: 'generate'; src: Source }
  | { kind: 'departure'; node: number };

/** FIFO with O(1) amortised push/shift. */
class Fifo<T> {
  #items: T[] = [];
  #head = 0;

  get length(): number {
    return this.#items.length - this.#head;
  }

  push(x: T): void {
    this.#items.push(x);
  }

  shift(): T | undefined {
    if (this.#head >= this.#items.length) return undefined;
    const x = this.#items[this.#head++];
    if (this.#head > 1024 && this.#head * 2 > this.#items.length) {
      this.#items = this.#items.slice(this.#head);
      this.#head = 0;
    }
    return x;
  }
}

interface ClassStats {
  arrivals: number;
  drops: number;
  departures: number;
  waitSum: number;
  delaySum: number;
  backlogArea: number;
  maxBacklog: number;
}

class NodeState {
  /** Indexed by priority: 0 = audio, 1 = video, 2 = data. */
  queues: Fifo<Packet>[] = [new Fifo(), new Fifo(), new Fifo()];
  inService: Packet | null = null;
  lastChange = 0;
  stats: Record<ClassName, ClassStats> = {
    audio: emptyStats(),
    video: emptyStats(),
    data: emptyStats(),
  };
}

function emptyStats(): ClassStats {
  return { arrivals: 0, drops: 0, departures: 0, waitSum: 0, delaySum: 0, backlogArea: 0, maxBacklog: 0 };
}

export function validateConfig(cfg: SimConfig): void {
  const errors: string[] = [];
  const posInt = (v: number) => Number.isInteger(v) && v >= 1;
  const nonNegInt = (v: number) => Number.isInteger(v) && v >= 0;
  if (!posInt(cfg.numNodes)) errors.push('numNodes must be an integer >= 1');
  if (!(cfg.linkRateBps > 0)) errors.push('linkRateBps must be > 0');
  if (!nonNegInt(cfg.bufferPackets)) errors.push('bufferPackets must be an integer >= 0');
  if (!(cfg.warmupSec >= 0)) errors.push('warmupSec must be >= 0');
  if (!(cfg.durationSec > cfg.warmupSec)) errors.push('durationSec must be greater than warmupSec');
  if (!Number.isInteger(cfg.seed)) errors.push('seed must be an integer');
  if (!CLASS_NAMES.includes(cfg.referenceClass)) errors.push(`unknown referenceClass ${cfg.referenceClass}`);
  for (const c of CLASS_NAMES) {
    if (!nonNegInt(cfg.crossTraffic[c])) errors.push(`crossTraffic.${c} must be an integer >= 0`);
    const p = cfg.classes[c];
    for (const key of ['packetBytes', 'peakRateBps', 'meanOnSec', 'meanOffSec'] as const) {
      if (!(p[key] > 0)) errors.push(`classes.${c}.${key} must be > 0`);
    }
  }
  if (errors.length > 0) throw new Error(`Invalid config:\n  - ${errors.join('\n  - ')}`);
}

export interface SimOptions {
  /** Called once per reference packet created after warm-up, when it is delivered or dropped. */
  onReferencePacket?: (row: TraceRow) => void;
}

/**
 * Discrete-event simulation of M nodes in tandem, each with one output
 * link and three strict-priority (non-preemptive) FIFO queues.
 * There is no propagation delay between nodes.
 */
export function simulate(cfg: SimConfig, options: SimOptions = {}): SimResult {
  validateConfig(cfg);
  const rng = new Rng(cfg.seed);
  const events = new EventQueue<SimEvent>();
  const nodes = Array.from({ length: cfg.numNodes }, () => new NodeState());
  const warmup = cfg.warmupSec;
  const lastNode = cfg.numNodes - 1;

  const ref = { generated: 0, dropped: 0, delivered: 0, delaySum: 0, maxDelay: 0 };
  let nextPacketId = 0;
  let eventsProcessed = 0;

  // ---- sources -----------------------------------------------------------
  const sources: Source[] = [];
  for (let n = 0; n < cfg.numNodes; n++) {
    for (const c of CLASS_NAMES) {
      for (let k = 0; k < cfg.crossTraffic[c]; k++) {
        sources.push({ cls: c, params: cfg.classes[c], node: n, isRef: false, onUntil: 0 });
      }
    }
  }
  const refClass = cfg.referenceClass;
  sources.push({ cls: refClass, params: cfg.classes[refClass], node: 0, isRef: true, onUntil: 0 });

  for (const src of sources) {
    const T = packetIntervalSec(src.params);
    if (cfg.model === 'poisson') {
      src.onUntil = Infinity;
      events.push(rng.exponential(T), { kind: 'generate', src });
      continue;
    }
    // Start each ON/OFF source in its stationary state so sources are not synchronised.
    const pOn = src.params.meanOnSec / (src.params.meanOnSec + src.params.meanOffSec);
    if (rng.next() < pOn) {
      src.onUntil = rng.exponential(src.params.meanOnSec); // memoryless residual ON time
      const first = rng.next() * T;
      if (first < src.onUntil) events.push(first, { kind: 'generate', src });
      else events.push(src.onUntil + rng.exponential(src.params.meanOffSec), { kind: 'turnOn', src });
    } else {
      events.push(rng.exponential(src.params.meanOffSec), { kind: 'turnOn', src });
    }
  }

  // ---- helpers -----------------------------------------------------------
  /** Integrate queue lengths over time (only the part after warm-up). */
  function accumulateBacklog(node: NodeState, t: number): void {
    const from = Math.max(node.lastChange, warmup);
    if (t > from) {
      for (const c of CLASS_NAMES) {
        node.stats[c].backlogArea += node.queues[PRIORITY[c]].length * (t - from);
      }
    }
    node.lastChange = t;
  }

  function startService(node: NodeState, nodeIdx: number, p: Packet, t: number): void {
    p.serviceStart = t;
    node.inService = p;
    events.push(t + p.bits / cfg.linkRateBps, { kind: 'departure', node: nodeIdx });
  }

  function arrive(p: Packet, nodeIdx: number, t: number): void {
    const node = nodes[nodeIdx];
    const st = node.stats[p.cls];
    const counting = t >= warmup;
    if (counting) st.arrivals++;
    p.arrivedAtNode = t;

    if (node.inService === null) {
      // Work-conserving: an idle link means every queue is empty.
      startService(node, nodeIdx, p, t);
      return;
    }
    const queue = node.queues[PRIORITY[p.cls]];
    if (queue.length >= cfg.bufferPackets) {
      if (counting) st.drops++;
      if (p.isRef && p.createdAt >= warmup) {
        ref.dropped++;
        options.onReferencePacket?.({
          packetId: p.id,
          createdAt: p.createdAt,
          endedAt: t,
          outcome: 'dropped',
          dropNode: nodeIdx + 1,
        });
      }
      return;
    }
    accumulateBacklog(node, t);
    queue.push(p);
    if (counting) st.maxBacklog = Math.max(st.maxBacklog, queue.length);
  }

  function generate(src: Source, t: number): void {
    const p: Packet = {
      id: nextPacketId++,
      cls: src.cls,
      bits: src.params.packetBytes * 8,
      createdAt: t,
      isRef: src.isRef,
      arrivedAtNode: t,
      serviceStart: t,
    };
    if (src.isRef && t >= warmup) ref.generated++;

    // Schedule this source's next action before handling the packet.
    const T = packetIntervalSec(src.params);
    if (cfg.model === 'poisson') {
      events.push(t + rng.exponential(T), { kind: 'generate', src });
    } else {
      const next = t + T;
      if (next < src.onUntil) events.push(next, { kind: 'generate', src });
      else events.push(src.onUntil + rng.exponential(src.params.meanOffSec), { kind: 'turnOn', src });
    }

    arrive(p, src.node, t);
  }

  function depart(nodeIdx: number, t: number): void {
    const node = nodes[nodeIdx];
    const p = node.inService;
    if (p === null) throw new Error(`departure at idle node ${nodeIdx + 1} (t=${t})`);
    node.inService = null;

    if (p.arrivedAtNode >= warmup) {
      const st = node.stats[p.cls];
      st.departures++;
      st.waitSum += p.serviceStart - p.arrivedAtNode;
      st.delaySum += t - p.arrivedAtNode;
    }

    // Strict priority: always take the highest non-empty class next.
    for (const queue of node.queues) {
      if (queue.length > 0) {
        accumulateBacklog(node, t);
        startService(node, nodeIdx, queue.shift()!, t);
        break;
      }
    }

    if (!p.isRef) return; // cross traffic leaves after one hop
    if (nodeIdx < lastNode) {
      arrive(p, nodeIdx + 1, t); // no link delay
    } else if (p.createdAt >= warmup) {
      const e2e = t - p.createdAt;
      ref.delivered++;
      ref.delaySum += e2e;
      ref.maxDelay = Math.max(ref.maxDelay, e2e);
      options.onReferencePacket?.({
        packetId: p.id,
        createdAt: p.createdAt,
        endedAt: t,
        outcome: 'delivered',
        dropNode: null,
      });
    }
  }

  // ---- main loop ---------------------------------------------------------
  for (;;) {
    const nextTime = events.peekTime();
    if (nextTime === undefined || nextTime > cfg.durationSec) break;
    const { time, item } = events.pop()!;
    eventsProcessed++;
    switch (item.kind) {
      case 'turnOn':
        item.src.onUntil = time + rng.exponential(item.src.params.meanOnSec);
        generate(item.src, time);
        break;
      case 'generate':
        generate(item.src, time);
        break;
      case 'departure':
        depart(item.node, time);
        break;
    }
  }
  for (const node of nodes) accumulateBacklog(node, cfg.durationSec);

  // ---- results -----------------------------------------------------------
  const measuredSec = cfg.durationSec - warmup;
  const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

  const nodeResults = nodes.map((node) => {
    const out = {} as Record<ClassName, NodeClassResult>;
    for (const c of CLASS_NAMES) {
      const s = node.stats[c];
      const inService = node.inService?.cls === c ? 1 : 0;
      out[c] = {
        arrivals: s.arrivals,
        drops: s.drops,
        departures: s.departures,
        blockingRatio: div(s.drops, s.arrivals),
        avgWaitSec: div(s.waitSum, s.departures),
        avgDelaySec: div(s.delaySum, s.departures),
        avgBacklog: s.backlogArea / measuredSec,
        maxBacklog: s.maxBacklog,
        remainingAtEnd: node.queues[PRIORITY[c]].length + inService,
      };
    }
    return out;
  });

  return {
    config: cfg,
    offeredLoad: offeredLoad(cfg),
    nodes: nodeResults,
    reference: {
      cls: refClass,
      generated: ref.generated,
      dropped: ref.dropped,
      delivered: ref.delivered,
      blockingRatio: div(ref.dropped, ref.generated),
      avgEndToEndDelaySec: div(ref.delaySum, ref.delivered),
      maxEndToEndDelaySec: ref.delivered > 0 ? ref.maxDelay : null,
    },
    eventsProcessed,
    measuredSec,
  };
}
