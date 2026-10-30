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
  it('does not lose long or lower card names on a six-card mosaic', () => {
    const names = ['КРОСТ', 'Dexterium', 'Jaishin', 'Mad1ar', 'PointJam', 'Lareauz'];
    const words = names.flatMap((name, index) => [
      { text: name, x: 20, y: 190 + index * 115 },
      { text: '2.34q', x: 20, y: 241 + index * 115 },
    ]);
    const result = parseRosterScreenshot({ raw: '', width: 600, height: 1000, words }, 1, 120);
    expect(result.players.map((row) => row.name)).toEqual(names);
    expect(result.warnings).toEqual([]);
  });

  it('handles name and power on the same line without losing the player', () => {
    const words = [
      { text: 'Dexterium', x: 10, y: 200 },
      { text: '1.54q', x: 160, y: 200 },
      { text: 'Captain', x: 10, y: 260 },
      { text: 'Jaishin', x: 10, y: 310 },
      { text: '3.11q', x: 10, y: 365 },
    ];
    const result = parseRosterScreenshot({ raw: '', width: 600, height: 500, words }, 1, 0);
    expect(result.players.map((row) => row.name)).toEqual(['Dexterium', 'Jaishin']);
  });

  it('recognizes two-row cards and the first screenshot header', () => {
    const words = (
      [
        ['Power', 13, 40],
        ['77.80q', 220, 40],
        ['Members', 13, 92],
        ['48/50', 220, 92],
        ['КРОСТ', 15, 180],
        ['6.98q', 15, 238],
        ['aywy', 15, 348],
        ['9.64q', 15, 403],
        ['GIBURGERJOEY', 15, 516],
        ['2.46q', 15, 573],
      ] as const
    ).map(([text, x, y]) => ({ text, x, y }));
    const input: VisionText = { raw: '', width: 600, height: 700, words };
    const result = parseRosterScreenshot(input, 1, 120);
    expect(result.reportedMembers).toBe(48);
    expect(result.capacity).toBe(50);
    expect(result.reportedPower).toBe(77.8e15);
    expect(result.players.map((row) => row.name)).toEqual(['КРОСТ', 'aywy', 'GIBURGERJOEY']);
    expect(result.players.map((row) => row.powerText)).toEqual(['6.98q', '9.64q', '2.46q']);
  });

  it('ignores cropped game roles and never creates partial Member/Captain players', () => {
    const words = [
      { text: 'Memb', x: 25, y: 180 },
      { text: '558.37T', x: 25, y: 220 },
      { text: 'Captai', x: 25, y: 280 },
      { text: '9.64q', x: 25, y: 323 },
      { text: 'O Memb', x: 25, y: 380 },
      { text: '1.40q', x: 25, y: 423 },
      { text: 'O M', x: 25, y: 446 },
      { text: '1.12q', x: 25, y: 465 },
      { text: 'КРОСТ', x: 25, y: 485 },
      { text: '5.59q', x: 25, y: 530 },
    ];
    const result = parseRosterScreenshot({ raw: '', width: 600, height: 620, words }, 1);
    expect(result.players).toEqual([{ name: 'КРОСТ', power: 5.59e15, powerText: '5.59q', source: 1 }]);
  });

  it('recovers the reported OCR failure: IM is a tier badge, not a player', () => {
    // Positions and strings are taken from a real multi-page roster OCR response.
    const words = [
      { text: 'КРОСТ', x: 26, y: 157 },
      { text: '6.989', x: 88, y: 205 },
      { text: 'aywy', x: 27, y: 323 },
      { text: '9.649', x: 89, y: 364 },
      { text: 'GIBURGERJOEY', x: 27, y: 470 },
      { text: '2.469', x: 90, y: 523 },
      { text: 'Mishko', x: 27, y: 627 },
      { text: 'M', x: 43, y: 679 },
      { text: '4.37q', x: 90, y: 679 },
      { text: 'Den', x: 28, y: 2140 },
      { text: 'Haag', x: 99, y: 2140 },
      { text: 'Wartet', x: 192, y: 2140 },
      { text: 'IM', x: 33, y: 2192 },
      { text: '101.29T', x: 91, y: 2192 },
      { text: 'ilbctc', x: 27, y: 3491 },
      { text: 'IM', x: 33, y: 3544 },
      { text: '509.77T', x: 92, y: 3544 },
    ];
    const result = parseRosterScreenshot({ raw: '', width: 420, height: 4277, words }, 1);
    expect(result.players.map((entry) => entry.name)).toEqual([
      'КРОСТ', 'aywy', 'GIBURGERJOEY', 'Mishko', 'Den Haag Wartet', 'ilbctc',
    ]);
    expect(result.players.map((entry) => entry.powerText)).toEqual([
      '6.98q', '9.64q', '2.46q', '4.37q', '101.29T', '509.77T',
    ]);
    expect(result.warnings.filter((warning) => warning.startsWith('Verify '))).toHaveLength(3);
    expect(result.warnings.some((warning) => warning.includes('Conflicting power values'))).toBe(false);
  });

  it('keeps the names lost because Vision read q/T as digits on the second screenshot', () => {
    const words = [
      { text: 'Lareauz', x: 28, y: 189 },
      { text: '1.299', x: 90, y: 240 },
      { text: 'noobgo', x: 27, y: 1488 },
      { text: 'IM', x: 33, y: 1540 },
      { text: '244.30T', x: 91, y: 1541 },
      { text: 'Point', x: 28, y: 2014 },
      { text: 'Jam', x: 126, y: 2014 },
      { text: '106.847', x: 92, y: 2065 },
    ];
    const result = parseRosterScreenshot({ raw: '', width: 420, height: 2200, words }, 2);
    expect(result.players.map((entry) => entry.name)).toEqual(['Lareauz', 'noobgo', 'Point Jam']);
    expect(result.players.map((entry) => entry.powerText)).toEqual(['1.29q', '244.30T', '106.84T']);
    expect(result.warnings.filter((warning) => warning.startsWith('Verify '))).toHaveLength(2);
  });

  it('does not silently reinterpret arbitrary numbers or erase a legitimate short name', () => {
    const words = [
      { text: 'IM', x: 20, y: 200 },
      { text: '4.99q', x: 130, y: 200 },
      { text: 'Other', x: 22, y: 340 },
      { text: '2.123', x: 90, y: 390 },
    ];
    const result = parseRosterScreenshot({ raw: '', width: 420, height: 500, words }, 1);
    expect(result.players.map((entry) => entry.name)).toEqual(['IM']);
    expect(result.warnings.every((warning) => !warning.includes('interpreted as'))).toBe(true);
  });

  it('does not warn about repeated cards from overlapping screenshots', () => {
    const words = [
      { text: 'Mishko', x: 22, y: 200 },
      { text: '4.74q', x: 22, y: 250 },
      { text: 'Mishko', x: 22, y: 360 },
      { text: '4.74q', x: 22, y: 410 },
    ];
    const result = parseRosterScreenshot({ raw: '', width: 600, height: 500, words }, 1);
    expect(result.players).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });
});
