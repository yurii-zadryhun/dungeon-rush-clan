import { normalizeName, type ClanRosterCandidates } from '../api';

export interface RosterMatch {
  playerId: number;
  name: string;
  distance: number;
  exact: boolean;
}

// OCR mixes lookalike Latin and Cyrillic letters, particularly in "КРОСТ"/"KPOCT".
// Use this only for matching. Never rewrite a player's stored name.
const confusables: Record<string, string> = {
  а: 'a',
  в: 'b',
  е: 'e',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  і: 'i',
};
function visualName(value: string): string {
  return Array.from(normalizeName(value), (char) => confusables[char] ?? char).join('');
}

export function levenshtein(left: string, right: string, ceiling = Infinity): number {
  const a = Array.from(left);
  const b = Array.from(right);
  if (Math.abs(a.length - b.length) > ceiling) return ceiling + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    if (Math.min(...current) > ceiling) return ceiling + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * Exact/alias matches win. Fuzzy matches are accepted only when the closest
 * player is unique and within 1–2 edits, preventing silent accidental merges.
 */
export function matchRosterName(
  input: string,
  known: ClanRosterCandidates,
  fuzzy = true,
): RosterMatch | null {
  const normalized = normalizeName(input);
  if (!normalized) return null;
  const visual = visualName(input);
  const canonical = new Map(known.players.map((player) => [player.id, player.name]));
  const names = [
    ...known.players.map((player) => ({ id: player.id, name: player.name })),
    ...known.aliases
      .filter((alias) => canonical.has(alias.playerId))
      .map((alias) => ({ id: alias.playerId, name: alias.normalizedName })),
  ];
  const byPlayer = new Map<number, { distance: number; exact: boolean }>();
  for (const name of names) {
    const actual = normalizeName(name.name);
    const match = actual === normalized || visualName(name.name) === visual;
    const maxDistance = fuzzy && normalized.length >= 3 ? (normalized.length < 6 ? 1 : 2) : 0;
    const distance = match ? 0 : levenshtein(visual, visualName(name.name), maxDistance);
    if (distance > maxDistance) continue;
    const current = byPlayer.get(name.id);
    if (!current || distance < current.distance || (distance === current.distance && match)) {
      byPlayer.set(name.id, { distance, exact: match });
    }
  }
  const ranked = [...byPlayer.entries()].sort((a, b) => a[1].distance - b[1].distance);
  if (!ranked.length || (ranked[1] && ranked[1][1].distance === ranked[0][1].distance)) return null;
  const [playerId, details] = ranked[0];
  return {
    playerId,
    name: canonical.get(playerId)!,
    distance: details.distance,
    exact: details.exact,
  };
}
