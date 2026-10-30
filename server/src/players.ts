import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Transaction } from 'kysely';
import { z } from 'zod';
import { AdminGuard, SessionGuard, type AuthenticatedRequest } from './auth';
import { Db, normalizeName, type Tables } from './database';
import { WarsService } from './wars';
import { MembershipService } from './membership';

type Tx = Transaction<Tables>;

@Injectable()
export class PlayersService {
  constructor(
    private readonly db: Db,
    private readonly wars: WarsService,
    private readonly membership: MembershipService,
  ) {}

  async list(isStaff: boolean) {
    const [players, scores, labels] = await Promise.all([
      this.db.query
        .selectFrom('players')
        .leftJoin('accounts', 'accounts.id', 'players.account_id')
        .select([
          'players.id',
          'players.name',
          'players.active',
          'players.account_id',
          'accounts.active as account_active',
          'accounts.role as account_role',
        ])
        .orderBy('players.name')
        .execute(),
      this.db.query
        .selectFrom('player_scores')
        .innerJoin('wars', 'wars.id', 'player_scores.war_id')
        .select(['player_scores.player_id', 'wars.start_date'])
        .execute(),
      isStaff
        ? this.db.query
            .selectFrom('player_labels')
            .select(['player_id', 'telegram', 'discord', 'tags_json', 'exception_reason'])
            .execute()
        : Promise.resolve([]),
    ]);
    const weeksByPlayer = new Map<number, string[]>();
    for (const score of scores) {
      const weeks = weeksByPlayer.get(score.player_id) ?? [];
      weeks.push(score.start_date);
      weeksByPlayer.set(score.player_id, weeks);
    }
    const labelsByPlayer = new Map(labels.map((label) => [label.player_id, label]));
    return players.map((player) => {
      const flags = labelsByPlayer.get(player.id);
      const tags = flags ? (JSON.parse(flags.tags_json) as string[]) : [];
      return {
        id: player.id,
        name: player.name,
        active: !!player.active,
        hasAccount: player.account_id !== null,
        accountActive: !!player.account_active,
        accountRole: player.account_id !== null ? player.account_role : null,
        ...(isStaff ? { accountId: player.account_id } : {}),
        weeks: weeksByPlayer.get(player.id) ?? [],
        ...(isStaff
          ? {
              telegram: !!flags?.telegram,
              discord: !!flags?.discord,
              protected: !!flags?.exception_reason.trim() || tags.includes('exception'),
              attention: tags.includes('attention'),
            }
          : {}),
      };
    });
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
    await trx.insertInto('player_events').values({
      player_id: playerId,
      kind: 'rename',
      previous_value: previous.name,
      next_value: name.trim(),
      occurred_at: Date.now(),
    }).execute();
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
        .set({ mvp: name.trim(), mvp_player_id: playerId })
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
        .updateTable('war_days')
        .set({ mvp_player_id: targetId })
        .where('mvp_player_id', '=', sourceId)
        .execute();
      await trx
        .updateTable('player_events')
        .set({ player_id: targetId })
        .where('player_id', '=', sourceId)
        .execute();
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
          .set({ mvp: target.name, mvp_player_id: targetId })
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
        if (
          oldLabels.exception_reason.trim() &&
          canonicalLabels?.exception_reason.trim() &&
          oldLabels.exception_reason !== canonicalLabels.exception_reason
        ) {
          extraNotes.push('Earlier exception for ' + source.name + ': ' + oldLabels.exception_reason);
        }
        for (const channel of ['telegram', 'discord'] as const) {
          const field = channel === 'telegram' ? 'telegram_handle' : 'discord_handle';
          if (
            oldLabels[field] &&
            canonicalLabels?.[field] &&
            oldLabels[field] !== canonicalLabels[field]
          ) {
            extraNotes.push(
              'Previous ' + channel + ' contact for ' + source.name + ': ' + oldLabels[field],
            );
          }
        }
        for (const body of extraNotes) {
          await trx
            .insertInto('player_notes')
            .values({
              player_id: targetId,
              author_id: null,
              body,
              category: 'note',
              created_at: Date.now(),
            })
            .execute();
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
      // Keep all historical power observations when consolidating OCR nicknames.
      const sourcePower = await trx
        .selectFrom('clan_roster_entries')
        .selectAll()
        .where('player_id', '=', sourceId)
        .execute();
      const targetPower = await trx
        .selectFrom('clan_roster_entries')
        .select('snapshot_id')
        .where('player_id', '=', targetId)
        .execute();
      const occupiedSnapshots = new Set(targetPower.map((entry) => entry.snapshot_id));
      for (const entry of sourcePower) {
        if (!occupiedSnapshots.has(entry.snapshot_id)) continue;
        await trx
          .deleteFrom('clan_roster_entries')
          .where('snapshot_id', '=', entry.snapshot_id)
          .where('player_id', '=', overlap === 'keepTarget' ? sourceId : targetId)
          .execute();
      }
      await trx
        .updateTable('clan_roster_entries')
        .set({ player_id: targetId })
        .where('player_id', '=', sourceId)
        .execute();
      await trx.deleteFrom('players').where('id', '=', sourceId).execute();
      await trx
        .insertInto('player_aliases')
        .values({ normalized_name: source.normalized_name, player_id: targetId })
        .onConflict((oc) => oc.column('normalized_name').doUpdateSet({ player_id: targetId }))
        .execute();

      await this.membership.refresh(trx);
    });
    return this.wars.dashboard();
  }
}

@Controller('api/players')
@UseGuards(SessionGuard)
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.players.list(request.account?.role === 'owner' || request.account?.role === 'admin');
  }

  @UseGuards(AdminGuard)
  @Post('merge')
  merge(@Body() body: unknown) {
    return this.players.merge(body);
  }
}
