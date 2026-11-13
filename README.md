# spq-netsim

A discrete-event simulator for **strict priority queuing** in a chain of network nodes,
written in TypeScript for Node.js and developed with **Claude Code**.

It is a personal re-implementation of a simulator I first built in C for a computer
networks course project at Lakehead University, extended with seeded reproducible runs,
an automated test suite and checks against queueing theory.

```
 audio  ON/OFF ─┐                ┌──────── node 1 ────────┐        ┌── node M ──┐
 video  ON/OFF ─┼─► classify ──► │ [audio]  ─┐             │        │            │
 data   ON/OFF ─┘                │ [video]  ─┼─► link C ───┼─ ... ─►│    ...     ├─► sink
 reference flow ───────────────► │ [data]   ─┘ (strict     │        │            │
                                 │             priority)   │        │            │
                                 └─────────────────────────┘        └────────────┘
```

## What it models
- Three classes with strict, non-preemptive priority: **audio (EF) > video (AF) > data (BE)**.
- Exponential **ON/OFF** sources (constant packet spacing while ON) or **Poisson** sources.
- Finite buffer of K packets per class queue; arrivals to a full queue are dropped.
- A tagged **reference flow** crosses all M nodes; cross traffic enters and leaves at one node.
- Metrics after a warm-up period: per-node delay, waiting time, blocking ratio and
  time-averaged backlog per class; end-to-end delay and blocking for the reference flow.

## Quick start
Requires **Node.js 22.18 or newer** (runs TypeScript directly, no build step).

```bash
npm install          # only dev tools: typescript, @types/node
npm test             # 35+ tests
npm run sim -- list
npm run sim -- run --scenario q1 --load 0.6
npm run sim -- sweep --scenario q1 --out results/q1.csv
npm run validate     # simulator vs M/D/1 and priority queueing formulas
```

## Scenarios
| id | setup |
|----|-------|
| q1 | 5 nodes, K = 900, audio reference |
| q2 | 5 nodes, K = 100, audio reference |
| q3 | 10 nodes, K = 900, audio reference |
| q4 | 5 nodes, K = 900, video reference |
| q5 | 5 nodes, K = 900, data (best-effort) reference |
| q6 | 1 node, audio only, Poisson – compared with M/D/1 |

Options: `--seed`, `--duration`, `--warmup`, `--buffer`, `--nodes`, `--trace file.csv`
(per-packet log of the reference flow), and for sweeps `--from --to --step --out`.

## How correctness is checked
- **Unit tests** for the RNG, event queue (time order, FIFO tie-break) and traffic maths.
- **Property tests** on the simulator: determinism per seed, packet conservation at every
  node, priority order of delays, buffer/blocking trade-off, more hops → more delay.
- **Edge cases**: K = 0, idle network (delay = M × transmission time), ON period shorter
  than the packet interval, float drift in load steps, invalid configs.
- **Theory**: single-node Poisson runs match M/D/1 and the non-preemptive priority
  (Cobham) formula within a few percent (`npm run validate`).

## Working with Claude Code
This repo is set up so Claude Code follows the project rules:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | model rules, units, conventions, review checklist |
| `.claude/commands/spec.md` | `/spec` – request → spec with acceptance criteria, no code |
| `.claude/commands/implement.md` | `/implement` – small test-first steps, stop after each |
| `.claude/commands/review.md` | `/review` – line-by-line diff review against the checklist |
| `.claude/commands/sweep.md` | `/sweep` – run a sweep and sanity-check the trends |
| `.claude/agents/sim-reviewer.md` | read-only reviewer subagent |
| `.claude/hooks/block-secrets.mjs` | PreToolUse: blocks reading `.env`, keys, `secrets/` |
| `.claude/hooks/test-after-edit.mjs` | PostToolUse: runs the matching test after each edit |
| `specs/` | specs written before code; `BACKLOG.md` lists next features |
| `docs/BUILD_LOG.md` | log of how each change was directed and verified |

## Project layout
```
src/   rng, eventQueue, traffic, simulator, theory, validation, scenarios, report, cli
test/  one test file per module + CLI and hook tests
specs/ feature specs and backlog
docs/  build log, setup tutorial (Chinese)
```

## Default traffic parameters
| class | packet | peak rate | mean ON | mean OFF |
|-------|--------|-----------|---------|----------|
| audio | 120 B | 64 kb/s | 0.36 s | 0.64 s |
| video | 1000 B | 384 kb/s | 0.33 s | 0.73 s |
| data | 1500 B | 1 Mb/s | 0.5 s | 1.5 s |

Link rate 10 Mb/s. These are typical textbook values; change them in `src/traffic.ts`.
