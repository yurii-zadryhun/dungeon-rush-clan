import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Db, normalizeName, type Role, type Tables } from './database';
import type { Transaction } from 'kysely';

import {
  SESSION_TTL, SESSION_RENEWAL_INTERVAL, IMPERSONATION_TTL, INVITATION_TTL,
  usernameSchema, passwordSchema, localeSchema,
  validate, digest, randomToken, hashPassword, verifyPassword,
  safeTokenEquals, sessionCookie,
} from './auth-utils';
export interface AuthenticatedAccount {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  locale: 'uk' | 'en';
  playerId: number | null;
  impersonating?: { ownerId: number; ownerName: string; expiresAt: number };
}
export type AuthenticatedRequest = FastifyRequest & { account?: AuthenticatedAccount };

@Injectable()
export class AccountsService {
  private readonly loginAttempts = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly db: Db) {}

  async initialized(): Promise<boolean> {
    const owner = await this.db.query
      .selectFrom('accounts')
      .select('id')
      .where('role', '=', 'owner')
      .executeTakeFirst();
    return Boolean(owner);
  }

  async createOwner(input: unknown, reply: FastifyReply): Promise<AuthenticatedAccount> {
    const data = validate(
      z.object({
        bootstrapToken: z.string().min(1),
        username: usernameSchema,
        password: passwordSchema,
        locale: localeSchema.default('uk'),
      }),
      input,
    );
    const expected = process.env.BOOTSTRAP_TOKEN;
    if (!expected || !safeTokenEquals(data.bootstrapToken, expected)) {
      throw new ForbiddenException('Invalid setup token');
    }
    if (await this.initialized()) throw new ForbiddenException('Owner already exists');
    let id: number;
    try {
      id = await this.db.query.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('accounts')
          .values({
            username: normalizeName(data.username),
            display_name: data.username,
            role: 'owner',
            password_hash: hashPassword(data.password),
            locale: data.locale,
            active: 1,
            created_at: Date.now(),
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        return created.id;
      });
    } catch (error) {
      if ((error as Error).message.includes('UNIQUE')) {
        throw new BadRequestException('Account already exists');
      }
      throw error;
    }
    return this.createSession(id, reply);
  }

  private limitAttempts(key: string): void {
    const now = Date.now();
    const current = this.loginAttempts.get(key);
    if (current && current.expiresAt > now && current.count >= 10) {
      throw new UnauthorizedException('Too many login attempts');
    }
    this.loginAttempts.set(key, {
      count: current && current.expiresAt > now ? current.count + 1 : 1,
      expiresAt: now + 10 * 60_000,
    });
    if (this.loginAttempts.size > 2000) this.loginAttempts.clear();
  }

  async login(input: unknown, ip: string, reply: FastifyReply): Promise<AuthenticatedAccount> {
    const data = validate(
      z.object({
        username: usernameSchema,
        password: z.string(),
        locale: localeSchema.optional(),
      }),
      input,
    );
    const username = normalizeName(data.username);
    const attemptKey = ip + ':' + username;
    this.limitAttempts(attemptKey);
    const account = await this.db.query
      .selectFrom('accounts')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();
    if (!account || !account.active || !verifyPassword(data.password, account.password_hash)) {
      throw new UnauthorizedException('Invalid username or password');
    }
    this.loginAttempts.delete(attemptKey);
    if (data.locale && data.locale !== account.locale) {
      await this.db.query
        .updateTable('accounts')
        .set({ locale: data.locale })
        .where('id', '=', account.id)
        .execute();
    }
    return this.createSession(account.id, reply);
  }

  async createSession(accountId: number, reply: FastifyReply): Promise<AuthenticatedAccount> {
    const raw = randomToken();
    const now = Date.now();
    await this.db.query
      .insertInto('sessions')
      .values({
        token_hash: digest(raw),
        account_id: accountId,
        expires_at: now + SESSION_TTL,
        extended_at: now,
        impersonated_account_id: null,
        impersonation_expires_at: null,
      })
      .execute();
    sessionCookie(reply, raw);
    const account = await this.db.query
      .selectFrom('accounts')
      .select(['id', 'username', 'display_name', 'role', 'locale'])
      .where('id', '=', accountId)
      .executeTakeFirstOrThrow();
    const player = await this.db.query
      .selectFrom('players')
      .select('id')
      .where('account_id', '=', accountId)
      .executeTakeFirst();
    return {
      id: account.id,
      username: account.username,
      displayName: account.display_name,
      role: account.role,
      locale: account.locale,
      playerId: player?.id ?? null,
    };
  }

  async resolveSession(
    raw: string | undefined,
    reply: FastifyReply,
  ): Promise<AuthenticatedAccount | null> {
    if (!raw) return null;
    const session = await this.db.query
      .selectFrom('sessions')
      .innerJoin('accounts', 'accounts.id', 'sessions.account_id')
      .select([
        'sessions.expires_at',
        'sessions.extended_at',
        'sessions.impersonated_account_id',
        'sessions.impersonation_expires_at',
        'accounts.id',
        'accounts.username',
        'accounts.display_name',
        'accounts.role',
        'accounts.locale',
        'accounts.active',
      ])
      .where('sessions.token_hash', '=', digest(raw))
      .executeTakeFirst();
    if (!session || !session.active || session.expires_at <= Date.now()) return null;
    if (Date.now() - session.extended_at >= SESSION_RENEWAL_INTERVAL) {
      const now = Date.now();
      await this.db.query
        .updateTable('sessions')
        .set({
          expires_at: now + SESSION_TTL,
          extended_at: now,
        })
        .where('token_hash', '=', digest(raw))
        .execute();
      sessionCookie(reply, raw);
    }
    if (session.impersonated_account_id !== null) {
      if (
        session.role === 'owner' &&
        session.impersonation_expires_at !== null &&
        session.impersonation_expires_at > Date.now()
      ) {
        const target = await this.db.query
          .selectFrom('accounts')
          .select(['id', 'username', 'display_name', 'role', 'locale'])
          .where('id', '=', session.impersonated_account_id)
          .where('active', '=', 1)
          .executeTakeFirst();
        if (target) {
          const player = await this.db.query
            .selectFrom('players')
            .select('id')
            .where('account_id', '=', target.id)
            .executeTakeFirst();
          return {
            id: target.id,
            username: target.username,
            displayName: target.display_name,
            role: target.role,
            locale: target.locale,
            playerId: player?.id ?? null,
            impersonating: {
              ownerId: session.id,
              ownerName: session.display_name,
              expiresAt: session.impersonation_expires_at,
            },
          };
        }
      }
      // Expired sessions or deactivated target accounts return to the original owner.
      await this.db.query
        .updateTable('sessions')
        .set({ impersonated_account_id: null, impersonation_expires_at: null })
        .where('token_hash', '=', digest(raw))
        .execute();
    }
    const player = await this.db.query
      .selectFrom('players')
      .select('id')
      .where('account_id', '=', session.id)
      .executeTakeFirst();
    return {
      id: session.id,
      username: session.username,
      displayName: session.display_name,
      role: session.role,
      locale: session.locale,
      playerId: player?.id ?? null,
    };
  }

  async impersonate(
    raw: string | undefined,
    ownerId: number,
    input: unknown,
    reply: FastifyReply,
  ): Promise<AuthenticatedAccount> {
    if (!raw) throw new UnauthorizedException();
    const { accountId } = validate(z.object({ accountId: z.number().int().positive() }), input);
    if (ownerId === accountId) throw new BadRequestException('Cannot impersonate yourself');
    const target = await this.db.query
      .selectFrom('accounts')
      .select(['id', 'role', 'active'])
      .where('id', '=', accountId)
      .executeTakeFirst();
    if (!target || !target.active) throw new BadRequestException('Account not available');
    if (target.role === 'owner') throw new ForbiddenException('Cannot impersonate another owner');
    const now = Date.now();
    const updated = await this.db.query
      .updateTable('sessions')
      .set({ impersonated_account_id: accountId, impersonation_expires_at: now + IMPERSONATION_TTL })
      .where('token_hash', '=', digest(raw))
      .where('account_id', '=', ownerId)
      .where('expires_at', '>', now)
      .where('impersonated_account_id', 'is', null)
      .executeTakeFirstOrThrow();
    if (updated.numUpdatedRows !== 1n) throw new ForbiddenException('Switching is not available');
    const active = await this.resolveSession(raw, reply);
    if (!active?.impersonating) throw new UnauthorizedException();
    return active;
  }

  async stopImpersonation(raw: string | undefined, reply: FastifyReply): Promise<AuthenticatedAccount> {
    if (!raw) throw new UnauthorizedException();
    const now = Date.now();
    const session = await this.db.query
      .selectFrom('sessions')
      .innerJoin('accounts', 'accounts.id', 'sessions.account_id')
      .select(['accounts.role', 'accounts.active', 'sessions.impersonated_account_id'])
      .where('sessions.token_hash', '=', digest(raw))
      .where('sessions.expires_at', '>', now)
      .executeTakeFirst();
    if (
      !session ||
      !session.active ||
      session.role !== 'owner' ||
      session.impersonated_account_id === null
    ) {
      throw new ForbiddenException('No owner impersonation to stop');
    }
    await this.db.query
      .updateTable('sessions')
      .set({ impersonated_account_id: null, impersonation_expires_at: null })
      .where('token_hash', '=', digest(raw))
      .execute();
    const restored = await this.resolveSession(raw, reply);
    if (!restored) throw new UnauthorizedException();
    return restored;
  }

  async logout(raw?: string): Promise<void> {
    if (raw) await this.db.query.deleteFrom('sessions').where('token_hash', '=', digest(raw)).execute();
  }

  async setLocale(accountId: number, input: unknown): Promise<{ locale: 'uk' | 'en' }> {
    const { locale } = validate(z.object({ locale: localeSchema }), input);
    await this.db.query.updateTable('accounts').set({ locale }).where('id', '=', accountId).execute();
    return { locale };
  }

  listAccounts() {
    return this.db.query
      .selectFrom('accounts')
      .select(['id', 'username', 'display_name', 'role', 'locale', 'active', 'created_at'])
      .orderBy('id')
      .execute();
  }

  listInvites() {
    return this.db.query
      .selectFrom('invites')
      .select(['id', 'label', 'role', 'created_by', 'expires_at', 'used_at'])
      .orderBy('id', 'desc')
      .execute();
  }

  async createInvite(input: unknown, inviter: AuthenticatedAccount) {
    const { label, role } = validate(
      z.object({
        label: usernameSchema,
        role: z.enum(['owner', 'admin', 'member']),
      }),
      input,
    );
    if (inviter.role === 'member' || (inviter.role === 'admin' && role !== 'member')) {
      throw new ForbiddenException('Cannot invite this role');
    }
    const raw = randomToken();
    const created = await this.db.query
      .insertInto('invites')
      .values({
        label,
        role,
        token_hash: digest(raw),
        expires_at: Date.now() + INVITATION_TTL,
        used_at: null,
        created_by: inviter.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const url = new URL(
      '/invite/' + encodeURIComponent(raw),
      process.env.APP_ORIGIN || 'http://localhost:5173',
    ).toString();
    return { id: created.id, url, label, role };
  }

  async sharedInviteStatus() {
    const shared = await this.db.query
      .selectFrom('shared_invites')
      .select(['active', 'created_at'])
      .where('id', '=', 1)
      .executeTakeFirst();
    return { active: !!shared?.active, createdAt: shared?.created_at ?? null };
  }

  async createSharedInvite(ownerId: number) {
    const raw = randomToken();
    const createdAt = Date.now();
    await this.db.query
      .insertInto('shared_invites')
      .values({ id: 1, token_hash: digest(raw), created_by: ownerId, active: 1, created_at: createdAt })
      .onConflict((conflict) =>
        conflict.column('id').doUpdateSet({
          token_hash: digest(raw),
          created_by: ownerId,
          active: 1,
          created_at: createdAt,
        }),
      )
      .execute();
    const url = new URL(
      '/invite/' + encodeURIComponent(raw),
      process.env.APP_ORIGIN || 'http://localhost:5173',
    ).toString();
    return { url, active: true, createdAt };
  }

  async revokeSharedInvite() {
    await this.db.query.updateTable('shared_invites').set({ active: 0 }).where('id', '=', 1).execute();
    return { active: false };
  }

  private async resolveInvite(raw: string) {
    const individual = await this.db.query
      .selectFrom('invites')
      .selectAll()
      .where('token_hash', '=', digest(raw))
      .executeTakeFirst();
    if (individual) {
      if (individual.used_at || individual.expires_at <= Date.now())
        throw new BadRequestException('Invitation expired or revoked');
      return { individual, label: individual.label, role: individual.role, shared: false };
    }
    const shared = await this.db.query
      .selectFrom('shared_invites')
      .select(['active'])
      .where('token_hash', '=', digest(raw))
      .executeTakeFirst();
    if (!shared?.active) throw new BadRequestException('Invitation expired or revoked');
    return { individual: null, label: '', role: 'member' as const, shared: true };
  }

  private async renamePlayer(
    trx: Transaction<Tables>,
    accountId: number,
    username: string,
    oldUsername: string,
  ) {
    const normalized = normalizeName(username);
    const duplicate = await trx
      .selectFrom('accounts')
      .select('id')
      .where('username', '=', normalized)
      .where('id', '!=', accountId)
      .executeTakeFirst();
    if (duplicate) throw new BadRequestException('Username already exists');
    const player = await trx
      .selectFrom('players')
      .selectAll()
      .where('account_id', '=', accountId)
      .executeTakeFirst();
    const legacyPlayer =
      player ||
      (await trx
        .selectFrom('players')
        .selectAll()
        .where('normalized_name', '=', normalizeName(oldUsername))
        .where('account_id', 'is', null)
        .executeTakeFirst());
    const collision = await trx
      .selectFrom('players')
      .select('id')
      .where('normalized_name', '=', normalized)
      .executeTakeFirst();
    if (collision && collision.id !== legacyPlayer?.id)
      throw new BadRequestException('Player name already exists');
    if (!legacyPlayer) return;
    if (legacyPlayer.name === username.trim() && legacyPlayer.account_id === accountId) return;
    const alias = await trx
      .selectFrom('player_aliases')
      .select('player_id')
      .where('normalized_name', '=', normalized)
      .executeTakeFirst();
    if (alias && alias.player_id !== legacyPlayer.id) {
      throw new BadRequestException('Player name belongs to another player. Merge duplicates first.');
    }
    if (legacyPlayer.normalized_name !== normalized) {
      await trx
        .insertInto('player_aliases')
        .values({ normalized_name: legacyPlayer.normalized_name, player_id: legacyPlayer.id })
        .onConflict((oc) => oc.column('normalized_name').doUpdateSet({ player_id: legacyPlayer.id }))
        .execute();
      await trx
        .deleteFrom('player_aliases')
        .where('normalized_name', '=', normalized)
        .where('player_id', '=', legacyPlayer.id)
        .execute();
    }
    await trx
      .updateTable('players')
      .set({ name: username.trim(), normalized_name: normalized, account_id: accountId })
      .where('id', '=', legacyPlayer.id)
      .execute();
    const days = await trx.selectFrom('war_days').select(['war_id', 'day_number', 'mvp']).execute();
    for (const day of days) {
      if (normalizeName(day.mvp) !== normalizeName(legacyPlayer.name)) continue;
      await trx
        .updateTable('war_days')
        .set({ mvp: username.trim() })
        .where('war_id', '=', day.war_id)
        .where('day_number', '=', day.day_number)
        .execute();
    }
  }

  async updateProfile(accountId: number, input: unknown): Promise<AuthenticatedAccount> {
    const data = validate(
      z.object({
        username: usernameSchema,
        currentPassword: z.string().min(1).optional(),
        newPassword: passwordSchema.optional(),
      }),
      input,
    );
    const normalized = normalizeName(data.username);
    try {
      await this.db.query.transaction().execute(async (trx) => {
        const account = await trx
          .selectFrom('accounts')
          .selectAll()
          .where('id', '=', accountId)
          .executeTakeFirstOrThrow();
        if (
          data.newPassword &&
          (!data.currentPassword || !verifyPassword(data.currentPassword, account.password_hash))
        ) {
          throw new UnauthorizedException('Invalid username or password');
        }
        await this.renamePlayer(trx, accountId, data.username, account.username);
        await trx
          .updateTable('accounts')
          .set({
            username: normalized,
            display_name: data.username.trim(),
            ...(data.newPassword ? { password_hash: hashPassword(data.newPassword) } : {}),
          })
          .where('id', '=', accountId)
          .execute();
      });
    } catch (error) {
      if ((error as Error).message.includes('UNIQUE'))
        throw new BadRequestException('Username already exists');
      throw error;
    }
    const updated = await this.db.query
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', accountId)
      .executeTakeFirstOrThrow();
    const player = await this.db.query
      .selectFrom('players')
      .select('id')
      .where('account_id', '=', accountId)
      .executeTakeFirst();
    return {
      id: updated.id,
      username: updated.username,
      displayName: updated.display_name,
      role: updated.role,
      locale: updated.locale,
      playerId: player?.id ?? null,
    };
  }

  async inviteInfo(raw: string) {
    const invitation = await this.resolveInvite(raw);
    return { label: invitation.label, role: invitation.role, shared: invitation.shared };
  }

  async registerInvite(raw: string, input: unknown, reply: FastifyReply) {
    const { username, password, locale } = validate(
      z.object({
        username: usernameSchema,
        password: passwordSchema,
        locale: localeSchema.default('uk'),
      }),
      input,
    );
    const invitation = await this.resolveInvite(raw);
    const normalized = normalizeName(username);
    let accountId: number;
    try {
      accountId = await this.db.query.transaction().execute(async (transaction) => {
        if (invitation.individual) {
          const claimed = await transaction
            .updateTable('invites')
            .set({ used_at: Date.now() })
            .where('id', '=', invitation.individual.id)
            .where('used_at', 'is', null)
            .where('expires_at', '>', Date.now())
            .returning('id')
            .executeTakeFirst();
          if (!claimed) throw new BadRequestException('Invitation already used');
        } else {
          const active = await transaction
            .selectFrom('shared_invites')
            .select('active')
            .where('token_hash', '=', digest(raw))
            .executeTakeFirst();
          if (!active?.active) throw new BadRequestException('Invitation expired or revoked');
        }
        const created = await transaction
          .insertInto('accounts')
          .values({
            username: normalized,
            display_name: username.trim(),
            role: invitation.role,
            password_hash: hashPassword(password),
            locale,
            active: 1,
            created_at: Date.now(),
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const historic = await transaction
          .selectFrom('players')
          .select(['id', 'account_id'])
          .where('normalized_name', '=', normalized)
          .executeTakeFirst();
        if (historic && !historic.account_id) {
          await transaction
            .updateTable('players')
            .set({ account_id: created.id })
            .where('id', '=', historic.id)
            .execute();
        }
        return created.id;
      });
    } catch (error) {
      if ((error as Error).message.includes('UNIQUE'))
        throw new BadRequestException('Username already exists');
      throw error;
    }
    return this.createSession(accountId, reply);
  }

  private async editableAccount(id: number, actor: AuthenticatedAccount) {
    if (id === actor.id) throw new ForbiddenException('Cannot edit your own access');
    const target = await this.db.query
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!target) throw new BadRequestException('Account not found');
    if (actor.role !== 'owner' && (actor.role !== 'admin' || target.role !== 'member')) {
      throw new ForbiddenException('Cannot manage this account');
    }
    return target;
  }

  async updateAccount(id: number, actor: AuthenticatedAccount, input: unknown) {
    const data = validate(
      z.object({
        username: usernameSchema,
        role: z.enum(['owner', 'admin', 'member']),
      }),
      input,
    );
    const target = await this.editableAccount(id, actor);
    if (actor.role === 'admin' && data.role !== 'member') {
      throw new ForbiddenException('Cannot assign this role');
    }
    if (target.role === 'owner' && data.role !== 'owner') {
      const others = await this.db.query
        .selectFrom('accounts')
        .select('id')
        .where('role', '=', 'owner')
        .where('active', '=', 1)
        .execute();
      if (others.length <= 1) throw new ForbiddenException('Cannot change last owner');
    }
    try {
      await this.db.query.transaction().execute(async (trx) => {
        await this.renamePlayer(trx, id, data.username, target.username);
        await trx
          .updateTable('accounts')
          .set({
            username: normalizeName(data.username),
            display_name: data.username.trim(),
            role: data.role,
          })
          .where('id', '=', id)
          .execute();
      });
    } catch (error) {
      if ((error as Error).message.includes('UNIQUE')) {
        throw new BadRequestException('Username already exists');
      }
      throw error;
    }
    return { ok: true };
  }

  async deleteAccount(id: number, actor: AuthenticatedAccount) {
    const target = await this.editableAccount(id, actor);
    if (target.role === 'owner') {
      const owners = await this.db.query
        .selectFrom('accounts')
        .select('id')
        .where('role', '=', 'owner')
        .where('active', '=', 1)
        .execute();
      if (owners.length <= 1) throw new ForbiddenException('Cannot delete last owner');
    }
    await this.db.query.transaction().execute(async (trx) => {
      // Historical player identities and scores are separate from website accounts.
      // Remove staff-only annotations and contact handles tied to this account.
      const associated = await trx
        .selectFrom('players')
        .select('id')
        .where('account_id', '=', id)
        .execute();
      for (const player of associated) {
        await trx.deleteFrom('player_notes').where('player_id', '=', player.id).execute();
        await trx.deleteFrom('player_labels').where('player_id', '=', player.id).execute();
      }
      await trx.deleteFrom('player_notes').where('author_id', '=', id).execute();
      await trx.updateTable('players').set({ account_id: null }).where('account_id', '=', id).execute();
      await trx
        .updateTable('sessions')
        .set({ impersonated_account_id: null, impersonation_expires_at: null })
        .where('impersonated_account_id', '=', id)
        .execute();
      await trx.deleteFrom('sessions').where('account_id', '=', id).execute();
      await trx.deleteFrom('invites').where('created_by', '=', id).execute();
      await trx.deleteFrom('shared_invites').where('created_by', '=', id).execute();
      await trx.deleteFrom('accounts').where('id', '=', id).execute();
    });
    return { ok: true };
  }

  async deleteOwnAccount(
    actor: AuthenticatedAccount,
    input: unknown,
    raw: string | undefined,
  ): Promise<{ ok: true }> {
    if (actor.impersonating) throw new ForbiddenException('Return to your own account first');
    if (!raw) throw new UnauthorizedException();
    const { password, confirmation } = validate(
      z
        .object({
          password: z.string().min(1),
          confirmation: z.literal('DELETE'),
        })
        .strict(),
      input,
    );
    const current = await this.db.query
      .selectFrom('accounts')
      .select(['id', 'password_hash', 'role', 'active'])
      .where('id', '=', actor.id)
      .executeTakeFirst();
    if (!current || !current.active || !verifyPassword(password, current.password_hash))
      throw new UnauthorizedException('Invalid password');

    if (current.role === 'owner') {
      const otherOwners = await this.db.query
        .selectFrom('accounts')
        .select('id')
        .where('role', '=', 'owner')
        .where('active', '=', 1)
        .where('id', '!=', actor.id)
        .execute();
      if (!otherOwners.length) {
        throw new ForbiddenException(
          'Transfer ownership or create another owner before deleting this account',
        );
      }
    }
    // Never remove imported wars, player identities, or player_scores.
    await this.db.query.transaction().execute(async (trx) => {
      const linked = await trx
        .selectFrom('players')
        .select('id')
        .where('account_id', '=', actor.id)
        .execute();
      for (const player of linked) {
        await trx.deleteFrom('player_notes').where('player_id', '=', player.id).execute();
        await trx.deleteFrom('player_labels').where('player_id', '=', player.id).execute();
      }
      await trx.deleteFrom('player_notes').where('author_id', '=', actor.id).execute();
      await trx
        .updateTable('players')
        .set({ account_id: null })
        .where('account_id', '=', actor.id)
        .execute();
      await trx
        .updateTable('sessions')
        .set({ impersonated_account_id: null, impersonation_expires_at: null })
        .where('impersonated_account_id', '=', actor.id)
        .execute();
      await trx.deleteFrom('sessions').where('account_id', '=', actor.id).execute();
      await trx.deleteFrom('invites').where('created_by', '=', actor.id).execute();
      await trx.deleteFrom('shared_invites').where('created_by', '=', actor.id).execute();
      await trx.deleteFrom('accounts').where('id', '=', actor.id).execute();
    });
    return { ok: true };
  }

  async revokeInvite(id: number, requester: AuthenticatedAccount) {
    const invite = await this.db.query
      .selectFrom('invites')
      .select(['role', 'created_by'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (
      requester.role !== 'owner' &&
      (!invite || invite.role !== 'member' || invite.created_by !== requester.id)
    ) {
      throw new ForbiddenException('Cannot revoke this invitation');
    }
    await this.db.query
      .deleteFrom('invites')
      .where('id', '=', id)
      .where('used_at', 'is', null)
      .execute();
    return { ok: true };
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly accounts: AccountsService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    request.account =
      (await this.accounts.resolveSession(
        (request as FastifyRequest & { cookies?: Record<string, string> }).cookies?.clan_session,
        reply,
      )) ?? undefined;
    if (!request.account) throw new UnauthorizedException();
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const role = context.switchToHttp().getRequest<AuthenticatedRequest>().account?.role;
    if (role !== 'owner' && role !== 'admin') throw new ForbiddenException();
    return true;
  }
}

@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.switchToHttp().getRequest<AuthenticatedRequest>().account?.role !== 'owner') {
      throw new ForbiddenException();
    }
    return true;
  }
}

