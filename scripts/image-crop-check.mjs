import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Keep this regression test browser-free: verify the actual geometry shipped to
// the client, rather than maintaining a second copy of the crop constants.
const source = readFileSync(new URL('../web/src/screens/image-prep.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { regions, MOSAIC_WIDTH, screenshotAspectSupported } =
  await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const { header, rows } = regions.clan;
assert.ok(header, 'Clan screenshot includes a metadata header');
for (const region of [header, rows, regions.ranking.rows]) {
  assert.ok(region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0);
  assert.ok(region.x + region.width <= 1 && region.y + region.height <= 1,
    'Regions stay within the source screenshot');
}

// Real screenshots showed unnecessary titles/URLs above Power and avatars/roles
// beside player names. These checks prevent the old noisy crop from returning.
assert.ok(header.y >= 0.35 && header.y + header.height <= 0.47,
  'Header captures Power / Tier / Type / Members, not the banner or description');
assert.ok(rows.x >= 0.24 && rows.x <= 0.28,
  'Left edge excludes character avatars while preserving player names');
assert.ok(rows.x + rows.width <= 0.64 && rows.width >= 0.32,
  'Right edge excludes role labels without cutting long nicknames');
assert.ok(rows.y >= 0.45 && rows.y + rows.height <= 0.79,
  'Bottom edge excludes empty roster navigation tabs');
assert.ok(MOSAIC_WIDTH.clan < MOSAIC_WIDTH.ranking,
  'Narrow clan crops use lower mosaic width so uploads stay compact');

// Five 1080x2400 screenshots should not create excessively tall mosaics.
const scaled = (part) =>
  Math.round(MOSAIC_WIDTH.clan * 2400 * part.height / (1080 * part.width));
const mosaicHeight = scaled(header) + 24 + 5 * (scaled(rows) + 24);
assert.ok(mosaicHeight < 4800, 'Five-card clan mosaic stays manageable for OCR');
assert.equal(screenshotAspectSupported(1080, 2400), true);
assert.equal(screenshotAspectSupported(300, 1000), false);
console.log('Clan screenshot crop geometry tests passed');
