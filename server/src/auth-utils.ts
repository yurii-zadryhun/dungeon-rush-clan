import { BadRequestException } from '@nestjs/common';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';

export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const SESSION_RENEWAL_INTERVAL = 24 * 60 * 60 * 1000;
export const IMPERSONATION_TTL = 30 * 60 * 1000;
export const INVITATION_TTL = SESSION_TTL;
export const usernameSchema = z.string().trim().min(2).max(50);
export const passwordSchema = z.string().min(12).max(200);
export const localeSchema = z.enum(['uk', 'en']);

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(result.error.issues.map((issue) => issue.message).join('; '));
  return result.data;
}

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function verifyPassword(password: string, saved: string): boolean {
  const [salt, hex] = saved.split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(hex)) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hex, 'hex'));
}
export function safeTokenEquals(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(digest(left), 'hex'), Buffer.from(digest(right), 'hex'));
}
export function sessionCookie(reply: FastifyReply, value: string): void {
  reply.setCookie('clan_session', value, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL / 1000,
  });
}
export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie('clan_session', {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}
