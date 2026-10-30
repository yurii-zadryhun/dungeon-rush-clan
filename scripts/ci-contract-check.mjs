import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/check.yml', import.meta.url), 'utf8');

// The Check workflow must never be temporarily used as an autoformatter.
// Validate the rules in CI so future changes cannot silently reintroduce this.
assert.match(workflow, /^permissions:\r?\n {2}contents: read$/m);
assert.match(workflow, /^\s+- run: npm run format:check$/m);
assert.match(workflow, /^\s+- run: node scripts\/ci-contract-check\.mjs$/m);

const prohibited = [
  [/^\s*contents:\s*write\s*$/m, 'CI must not receive contents: write'],
  [/^\s*permissions:\s*write-all\s*$/m, 'CI must not receive write-all permissions'],
  [/\bnpm\s+run\s+format(?!:check)(?:\s|$)/m, 'CI must not format source files'],
  [/\bprettier\b[^\n]*\s--write\b/m, 'CI must not run Prettier with --write'],
  [/\bgit\s+(?:push|commit)\b/m, 'CI must not commit or push changes'],
];

for (const [pattern, message] of prohibited) {
  assert.doesNotMatch(workflow, pattern, message);
}

console.log('Read-only CI and formatting policy verified');
