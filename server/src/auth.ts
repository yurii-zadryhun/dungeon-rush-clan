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
import { Db, type Role } from './database';

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
            username: data.username.toLowerCase(),
            display_name: data.username,
            role: 'owner',
            password_hash: hashPassword(data.password),
            locale: 'uk',
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
    const username = data.username.toLowerCase();
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
    return {
      id: account.id,
      username: account.username,
      displayName: account.display_name,
      role: account.role,
      locale: account.locale,
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
    return {
      id: session.id,
      username: session.username,
      displayName: session.display_name,
      role: session.role,
      locale: session.locale,
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
      .select(['id', 'label', 'role', 'expires_at', 'used_at'])
      .orderBy('id', 'desc')
      .execute();
  }

  async createInvite(input: unknown, ownerId: number) {
    const { label, role } = validate(
      z.object({
        label: usernameSchema,
        role: z.enum(['admin', 'member']),
      }),
      input,
    );
    const raw = randomToken();
    const created = await this.db.query
      .insertInto('invites')
      .values({
        label,
        role,
        token_hash: digest(raw),
        expires_at: Date.now() + INVITATION_TTL,
        used_at: null,
        created_by: ownerId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const url = new URL(
      '/?invite=' + encodeURIComponent(raw),
      process.env.APP_ORIGIN || 'http://localhost:5173',
    ).toString();
    return { id: created.id, url, label, role };
  }

  private async validInvite(raw: string) {
    const invite = await this.db.query
      .selectFrom('invites')
      .selectAll()
      .where('token_hash', '=', digest(raw))
      .executeTakeFirst();
    if (!invite || invite.used_at || invite.expires_at <= Date.now()) {
      throw new BadRequestException('Invitation expired or revoked');
    }
    return invite;
  }

  async inviteInfo(raw: string) {
    const invite = await this.validInvite(raw);
    return { label: invite.label, role: invite.role };
  }

  async registerInvite(raw: string, input: unknown, reply: FastifyReply) {
    const { username, password } = validate(
      z.object({
        username: usernameSchema,
        password: passwordSchema,
      }),
      input,
    );
    const invite = await this.validInvite(raw);
    let accountId: number;
    try {
      accountId = await this.db.query.transaction().execute(async (transaction) => {
        const claimed = await transaction
          .updateTable('invites')
          .set({ used_at: Date.now() })
          .where('id', '=', invite.id)
          .where('used_at', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (!claimed) throw new BadRequestException('Invitation already used');
        const created = await transaction
          .insertInto('accounts')
          .values({
            username: username.toLowerCase(),
            display_name: invite.label,
            role: invite.role,
            password_hash: hashPassword(password),
            locale: 'uk',
            active: 1,
            created_at: Date.now(),
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        return created.id;
      });
    } catch (error) {
      if ((error as Error).message.includes('UNIQUE')) {
        throw new BadRequestException('Username already exists');
      }
      throw error;
    }
    return this.createSession(accountId, reply);
  }

  async revokeAccount(id: number, currentId: number) {
    if (id === currentId) throw new ForbiddenException('Cannot revoke yourself');
    const account = await this.db.query
      .selectFrom('accounts')
      .select('role')
      .where('id', '=', id)
      .executeTakeFirst();
    if (account?.role === 'owner') throw new ForbiddenException('Cannot revoke owner');
    await this.db.query.transaction().execute(async (transaction) => {
      await transaction.updateTable('accounts').set({ active: 0 }).where('id', '=', id).execute();
      await transaction.deleteFrom('sessions').where('account_id', '=', id).execute();
    });
    return { ok: true };
  }

  async revokeInvite(id: number) {
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

  @UseGuards(SessionGuard, OwnerGuard)
  @Get('accounts')
  accounts() {
    return this.auth.listAccounts();
  }

  @UseGuards(SessionGuard, OwnerGuard)
  @Get('invites')
  invites() {
    return this.auth.listInvites();
  }

  @UseGuards(SessionGuard, OwnerGuard)
  @Post('invites')
  createInvite(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.auth.createInvite(body, request.account!.id);
  }

  @UseGuards(SessionGuard, OwnerGuard)
  @Delete('accounts/:id')
  revokeAccount(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.auth.revokeAccount(Number(id), request.account!.id);
  }

  @UseGuards(SessionGuard, OwnerGuard)
  @Delete('invites/:id')
  revokeInvite(@Param('id') id: string) {
    return this.auth.revokeInvite(Number(id));
  }
}
