# CLAUDE.md – spq-netsim

Project instructions for Claude Code. Read this before every task.

## What this project is
A discrete-event simulator for **strict priority queuing (SPQ)** across a chain of
network nodes. Three traffic classes share each output link:
audio (Premium/EF) > video (Assured Forwarding) > data (Best Effort).
Sources are exponential ON/OFF (or Poisson for validation). One tagged
reference flow crosses all nodes; cross traffic enters and leaves at one node.

Stack: Node.js >= 22.18 running TypeScript directly (type stripping), no build step,
no runtime dependencies. Tests use `node:test` + `node:assert/strict`.

## Commands
- `npm test` – all tests (must pass before you say a task is done)
- `npm run typecheck` – `tsc --noEmit` (must pass)
- `npm run check` – both of the above
- `npm run sim -- run --scenario q1 --load 0.6` – one run
- `npm run sim -- sweep --scenario q1 --out results/q1.csv` – load sweep
- `npm run validate` – simulator vs queueing theory

## Layout
- `src/types.ts` – shared types, class names, priorities
- `src/rng.ts` – seeded PRNG (mulberry32) + exponential sampling
- `src/eventQueue.ts` – binary min-heap, ties broken by insertion order
- `src/traffic.ts` – default class parameters, rates, load ↔ number of sources
- `src/simulator.ts` – the event loop (turnOn / generate / departure)
- `src/theory.ts` – M/D/1 and non-preemptive priority (Cobham) formulas
- `src/validation.ts` – runs the simulator against the formulas
- `src/scenarios.ts` – Q1–Q6 definitions
- `src/report.ts`, `src/cli.ts` – output formatting and command line
- `specs/` – one spec per feature, written before code
- `test/` – one test file per module

## Model rules (do not change silently)
- Units: time in **seconds**, rates in **bits per second**, sizes in **bytes**.
  Convert to ms only in `report.ts`. Name variables with their unit (`durationSec`, `linkRateBps`).
- Scheduling is **non-preemptive** strict priority: a packet in service always finishes.
- `bufferPackets` (K) is the waiting room **per class queue**, excluding the packet in service.
  An arrival to an idle link is served immediately even when K = 0.
- No propagation delay between nodes.
- Statistics ignore anything that arrives before `warmupSec`. Backlog is time-averaged
  over `[warmupSec, durationSec]`.
- Every random number comes from the single seeded `Rng`. Never use `Math.random()`.
- If a change would alter any of these rules, stop and ask first.

## Code conventions
- Erasable TypeScript only: no `enum`, no `namespace`, no constructor parameter properties
  (Node strips types; it does not compile them). Use `as const` objects instead of enums.
- Relative imports include the `.ts` extension; type-only imports use `import type`.
- Keep functions pure where possible; the simulator takes a config and returns a result.
- Validate inputs at the boundary (`validateConfig`, CLI parsing) and fail with a clear message.
- No new dependencies without asking.

## How to work in this repo
1. For a new feature, write or update a spec in `specs/` first (`/spec`).
2. Implement in **small steps**. Each step: add/adjust a test, make it pass, run `npm run check`.
3. Keep diffs small and focused; do not reformat unrelated code.
4. After implementing, review the diff with `/review` or the `sim-reviewer` subagent.
5. Summarise what changed, how it was verified, and anything you are unsure about.

## What a good test looks like here
- Deterministic: fixed seed, so a failure is reproducible.
- Checks a property or a known value, not just "it runs".
- Covers edge cases: K = 0, empty classes, load near 1, warm-up boundary, ties at the same time,
  ON period shorter than the packet interval, rounding of source counts.
- Statistical checks use a stated tolerance and a duration long enough to make it stable.

## Things that look right but are wrong (check for these in every review)
- bits vs bytes (`packetBytes * 8`), seconds vs milliseconds.
- Counting a packet's delay when it arrived before warm-up.
- Updating backlog area **after** changing the queue length (must be before).
- Dividing by zero when a class has no packets (return `null`, print `-`).
- Floating-point load steps (use `loadRange`).
- Using peak rate × duty cycle for the ON/OFF mean rate (see `meanPacketRate`).

## Security
- Never read or print `.env`, `secrets/`, keys or certificates. A PreToolUse hook blocks this.
- Do not push to remote or rewrite git history; the human does that.
