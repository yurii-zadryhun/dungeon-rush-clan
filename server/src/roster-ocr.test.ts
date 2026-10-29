import { describe, expect, it } from 'vitest';
import { formatPower, parsePower, parseRosterScreenshot } from './roster-ocr';
import type { VisionText } from './ocr';

describe('clan power units', () => {
  it('supports every game suffix with case-sensitive q vs Q', () => {
    expect(parsePower('1K')).toBe(1000);
    expect(parsePower('1M')).toBe(1e6);
    expect(parsePower('1B')).toBe(1e9);
    expect(parsePower('558.37T')).toBe(558.37e12);
    expect(parsePower('6.98q')).toBe(6.98e15);
    expect(parsePower('1.50Q')).toBe(1.5e18);
    expect(parsePower('garbage')).toBeNull();
    expect(parsePower('-2q')).toBeNull();
    expect(formatPower(9.64e15)).toBe('9.64q');
    expect(formatPower(91.78e12)).toBe('91.78T');
  });
  it('recognizes two-row cards and the first screenshot header', () => {
    const words = ([
      ['Power', 13, 40], ['77.80q', 220, 40],
      ['Members', 13, 92], ['48/50', 220, 92],
      ['КРОСТ', 15, 180], ['6.98q', 15, 238],
      ['aywy', 15, 348], ['9.64q', 15, 403],
      ['GIBURGERJOEY', 15, 516], ['2.46q', 15, 573],
    ] as const).map(([text, x, y]) => ({ text, x, y }));
    const input: VisionText = { raw: '', width: 600, height: 700, words };
    const result = parseRosterScreenshot(input, 1, 120);
    expect(result.reportedMembers).toBe(48);
    expect(result.capacity).toBe(50);
    expect(result.reportedPower).toBe(77.8e15);
    expect(result.players.map((row) => row.name)).toEqual(['КРОСТ', 'aywy', 'GIBURGERJOEY']);
    expect(result.players.map((row) => row.powerText)).toEqual(['6.98q', '9.64q', '2.46q']);
  });
});
