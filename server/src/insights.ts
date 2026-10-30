import { BadRequestException, Controller, Get, Injectable, Param, UseGuards } from '@nestjs/common';
import { AdminGuard, SessionGuard } from './auth';
import { Db, normalizeName } from './database';
import { PlayerManagementService } from './player-management';
import { RankingService } from './ranking';
import { ClanRosterService } from './clan-roster';

@Injectable()
export class InsightsService {
  constructor(
    private readonly db: Db,
    private readonly ranking: RankingService,
    private readonly management: PlayerManagementService,
    private readonly roster: ClanRosterService,
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

    const [weeks, mvpDays, aliases, ranking, powerHistory] = await Promise.all([
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
      this.db.query.selectFrom('war_days').select(['mvp', 'mvp_player_id', 'winner']).execute(),
      this.db.query
        .selectFrom('player_aliases')
        .select('normalized_name')
        .where('player_id', '=', id)
        .execute(),
      this.ranking.compute(),
      this.roster.playerHistory(id),
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
      mvpCount: mvpDays.filter(
        (day) =>
          day.winner === 'ours' &&
          (day.mvp_player_id === id ||
            (day.mvp_player_id === null && names.has(normalizeName(day.mvp)))),
      ).length,
      calculatedScore: stats?.score ?? 0,
      requirement: ranking.settings.minimumPoints,
      belowRequirement: stats?.belowRequirement ?? false,
      weeks,
      powerHistory,
      nameHistory: await this.db.query
        .selectFrom('player_events')
        .select([
          'kind',
          'previous_value as previousValue',
          'next_value as nextValue',
          'occurred_at as occurredAt',
        ])
        .where('player_id', '=', id)
        .orderBy('occurred_at', 'desc')
        .execute(),
    };
  }

  async warPoints() {
    const scores = await this.db.query
      .selectFrom('player_scores')
      .innerJoin('wars', 'wars.id', 'player_scores.war_id')
      .select(['wars.start_date', 'player_scores.points'])
      .where('wars.ranking_imported_at', 'is not', null)
      .orderBy('wars.start_date')
      .execute();
    const totals = new Map<string, number[]>();
    for (const score of scores) {
      const values = totals.get(score.start_date) ?? [];
      values.push(score.points);
      totals.set(score.start_date, values);
    }
    return [...totals].map(([start, values]) => {
      values.sort((a, b) => a - b);
      const total = values.reduce((sum, value) => sum + value, 0);
      const middle = Math.floor(values.length / 2);
      const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
      return {
        start,
        total,
        playerCount: values.length,
        average: values.length ? Math.round(total / values.length) : 0,
        median: Math.round(median ?? 0),
        topTenShare: total
          ? Math.round((100 * values.slice(-10).reduce((a, b) => a + b, 0)) / total)
          : 0,
      };
    });
  }

  async extended() {
    const [wars, scores, rosters, rosterEntries, rankings] = await Promise.all([
      this.db.query
        .selectFrom('wars')
        .select(['id', 'start_date'])
        .where('ranking_imported_at', 'is not', null)
        .orderBy('start_date', 'asc')
        .execute(),
      this.db.query.selectFrom('player_scores').select(['war_id', 'player_id', 'points']).execute(),
      this.db.query
        .selectFrom('clan_roster_snapshots')
        .select(['id', 'captured_at'])
        .orderBy('captured_at', 'desc')
        .limit(2)
        .execute(),
      this.db.query
        .selectFrom('clan_roster_entries')
        .select(['snapshot_id', 'player_id', 'power'])
        .execute(),
      this.ranking.compute(),
    ]);
    const latest = wars.at(-1);
    const latestScores = new Map(
      scores
        .filter((score) => score.war_id === latest?.id)
        .map((score) => [score.player_id, score.points]),
    );
    const names = new Map(rankings.calculated.map((player) => [player.id, player.name]));
    const now = new Map(
      rosterEntries
        .filter((item) => item.snapshot_id === rosters[0]?.id)
        .map((item) => [item.player_id, item.power]),
    );
    const before = new Map(
      rosterEntries
        .filter((item) => item.snapshot_id === rosters[1]?.id)
        .map((item) => [item.player_id, item.power]),
    );
    const powerContribution = [...now]
      .filter(([id]) => latestScores.has(id))
      .map(([id, power]) => ({ id, name: names.get(id) ?? '', power, points: latestScores.get(id)! }));
    const powerGrowth = [...now]
      .filter(([id]) => before.has(id))
      .map(([id, power]) => ({
        id,
        name: names.get(id) ?? '',
        power,
        delta: power - before.get(id)!,
        percentage:
          before.get(id)! > 0 ? Math.round((100 * (power - before.get(id)!)) / before.get(id)!) : null,
      }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 10);
    const first = new Map<number, number>();
    const participation = new Map<number, Set<number>>();
    for (const [index, war] of wars.entries()) {
      for (const row of scores.filter((item) => item.war_id === war.id)) {
        if (!first.has(row.player_id)) first.set(row.player_id, index);
        const seen = participation.get(row.player_id) ?? new Set<number>();
        seen.add(index);
        participation.set(row.player_id, seen);
      }
    }
    const retention = [2, 4, 8].map((offset) => {
      const eligible = [...first].filter(([, start]) => start + offset < wars.length);
      const retained = eligible.filter(([id, start]) =>
        participation.get(id)?.has(start + offset),
      ).length;
      return {
        wars: offset,
        eligible: eligible.length,
        retained,
        rate: eligible.length ? Math.round((100 * retained) / eligible.length) : null,
      };
    });
    const consistency = rankings.calculated
      .map((player) => {
        const lastFive = wars.slice(-5);
        const values = lastFive.map(
          (war) =>
            scores.find((row) => row.war_id === war.id && row.player_id === player.id)?.points ?? 0,
        );
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        const variance = values.length
          ? values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
          : 0;
        return {
          id: player.id,
          name: player.name,
          average: Math.round(avg),
          consistency: avg > 0 ? Math.round(100 * (1 - Math.min(1, Math.sqrt(variance) / avg))) : 0,
        };
      })
      .filter((player) => player.average >= rankings.settings.minimumPoints)
      .sort((a, b) => b.consistency - a.consistency)
      .slice(0, 8);
    const active = rankings.calculated.filter((player) => player.active);
    const requirement = rankings.settings.minimumPoints;
    return {
      asOf: rosters[0] ? new Date(rosters[0].captured_at).toISOString() : null,
      latestWar: latest?.start_date ?? null,
      powerContribution,
      powerGrowth,
      retention,
      consistency,
      activityGroups: {
        newcomer: active.filter((player) => player.newcomer).length,
        below: active.filter((player) => !player.newcomer && player.score < requirement).length,
        meeting: active.filter(
          (player) => !player.newcomer && player.score >= requirement && player.score < 2 * requirement,
        ).length,
        exceeding: active.filter((player) => !player.newcomer && player.score >= 2 * requirement).length,
      },
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
    // A complete roster is more authoritative for join/leave events than missing
    // historical war scores. In particular, a member can join before playing a war.
    const rosterSnapshots = await this.db.query
      .selectFrom('clan_roster_snapshots')
      .select(['id', 'captured_at'])
      .orderBy('captured_at', 'desc')
      .orderBy('id', 'desc')
      .limit(2)
      .execute();
    const rosterIsCurrent =
      rosterSnapshots.length > 0 &&
      rosterSnapshots[0].captured_at >=
        (wars[0] ? Date.parse(wars[0].start_date + 'T00:00:00Z') + 6 * 86_400_000 - 1 : -1);
    const rosterEntries =
      rosterIsCurrent && rosterSnapshots.length >= 2
        ? await this.db.query
            .selectFrom('clan_roster_entries')
            .select(['snapshot_id', 'player_id'])
            .where(
              'snapshot_id',
              'in',
              rosterSnapshots.map((item) => item.id),
            )
            .execute()
        : [];
    const currentRoster = new Set(
      rosterEntries
        .filter((entry) => entry.snapshot_id === rosterSnapshots[0]?.id)
        .map((entry) => entry.player_id),
    );
    const olderRoster = new Set(
      rosterEntries
        .filter((entry) => entry.snapshot_id === rosterSnapshots[1]?.id)
        .map((entry) => entry.player_id),
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
        joined: rosterIsCurrent
          ? rosterSnapshots.length >= 2 && currentRoster.has(player.id) && !olderRoster.has(player.id)
          : !!wars[1] && current !== null && before === null && player.active,
        left: rosterIsCurrent
          ? rosterSnapshots.length >= 2 && !currentRoster.has(player.id) && olderRoster.has(player.id)
          : !!wars[1] && current === null && before !== null && !player.active,
        dropping: player.active && !player.newcomer && change !== null && change <= -25,
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

  @Get('war-points') warPoints() {
    return this.insights.warPoints();
  }

  @Get('extended') extended() {
    return this.insights.extended();
  }

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
