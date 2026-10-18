import { BadRequestException, Body, Controller, Get, Injectable, Patch, Query, UseGuards } from '@nestjs/common';
import { Db } from './database';
import { importPermission, shiftWar, warStart, weekLabel, weekState } from './calendar';
import { AdminGuard, SessionGuard } from './auth';
import { RankingService } from './ranking';
import { z } from 'zod';

@Injectable()
export class WarsService {
  constructor(private readonly db: Db, private readonly ranking: RankingService) {}

  async dashboard(anchor?: string, count = 10) {
    const now = new Date(), current = warStart(now);
    if (anchor && !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) throw new BadRequestException('Invalid date');
    if (anchor && warStart(new Date(anchor + 'T00:00:00Z')) !== anchor) throw new BadRequestException('Anchor must be a Tuesday');
    const end = anchor || shiftWar(current, 2);
    const limit = Math.max(1, Math.min(20, Number.isFinite(count) ? Math.floor(count) : 10));
    const starts = Array.from({ length: limit }, (_, i) => shiftWar(end, i - limit + 1));
    const rows = await this.db.query.selectFrom('wars').leftJoin('clans', 'wars.opponent_clan_id', 'clans.id')
      .select(['wars.id', 'wars.start_date', 'wars.our_score', 'wars.opponent_score', 'wars.ranking_imported_at', 'wars.result_imported_at', 'clans.name as opponent'])
      .where('wars.start_date', '>=', starts[0]).where('wars.start_date', '<=', starts[starts.length - 1])
      .orderBy('wars.start_date', 'asc').execute();
    const ids = rows.map(w => w.id);
    const days = ids.length ? await this.db.query.selectFrom('war_days').selectAll().where('war_id', 'in', ids).orderBy('day_number').execute() : [];
    const scores = ids.length ? await this.db.query.selectFrom('player_scores').innerJoin('players', 'players.id', 'player_scores.player_id')
      .select(['player_scores.war_id', 'player_scores.position', 'player_scores.points', 'players.id as playerId', 'players.name', 'players.active'])
      .where('player_scores.war_id', 'in', ids).orderBy('player_scores.position').execute() : [];
    const mapping = new Map(rows.map(w => [w.start_date, w]));
    const weeks = starts.map(start => {
      const found = mapping.get(start);
      return {
        start, label: weekLabel(start), state: weekState(start, now), permissions: importPermission(start, now),
        id: found?.id ?? null, opponent: found?.opponent ?? null, ourScore: found?.our_score ?? null,
        opponentScore: found?.opponent_score ?? null, rankingImported: !!found?.ranking_imported_at,
        resultImported: !!found?.result_imported_at,
        days: found ? days.filter(d => d.war_id === found.id).map(d => ({
          day: d.day_number,
          points: d.points,
          winner: d.winner,
          mvp: d.mvp
        })) : [],
        players: found ? scores.filter(s => s.war_id === found.id).map(s => ({
          id: s.playerId,
          position: s.position,
          name: s.name,
          points: s.points,
          active: !!s.active
        })) : []
      };
    });
    const stats = await this.ranking.compute();
    const outcomes = await this.db.query.selectFrom('wars').select(['our_score', 'opponent_score']).where('result_imported_at', 'is not', null).execute();
    return {
      weeks, rankings: stats, record: {
        wins: outcomes.filter(w => w.our_score! > w.opponent_score!).length,
        losses: outcomes.filter(w => w.our_score! < w.opponent_score!).length
      },
      currentStart: current, serverNow: now.toISOString()
    };
  }

  async settings(input: unknown) {
    const parsed = z.object({
      clanName: z.string().trim().min(2).max(60), minimumPoints: z.number().int().min(0).max(1_000_000_000),
      weights: z.array(z.number().positive().finite()).min(1).max(12)
    }).safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(i => i.message).join('; '));
    const { clanName, minimumPoints, weights } = parsed.data;
    const sum = weights.reduce((s, x) => s + x, 0);
    if (Math.abs(sum - 1) > 0.00001) throw new BadRequestException('Weights must sum to 1');
    await this.db.query.updateTable('settings').set({
      clan_name: clanName,
      minimum_points: minimumPoints,
      weights_json: JSON.stringify(weights)
    }).where('id', '=', 1).execute();
    return this.dashboard();
  }
}

@Controller('api')
@UseGuards(SessionGuard)
export class WarsController {
  constructor(private readonly wars: WarsService) {}

  @Get('dashboard') dashboard(@Query('anchor') anchor?: string, @Query('count') count?: string) { return this.wars.dashboard(anchor, count ? Number(count) : 10); }

  @UseGuards(AdminGuard) @Patch('settings') settings(@Body() body: unknown) { return this.wars.settings(body); }
}
