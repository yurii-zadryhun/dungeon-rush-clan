import { BadRequestException, Body, Controller, Get, Injectable, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { DAY_POINTS, importPermission, warStart } from './calendar';
import { AdminGuard, SessionGuard } from './auth';
import { Db, normalizeName } from './database';
import { WarsService } from './wars';

const name = z.string().trim().min(1).max(80);
const rankingItem = z.object({
  position: z.number().int().min(1).max(100),
  name, points: z.number().int().min(0).max(1_000_000_000),
  playerId: z.number().int().positive().nullable().optional()
});
const result = z.object({
  opponent: name, ourScore: z.number().int().min(0).max(13),
  opponentScore: z.number().int().min(0).max(13),
  days: z.array(z.object({
    day: z.number().int().min(1).max(6),
    points: z.number().int(),
    winner: z.enum(['ours', 'opponent']),
    mvp: name
  })).length(6)
});
const submission = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  players: z.array(rankingItem).min(1).max(100).optional(),
  result: result.optional()
}).refine(data => !!data.players || !!data.result, { message: 'Nothing to import' });

@Injectable()
export class ImportService {
  constructor(private readonly db: Db, private readonly wars: WarsService) {}

  async matchingPlayers(start: string) {
    if (warStart(new Date(start + 'T00:00:00Z')) !== start) throw new BadRequestException('War must start on a Tuesday');
    const last = await this.db.query.selectFrom('wars').select(['id', 'start_date'])
      .where('ranking_imported_at', 'is not', null).where('start_date', '<', start).orderBy('start_date', 'desc').executeTakeFirst();
    const previous = last ? await this.db.query.selectFrom('player_scores').innerJoin('players', 'player_scores.player_id', 'players.id')
      .select(['players.id', 'players.name', 'player_scores.points'])
      .where('player_scores.war_id', '=', last.id).orderBy('player_scores.position').execute() : [];
    const all = await this.db.query.selectFrom('players').select(['id', 'name', 'active']).execute();
    return { previousStart: last?.start_date || null, previous, all };
  }

  async confirm(input: unknown) {
    const parsed = submission.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(x => x.message).join('; '));
    const data = parsed.data;
    if (warStart(new Date(data.start + 'T00:00:00Z')) !== data.start) throw new BadRequestException('Invalid Tuesday date');
    const permission = importPermission(data.start);
    if (data.players && !permission.ranking) throw new BadRequestException('Rankings become available Sunday 00:00 UTC');
    if (data.result && !permission.result) throw new BadRequestException('Final results become available Monday 00:00 UTC');
    if (data.players) {
      const positions = new Set(data.players.map(p => p.position));
      const identities = data.players.map(p => p.playerId !== undefined && p.playerId !== null ? 'id:' + p.playerId : 'name:' + normalizeName(p.name));
      if (positions.size !== data.players.length || new Set(identities).size !== data.players.length) throw new BadRequestException('Duplicate player/rank entries');
    }
    if (data.result) {
      const r = data.result;
      if (new Set(r.days.map(d => d.day)).size !== 6) throw new BadRequestException('Each day must appear once');
      let our = 0, opponent = 0;
      for (const d of r.days) {
        if (d.points !== DAY_POINTS[d.day - 1]) throw new BadRequestException('Invalid day ' + d.day + ' points');
        if (d.winner === 'ours') our += d.points; else opponent += d.points;
      }
      if (our !== r.ourScore || opponent !== r.opponentScore) throw new BadRequestException('Daily winners do not match final score');
    }
    try {
      await this.db.query.transaction().execute(async trx => {
        let war = await trx.selectFrom('wars').selectAll().where('start_date', '=', data.start).executeTakeFirst();
        if (!war) {
          const id = await trx.insertInto('wars').values({
            start_date: data.start, opponent_clan_id: null, our_score: null, opponent_score: null,
            ranking_imported_at: null, result_imported_at: null, created_at: Date.now()
          }).returning('id').executeTakeFirstOrThrow();
          war = await trx.selectFrom('wars').selectAll().where('id', '=', id.id).executeTakeFirstOrThrow();
        }
        if (data.players) {
          if (war.ranking_imported_at !== null) throw new BadRequestException('Player ranking already imported for this war');
          const existingPlayers = await trx.selectFrom('players').select(['id', 'normalized_name']).execute();
          const names = new Map(existingPlayers.map(p => [p.normalized_name, p.id]));
          const ids = new Set<number>();
          for (const player of data.players) {
            let playerId = player.playerId ?? names.get(normalizeName(player.name));
            if (playerId && !existingPlayers.some(p => p.id === playerId)) throw new BadRequestException('Unknown player ID ' + playerId);
            if (!playerId) {
              const id = await trx.insertInto('players').values({
                name: player.name,
                normalized_name: normalizeName(player.name),
                active: 1,
                created_at: Date.now()
              })
                .returning('id').executeTakeFirstOrThrow();
              playerId = id.id;
              names.set(normalizeName(player.name), playerId);
              existingPlayers.push({ id: playerId, normalized_name: normalizeName(player.name) });
            }
            if (ids.has(playerId)) throw new BadRequestException('Same player assigned to multiple ranks');
            ids.add(playerId);
            await trx.insertInto('player_scores').values({
              war_id: war.id,
              player_id: playerId,
              position: player.position,
              points: player.points
            }).execute();
          }
          await trx.updateTable('wars').set({ ranking_imported_at: Date.now() }).where('id', '=', war.id).execute();
          // Roster status is always based on the most recent imported ranking by war date.
          const latest = await trx.selectFrom('wars').select(['id']).where('ranking_imported_at', 'is not', null)
            .orderBy('start_date', 'desc').executeTakeFirstOrThrow();
          await trx.updateTable('players').set({ active: 0 }).execute();
          const active = await trx.selectFrom('player_scores').select('player_id').where('war_id', '=', latest.id).execute();
          if (active.length) await trx.updateTable('players').set({ active: 1 }).where('id', 'in', active.map(x => x.player_id)).execute();
        }
        if (data.result) {
          if (war.result_imported_at !== null) throw new BadRequestException('Final result already imported for this war');
          const normalized = normalizeName(data.result.opponent);
          let opponent = await trx.selectFrom('clans').select('id').where('normalized_name', '=', normalized).executeTakeFirst();
          if (!opponent) opponent = await trx.insertInto('clans').values({
            name: data.result.opponent,
            normalized_name: normalized
          })
            .returning('id').executeTakeFirstOrThrow();
          await trx.updateTable('wars').set({
            opponent_clan_id: opponent.id, our_score: data.result.ourScore,
            opponent_score: data.result.opponentScore, result_imported_at: Date.now()
          }).where('id', '=', war.id).execute();
          for (const day of data.result.days) await trx.insertInto('war_days').values({
            war_id: war.id, day_number: day.day,
            winner: day.winner, points: day.points, mvp: day.mvp
          }).execute();
        }
      });
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      if ((e as Error).message.includes('UNIQUE')) throw new BadRequestException('Name or rank is already used');
      throw e;
    }
    return this.wars.dashboard();
  }
}

@Controller('api/import')
@UseGuards(SessionGuard, AdminGuard)
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  @Get('roster') roster(@Query('start') start: string) {return this.importer.matchingPlayers(start);}

  @Post('confirm') submit(@Body() body: unknown) {return this.importer.confirm(body);}
}
