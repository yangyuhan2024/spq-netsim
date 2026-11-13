---
description: Line-by-line review of the current diff against the project checklist
argument-hint: "[optional: base branch, default main]"
---
Review the changes on this branch. Base branch: "$ARGUMENTS" (use `main` if that is empty).

1. Run `git diff <base>...HEAD` and `git status` and read every changed line.
2. Check each item and report findings with file:line:
   - Units: bits vs bytes, seconds vs ms, bps vs Mb/s.
   - Warm-up: are statistics only counted for packets that arrived after warm-up?
   - Backlog integration happens BEFORE the queue length changes.
   - Division by zero / empty classes return null, not NaN or 0.
   - Determinism: no Math.random(), no dependence on object key order or wall-clock time.
   - Strict priority and non-preemption still hold.
   - Tests: do they assert something meaningful, or would they still pass if the code were wrong?
     Name one mutation of the code that the tests would NOT catch, if there is one.
3. Run `npm run check` and include the result.
4. Finish with: must-fix, should-fix, and fine-as-is. Do not edit files during the review.
