/**
 * Future event list for the discrete-event simulator.
 *
 * Binary min-heap ordered by (time, insertion sequence). The sequence
 * number makes ties deterministic: two events at the same time are
 * processed in the order they were scheduled (FIFO).
 *
 * The original C version used a time-sorted linked list (O(n) insert);
 * the heap gives O(log n) insert and pop.
 */
interface Entry<T> {
  time: number;
  seq: number;
  item: T;
}

export class EventQueue<T> {
  #heap: Entry<T>[] = [];
  #seq = 0;

  get size(): number {
    return this.#heap.length;
  }

  push(time: number, item: T): void {
    if (!Number.isFinite(time) || time < 0) {
      throw new Error(`event time must be a finite number >= 0, got ${time}`);
    }
    const heap = this.#heap;
    heap.push({ time, seq: this.#seq++, item });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(heap[i], heap[parent])) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  }

  peekTime(): number | undefined {
    return this.#heap[0]?.time;
  }

  pop(): { time: number; item: T } | undefined {
    const heap = this.#heap;
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < heap.length && before(heap[l], heap[smallest])) smallest = l;
        if (r < heap.length && before(heap[r], heap[smallest])) smallest = r;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }
    return { time: top.time, item: top.item };
  }
}

function before<T>(a: Entry<T>, b: Entry<T>): boolean {
  return a.time < b.time || (a.time === b.time && a.seq < b.seq);
}
