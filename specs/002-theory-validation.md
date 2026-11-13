# 002 – Validate the simulator against queueing theory

Status: done

## Problem
A simulator can pass "it runs" tests and still be wrong. We need checks against
closed-form results.

## Behaviour
- Single node, Poisson arrivals, fixed packet size (deterministic service), effectively
  infinite buffer.
- One class: compare mean waiting time with M/D/1, W = λS² / (2(1 − ρ)).
- Three classes: compare with the non-preemptive priority formula (Cobham),
  W_k = W0 / ((1 − σ_{k−1})(1 − σ_k)), W0 = Σ λ_i S_i² / 2.
- `npm run validate` prints simulated vs theoretical values and the relative error.

## Acceptance criteria
- [x] AC1: M/D/1 at ρ = 0.3, 0.5, 0.7 within 6%.
- [x] AC2: Priority waits within 6% (audio, video) and 10% (data, fewer samples).
- [x] AC3: Formula unit tests: known value, overload returns Infinity, one class equals M/D/1.

## Note
The original course Q6 used ON/OFF sources; it is changed to Poisson here because ON/OFF
traffic has no simple closed form.
