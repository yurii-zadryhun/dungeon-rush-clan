import { BadRequestException, Body, CanActivate, Controller, Delete, ExecutionContext, ForbiddenException, Get, Injectable, Param, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Db, Role } from './database';
import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const WEEK = 7 * 86400000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const nameSchema = z.string().trim().min(2).max(50);
const passwordSchema = z.string().min(12).max(200);
const otpSchema = z.string().regex(/^\d{6}$/);
type SafeAccount = { id: number; username: string; displayName: string; role: Role };
type RequestWithAccount = FastifyRequest & { account?: SafeAccount };
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues.map(x=>x.message).join('; '));
  return result.data;
}
function encryptionKey(): Buffer {
  const text = process.env.AUTH_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(text)) throw new Error('AUTH_ENCRYPTION_KEY must be 32 random bytes in hex');
  return Buffer.from(text,'hex');
}
function protect(raw: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const output = Buffer.concat([cipher.update(raw,'utf8'),cipher.final()]);
  return [iv.toString('hex'),cipher.getAuthTag().toString('hex'),output.toString('hex')].join('.');
}
function reveal(encrypted: string): string {
  const [iv,tag,cipherText] = encrypted.split('.');
  const decipher = createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'hex'));
  decipher.setAuthTag(Buffer.from(tag,'hex'));
  return Buffer.concat([decipher.update(Buffer.from(cipherText,'hex')),decipher.final()]).toString('utf8');
}
function passwordHash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password,salt,64).toString('hex');
}
function passwordMatches(password: string, stored: string): boolean {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex || hex.length !== 128) return false;
  return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hex,'hex'));
}
function secret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const source = randomBytes(20);
  let bits = 0; let value = 0; let output = '';
  for (const byte of source) {
    value = value * 256 + byte; bits += 8;
    while(bits>=5) { bits-=5; output+=alphabet[(value>>>bits)&31]; value &= (1<<bits)-1; }
  }
  if (bits) output+=alphabet[(value<<(5-bits))&31];
  return output;
}
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let buffer=0, bits=0; const bytes:number[]=[];
  for (const c of input.toUpperCase().replace(/=+$/,'')) {
    const digit=alphabet.indexOf(c); if(digit<0) throw new Error('Invalid TOTP secret');
    buffer=(buffer<<5)|digit; bits+=5;
    if(bits>=8){bits-=8;bytes.push((buffer>>bits)&255);}
  }
  return Buffer.from(bytes);
}
export function totp(secretValue: string, step = Math.floor(Date.now()/30000)): string {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1',base32Decode(secretValue)).update(counter).digest();
  const offset = digest[digest.length-1]&15;
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
function verifyTotp(secretValue: string, code: string, lastStep=-1): number | null {
  const current = Math.floor(Date.now()/30000);
  for (const step of [current-1,current,current+1]) {
    if(step>lastStep && totp(secretValue,step)===code) return step;
  }
  return null;
}
function qrUri(username: string, secretValue: string): string {
  return 'otpauth://totp/' + encodeURIComponent('Dungeon Rush Clan:'+username) + '?secret='+secretValue+'&issuer='+encodeURIComponent('Dungeon Rush Clan')+'&algorithm=SHA1&digits=6&period=30';
}
function sendSession(reply: FastifyReply, raw: string) {
  reply.setCookie('clan_session',raw,{path:'/',httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:7*24*3600});
}
export function clearSession(reply: FastifyReply) {
  reply.clearCookie('clan_session',{path:'/',httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production'});
}
@Injectable()
export class AccountsService {
  private attempts = new Map<string,{count:number;until:number}>();
  constructor(private readonly db: Db) { encryptionKey(); }
  private throttle(key: string) {
    const now=Date.now(); const a=this.attempts.get(key);
    if(a && a.until>now && a.count>=10) throw new UnauthorizedException('Too many attempts; try again later');
    if(!a || a.until<=now) this.attempts.set(key,{count:1,until:now+10*60_000});
    else a.count++;
    if(this.attempts.size>2000) this.attempts.clear();
  }
  async initialized() {
    const owner=await this.db.query.selectFrom('accounts').select('id').where('role','=','owner').executeTakeFirst();
    return Boolean(owner);
  }
  async bootstrapStart(input: unknown) {
    const {bootstrapToken}=parse(z.object({bootstrapToken:z.string()}),input);
    if(!process.env.BOOTSTRAP_TOKEN || hash(bootstrapToken)!==hash(process.env.BOOTSTRAP_TOKEN)) throw new ForbiddenException('Invalid bootstrap token');
    if(await this.initialized()) throw new ForbiddenException('Owner already exists');
    const key=secret();
    await this.db.query.insertInto('bootstrap').values({id:1,secret:protect(key),expires_at:Date.now()+15*60_000})
      .onConflict(o=>o.column('id').doUpdateSet({secret:protect(key),expires_at:Date.now()+15*60_000})).execute();
    const uri=qrUri('owner',key);
    return {uri,qr:await QRCode.toDataURL(uri)};
  }
  async bootstrapFinish(input:unknown, reply:FastifyReply) {
    const data=parse(z.object({bootstrapToken:z.string(),username:nameSchema,password:passwordSchema,code:otpSchema}),input);
    if(!process.env.BOOTSTRAP_TOKEN || hash(data.bootstrapToken)!==hash(process.env.BOOTSTRAP_TOKEN)) throw new ForbiddenException('Invalid bootstrap token');
    if(await this.initialized()) throw new ForbiddenException('Owner already exists');
    const row=await this.db.query.selectFrom('bootstrap').selectAll().where('id','=',1).executeTakeFirst();
    if(!row || row.expires_at<Date.now()) throw new BadRequestException('Enrollment expired');
    const key=reveal(row.secret), step=verifyTotp(key,data.code);
    if(step===null) throw new BadRequestException('Invalid authenticator code');
    const account=await this.db.query.transaction().execute(async trx=>{
      const id=await trx.insertInto('accounts').values({username:data.username.toLowerCase(),display_name:data.username,
        role:'owner',password_hash:passwordHash(data.password),totp_secret:protect(key),
        last_totp_step:step,active:1,created_at:Date.now()}).returning('id').executeTakeFirstOrThrow();
      await trx.deleteFrom('bootstrap').where('id','=',1).execute();
      return id.id;
    });
    return this.createSession(account,reply);
  }
  async login(input:unknown, ip:string, reply:FastifyReply) {
    const data=parse(z.object({username:nameSchema,password:z.string(),code:otpSchema}),input);
    this.throttle(ip+':'+data.username.toLowerCase());
    const row=await this.db.query.selectFrom('accounts').selectAll().where('username','=',data.username.toLowerCase()).executeTakeFirst();
    // Avoid revealing whether an account exists.
    if(!row || !row.active || !passwordMatches(data.password,row.password_hash)) throw new UnauthorizedException('Invalid credentials');
    const step=verifyTotp(reveal(row.totp_secret),data.code,row.last_totp_step);
    if(step===null) throw new UnauthorizedException('Invalid credentials or already used code');
    const used=await this.db.query.updateTable('accounts').set({last_totp_step:step})
      .where('id','=',row.id).where('last_totp_step','<',step).executeTakeFirst();
    if(!Number(used.numUpdatedRows)) throw new UnauthorizedException('Code already used');
    this.attempts.delete(ip+':'+data.username.toLowerCase());
    return this.createSession(row.id,reply);
  }
  async createSession(accountId:number,reply:FastifyReply) {
    const value=token(),now=Date.now();
    await this.db.query.insertInto('sessions').values({token_hash:hash(value),account_id:accountId,expires_at:now+WEEK,extended_at:now}).execute();
    sendSession(reply,value);
    const account=await this.db.query.selectFrom('accounts').select(['id','username','display_name','role']).where('id','=',accountId).executeTakeFirstOrThrow();
    return {id:account.id,username:account.username,displayName:account.display_name,role:account.role};
  }
  async resolveSession(raw?:string):Promise<SafeAccount|null> {
    if(!raw) return null;
    const session=await this.db.query.selectFrom('sessions').innerJoin('accounts','accounts.id','sessions.account_id')
      .select(['sessions.expires_at','sessions.extended_at','accounts.id','accounts.username','accounts.display_name','accounts.role','accounts.active'])
      .where('sessions.token_hash','=',hash(raw)).executeTakeFirst();
    if(!session || session.expires_at<=Date.now() || !session.active) return null;
    if(Date.now()-session.extended_at>=24*3600_000) {
      await this.db.query.updateTable('sessions').set({expires_at:Date.now()+WEEK,extended_at:Date.now()})
        .where('token_hash','=',hash(raw)).execute();
    }
    return {id:session.id,username:session.username,displayName:session.display_name,role:session.role};
  }
  async logout(raw?:string) {
    if(raw) await this.db.query.deleteFrom('sessions').where('token_hash','=',hash(raw)).execute();
  }
  async accounts() {
    return this.db.query.selectFrom('accounts').select(['id','username','display_name','role','active','created_at']).orderBy('id').execute();
  }
  async invites() {
    return this.db.query.selectFrom('invites').select(['id','label','role','expires_at','used_at']).orderBy('id','desc').execute();
  }
  async createInvite(input:unknown,ownerId:number) {
    const data=parse(z.object({label:nameSchema,role:z.enum(['admin','member'])}),input);
    const raw=token();
    const inserted=await this.db.query.insertInto('invites').values({label:data.label,role:data.role,token_hash:hash(raw),
      setup_secret:null,expires_at:Date.now()+WEEK,used_at:null,created_by:ownerId}).returning('id').executeTakeFirstOrThrow();
    const url=new URL('/?invite='+encodeURIComponent(raw),process.env.APP_ORIGIN||'http://localhost:5173').toString();
    return {id:inserted.id,url,qr:await QRCode.toDataURL(url),label:data.label,role:data.role};
  }
  async inviteRow(raw:string) {
    const row=await this.db.query.selectFrom('invites').selectAll().where('token_hash','=',hash(raw)).executeTakeFirst();
    if(!row || row.used_at || row.expires_at<Date.now()) throw new BadRequestException('Invalid or expired invite');
    return row;
  }
  async inviteInfo(raw:string) {
    const row=await this.inviteRow(raw);
    return {label:row.label,role:row.role};
  }
  async inviteStart(raw:string) {
    const row=await this.inviteRow(raw);
    const key=secret();
    await this.db.query.updateTable('invites').set({setup_secret:protect(key)}).where('id','=',row.id).execute();
    const uri=qrUri(row.label,key);
    return {uri,qr:await QRCode.toDataURL(uri)};
  }
  async inviteFinish(raw:string,input:unknown,reply:FastifyReply) {
    const data=parse(z.object({username:nameSchema,password:passwordSchema,code:otpSchema}),input);
    const row=await this.inviteRow(raw);
    if(!row.setup_secret) throw new BadRequestException('Start enrollment first');
    const key=reveal(row.setup_secret),step=verifyTotp(key,data.code);
    if(step===null) throw new BadRequestException('Invalid authenticator code');
    let id:number;
    try {
      id=await this.db.query.transaction().execute(async trx=>{
        const claimed=await trx.updateTable('invites').set({used_at:Date.now(),setup_secret:null})
          .where('id','=',row.id).where('used_at','is',null).returning('id').executeTakeFirst();
        if(!claimed) throw new BadRequestException('Invite already redeemed');
        const account=await trx.insertInto('accounts').values({username:data.username.toLowerCase(),display_name:row.label,
          role:row.role,password_hash:passwordHash(data.password),totp_secret:protect(key),last_totp_step:step,
          active:1,created_at:Date.now()}).returning('id').executeTakeFirstOrThrow();
        return account.id;
      });
    } catch(e) { if((e as Error).message.includes('UNIQUE')) throw new BadRequestException('Username is already taken'); throw e; }
    return this.createSession(id,reply);
  }
  async revokeAccount(id:number,currentId:number) {
    if(id===currentId) throw new ForbiddenException('Cannot revoke yourself');
    const row=await this.db.query.selectFrom('accounts').select(['role']).where('id','=',id).executeTakeFirst();
    if(row?.role==='owner') throw new ForbiddenException('Owner cannot be revoked');
    await this.db.query.transaction().execute(async trx=>{
      await trx.updateTable('accounts').set({active:0}).where('id','=',id).execute();
      await trx.deleteFrom('sessions').where('account_id','=',id).execute();
    });
    return {ok:true};
  }
  async revokeInvite(id:number) {
    await this.db.query.deleteFrom('invites').where('id','=',id).where('used_at','is',null).execute();
    return {ok:true};
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly accounts:AccountsService) {}
  async canActivate(context:ExecutionContext) {
    const req=context.switchToHttp().getRequest<RequestWithAccount>();
    const value=(req as any).cookies?.clan_session as string|undefined;
    req.account=await this.accounts.resolveSession(value) || undefined;
    if(!req.account) throw new UnauthorizedException();
    return true;
  }
}
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context:ExecutionContext) {
    const user=context.switchToHttp().getRequest<RequestWithAccount>().account;
    if(user?.role!=='admin' && user?.role!=='owner') throw new ForbiddenException();
    return true;
  }
}
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context:ExecutionContext) {
    if(context.switchToHttp().getRequest<RequestWithAccount>().account?.role!=='owner') throw new ForbiddenException();
    return true;
  }
}
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth:AccountsService) {}
  @Get('setup-state') async setupState() { return {initialized:await this.auth.initialized()}; }
  @Post('bootstrap/start') start(@Body() b:unknown) { return this.auth.bootstrapStart(b); }
  @Post('bootstrap/finish') finish(@Body() b:unknown,@Res({passthrough:true}) reply:FastifyReply) { return this.auth.bootstrapFinish(b,reply); }
  @Post('login') login(@Body() b:unknown,@Req() req:FastifyRequest,@Res({passthrough:true}) reply:FastifyReply) {
    return this.auth.login(b,req.ip,reply);
  }
  @UseGuards(SessionGuard) @Get('me') me(@Req() req:RequestWithAccount) { return req.account; }
  @UseGuards(SessionGuard) @Post('logout') async logout(@Req() req:FastifyRequest,@Res({passthrough:true}) reply:FastifyReply) {
    await this.auth.logout((req as any).cookies?.clan_session); clearSession(reply); return {ok:true};
  }
  @Get('invite/:token') invite(@Param('token') t:string) { return this.auth.inviteInfo(t); }
  @Post('invite/:token/start') inviteStart(@Param('token') t:string) { return this.auth.inviteStart(t); }
  @Post('invite/:token/finish') inviteFinish(@Param('token') t:string,@Body() b:unknown,@Res({passthrough:true}) r:FastifyReply) { return this.auth.inviteFinish(t,b,r); }
  @UseGuards(SessionGuard,OwnerGuard) @Get('accounts') listAccounts() { return this.auth.accounts(); }
  @UseGuards(SessionGuard,OwnerGuard) @Delete('accounts/:id') revokeAccount(@Param('id') id:string,@Req() req:RequestWithAccount) { return this.auth.revokeAccount(Number(id),req.account!.id); }
  @UseGuards(SessionGuard,OwnerGuard) @Get('invites') listInvites() { return this.auth.invites(); }
  @UseGuards(SessionGuard,OwnerGuard) @Post('invites') addInvite(@Body() b:unknown,@Req() req:RequestWithAccount) { return this.auth.createInvite(b,req.account!.id); }
  @UseGuards(SessionGuard,OwnerGuard) @Delete('invites/:id') removeInvite(@Param('id') id:string) { return this.auth.revokeInvite(Number(id)); }
}
