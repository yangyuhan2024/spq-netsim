# Backlog – next features

Each item should go through `/spec` → review the spec → `/implement` → `/review`.

1. **003 Confidence intervals across seeds** – `sweep --seeds 10` runs each load with several
   seeds and reports mean and 95% CI (t-distribution) for the reference delay and blocking.
2. **004 Link propagation delay** – optional per-link delay in seconds; end-to-end delay must
   increase by exactly M × delay at low load.
3. **005 Weighted fair queuing** – a `--scheduler wfq` option with class weights, compared with
   SPQ. Check that data no longer starves at high load.
4. **006 Sweep chart** – write a self-contained HTML/SVG chart of delay vs load from a sweep CSV.
5. **007 JSON config file** – `run --config my.json` to override class parameters, with
   validation errors that name the bad field.
