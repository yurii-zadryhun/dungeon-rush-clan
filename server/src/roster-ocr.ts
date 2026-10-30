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

// Cloud Vision may recognize the terminal q as "9" (6.989 -> 6.98q)
// or a terminal T as "7" (106.847 -> 106.84T). These patterns only
// apply to isolated power values, not general numbers or player names.
function inferredPower(row: string): { value: string; original: string } | null {
  const raw = row.trim().replace(/\s+/g, '');
  const quadrillion = raw.match(/^(\d{1,2}[.,]\d{2})9$/);
  if (quadrillion) return { value: quadrillion[1] + 'q', original: row.trim() };
  const trillion = raw.match(/^(\d{3,5}[.,]\d{2})7$/);
  if (trillion) return { value: trillion[1] + 'T', original: row.trim() };
  return null;
}


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
    /(?:^|\n)\s*Power\s*:?\s*(\d{1,5}(?:[.,]\d{1,4})?)\s*([KMBTqQ])(?=$|[^\p{L}])/iu,
  );
  const reportedPowerText = headerPower ? headerPower[1] + headerPower[2] : null;
  const output: RecognizedPower[] = [];
  let candidate: { name: string; y: number } | null = null;
  const cleanCandidate = (value: string) =>
    value
      .replace(/^[^\p{L}\p{N}_]+/u, '')
      .replace(/[^\p{L}\p{N}_ .'-]+$/u, '')
      .trim();
  // Cropped or partially recognized game roles must never become player identities.
  // In particular, the old client crop cut "Captain" -> "Captai" and "Member"
  // -> "Memb", which previously created dozens of false duplicate players.
  const interfaceLabel =
    /^(?:(?:capt(?:a(?:i(?:n)?)?)?)|(?:memb(?:e(?:r(?:s)?)?)?)|(?:lead(?:e(?:r)?)?)|(?:onlin(?:e)?)|(?:offlin(?:e)?)|power|tier|type|open|members|battle|(?:[o0]\s+)?memb?)$/i;
  const plausibleName = (value: string) =>
    value.length >= 2 &&
    value.length <= 80 &&
    /[\p{L}_]/u.test(value) &&
    !interfaceLabel.test(value) &&
    !/^[o0]\s+m(?:e(?:m(?:b(?:e(?:r)?)?)?)?)?$/i.test(value) &&
    !/^\d+\s*[hms]\b/i.test(value);

  for (const row of all) {
    if (row.y <= headerHeight + 5) continue;
    const power = row.text.match(powerMatch);
    const inferred = power ? null : inferredPower(row.text);
    if (power || inferred) {
      const powerText = power ? power[1] + power[2] : inferred!.value;
      const powerValue = parsePower(powerText);
      // Vision may put the name on the same line as the power. Otherwise use
      // the nearest plausible name above it, within one player card.
      const inline = power ? cleanCandidate(row.text.slice(0, power.index ?? 0)) : '';
      const preceding =
        candidate && row.y > candidate.y && row.y - candidate.y < 145
          ? candidate.name
          : null;
      // The game paints rarity/tier labels ("IM", "M", "E") directly beside
      // the power. In particular "IM 101.29T" belongs to the name on the
      // row above, not to a player called IM.
      const tierOnly = /^(?:IM|M|E|D)$/i.test(inline);
      const name = preceding && tierOnly ? preceding : plausibleName(inline) ? inline : preceding;
      if (powerValue !== null && name) {
        output.push({ name, power: powerValue, powerText, source });
        if (inferred) {
          warnings.push(
            'Verify ' + name + ' power: OCR read "' + inferred.original +
              '", interpreted as ' + powerText + '.',
          );
        }
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
  if (!output.length) warnings.push('No player names and power were found. Check the images.');
  // The same player can appear in overlapping screenshots. Repeats with an
  // identical value are expected; different powers need manual review.
  const seen = new Map<string, string>();
  const conflicts = new Set<string>();
  for (const entry of output) {
    const key = normalizeName(entry.name);
    const earlier = seen.get(key);
    if (earlier && earlier !== entry.powerText) conflicts.add(entry.name);
    else if (!earlier) seen.set(key, entry.powerText);
  }
  if (conflicts.size > 0)
    warnings.push('Conflicting power values for: ' + [...conflicts].slice(0, 8).join(', '));
  return {
    players: output,
    reportedMembers: members ? Number(members[1]) : null,
    capacity: members ? Number(members[2]) : null,
    reportedPower: reportedPowerText ? parsePower(reportedPowerText) : null,
    reportedPowerText,
    warnings,
  };
}
