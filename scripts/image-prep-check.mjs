import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Test the exact crop geometry shipped to the browser without needing a DOM.
const source = readFileSync(new URL('../web/src/screens/image-prep.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { regions, screenshotAspectSupported } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);

const { rows, header } = regions.clan;
// Calibrated against the actual composite previews: left-side avatars stop
// near x=0.26, while clan roles begin to intrude past roughly x=0.62.
// Nicknames and their power remain together in the central strip.
assert.ok(rows.x >= 0.24 && rows.x <= 0.28, 'Avatar area must be excluded');
assert.ok(rows.width >= 0.32 && rows.x + rows.width >= 0.59, 'Long nicknames must fit');
assert.ok(rows.x + rows.width <= 0.64, 'Right-side clan role labels must be excluded');
assert.ok(rows.y <= 0.48, 'The first player card must be included');
assert.ok(rows.y + rows.height <= 0.79, 'Bottom game navigation must be excluded');
assert.ok(
  header.y >= 0.35 && header.y <= 0.4,
  'Header must start above Power and omit clan description',
);
assert.ok(header.y + header.height < rows.y, 'Header cannot overlap the first card');
assert.ok(screenshotAspectSupported(709, 1536), 'Standard game screenshot is accepted');
assert.equal(screenshotAspectSupported(1536, 709), false, 'Landscape screenshots are rejected');
console.log('OCR screenshot crop geometry passed');
