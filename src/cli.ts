#!/usr/bin/env node
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatResult, formatValidation, sweepCsvHeader, sweepCsvRow, traceCsvHeader, traceCsvRow } from './report.ts';
import { buildConfig, findScenario, loadRange, SCENARIOS } from './scenarios.ts';
import type { ScenarioOverrides } from './scenarios.ts';
import { simulate } from './simulator.ts';
import { validateMd1, validatePriority } from './validation.ts';

const HELP = `spq-netsim – strict priority queuing network simulator

Usage:
  node src/cli.ts list
  node src/cli.ts run      --scenario q1 --load 0.6 [--trace out/trace.csv]
  node src/cli.ts sweep    --scenario q1 [--from 0.1 --to 0.9 --step 0.1] [--out results/q1.csv]
  node src/cli.ts validate

Common options:
  --seed N        random seed (default 1)
  --duration S    simulated seconds (default 60)
  --warmup S      seconds ignored at the start (default 5)
  --buffer K      packets per class queue (overrides scenario)
  --nodes M       number of nodes (overrides scenario)
`;

function parseNumber(name: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const v = Number(raw);
  if (!Number.isFinite(v)) throw new Error(`--${name} must be a number, got "${raw}"`);
  return v;
}

function ensureDir(file: string): void {
  mkdirSync(dirname(file), { recursive: true });
}

export function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      scenario: { type: 'string', default: 'q1' },
      load: { type: 'string' },
      from: { type: 'string', default: '0.1' },
      to: { type: 'string', default: '0.9' },
      step: { type: 'string', default: '0.1' },
      seed: { type: 'string' },
      duration: { type: 'string' },
      warmup: { type: 'string' },
      buffer: { type: 'string' },
      nodes: { type: 'string' },
      out: { type: 'string' },
      trace: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const command = positionals[0] ?? 'help';
  if (values.help || command === 'help') {
    console.log(HELP);
    return 0;
  }

  const overrides: ScenarioOverrides = {
    seed: parseNumber('seed', values.seed),
    durationSec: parseNumber('duration', values.duration),
    warmupSec: parseNumber('warmup', values.warmup),
    bufferPackets: parseNumber('buffer', values.buffer),
    numNodes: parseNumber('nodes', values.nodes),
  };

  switch (command) {
    case 'list': {
      for (const s of SCENARIOS) console.log(`${s.id}  ${s.title}`);
      return 0;
    }
    case 'run': {
      const scenario = findScenario(values.scenario!);
      const load = parseNumber('load', values.load) ?? 0.5;
      const cfg = buildConfig(scenario, load, overrides);
      let trace: ReturnType<typeof createWriteStream> | undefined;
      if (values.trace) {
        ensureDir(values.trace);
        trace = createWriteStream(values.trace);
        trace.write(traceCsvHeader() + '\n');
      }
      const result = simulate(cfg, { onReferencePacket: trace ? (row) => trace!.write(traceCsvRow(row) + '\n') : undefined });
      trace?.end();
      console.log(formatResult(result, `${scenario.id.toUpperCase()}: ${scenario.title} @ target load ${load}`));
      if (values.trace) console.log(`reference-packet trace written to ${values.trace}`);
      return 0;
    }
    case 'sweep': {
      const scenario = findScenario(values.scenario!);
      const loads = loadRange(parseNumber('from', values.from)!, parseNumber('to', values.to)!, parseNumber('step', values.step)!);
      const out = values.out ?? `results/${scenario.id}.csv`;
      const lines = [sweepCsvHeader()];
      for (const load of loads) {
        const started = Date.now();
        const r = simulate(buildConfig(scenario, load, overrides));
        lines.push(sweepCsvRow(scenario.id, load, r));
        const d = r.reference.avgEndToEndDelaySec;
        console.log(
          `load ${load.toFixed(2)} -> offered ${r.offeredLoad.toFixed(3)}, ref e2e delay ` +
            `${d === null ? '-' : (d * 1000).toFixed(3) + ' ms'}, ref blocking ${((r.reference.blockingRatio ?? 0) * 100).toFixed(3)}% ` +
            `(${Date.now() - started} ms)`,
        );
      }
      ensureDir(out);
      writeFileSync(out, lines.join('\n') + '\n');
      console.log(`wrote ${loads.length} rows to ${out}`);
      return 0;
    }
    case 'validate': {
      const seed = overrides.seed ?? 1;
      const rows = [0.3, 0.5, 0.7, 0.8].map((l) => validateMd1(l, seed));
      rows.push(...validatePriority({ audio: 31, video: 5, data: 2 }, seed));
      console.log('Simulator vs queueing theory (single node, Poisson arrivals, deterministic service)\n');
      console.log(formatValidation(rows));
      return 0;
    }
    default:
      throw new Error(`Unknown command "${command}". Run with --help.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
