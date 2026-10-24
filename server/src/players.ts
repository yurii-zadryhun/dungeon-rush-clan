import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Transaction } from 'kysely';
import { z } from 'zod';
import { AdminGuard, SessionGuard } from './auth';
import { Db, normalizeName, type Tables } from './database';
import { WarsService } from './wars';

type Tx = Transaction<Tables>;

@Injectable()
export class PlayersService {
  constructor(
    private readonly db: Db,
    private readonly wars: WarsService,
  ) {}

  async list() {
    const [players, scores] = await Promise.all([
      this.db.query
        .selectFrom('players')
        .select(['id', 'name', 'active', 'account_id'])
        .orderBy('name')
        .execute(),
      this.db.query
        .selectFrom('player_scores')
        .innerJoin('wars', 'wars.id', 'player_scores.war_id')
        .select(['player_scores.player_id', 'wars.start_date'])
        .execute(),
    ]);
    return players.map((player) => ({
      id: player.id,
      name: player.name,
      active: !!player.active,
      hasAccount: player.account_id !== null,
      weeks: scores.filter((score) => score.player_id === player.id).map((score) => score.start_date),
    }));
  }

  async resolve(trx: Tx, input: string): Promise<number | undefined> {
    const normalized = normalizeName(input);
    const current = await trx
      .selectFrom('players')
      .select('id')
      .where('normalized_name', '=', normalized)
      .executeTakeFirst();
    if (current) return current.id;
    const alias = await trx
      .selectFrom('player_aliases')
      .select('player_id')
      .where('normalized_name', '=', normalized)
      .executeTakeFirst();
    return alias?.player_id;
  }

  async rename(trx: Tx, playerId: number, name: string) {
    const previous = await trx
      .selectFrom('players')
      .selectAll()
      .where('id', '=', playerId)
      .executeTakeFirstOrThrow();
    const normalized = normalizeName(name);
    if (previous.normalized_name === normalized && previous.name === name.trim()) return;
    const reserved = await this.resolve(trx, name);
    if (reserved !== undefined && reserved !== playerId) {
      throw new BadRequestException('Player name belongs to another player. Merge duplicates first.');
    }
    if (previous.account_id !== null) {
      const used = await trx
        .selectFrom('accounts')
        .select('id')
        .where('username', '=', normalized)
        .where('id', '!=', previous.account_id)
        .executeTakeFirst();
      if (used) throw new BadRequestException('Username already exists');
      await trx
        .updateTable('accounts')
        .set({ username: normalized, display_name: name.trim() })
        .where('id', '=', previous.account_id)
        .execute();
    }
    if (normalized !== previous.normalized_name) {
      await trx
        .insertInto('player_aliases')
        .values({ normalized_name: previous.normalized_name, player_id: playerId })
        .onConflict((oc) => oc.column('normalized_name').doUpdateSet({ player_id: playerId }))
        .execute();
      await trx.deleteFrom('player_aliases').where('normalized_name', '=', normalized).execute();
    }
    await trx
      .updateTable('players')
      .set({ name: name.trim(), normalized_name: normalized })
      .where('id', '=', playerId)
      .execute();
    const mvpEntries = await trx
      .selectFrom('war_days')
      .select(['war_id', 'day_number', 'mvp'])
      .execute();
    for (const day of mvpEntries) {
      if (normalizeName(day.mvp) !== previous.normalized_name) continue;
      await trx
        .updateTable('war_days')
        .set({ mvp: name.trim() })
        .where('war_id', '=', day.war_id)
        .where('day_number', '=', day.day_number)
        .execute();
    }
  }

