#!/usr/bin/env node
// PreToolUse hook: stop Claude Code from reading, editing or printing secrets.
// Input: JSON on stdin ({ tool_name, tool_input, ... }).
// Exit 2 blocks the tool call; the stderr message is shown to Claude.
import { readFileSync } from 'node:fs';

const SECRET_PATTERNS = [
  /(^|[\s/"'=])\.env(\.[\w-]+)?($|[\s"'/;|&])/, // .env, .env.local ...
  /(^|[\s/"'])secrets\//,
  /\.(pem|key|p12|pfx)($|[\s"'])/,
  /id_(rsa|ed25519)/,
];
const ALLOWED = [/\.env\.example($|[\s"'])/];

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0); // not our business if the payload is unreadable
}

const ti = input.tool_input ?? {};
const candidates = [ti.file_path, ti.path, ti.pattern, ti.command].filter((v) => typeof v === 'string');

for (const text of candidates) {
  const stripped = ALLOWED.reduce((s, re) => s.replace(re, ' '), text);
  if (SECRET_PATTERNS.some((re) => re.test(stripped))) {
    console.error(
      `Blocked by .claude/hooks/block-secrets.mjs: "${text}" looks like a secret file. ` +
        'Secrets must stay out of the agent context. Ask the human if you really need a value.',
    );
    process.exit(2);
  }
}
process.exit(0);
