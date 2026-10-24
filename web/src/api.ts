import { localizeError, type Locale } from './i18n';
import { initialLocale } from './locale';
export type Role = 'owner' | 'admin' | 'member';

export interface Account {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  locale: Locale;
  playerId: number | null;
  impersonating?: { ownerId: number; ownerName: string; expiresAt: number };
}

export interface Player {
  id: number;
  name: string;
  active: boolean;
  score: number;
  average: number;
  appearances: number;
  lastPoints: number | null;
  belowRequirement: boolean;
}

export interface PlayerScore {
  id: number;
  name: string;
  active: boolean;
  points: number;
  position: number;
}

export interface Day {
  day: number;
  points: number;
  winner: 'ours' | 'opponent';
  mvp: string;
}

export interface Week {
  start: string;
  label: string;
  state: 'past' | 'active' | 'future';
  permissions: { ranking: boolean; result: boolean };
  id: number | null;
  opponent: string | null;
  ourScore: number | null;
  opponentScore: number | null;
  rankingImported: boolean;
  resultImported: boolean;
  days: Day[];
  players: PlayerScore[];
}

export interface Dashboard {
  weeks: Week[];
  rankings: {
    settings: {
      clanName: string;
      minimumPoints: number;
      weights: number[];
      leaderName: string;
      telegramUrl: string;
      discordUrl: string;
      contactUrl: string;
    };
    calculated: Player[];
    allTime: Player[];
    latest: Player[];
    latestWarStart: string | null;
  };
  record: { wins: number; losses: number };
  currentStart: string;
  serverNow: string;
}

export interface PlayerProgressWeek {
  start: string;
  points: number;
  position: number;
}
export interface PlayerProgress {
  id: number;
  name: string;
  active: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
  appearances: number;
  average: number;
  best: number;
  mvpCount: number;
  calculatedScore: number;
  requirement: number;
  belowRequirement: boolean;
  weeks: PlayerProgressWeek[];
}
export interface DayAnalytics {
  completedWars: number;
  days: Array<{
    day: number;
    wins: number;
    losses: number;
    total: number;
    winRate: number | null;
    dayWeight: number;
  }>;
}
export interface HealthPlayer {
  id: number;
  name: string;
  active: boolean;
  calculated: number;
  latestPoints: number | null;
  previousPoints: number | null;
  change: number | null;
  belowRequirement: boolean;
  joined: boolean;
  left: boolean;
  dropping: boolean;
  telegram: boolean;
  discord: boolean;
  exception?: boolean;
  attention?: boolean;
}
export interface ClanHealth {
  latestStart: string | null;
  previousStart: string | null;
  minimumPoints: number;
  belowRequirement: HealthPlayer[];
  dropping: HealthPlayer[];
  joined: HealthPlayer[];
  left: HealthPlayer[];
  attention: HealthPlayer[];
}
export type PlayerTag = 'family' | 'exception' | 'attention' | 'inactive' | 'plan' | 'reliable';
export type NoteCategory = 'note' | 'attention' | 'contact' | 'positive';
export interface PlayerLabels {
  telegram: boolean;
  discord: boolean;
  telegramHandle: string;
  discordHandle: string;
  tags: PlayerTag[];
  exceptionReason: string;
}
export interface StaffNote {
  id: number;
  body: string;
  category: NoteCategory;
  createdAt: number;
  author: string | null;
}
export interface PlayerManagement {
  labels: PlayerLabels;
  notes: StaffNote[];
}

export interface PublicClan {
  name: string;
  leader: string;
  contactUrl: string;
  record: { wins: number; losses: number };
  recentWars: Array<{
    start: string;
    opponent: string | null;
    ourScore: number;
    opponentScore: number;
  }>;
}

export interface OcrPlayer {
  position: number;
  name: string;
  points: number;
  source: number;
  playerId?: number | null;
}

export interface OcrResult {
  opponent: string;
  ourScore: number | null;
  opponentScore: number | null;
  days: { day: number; points: number; winner: 'ours' | 'opponent' | null; mvp: string }[];
  warnings: string[];
}

export interface OcrResponse {
  players: OcrPlayer[];
  result: OcrResult | null;
  warnings: string[];
}

export interface Roster {
  previousStart: string | null;
  previous: { id: number; name: string; points: number }[];
  all: { id: number; name: string; active: number }[];
  aliases?: { normalizedName: string; playerId: number }[];
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'clan-stats');
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  const response = await fetch('/api/' + path.replace(/^\//, ''), {
    ...options,
    credentials: 'same-origin',
    headers,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join('; ') : data.message;
    const locale = initialLocale();
    throw new Error(localizeError(String(message || 'Request failed'), locale, response.status));
  }
  return (await response.json()) as T;
}

export function json(method: 'POST' | 'PATCH' | 'DELETE', value: unknown): RequestInit {
  return {
    method,
    body: JSON.stringify(value),
  };
}

export function shortNumber(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return (value / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (magnitude >= 1_000) return (value / 1_000).toFixed(2).replace(/\.?0+$/, '') + 'K';
  return String(value);
}

export const number = shortNumber;

export function normalizeName(s: string) {
  return s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function previousTuesday(start: string): string {
  const date = new Date(start + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}
