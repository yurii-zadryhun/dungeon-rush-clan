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
// Names start around 15% and power below them; role labels start near 78%.
// The old x=23% crop cut names like Captain into "Captai" and "Member" into "Memb".
assert.ok(rows.x <= 0.13, 'Player name and power must not be cut off on the left');
assert.ok(rows.x + rows.width >= 0.68, 'Long nicknames must fit');
assert.ok(rows.x + rows.width <= 0.76, 'Right-side clan role labels must be excluded');
assert.ok(rows.y <= 0.48, 'The first player card must be included');
assert.ok(rows.y + rows.height <= 0.83, 'Bottom game navigation must be excluded');
assert.ok(header.y <= 0.16, 'Header must include power and member count at the top');
assert.ok(header.y + header.height < rows.y, 'Header cannot overlap the first card');
assert.ok(screenshotAspectSupported(709, 1536), 'Standard game screenshot is accepted');
assert.equal(screenshotAspectSupported(1536, 709), false, 'Landscape screenshots are rejected');
console.log('OCR screenshot crop geometry passed');
