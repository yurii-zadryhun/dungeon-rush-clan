import { Controller, Get, Injectable, UseGuards } from '@nestjs/common';
import { SessionGuard } from './auth';
import { Db } from './database';

export interface RecognitionScore {
  warId: number;
  start: string;
  championship: boolean;
  playerId: number;
  name: string;
  points: number;
  position: number;
}
export interface RecognitionMvp {
  playerId: number | null;
  winner: 'ours' | 'opponent';
}
export interface RecognitionPlayer {
  id: number;
  name: string;
  points: number;
  podiums: number;
  firstPlaces: number;
  mvps: number;
  championshipPoints: number;
  longestStreak: number;
}
export interface RecognitionAward {
  kind: 'points' | 'firstPlaces' | 'mvps' | 'streak' | 'championship';
  playerId: number;
  name: string;
  value: number;
}
export interface RecognitionOverview {
  warCount: number;
  leaderboard: RecognitionPlayer[];
  awards: RecognitionAward[];
  recent: Array<{ start: string; championship: boolean; id: number; name: string; points: number }>;
}

/** Pure read model: counts only imported rankings and MVPs from our winning days. */
export function buildRecognition(
  rows: RecognitionScore[],
  mvps: RecognitionMvp[],
  importedWarIds: number[],
): RecognitionOverview {
  const byPlayer = new Map<number, RecognitionPlayer>();
  const byWar = new Map<number, RecognitionScore[]>();
  for (const row of rows) {
    const current = byPlayer.get(row.playerId) ?? {
      id: row.playerId, name: row.name, points: 0, podiums: 0,
      firstPlaces: 0, mvps: 0, championshipPoints: 0, longestStreak: 0,
    };
    current.name = row.name;
    current.points += row.points;
    current.firstPlaces += Number(row.position === 1);
    current.podiums += Number(row.position <= 3);
    if (row.championship) current.championshipPoints += row.points;
    byPlayer.set(row.playerId, current);
    const entries = byWar.get(row.warId) ?? [];
    entries.push(row);
    byWar.set(row.warId, entries);
  }
  for (const day of mvps) {
    if (day.winner !== 'ours' || day.playerId === null) continue;
    const player = byPlayer.get(day.playerId);
    if (player) player.mvps++;
  }
  const streaks = new Map<number, number>();
  for (const warId of importedWarIds) {
    const participants = new Set((byWar.get(warId) ?? []).map((row) => row.playerId));
    for (const player of byPlayer.values()) {
      const streak = participants.has(player.id) ? (streaks.get(player.id) ?? 0) + 1 : 0;
      streaks.set(player.id, streak);
      player.longestStreak = Math.max(player.longestStreak, streak);
    }
  }
  const leaderboard = [...byPlayer.values()].sort(
    (a, b) => b.points - a.points || b.mvps - a.mvps || a.id - b.id,
  );
  const awards: RecognitionAward[] = [];
  const criteria: Array<{ kind: RecognitionAward['kind']; field: keyof RecognitionPlayer }> = [
    { kind: 'points', field: 'points' },
    { kind: 'firstPlaces', field: 'firstPlaces' },
    { kind: 'mvps', field: 'mvps' },
    { kind: 'streak', field: 'longestStreak' },
    { kind: 'championship', field: 'championshipPoints' },
  ];
  for (const criterion of criteria) {
    const winner = [...leaderboard].sort(
      (a, b) => Number(b[criterion.field]) - Number(a[criterion.field]) || a.id - b.id,
    )[0];
    const value = winner ? Number(winner[criterion.field]) : 0;
    if (winner && value > 0) awards.push({
      kind: criterion.kind, playerId: winner.id, name: winner.name, value,
    });
  }
  const recent = [...importedWarIds].reverse().slice(0, 4)
    .flatMap((warId) => {
      const top = [...(byWar.get(warId) ?? [])]
        .sort((a, b) => a.position - b.position || b.points - a.points)[0];
      return top ? [{
        start: top.start, championship: top.championship,
        id: top.playerId, name: top.name, points: top.points,
      }] : [];
    });
  return { warCount: importedWarIds.length, leaderboard: leaderboard.slice(0, 15), awards, recent };
}

@Injectable()
export class RecognitionService {
  constructor(private readonly db: Db) {}

  async overview() {
    const [wars, scores, mvpDays] = await Promise.all([
      this.db.query.selectFrom('wars')
        .select(['id', 'start_date', 'is_championship'])
        .where('ranking_imported_at', 'is not', null)
        .orderBy('start_date', 'asc').execute(),
      this.db.query.selectFrom('player_scores')
        .innerJoin('wars', 'wars.id', 'player_scores.war_id')
        .innerJoin('players', 'players.id', 'player_scores.player_id')
        .select(['player_scores.war_id as warId', 'wars.start_date as start',
          'wars.is_championship as championship', 'player_scores.player_id as playerId',
          'players.name', 'player_scores.points', 'player_scores.position'])
        .where('wars.ranking_imported_at', 'is not', null).execute(),
      this.db.query.selectFrom('war_days')
        .select(['winner', 'mvp_player_id as playerId']).execute(),
    ]);
    return buildRecognition(
      scores.map((score) => ({ ...score, championship: !!score.championship })),
      mvpDays, wars.map((war) => war.id),
    );
  }
}

@Controller('api/recognition')
@UseGuards(SessionGuard)
export class RecognitionController {
  constructor(private readonly recognition: RecognitionService) {}
  @Get()
  overview() { return this.recognition.overview(); }
}
