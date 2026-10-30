import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const endpoint = source('server/src/ocr.ts');
const modal = source('web/src/screens/ClanRosterImportModal.tsx');
const styles = source('web/src/screens/ClanRosterImportModal.css');

assert.match(endpoint, /diagnostics\.push\(/, 'OCR preserves per-image diagnostic data');
assert.match(endpoint, /vision: extracted/, 'OCR includes original recognized text and word positions');
assert.match(endpoint, /parsed,/, 'OCR includes pre-deduplication parser results');
assert.match(modal, /JSON\.stringify\(result, null, 2\)/, 'Response JSON is captured without manual edits');
assert.match(modal, /<details className="clan-ocr-response">/, 'OCR output is collapsed by default');
assert.match(modal, /navigator\.clipboard\.writeText\(ocrResponseJson\)/, 'Complete JSON can be copied');
assert.match(styles, /\.clan-ocr-response pre/, 'Large OCR response is scrollable');
assert.match(modal, /clan-thumbnail-strip/, 'Screenshot thumbnails remain available');
assert.match(modal, /clan-thumbnail-remove/, 'Screenshots can be removed');
assert.doesNotMatch(modal, /moveScreenshot|ArrowUp|ArrowDown|clan-mosaic-preview|MOSAIC_WIDTH/,
  'Image sorting and full-size mosaic preview were removed');
assert.doesNotMatch(styles, /clan-mosaic|clan-thumbnail-actions/,
  'Unused mosaic gallery and sorting CSS were removed');

console.log('Clan roster OCR diagnostic UI checks passed');
