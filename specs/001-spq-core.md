# 001 – Strict priority queuing simulator core

Status: done

## Problem
Re-implement the course C simulator (strict priority queuing over M nodes with ON/OFF
sources) in TypeScript so it is testable, reproducible and easy to extend.

## Scope
- In: event loop, ON/OFF and Poisson sources, three priority queues per node, finite buffers,
  tagged reference flow across M nodes, per-node and end-to-end metrics, scenarios Q1–Q6, CLI.
- Out: link propagation delay, other schedulers (WFQ), preemption, charts.

## Behaviour
- Classes and priority: audio (0) > video (1) > data (2). Non-preemptive.
- Packet interval while ON = packetBytes × 8 / peakRateBps. ON and OFF times are exponential.
- K = waiting packets per class queue, excluding the one in service. Full queue → drop.
- Cross traffic enters and leaves at one node; the reference source enters node 1 and is
  forwarded hop by hop with no link delay.
- Metrics after warm-up: per node and class – arrivals, drops, blocking ratio, mean wait,
  mean delay, time-averaged and max backlog; reference flow – generated, dropped, delivered,
  blocking ratio, mean and max end-to-end delay.

## Acceptance criteria
- [x] AC1: Same config and seed → identical results. (simulator.test: determinism)
- [x] AC2: arrivals = drops + departures + remaining at every node and class. (conservation)
- [x] AC3: At load 0.9, mean delay audio < video < data at every node. (strict priority)
- [x] AC4: Smaller buffer → higher blocking and lower delay for the reference flow. (Q2 finding)
- [x] AC5: More hops → larger end-to-end delay. (Q3 vs Q1)
- [x] AC6: Invalid configs fail with every problem listed. (validateConfig)
- [x] AC7: K = 0 still serves packets that find the link idle.

## Test cases
See `test/simulator.test.ts`, `test/traffic.test.ts`, `test/eventQueue.test.ts`.
