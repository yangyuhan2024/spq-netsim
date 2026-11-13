/**
 * Closed-form queueing results used to validate the simulator.
 * All service times are deterministic (fixed packet size / link rate).
 */

/** M/D/1 mean waiting time in queue: W = lambda * S^2 / (2 (1 - rho)). */
export function md1WaitSec(lambda: number, serviceSec: number): number {
  const rho = lambda * serviceSec;
  if (rho >= 1) return Infinity;
  return (lambda * serviceSec * serviceSec) / (2 * (1 - rho));
}

export interface PriorityClassInput {
  /** Arrival rate, packets per second. */
  lambda: number;
  /** Deterministic service time, seconds. */
  serviceSec: number;
}

/**
 * Non-preemptive priority M/G/1 (Cobham's formula).
 * Classes are given highest priority first.
 *   W0  = sum_i lambda_i E[S_i^2] / 2       (residual work of the packet in service)
 *   W_k = W0 / ((1 - sigma_{k-1}) (1 - sigma_k)),  sigma_k = rho_1 + ... + rho_k
 */
export function nonPreemptivePriorityWaitSec(classes: PriorityClassInput[]): number[] {
  const w0 = classes.reduce((s, c) => s + (c.lambda * c.serviceSec * c.serviceSec) / 2, 0);
  const waits: number[] = [];
  let sigmaPrev = 0;
  for (const c of classes) {
    const sigma = sigmaPrev + c.lambda * c.serviceSec;
    waits.push(sigma >= 1 ? Infinity : w0 / ((1 - sigmaPrev) * (1 - sigma)));
    sigmaPrev = sigma;
  }
  return waits;
}
