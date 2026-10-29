import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import { Db, type Tables } from './database';

type Tx = Transaction<Tables>;
const DAY_MS = 86_400_000;

/**
 * Single source of truth for "currently in clan".
 * A complete roster screenshot is an observation at capture time.
 * A war ranking represents the Sunday when that war finished, NOT its later import time.
 * Re-importing older wars must never overwrite a more recent roster.
 */
@Injectable()
export class MembershipService {
  constructor(private readonly db: Db) {}

  async refresh(trx: Tx) {
    const [roster, war] = await Promise.all([
      trx
        .selectFrom('clan_roster_snapshots')
        .select(['id', 'captured_at'])
        .orderBy('captured_at', 'desc')
        .orderBy('id', 'desc')
        .executeTakeFirst(),
      trx
        .selectFrom('wars')
        .select(['id', 'start_date'])
        .where('ranking_imported_at', 'is not', null)
        .orderBy('start_date', 'desc')
        .executeTakeFirst(),
    ]);
    const warObservedAt = war ? Date.parse(war.start_date + 'T00:00:00Z') + 6 * DAY_MS - 1 : -1;
    const rosterIsLatest = !!roster && roster.captured_at >= warObservedAt;
    if (!rosterIsLatest && !war) return;

    const ids = rosterIsLatest
      ? await trx
          .selectFrom('clan_roster_entries')
          .select('player_id')
          .where('snapshot_id', '=', roster!.id)
          .execute()
      : await trx
          .selectFrom('player_scores')
          .select('player_id')
          .where('war_id', '=', war!.id)
          .execute();
    const observedAt = rosterIsLatest ? roster!.captured_at : warObservedAt;

    // Players enrolled after the last observed snapshot are not proof of departure.
    await trx.updateTable('players').set({ active: 0 }).where('created_at', '<=', observedAt).execute();
    if (ids.length) {
      await trx
        .updateTable('players')
        .set({ active: 1 })
        .where('id', 'in', [...new Set(ids.map((entry) => entry.player_id))])
        .execute();
    }
  }
}
