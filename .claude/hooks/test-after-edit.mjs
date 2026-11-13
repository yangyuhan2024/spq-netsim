#!/usr/bin/env node
// PostToolUse hook: after Claude edits a .ts file, run the matching test file.
//   src/foo.ts        -> test/foo.test.ts (if it exists)
//   test/foo.test.ts  -> that file
// On failure, exit 2 so the test output is fed back to Claude to fix.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const file = input.tool_input?.file_path;
if (typeof file !== 'string' || !file.endsWith('.ts')) process.exit(0);

const rel = relative(root, file).split('\\').join('/');
let testFile;
if (rel.startsWith('test/') && rel.endsWith('.test.ts')) testFile = rel;
else if (rel.startsWith('src/')) testFile = `test/${basename(rel, '.ts')}.test.ts`;
if (!testFile || !existsSync(join(root, testFile))) process.exit(0);

const run = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', testFile], {
  cwd: root,
  encoding: 'utf8',
  timeout: 110_000,
});

if (run.status !== 0) {
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`.split('\n');
  const failing = output.filter((l) => /^not ok|AssertionError|Error:|expected|actual/.test(l.trim()));
  console.error(`Tests failed after editing ${rel} (${testFile}):\n${failing.slice(0, 40).join('\n')}`);
  process.exit(2);
}
process.exit(0);
