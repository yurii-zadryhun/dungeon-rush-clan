import type { VisionText, Word } from './ocr';
import { normalizeName } from './database';

export const POWER_UNITS = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, q: 1e15, Q: 1e18 } as const;

export function parsePower(input: string): number | null {
  const match = input.replace(/\s+/g, '').match(/^(\d{1,5}(?:[.,]\d{1,4})?)([KMBTqQ])$/);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.')) * POWER_UNITS[match[2] as keyof typeof POWER_UNITS];
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function formatPower(power: number): string {
  if (!Number.isFinite(power) || power < 0) return '—';
  const units = Object.entries(POWER_UNITS).reverse() as [string, number][];
  const unit = units.find(([, factor]) => power >= factor);
  if (!unit) return String(Math.round(power));
  return (power / unit[1]).toFixed(2).replace(/\.?0+$/, '') + unit[0];
}

export interface RecognizedPower {
  name: string;
  power: number;
  powerText: string;
  source: number;
}
export interface RosterRecognition {
  players: RecognizedPower[];
  reportedMembers: number | null;
  capacity: number | null;
  reportedPower: number | null;
  reportedPowerText: string | null;
  warnings: string[];
}

const powerMatch = /(?:^|[^\p{L}\p{N}])(\d{1,5}(?:[.,]\d{1,4})?)\s*([KMBTqQ])(?=$|[^\p{L}])/u;

function lines(words: Word[]): { y: number; text: string }[] {
  const groups: { y: number; words: Word[] }[] = [];
  for (const word of words.slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = groups.find((item) => Math.abs(item.y - word.y) <= 11);
    if (!row) {
      row = { y: word.y, words: [] };
      groups.push(row);
    }
    row.words.push(word);
    row.y += (word.y - row.y) / row.words.length;
  }
  return groups
    .sort((a, b) => a.y - b.y)
    .map((row) => ({
      y: row.y,
      text: row.words
        .sort((a, b) => a.x - b.x)
        .map((word) => word.text)
        .join(' ')
        .trim(),
    }));
}

export function parseRosterScreenshot(
  text: VisionText,
  source: number,
  headerHeight = 0,
): RosterRecognition {
  const warnings: string[] = [];
  const all = lines(text.words);
  const header = all
    .filter((row) => row.y <= headerHeight + 5)
    .map((row) => row.text)
    .join('\n');
  // Cloud Vision may split '48/50' or '77.80q' over multiple words.
  const members = header.match(/Members?\s*[:\s]*?(\d{1,3})\s*\/\s*(\d{1,3})/i);
  const headerPower = header.match(
    /\bPower\s*[:\s\S]*?(\d{1,5}(?:[.,]\d{1,4})?)\s*([KMBTqQ])(?=$|[^\p{L}])/u,
  );
  const reportedPowerText = headerPower ? headerPower[1] + headerPower[2] : null;
  const output: RecognizedPower[] = [];
  let candidate: { name: string; y: number } | null = null;
  const cleanCandidate = (value: string) =>
    value
      .replace(/^[^\\p{L}\\p{N}_]+/u, '')
      .replace(/[^\\p{L}\\p{N}_ .'-]+$/u, '')
      .trim();
  const plausibleName = (value: string) =>
    value.length >= 2 &&
    value.length <= 80 &&
    /[\\p{L}_]/u.test(value) &&
    !/^(?:leader|captain|member|online|offline|power|tier|members?)$/i.test(value) &&
    !/^\\d+\\s*[hms]\\b/i.test(value);

  for (const row of all) {
    if (row.y <= headerHeight + 5) continue;
    const power = row.text.match(powerMatch);
    if (power) {
      const powerText = power[1] + power[2];
      const powerValue = parsePower(powerText);
      // Vision may put the name on the same line as the power. Otherwise use
      // the nearest plausible name above it, within one player card.
      const inline = cleanCandidate(row.text.slice(0, power.index ?? 0));
      const name = plausibleName(inline)
        ? inline
        : candidate && row.y > candidate.y && row.y - candidate.y < 145
          ? candidate.name
          : null;
      if (powerValue !== null && name) {
        output.push({ name, power: powerValue, powerText, source });
      } else {
        warnings.push('Power without recognized player name near ' + powerText);
      }
      candidate = null;
      continue;
    }
    const cleaned = cleanCandidate(row.text);
    if (!cleaned || /^[-–—]+$/.test(cleaned)) continue;
    if (plausibleName(cleaned)) candidate = { name: cleaned, y: row.y };
  }
  if (!output.length) warnings.push('No player power rows were recognized. Review the screenshot crop.');
  const duplicate = new Set<string>();
  for (const entry of output) {
    const key = normalizeName(entry.name);
    if (duplicate.has(key)) warnings.push('Duplicate detected: ' + entry.name);
    duplicate.add(key);
  }
  return {
    players: output,
    reportedMembers: members ? Number(members[1]) : null,
    capacity: members ? Number(members[2]) : null,
    reportedPower: reportedPowerText ? parsePower(reportedPowerText) : null,
    reportedPowerText,
    warnings,
  };
}
