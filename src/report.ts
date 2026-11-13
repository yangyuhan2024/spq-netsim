import { CLASS_NAMES, SERVICE_LABEL } from './types.ts';
import type { ClassName, SimResult, TraceRow } from './types.ts';
import type { ValidationRow } from './validation.ts';

const ms = (s: number | null) => (s === null ? '-' : (s * 1000).toFixed(3));
const pct = (r: number | null) => (r === null ? '-' : (r * 100).toFixed(3) + '%');

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padStart(widths[i])).join('  ');
  return [line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

export function formatResult(r: SimResult, title: string): string {
  const c = r.config;
  const out: string[] = [];
  out.push(`== ${title} ==`);
  out.push(
    `nodes=${c.numNodes}  link=${c.linkRateBps / 1e6} Mb/s  buffer K=${c.bufferPackets}/class  ` +
      `model=${c.model}  seed=${c.seed}  measured=${r.measuredSec}s (warm-up ${c.warmupSec}s)`,
  );
  out.push(
    `offered load per node = ${r.offeredLoad.toFixed(3)}  ` +
      `(cross sources/node: audio ${c.crossTraffic.audio}, video ${c.crossTraffic.video}, data ${c.crossTraffic.data})`,
  );
  out.push('');

  const rows: string[][] = [];
  r.nodes.forEach((node, i) => {
    for (const cls of CLASS_NAMES) {
      const s = node[cls];
      if (s.arrivals === 0) continue;
      rows.push([
        String(i + 1),
        `${cls} (${SERVICE_LABEL[cls]})`,
        String(s.arrivals),
        ms(s.avgDelaySec),
        pct(s.blockingRatio),
        s.avgBacklog.toFixed(3),
        String(s.maxBacklog),
      ]);
    }
  });
  out.push(table(['node', 'class', 'arrivals', 'avg delay ms', 'blocking', 'avg backlog', 'max backlog'], rows));
  out.push('');

  const ref = r.reference;
  out.push(
    `Reference flow (${ref.cls}, ${c.numNodes} hops): generated ${ref.generated}, delivered ${ref.delivered}, ` +
      `dropped ${ref.dropped}, blocking ${pct(ref.blockingRatio)}, ` +
      `avg end-to-end delay ${ms(ref.avgEndToEndDelaySec)} ms, max ${ms(ref.maxEndToEndDelaySec)} ms`,
  );
  out.push(`events processed: ${r.eventsProcessed}`);
  return out.join('\n');
}

/** Mean of a per-node metric across nodes, ignoring nodes with no data. */
function nodeMean(r: SimResult, cls: ClassName, pick: (n: SimResult['nodes'][number][ClassName]) => number | null) {
  const vals = r.nodes.map((n) => pick(n[cls])).filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

const num = (v: number | null, digits = 6) => (v === null ? '' : v.toFixed(digits));

export function sweepCsvHeader(): string {
  const cols = ['scenario', 'target_load', 'offered_load', 'seed', 'ref_class', 'ref_generated', 'ref_blocking', 'ref_avg_e2e_delay_ms'];
  for (const c of CLASS_NAMES) cols.push(`${c}_avg_delay_ms`, `${c}_blocking`, `${c}_avg_backlog`);
  return cols.join(',');
}

export function sweepCsvRow(scenario: string, targetLoad: number, r: SimResult): string {
  const ref = r.reference;
  const cells = [
    scenario,
    String(targetLoad),
    num(r.offeredLoad, 4),
    String(r.config.seed),
    ref.cls,
    String(ref.generated),
    num(ref.blockingRatio),
    num(ref.avgEndToEndDelaySec === null ? null : ref.avgEndToEndDelaySec * 1000),
  ];
  for (const c of CLASS_NAMES) {
    const d = nodeMean(r, c, (s) => s.avgDelaySec);
    cells.push(num(d === null ? null : d * 1000), num(nodeMean(r, c, (s) => s.blockingRatio)), num(nodeMean(r, c, (s) => s.avgBacklog)));
  }
  return cells.join(',');
}

export function traceCsvHeader(): string {
  return 'packet_id,created_s,ended_s,outcome,drop_node,e2e_delay_ms';
}

export function traceCsvRow(t: TraceRow): string {
  const delay = t.outcome === 'delivered' ? ((t.endedAt - t.createdAt) * 1000).toFixed(6) : '';
  return [t.packetId, t.createdAt.toFixed(6), t.endedAt.toFixed(6), t.outcome, t.dropNode ?? '', delay].join(',');
}

export function formatValidation(rows: ValidationRow[]): string {
  return table(
    ['check', 'load', 'sim wait ms', 'theory wait ms', 'error'],
    rows.map((r) => [
      r.label,
      r.offeredLoad.toFixed(3),
      (r.simWaitSec * 1000).toFixed(4),
      (r.theoryWaitSec * 1000).toFixed(4),
      (r.relError * 100).toFixed(2) + '%',
    ]),
  );
}
