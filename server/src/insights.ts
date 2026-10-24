import { BadRequestException, Controller, Get, Injectable, Param, UseGuards } from '@nestjs/common';
import { AdminGuard, SessionGuard } from './auth';
import { Db, normalizeName } from './database';
import { PlayerManagementService } from './player-management';
import { RankingService } from './ranking';

@Injectable()
export class InsightsService {
  constructor(
    private readonly db: Db,
    private readonly ranking: RankingService,
    private readonly management: PlayerManagementService,
  ) {}

  async days() {
    const [rows, wars] = await Promise.all([
      this.db.query
        .selectFrom('war_days')
        .innerJoin('wars', 'wars.id', 'war_days.war_id')
        .select(['war_days.day_number', 'war_days.winner', 'war_days.points'])
        .where('wars.result_imported_at', 'is not', null)
        .execute(),
      this.db.query
        .selectFrom('wars')
        .select('id')
        .where('result_imported_at', 'is not', null)
        .execute(),
    ]);
    return {
      completedWars: wars.length,
      days: [1, 2, 3, 4, 5, 6].map((day) => {
        const sample = rows.filter((row) => row.day_number === day);
        const wins = sample.filter((row) => row.winner === 'ours').length;
        const losses = sample.filter((row) => row.winner === 'opponent').length;
        return {
          day,
          wins,
          losses,
          total: wins + losses,
          winRate: sample.length ? Math.round((100 * wins) / sample.length) : null,
          dayWeight: [1, 2, 2, 2, 2, 4][day - 1],
        };
      }),
    };
  }

  async player(id: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestException('Invalid player ID');
    const player = await this.db.query
      .selectFrom('players')
      .select(['id', 'name', 'normalized_name', 'active', 'created_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!player) throw new BadRequestException('Player not found');

    const [weeks, mvpDays, aliases, ranking] = await Promise.all([
      this.db.query
        .selectFrom('player_scores')
        .innerJoin('wars', 'wars.id', 'player_scores.war_id')
        .select([
          'wars.start_date as start',
          'player_scores.points as points',
          'player_scores.position as position',
        ])
        .where('player_scores.player_id', '=', id)
        .orderBy('wars.start_date', 'asc')
        .execute(),
      this.db.query.selectFrom('war_days').select('mvp').execute(),
      this.db.query
        .selectFrom('player_aliases')
        .select('normalized_name')
        .where('player_id', '=', id)
        .execute(),
      this.ranking.compute(),
    ]);
    const names = new Set([player.normalized_name, ...aliases.map((alias) => alias.normalized_name)]);
    const points = weeks.map((week) => week.points);
    const sum = points.reduce((total, value) => total + value, 0);
    const stats = ranking.calculated.find((item) => item.id === id);
    return {
      id: player.id,
      name: player.name,
      active: !!player.active,
      firstSeen: weeks[0]?.start ?? null,
      lastSeen: weeks.at(-1)?.start ?? null,
      appearances: weeks.length,
      average: points.length ? Math.round(sum / points.length) : 0,
      best: points.length ? Math.max(...points) : 0,
      mvpCount: mvpDays.filter((day) => names.has(normalizeName(day.mvp))).length,
      calculatedScore: stats?.score ?? 0,
      requirement: ranking.settings.minimumPoints,
      belowRequirement: stats?.belowRequirement ?? false,
      weeks,
    };
  }

  async health() {
    const [ranking, wars] = await Promise.all([
      this.ranking.compute(),
      this.db.query
        .selectFrom('wars')
        .select(['id', 'start_date'])
        .where('ranking_imported_at', 'is not', null)
        .orderBy('start_date', 'desc')
        .limit(2)
        .execute(),
    ]);
    const ids = wars.map((war) => war.id);
    const [scores, staffTags] = await Promise.all([
      ids.length
        ? this.db.query
            .selectFrom('player_scores')
            .select(['war_id', 'player_id', 'points'])
            .where('war_id', 'in', ids)
            .execute()
        : Promise.resolve([]),
      this.management.tagsByPlayer(ranking.calculated.map((p) => p.id)),
    ]);
    const tags = new Map(
      staffTags.map((row) => [
        row.player_id,
        {
          telegram: !!row.telegram,
          discord: !!row.discord,
          exception:
            !!row.exception_reason.trim() ||
            (JSON.parse(row.tags_json) as string[]).includes('exception'),
          attention: (JSON.parse(row.tags_json) as string[]).includes('attention'),
        },
      ]),
    );
    const latest = new Map(
      scores.filter((s) => s.war_id === wars[0]?.id).map((s) => [s.player_id, s.points]),
    );
    const previous = new Map(
      scores.filter((s) => s.war_id === wars[1]?.id).map((s) => [s.player_id, s.points]),
    );
    const rows = ranking.calculated.map((player) => {
      const current = latest.get(player.id) ?? null;
      const before = previous.get(player.id) ?? null;
      const change =
        current !== null && before !== null && before > 0
          ? Math.round((100 * (current - before)) / before)
          : null;
      return {
        id: player.id,
        name: player.name,
        active: player.active,
        calculated: player.score,
        latestPoints: current,
        previousPoints: before,
        change,
        belowRequirement: player.active && player.belowRequirement,
        joined: !!wars[1] && current !== null && before === null,
        left: !!wars[1] && current === null && before !== null,
        dropping: player.active && change !== null && change <= -25,
        ...tags.get(player.id),
      };
    });
    return {
      latestStart: wars[0]?.start_date ?? null,
      previousStart: wars[1]?.start_date ?? null,
      minimumPoints: ranking.settings.minimumPoints,
      belowRequirement: rows.filter((p) => p.belowRequirement),
      dropping: rows.filter((p) => p.dropping),
      joined: rows.filter((p) => p.joined),
      left: rows.filter((p) => p.left),
      attention: rows.filter((p) => p.attention),
    };
  }
}

@Controller('api/insights')
@UseGuards(SessionGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('days') days() {
    return this.insights.days();
  }

  @Get('players/:id')
  player(@Param('id') id: string) {
    return this.insights.player(Number(id));
  }

  @UseGuards(AdminGuard)
  @Get('health')
  health() {
    return this.insights.health();
  }
}
