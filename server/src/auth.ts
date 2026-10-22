import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Db, normalizeName, type Role, type Tables } from './database';
import type { Transaction } from 'kysely';

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const SESSION_RENEWAL_INTERVAL = 24 * 60 * 60 * 1000;
const INVITATION_TTL = SESSION_TTL;
const usernameSchema = z.string().trim().min(2).max(50);
const passwordSchema = z.string().min(12).max(200);
const localeSchema = z.enum(['uk', 'en']);

export interface AuthenticatedAccount {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  locale: 'uk' | 'en';
  playerId: number | null;
}
export type AuthenticatedRequest = FastifyRequest & { account?: AuthenticatedAccount };

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(result.error.issues.map((issue) => issue.message).join('; '));
  return result.data;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function randomToken(): string {
  return randomBytes(32).toString('base64url');
}
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password: string, saved: string): boolean {
  const [salt, hex] = saved.split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(hex)) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hex, 'hex'));
}
function safeTokenEquals(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(digest(left), 'hex'), Buffer.from(digest(right), 'hex'));
}
function sessionCookie(reply: FastifyReply, value: string): void {
  reply.setCookie('clan_session', value, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL / 1000,
  });
}
function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie('clan_session', {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}

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
      '/?invite=' + encodeURIComponent(raw),
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
      '/?invite=' + encodeURIComponent(raw),
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
      // Keep the player and scores intact: the account is not the historical identity.
      await trx.updateTable('players').set({ account_id: null }).where('account_id', '=', id).execute();
      await trx.deleteFrom('sessions').where('account_id', '=', id).execute();
      await trx.deleteFrom('invites').where('created_by', '=', id).execute();
      await trx.deleteFrom('shared_invites').where('created_by', '=', id).execute();
      await trx.deleteFrom('accounts').where('id', '=', id).execute();
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

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AccountsService) {}

  @Get('setup-state')
  async setupState() {
    return { initialized: await this.auth.initialized() };
  }

  @Post('bootstrap')
  bootstrap(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.auth.createOwner(body, reply);
  }

  @Post('login')
  login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.login(body, request.ip, reply);
  }

  @UseGuards(SessionGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return request.account;
  }

  @UseGuards(SessionGuard)
  @Patch('profile')
  profile(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.auth.updateProfile(request.account!.id, body);
  }

  @UseGuards(SessionGuard)
  @Patch('locale')
  locale(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.auth.setLocale(request.account!.id, body);
  }

  @UseGuards(SessionGuard)
  @Post('logout')
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(
      (request as FastifyRequest & { cookies?: Record<string, string> }).cookies?.clan_session,
    );
    clearSessionCookie(reply);
    return { ok: true };
  }

  @Get('invite/:token')
  invite(@Param('token') token: string) {
    return this.auth.inviteInfo(token);
  }

  @Post('invite/:token/register')
  register(
    @Param('token') token: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.registerInvite(token, body, reply);
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Get('shared-invite')
  sharedInvite() {
    return this.auth.sharedInviteStatus();
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Post('shared-invite')
  createShared(@Req() request: AuthenticatedRequest) {
    return this.auth.createSharedInvite(request.account!.id);
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Delete('shared-invite')
  revokeShared() {
    return this.auth.revokeSharedInvite();
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Get('accounts')
  accounts() {
    return this.auth.listAccounts();
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Get('invites')
  invites() {
    return this.auth.listInvites();
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Post('invites')
  createInvite(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.auth.createInvite(body, request.account!);
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.auth.updateAccount(Number(id), request.account!, body);
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.auth.deleteAccount(Number(id), request.account!);
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Delete('invites/:id')
  revokeInvite(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.auth.revokeInvite(Number(id), request.account!);
  }
}
