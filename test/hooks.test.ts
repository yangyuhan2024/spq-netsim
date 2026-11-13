import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const runHook = (payload: unknown) =>
  spawnSync(process.execPath, ['.claude/hooks/block-secrets.mjs'], { input: JSON.stringify(payload), encoding: 'utf8' });

test('block-secrets hook blocks .env, secrets/ and key files', () => {
  const blocked = [
    { tool_name: 'Read', tool_input: { file_path: '/repo/.env' } },
    { tool_name: 'Read', tool_input: { file_path: '/repo/.env.production' } },
    { tool_name: 'Bash', tool_input: { command: 'cat .env | grep KEY' } },
    { tool_name: 'Read', tool_input: { file_path: '/repo/secrets/stripe.json' } },
    { tool_name: 'Read', tool_input: { file_path: '/repo/certs/server.pem' } },
  ];
  for (const p of blocked) {
    const r = runHook(p);
    assert.equal(r.status, 2, `should block ${JSON.stringify(p.tool_input)}`);
    assert.match(r.stderr, /Blocked/);
  }
});

test('block-secrets hook allows normal files and .env.example', () => {
  const allowed = [
    { tool_name: 'Read', tool_input: { file_path: '/repo/src/simulator.ts' } },
    { tool_name: 'Read', tool_input: { file_path: '/repo/.env.example' } },
    { tool_name: 'Bash', tool_input: { command: 'npm test' } },
    { tool_name: 'Read', tool_input: { file_path: '/repo/src/environment.ts' } },
  ];
  for (const p of allowed) assert.equal(runHook(p).status, 0, `should allow ${JSON.stringify(p.tool_input)}`);
});
