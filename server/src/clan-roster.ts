import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminGuard, SessionGuard } from './auth';
import { Db, normalizeName } from './database';
import { MembershipService } from './membership';
import { PlayersService } from './players';
import { formatPower, parsePower } from './roster-ocr';

const rowSchema = z.object({
  name: z.string().trim().min(2).max(80),
  powerText: z.string().trim().min(2).max(24),
  playerId: z.number().int().positive().nullable().optional(),
});
const submitSchema = z.object({
  capturedAt: z.string().datetime({ offset: true }),
  reportedMembers: z.number().int().min(1).max(100),
  reportedPowerText: z.string().trim().max(24).nullable(),
  screenshotCount: z.number().int().min(1).max(10),
  acknowledgePowerMismatch: z.boolean().optional(),
  players: z.array(rowSchema).min(1).max(100),
});

@Injectable()
export class ClanRosterService {
  constructor(
    private readonly db: Db,
    private readonly identities: PlayersService,
    private readonly membership: MembershipService,
  ) {}

  async candidates() {
    const [players, aliases, latest] = await Promise.all([
      this.db.query.selectFrom('players').select(['id', 'name', 'active']).orderBy('name').execute(),
      this.db.query
        .selectFrom('player_aliases')
        .select(['normalized_name as normalizedName', 'player_id as playerId'])
        .execute(),
      this.db.query
        .selectFrom('clan_roster_snapshots')
        .select(['id', 'captured_at as capturedAt', 'reported_members as reportedMembers'])
        .orderBy('captured_at', 'desc')
        .orderBy('id', 'desc')
        .executeTakeFirst(),
    ]);
    return { players, aliases, latest: latest ?? null };
  }

