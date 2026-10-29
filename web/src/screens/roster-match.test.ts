import { describe, expect, it } from 'vitest';
import { levenshtein, matchRosterName } from './roster-match';

const known = {
  latest: null,
  players: [
    { id: 1, name: 'КРОСТ', active: 1 },
    { id: 2, name: 'Dexterium', active: 1 },
    { id: 3, name: 'Jaishin', active: 1 },
    { id: 4, name: 'Mad1ar', active: 1 },
    { id: 5, name: 'PointJam', active: 1 },
    { id: 6, name: 'Lareauz', active: 1 },
    { id: 7, name: 'Mister', active: 1 },
    { id: 8, name: 'Master', active: 1 },
  ],
  aliases: [{ normalizedName: 'old-name', playerId: 2 }],
};

describe('OCR roster matching', () => {
  it('counts substitutions, deletions and insertions', () => {
    expect(levenshtein('dexterium', 'dexterum')).toBe(1);
    expect(levenshtein('dexterium', 'dexterim')).toBe(1);
    expect(levenshtein('dexterium', 'dexteriumm')).toBe(1);
  });
  it('matches canonical and alias names without edits', () => {
    expect(matchRosterName('  DEXTERIUM ', known)?.playerId).toBe(2);
    expect(matchRosterName('old-name', known)?.playerId).toBe(2);
  });
  it('matches OCR lookalikes, including Latin KPOCT', () => {
    expect(matchRosterName('KPOCT', known)?.playerId).toBe(1);
  });
  it('corrects uniquely close OCR errors without inventing an identity', () => {
    expect(matchRosterName('Dexterlum', known)?.playerId).toBe(2);
    expect(matchRosterName('Jaishln', known)?.playerId).toBe(3);
    expect(matchRosterName('PointJarn', known)?.playerId).toBe(5);
    expect(matchRosterName('TotallyDifferent', known)).toBeNull();
  });
  it('avoids arbitrary selection when equally close candidates exist', () => {
    expect(matchRosterName('Moster', known)).toBeNull();
  });
  it('can disable approximate matching while typing', () => {
    expect(matchRosterName('Dexterlum', known, false)).toBeNull();
    expect(matchRosterName('KPOCT', known, false)?.playerId).toBe(1);
  });
});
