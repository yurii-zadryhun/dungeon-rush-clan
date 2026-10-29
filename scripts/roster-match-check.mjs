import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Test the production pure matching algorithm without importing React or UI components.
const source = readFileSync(
  new URL('../web/src/screens/roster-match.ts', import.meta.url),
  'utf8',
).replace(
  /^import \{ normalizeName, type ClanRosterCandidates \} from '\.\.\/api';/m,
  "const normalizeName = (value: string) => value.normalize('NFKC').trim().replace(/\\s+/g, ' ').toLocaleLowerCase();\ntype ClanRosterCandidates = { players: Array<{ id: number; name: string }>; aliases: Array<{ normalizedName: string; playerId: number }> };",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { levenshtein, matchRosterName } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
const candidates = {
  players: [
    { id: 1, name: 'КРОСТ' },
    { id: 2, name: 'Dexterium' },
    { id: 3, name: 'Jaishin' },
    { id: 4, name: 'Mad1ar' },
    { id: 5, name: 'PointJam' },
    { id: 6, name: 'Lareauz' },
    { id: 7, name: 'Mister' },
    { id: 8, name: 'Master' },
  ],
  aliases: [{ normalizedName: 'old-name', playerId: 2 }],
};
assert.equal(levenshtein('dexterium', 'dexterum'), 1);
assert.equal(matchRosterName('KPOCT', candidates)?.playerId, 1);
assert.equal(matchRosterName('Dexterlum', candidates)?.playerId, 2);
assert.equal(matchRosterName('Jaishln', candidates)?.playerId, 3);
assert.equal(matchRosterName('PointJarn', candidates)?.playerId, 5);
assert.equal(matchRosterName('old-name', candidates)?.playerId, 2);
assert.equal(matchRosterName('DEXTERIUM', candidates)?.playerId, 2);
assert.equal(matchRosterName('TotallyDifferent', candidates), null);
assert.equal(matchRosterName('Moster', candidates), null);
assert.equal(matchRosterName('Dexterlum', candidates, false), null);
console.log('Roster name reconciliation passed');
