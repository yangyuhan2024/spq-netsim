---
description: Turn a feature request into a spec with acceptance criteria and test cases (no code)
argument-hint: <feature request in plain words>
---
Write a spec for this feature request: $ARGUMENTS

1. Read CLAUDE.md, specs/TEMPLATE.md and the existing specs in specs/ so the numbering and style match.
2. Read the source files the feature will touch. Do NOT change any code in this step.
3. If the request is ambiguous (units, where a metric is measured, what happens at the edges),
   list your questions first and wait for my answers before writing the spec.
4. Create `specs/NNN-short-name.md` from the template. Acceptance criteria must be checkable
   by a test. Include edge cases (empty input, K = 0, load near 1, warm-up boundary, rounding).
5. List which files you expect to change and which tests you will add.
6. Stop and show me the spec. Do not start implementing.