  async confirm(body: unknown) {
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join('; '));
    }
    const data = parsed.data;
    const capturedAt = Date.parse(data.capturedAt);
    if (
      !Number.isFinite(capturedAt) ||
      capturedAt > Date.now() + 5 * 60_000 ||
      capturedAt < Date.UTC(2020, 0, 1)
    ) {
      throw new BadRequestException('Invalid roster capture date');
    }
    if (data.players.length !== data.reportedMembers) {
      throw new BadRequestException('Roster must contain exactly the reported number of members');
    }
    const names = new Set(data.players.map((player) => normalizeName(player.name)));
    if (names.size !== data.players.length) {
      throw new BadRequestException('Duplicate player names in roster');
    }
    const powers = data.players.map((player) => parsePower(player.powerText));
    if (powers.some((power) => power === null)) {
      throw new BadRequestException('Invalid player power: use K, M, B, T, q or Q');
    }
    const reported = data.reportedPowerText ? parsePower(data.reportedPowerText) : null;
    if (data.reportedPowerText && reported === null) {
      throw new BadRequestException('Invalid total clan power');
    }
    const computed = (powers as number[]).reduce((sum, value) => sum + value, 0);
    const difference = reported && reported > 0 ? Math.abs(computed - reported) / reported : 0;
    // Game power is rounded to two decimal places per player; small differences are normal.
    if (difference > 0.04 && !data.acknowledgePowerMismatch) {
      throw new BadRequestException(
        'Clan power differs from the sum of players by more than 4%. Review the OCR values.',
      );
    }

    let snapshotId = 0;
    await this.db.query.transaction().execute(async (trx) => {
      const existing = await trx.selectFrom('players').select(['id', 'account_id']).execute();
      const ids = new Set(existing.map((player) => player.id));
      const selected = new Set<number>();
      const entryIds: number[] = [];
      for (const [index, player] of data.players.entries()) {
        let id = player.playerId ?? (await this.identities.resolve(trx, player.name));
        if (id && !ids.has(id)) throw new BadRequestException('Unknown matched player ID');
        if (!id) {
          const inserted = await trx
            .insertInto('players')
            .values({
              name: player.name,
              normalized_name: normalizeName(player.name),
              account_id: null,
              active: 1,
              created_at: capturedAt,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          id = inserted.id;
          ids.add(id);
        }
        if (selected.has(id)) {
          throw new BadRequestException('Multiple screenshot entries match the same player');
        }
        selected.add(id);
        entryIds.push(id);
      }
      // Preserve the association between existing site accounts and newly recognized players.
      const availableAccounts = await trx
        .selectFrom('accounts')
        .select(['id', 'username'])
        .where('active', '=', 1)
        .execute();
      const linked = new Set(
        existing.filter((player) => player.account_id !== null).map((player) => player.account_id),
      );
      for (const [index, id] of entryIds.entries()) {
        const matched = availableAccounts.find(
          (account) => normalizeName(account.username) === normalizeName(data.players[index].name),
        );
        if (matched && !linked.has(matched.id)) {
          const update = await trx
            .updateTable('players')
            .set({ account_id: matched.id })
            .where('id', '=', id)
            .where('account_id', 'is', null)
            .executeTakeFirst();
          if (update.numUpdatedRows) linked.add(matched.id);
        }
      }
      const snapshot = await trx
        .insertInto('clan_roster_snapshots')
        .values({
          captured_at: capturedAt,
          imported_at: Date.now(),
          reported_members: data.reportedMembers,
          reported_power: reported,
          screenshot_count: data.screenshotCount,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      snapshotId = snapshot.id;
      for (const [index, player] of data.players.entries()) {
        await trx
          .insertInto('clan_roster_entries')
          .values({
            snapshot_id: snapshot.id,
            player_id: entryIds[index],
            power: powers[index]!,
            power_text: player.powerText,
          })
          .execute();
      }
      await this.membership.refresh(trx);
    });
    return { id: snapshotId, reportedMembers: data.reportedMembers, totalPower: computed };
  }

  async timeline() {
    const [snapshots, entries] = await Promise.all([
      this.db.query
        .selectFrom('clan_roster_snapshots')
        .selectAll()
        .orderBy('captured_at', 'asc')
        .orderBy('id', 'asc')
        .execute(),
      this.db.query
        .selectFrom('clan_roster_entries')
        .select(['snapshot_id', 'player_id', 'power'])
        .execute(),
    ]);
    const grouped = new Map<number, { ids: Set<number>; power: number }>();
    for (const entry of entries) {
      const group = grouped.get(entry.snapshot_id) ?? { ids: new Set<number>(), power: 0 };
      group.ids.add(entry.player_id);
      group.power += entry.power;
      grouped.set(entry.snapshot_id, group);
    }
    let previous: Set<number> | null = null;
    return snapshots.map((snapshot) => {
      const current = grouped.get(snapshot.id) ?? { ids: new Set<number>(), power: 0 };
      const joined = previous ? [...current.ids].filter((id) => !previous!.has(id)).length : null;
      const left = previous ? [...previous].filter((id) => !current.ids.has(id)).length : null;
      previous = current.ids;
      return {
        id: snapshot.id,
        capturedAt: new Date(snapshot.captured_at).toISOString(),
        memberCount: current.ids.size,
        reportedMembers: snapshot.reported_members,
        totalPower: current.power,
        totalPowerText: formatPower(current.power),
        reportedPower: snapshot.reported_power,
        joined,
        left,
      };
    });
  }

  async playerHistory(playerId: number) {
    if (!Number.isSafeInteger(playerId) || playerId < 1)
      throw new BadRequestException('Invalid player ID');
    const rows = await this.db.query
      .selectFrom('clan_roster_entries')
      .innerJoin('clan_roster_snapshots', 'clan_roster_entries.snapshot_id', 'clan_roster_snapshots.id')
      .select([
        'clan_roster_snapshots.id as snapshotId',
        'clan_roster_snapshots.captured_at as capturedAt',
        'clan_roster_entries.power',
        'clan_roster_entries.power_text as powerText',
      ])
      .where('clan_roster_entries.player_id', '=', playerId)
      .orderBy('clan_roster_snapshots.captured_at')
      .execute();
    return rows.map((row) => ({
      ...row,
      capturedAt: new Date(row.capturedAt).toISOString(),
    }));
  }

  async latest() {
    const snapshot = await this.db.query
      .selectFrom('clan_roster_snapshots')
      .selectAll()
      .orderBy('captured_at', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    if (!snapshot) return null;
    const entries = await this.db.query
      .selectFrom('clan_roster_entries')
      .innerJoin('players', 'players.id', 'clan_roster_entries.player_id')
      .select([
        'players.id',
        'players.name',
        'clan_roster_entries.power',
        'clan_roster_entries.power_text as powerText',
      ])
      .where('clan_roster_entries.snapshot_id', '=', snapshot.id)
      .orderBy('players.name')
      .execute();
    return {
      id: snapshot.id,
      capturedAt: new Date(snapshot.captured_at).toISOString(),
      reportedMembers: snapshot.reported_members,
      reportedPower: snapshot.reported_power,
      entries,
    };
  }
}

@Controller('api/clan-roster')
@UseGuards(SessionGuard)
export class ClanRosterController {
  constructor(private readonly roster: ClanRosterService) {}

  @Get('timeline')
  timeline() {
    return this.roster.timeline();
  }

  @Get('latest')
  latest() {
    return this.roster.latest();
  }

  @Get('players/:id')
  history(@Param('id') id: string) {
    return this.roster.playerHistory(Number(id));
  }

  @UseGuards(AdminGuard)
  @Get('candidates')
  candidates() {
    return this.roster.candidates();
  }

  @UseGuards(AdminGuard)
  @Post('confirm')
  confirm(@Body() body: unknown) {
    return this.roster.confirm(body);
  }
}
