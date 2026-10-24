import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the same pure resolution logic shipped to the browser.
const input = readFileSync(new URL('../web/src/locale.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(input, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(javascript).toString('base64');
const { resolveLocale } = await import(moduleUrl);

assert.equal(resolveLocale('en', ['uk-UA']), 'en', 'Saved choice beats browser');
assert.equal(resolveLocale('uk', ['en-US']), 'uk', 'Saved choice beats browser');
assert.equal(resolveLocale(null, ['en-US']), 'en', 'English browser chosen on first visit');
assert.equal(resolveLocale(null, ['uk-UA']), 'uk', 'Ukrainian browser chosen on first visit');
assert.equal(resolveLocale(null, ['pl-PL', 'en-GB']), 'en', 'Secondary supported language used');
assert.equal(resolveLocale(null, ['fr-FR']), 'uk', 'Unknown browser locale falls back to Ukrainian');
assert.equal(resolveLocale('invalid', ['en-GB']), 'en', 'Invalid saved preference ignored');
assert.equal(resolveLocale(null, []), 'uk', 'Empty language list falls back predictably');
console.log('Browser locale resolution tests passed');
