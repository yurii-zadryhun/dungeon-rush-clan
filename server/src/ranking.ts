import { Injectable } from '@nestjs/common';
import { Db } from './database';

export interface RankedPlayer {
  id: number;
  name: string;
  active: boolean;
  score: number;
  average: number;
  appearances: number;
  lastPoints: number | null;
  belowRequirement: boolean;
  newcomer: boolean;
}

@Injectable()
export class RankingService {
  constructor(private readonly db: Db) {}

  async compute() {
    const settings = await this.db.query
      .selectFrom('settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
    const weights = JSON.parse(settings.weights_json) as number[];
    // The newest eligible week is the newest *imported* ranking, not a calendar placeholder.
    const recent = await this.db.query
      .selectFrom('wars')
      .select(['id', 'start_date'])
      .where('ranking_imported_at', 'is not', null)
      .orderBy('start_date', 'desc')
      .limit(weights.length)
      .execute();
    const [players, importedWars] = await Promise.all([
      this.db.query.selectFrom('players').selectAll().execute(),
      this.db.query.selectFrom('wars').select('id')
        .where('ranking_imported_at', 'is not', null)
        .orderBy('start_date', 'asc').execute(),
    ]);
    const warIndexes = new Map(importedWars.map((war, index) => [war.id, index]));
    const scores = await this.db.query
      .selectFrom('player_scores')
      .innerJoin('wars', 'wars.id', 'player_scores.war_id')
      .select(['player_scores.player_id', 'player_scores.points', 'player_scores.war_id'])
      .execute();
    const perPlayer = new Map<number, { war_id: number; points: number }[]>();
    for (const s of scores) perPlayer.set(s.player_id, [...(perPlayer.get(s.player_id) || []), s]);
    const latestId = recent[0]?.id;
    const ranking: RankedPlayer[] = players.map((p) => {
      const entries = perPlayer.get(p.id) || [];
      const lookup = new Map(entries.map((e) => [e.war_id, e.points]));
      let total = 0;
      let applied = 0;
      recent.forEach((war, i) => {
        // Missing a player in an imported week means the player is no longer in the clan.
        total += (lookup.get(war.id) || 0) * weights[i];
        applied += weights[i];
      });
      const score = applied > 0 ? Math.round(total / applied) : 0;
      const average = entries.length
        ? Math.round(entries.reduce((sum, e) => sum + e.points, 0) / entries.length)
        : 0;
      const earliest = entries.length
        ? Math.min(...entries.map((entry) => warIndexes.get(entry.war_id) ?? 0)) : -1;
      const lastIndex = importedWars.length - 1;
      const newcomer = !!p.active && earliest >= 0 && lastIndex - earliest < 2;
      return {
        newcomer,
        id: p.id,
        name: p.name,
        active: !!p.active,
        score,
        average,
        appearances: entries.length,
        lastPoints: latestId ? (lookup.get(latestId) ?? null) : null,
        belowRequirement: !newcomer && entries.length > 0 && !!p.active && score < settings.minimum_points,
      };
    });
    return {
      settings: {
        clanName: settings.clan_name,
        minimumPoints: settings.minimum_points,
        weights,
        leaderName: settings.leader_name,
        telegramUrl: settings.telegram_url,
        discordUrl: settings.discord_url,
        contactUrl: settings.contact_url,
      },
      calculated: ranking.slice().sort((a, b) => b.score - a.score),
      allTime: ranking
        .filter((player) => player.appearances > 0)
        .sort((a, b) => b.average - a.average || b.appearances - a.appearances),
      latest: ranking
        .filter((p) => p.lastPoints !== null)
        .sort((a, b) => (b.lastPoints || 0) - (a.lastPoints || 0)),
      latestWarStart: recent[0]?.start_date || null,
    };
  }
}