  async merge(input: unknown) {
    const parsed = z
      .object({
        sourceId: z.number().int().positive(),
        targetId: z.number().int().positive(),
        overlap: z.enum(['keepTarget', 'keepSource']),
      })
      .safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid merge request');
    const { sourceId, targetId, overlap } = parsed.data;
    if (sourceId === targetId) throw new BadRequestException('Choose two different players');

    await this.db.query.transaction().execute(async (trx) => {
      const [source, target] = await Promise.all([
        trx.selectFrom('players').selectAll().where('id', '=', sourceId).executeTakeFirst(),
        trx.selectFrom('players').selectAll().where('id', '=', targetId).executeTakeFirst(),
      ]);
      if (!source || !target) throw new BadRequestException('Player not found');
      if (
        source.account_id !== null &&
        target.account_id !== null &&
        source.account_id !== target.account_id
      ) {
        throw new BadRequestException('Both players have different accounts. Resolve accounts first.');
      }
      const sourceScores = await trx
        .selectFrom('player_scores')
        .selectAll()
        .where('player_id', '=', sourceId)
        .execute();
      const targetScores = await trx
        .selectFrom('player_scores')
        .select(['war_id'])
        .where('player_id', '=', targetId)
        .execute();
      const occupied = new Set(targetScores.map((s) => s.war_id));

      // Remove source first on overlaps to avoid PRIMARY KEY conflicts; keepTarget is the default choice.
      if (overlap === 'keepTarget') {
        for (const score of sourceScores.filter((s) => occupied.has(s.war_id))) {
          await trx
            .deleteFrom('player_scores')
            .where('war_id', '=', score.war_id)
            .where('player_id', '=', sourceId)
            .execute();
        }
      } else {
        for (const score of sourceScores.filter((s) => occupied.has(s.war_id))) {
          await trx
            .deleteFrom('player_scores')
            .where('war_id', '=', score.war_id)
            .where('player_id', '=', targetId)
            .execute();
        }
      }
      await trx
        .updateTable('player_scores')
        .set({ player_id: targetId })
        .where('player_id', '=', sourceId)
        .execute();

      const days = await trx.selectFrom('war_days').select(['war_id', 'day_number', 'mvp']).execute();
      for (const day of days) {
        if (normalizeName(day.mvp) !== source.normalized_name) continue;
        await trx
          .updateTable('war_days')
          .set({ mvp: target.name })
          .where('war_id', '=', day.war_id)
          .where('day_number', '=', day.day_number)
          .execute();
      }

      if (source.account_id !== null) {
        // The account's login remains usable after the merge and follows the canonical nickname.
        const duplicate = await trx
          .selectFrom('accounts')
          .select('id')
          .where('username', '=', target.normalized_name)
          .where('id', '!=', source.account_id)
          .executeTakeFirst();
        if (duplicate) throw new BadRequestException('Canonical name belongs to another account');
        await trx.updateTable('players').set({ account_id: null }).where('id', '=', sourceId).execute();
        await trx
          .updateTable('players')
          .set({ account_id: source.account_id })
          .where('id', '=', targetId)
          .execute();
        await trx
          .updateTable('accounts')
          .set({ username: target.normalized_name, display_name: target.name })
          .where('id', '=', source.account_id)
          .execute();
      }

      await trx
        .updateTable('player_aliases')
        .set({ player_id: targetId })
        .where('player_id', '=', sourceId)
        .execute();
      // Preserve private leadership context when an OCR duplicate is merged.
      const [oldLabels, canonicalLabels] = await Promise.all([
        trx.selectFrom('player_labels').selectAll().where('player_id', '=', sourceId).executeTakeFirst(),
        trx.selectFrom('player_labels').selectAll().where('player_id', '=', targetId).executeTakeFirst(),
      ]);
      if (oldLabels) {
        const tags = [
          ...new Set([
            ...(JSON.parse(oldLabels.tags_json) as string[]),
            ...(canonicalLabels ? (JSON.parse(canonicalLabels.tags_json) as string[]) : []),
          ]),
        ];
        // Preserve conflicting manager context as history, not an oversized form field.
        const extraNotes: string[] = [];
        if (oldLabels.exception_reason.trim() && canonicalLabels?.exception_reason.trim() &&
            oldLabels.exception_reason !== canonicalLabels.exception_reason) {
          extraNotes.push('Earlier exception for ' + source.name + ': ' + oldLabels.exception_reason);
        }
        for (const channel of ['telegram', 'discord'] as const) {
          const field = channel === 'telegram' ? 'telegram_handle' : 'discord_handle';
          if (oldLabels[field] && canonicalLabels?.[field] &&
              oldLabels[field] !== canonicalLabels[field]) {
            extraNotes.push('Previous ' + channel + ' contact for ' + source.name + ': ' + oldLabels[field]);
          }
        }
        for (const body of extraNotes) {
          await trx.insertInto('player_notes').values({
            player_id: targetId, author_id: null, body, category: 'note', created_at: Date.now(),
          }).execute();
        }
        const mergedLabels = {
          telegram: Number(!!oldLabels.telegram || !!canonicalLabels?.telegram),
          discord: Number(!!oldLabels.discord || !!canonicalLabels?.discord),
          telegram_handle: canonicalLabels?.telegram_handle || oldLabels.telegram_handle,
          discord_handle: canonicalLabels?.discord_handle || oldLabels.discord_handle,
          tags_json: JSON.stringify(tags),
          exception_reason: canonicalLabels?.exception_reason || oldLabels.exception_reason,
          updated_at: Date.now(),
        };
        await trx
          .insertInto('player_labels')
          .values({
            player_id: targetId,
            ...mergedLabels,
          })
          .onConflict((oc) => oc.column('player_id').doUpdateSet(mergedLabels))
          .execute();
        await trx.deleteFrom('player_labels').where('player_id', '=', sourceId).execute();
      }
      await trx
        .updateTable('player_notes')
        .set({ player_id: targetId })
        .where('player_id', '=', sourceId)
        .execute();
      await trx.deleteFrom('players').where('id', '=', sourceId).execute();
      await trx
        .insertInto('player_aliases')
        .values({ normalized_name: source.normalized_name, player_id: targetId })
        .onConflict((oc) => oc.column('normalized_name').doUpdateSet({ player_id: targetId }))
        .execute();

      const latest = await trx
        .selectFrom('wars')
        .select('id')
        .where('ranking_imported_at', 'is not', null)
        .orderBy('start_date', 'desc')
        .executeTakeFirst();
      await trx.updateTable('players').set({ active: 0 }).execute();
      if (latest) {
        const current = await trx
          .selectFrom('player_scores')
          .select('player_id')
          .where('war_id', '=', latest.id)
          .execute();
        if (current.length) {
          await trx
            .updateTable('players')
            .set({ active: 1 })
            .where(
              'id',
              'in',
              current.map((p) => p.player_id),
            )
            .execute();
        }
      }
    });
    return this.wars.dashboard();
  }
}

@Controller('api/players')
@UseGuards(SessionGuard, AdminGuard)
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Get()
  list() {
    return this.players.list();
  }

  @Post('merge')
  merge(@Body() body: unknown) {
    return this.players.merge(body);
  }
}
