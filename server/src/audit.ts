import { Controller, Get, Injectable, UseGuards } from '@nestjs/common';
import type { Transaction } from 'kysely';
import { AdminGuard, SessionGuard } from './auth';
import { Db, type Tables } from './database';

export interface AuditEntry {
  actorId: number;
  action: string;
  entity: string;
  entityId?: number | null;
  details?: Record<string, unknown>;
}

export async function recordAudit(trx: Transaction<Tables>, entry: AuditEntry) {
  await trx
    .insertInto('audit_log')
    .values({
      actor_id: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      details_json: JSON.stringify(entry.details ?? {}),
      created_at: Date.now(),
    })
    .execute();
}

@Injectable()
export class AuditService {
  constructor(private readonly db: Db) {}

  async write(entry: AuditEntry) {
    return this.db.query.transaction().execute((trx) => recordAudit(trx, entry));
  }

  async recent() {
    return this.db.query
      .selectFrom('audit_log')
      .leftJoin('accounts', 'accounts.id', 'audit_log.actor_id')
      .select([
        'audit_log.id',
        'audit_log.action',
        'audit_log.entity',
        'audit_log.entity_id as entityId',
        'audit_log.details_json as detailsJson',
        'audit_log.created_at as createdAt',
        'accounts.display_name as actor',
      ])
      .orderBy('audit_log.id', 'desc')
      .limit(100)
      .execute();
  }
}

@Controller('api/audit')
@UseGuards(SessionGuard, AdminGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  recent() {
    return this.audit.recent();
  }
}
