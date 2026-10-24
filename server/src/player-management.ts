import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminGuard, type AuthenticatedRequest, SessionGuard } from './auth';
import { Db } from './database';

export const playerTag = z.enum(['family', 'exception', 'attention', 'inactive', 'plan', 'reliable']);
export const noteCategory = z.enum(['note', 'attention', 'contact', 'positive']);

const labelsSchema = z
  .object({
    telegram: z.boolean(),
    discord: z.boolean(),
    telegramHandle: z.string().trim().max(100),
    discordHandle: z.string().trim().max(100),
    tags: z
      .array(playerTag)
      .max(6)
      .refine((tags) => new Set(tags).size === tags.length),
    exceptionReason: z.string().trim().max(600),
  })
  .strict();
export type PlayerLabels = z.infer<typeof labelsSchema>;

@Injectable()
export class PlayerManagementService {
  constructor(private readonly db: Db) {}

  private async requirePlayer(id: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestException('Invalid player ID');
    const player = await this.db.query
      .selectFrom('players')
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst();
    if (!player) throw new BadRequestException('Player not found');
  }

  async get(id: number) {
    await this.requirePlayer(id);
    const [row, notes] = await Promise.all([
      this.db.query
        .selectFrom('player_labels')
        .selectAll()
        .where('player_id', '=', id)
        .executeTakeFirst(),
      this.db.query
        .selectFrom('player_notes')
        .leftJoin('accounts', 'accounts.id', 'player_notes.author_id')
        .select([
          'player_notes.id',
          'player_notes.body',
          'player_notes.category',
          'player_notes.created_at as createdAt',
          'accounts.display_name as author',
        ])
        .where('player_notes.player_id', '=', id)
        .orderBy('player_notes.created_at', 'desc')
        .orderBy('player_notes.id', 'desc')
        .execute(),
    ]);
    const labels: PlayerLabels = {
      telegram: !!row?.telegram,
      discord: !!row?.discord,
      telegramHandle: row?.telegram_handle ?? '',
      discordHandle: row?.discord_handle ?? '',
      tags: row ? labelsSchema.shape.tags.parse(JSON.parse(row.tags_json)) : [],
      exceptionReason: row?.exception_reason ?? '',
    };
    return { labels, notes };
  }

  async save(id: number, input: unknown) {
    const result = labelsSchema.safeParse(input);
    if (!result.success) throw new BadRequestException('Invalid player labels');
    await this.requirePlayer(id);
    const labels = result.data;
    await this.db.query
      .insertInto('player_labels')
      .values({
        player_id: id,
        telegram: Number(labels.telegram),
        discord: Number(labels.discord),
        telegram_handle: labels.telegram ? labels.telegramHandle : '',
        discord_handle: labels.discord ? labels.discordHandle : '',
        tags_json: JSON.stringify(labels.tags),
        exception_reason: labels.exceptionReason,
        updated_at: Date.now(),
      })
      .onConflict((oc) =>
        oc.column('player_id').doUpdateSet({
          telegram: Number(labels.telegram),
          discord: Number(labels.discord),
          telegram_handle: labels.telegram ? labels.telegramHandle : '',
          discord_handle: labels.discord ? labels.discordHandle : '',
          tags_json: JSON.stringify(labels.tags),
          exception_reason: labels.exceptionReason,
          updated_at: Date.now(),
        }),
      )
      .execute();
    return this.get(id);
  }

  async addNote(id: number, authorId: number, input: unknown) {
    const result = z
      .object({
        body: z.string().trim().min(1).max(700),
        category: noteCategory,
      })
      .strict()
      .safeParse(input);
    if (!result.success) throw new BadRequestException('Invalid note');
    await this.requirePlayer(id);
    await this.db.query
      .insertInto('player_notes')
      .values({
        player_id: id,
        author_id: authorId,
        ...result.data,
        created_at: Date.now(),
      })
      .execute();
    return this.get(id);
  }

  async removeNote(id: number, noteId: number) {
    await this.requirePlayer(id);
    const result = await this.db.query
      .deleteFrom('player_notes')
      .where('id', '=', noteId)
      .where('player_id', '=', id)
      .executeTakeFirst();
    if (!Number(result.numDeletedRows)) throw new BadRequestException('Note not found');
    return this.get(id);
  }

  async tagsByPlayer(ids: number[]) {
    if (!ids.length) return [];
    return this.db.query
      .selectFrom('player_labels')
      .select(['player_id', 'telegram', 'discord', 'tags_json', 'exception_reason'])
      .where('player_id', 'in', ids)
      .execute();
  }
}

@Controller('api/player-management')
@UseGuards(SessionGuard, AdminGuard)
export class PlayerManagementController {
  constructor(private readonly service: PlayerManagementService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(Number(id));
  }

  @Patch(':id')
  save(@Param('id') id: string, @Body() data: unknown) {
    return this.service.save(Number(id), data);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() data: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.addNote(Number(id), request.account!.id, data);
  }

  @Delete(':id/notes/:noteId')
  removeNote(@Param('id') id: string, @Param('noteId') noteId: string) {
    return this.service.removeNote(Number(id), Number(noteId));
  }
}
