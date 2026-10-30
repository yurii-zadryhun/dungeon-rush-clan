import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AccountsService,
  AdminGuard,
  OwnerGuard,
  SessionGuard,
  type AuthenticatedRequest,
} from './auth';
import { clearSessionCookie } from './auth-utils';
import { AuditService } from './audit';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AccountsService,
    private readonly audit: AuditService,
  ) {}

  @Get('setup-state')
  async setupState() {
    return { initialized: await this.auth.initialized() };
  }
  // One non-error request handles session restoration and first-time setup.
  // It never exposes another account: the account belongs to this session cookie.
  @Get('session-state')
  async sessionState(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    reply.header('Cache-Control', 'no-store');
    const raw = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies?.clan_session;
    const account = await this.auth.resolveSession(raw, reply);
    return { account, initialized: account ? true : await this.auth.initialized() };
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

  @UseGuards(SessionGuard, OwnerGuard)
  @Post('impersonate')
  impersonate(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const raw = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies?.clan_session;
    return this.auth.impersonate(raw, request.account!.id, body, reply);
  }

  // The effective user is not an owner while impersonating; validate the underlying
  // owner session rather than applying an OwnerGuard to the assumed identity.
  @Post('stop-impersonation')
  stopImpersonation(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const raw = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies?.clan_session;
    return this.auth.stopImpersonation(raw, reply);
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
  @Delete('me')
  async deleteMe(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const raw = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies?.clan_session;
    const result = await this.auth.deleteOwnAccount(request.account!, body, raw);
    clearSessionCookie(reply);
    return result;
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
  async createShared(@Req() request: AuthenticatedRequest) {
    const result = await this.auth.createSharedInvite(request.account!.id);
    await this.audit.write({
      actorId: request.account!.id,
      action: 'invite.shared.create',
      entity: 'invite',
    });
    return result;
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Delete('shared-invite')
  async revokeShared(@Req() request: AuthenticatedRequest) {
    const result = await this.auth.revokeSharedInvite();
    await this.audit.write({
      actorId: request.account!.id,
      action: 'invite.shared.revoke',
      entity: 'invite',
    });
    return result;
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
  async createInvite(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const result = await this.auth.createInvite(body, request.account!);
    await this.audit.write({ actorId: request.account!.id, action: 'invite.create', entity: 'invite' });
    return result;
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Patch('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const result = await this.auth.updateAccount(Number(id), request.account!, body);
    await this.audit.write({
      actorId: request.account!.id,
      action: 'account.update',
      entity: 'account',
      entityId: Number(id),
    });
    return result;
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Delete('accounts/:id')
  async deleteAccount(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const result = await this.auth.deleteAccount(Number(id), request.account!);
    await this.audit.write({
      actorId: request.account!.id,
      action: 'account.delete',
      entity: 'account',
      entityId: Number(id),
    });
    return result;
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Delete('invites/:id')
  async revokeInvite(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const result = await this.auth.revokeInvite(Number(id), request.account!);
    await this.audit.write({
      actorId: request.account!.id,
      action: 'invite.revoke',
      entity: 'invite',
      entityId: Number(id),
    });
    return result;
  }
}
