---
description: Implement an approved spec in small, tested steps
argument-hint: <path to spec, e.g. specs/003-wfq.md>
---
Implement the spec at $ARGUMENTS.

Rules:
- Read the spec and CLAUDE.md first. If anything in the spec conflicts with the model rules
  in CLAUDE.md, stop and ask.
- Break the work into steps of at most ~50 changed lines each. Show me the step list first.
- For each step: write or update the test first, run it and confirm it fails for the right
  reason, then change the code, then run `npm run check`.
- Keep the diff focused. No drive-by refactors, no new dependencies.
- After each step, give me: files changed, what the test proves, and the `npm run check` result.
  Then wait for "next" before continuing.
- When all acceptance criteria are covered, tick them off in the spec and list any
  assumptions you made.
