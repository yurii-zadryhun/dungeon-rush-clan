import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './module';
import { limitFor, RequestLimiter } from './security';

async function bootstrap() {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* environment provided by deployment */
  }
  if (process.env.NODE_ENV === 'production' && !/^https:\/\//.test(process.env.APP_ORIGIN || ''))
    throw new Error('Production APP_ORIGIN must be an HTTPS origin');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Nginx connects over loopback. Trust only that immediate hop, never arbitrary
      // client-supplied X-Forwarded-For addresses or other Internet proxies.
      trustProxy: (address: string, hop: number) =>
        hop === 0 && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address),
      bodyLimit: 1024 * 1024,
    }),
    { logger: ['log', 'warn', 'error'] },
  );
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 6 * 1024 * 1024, files: 11, fields: 2 } });
  const http = app.getHttpAdapter().getInstance();
  const limiter = new RequestLimiter();
  http.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), payment=()');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; " +
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000');
    }

    const pathname = request.url.split('?')[0] || '/';
    if (pathname.startsWith('/api/') && pathname !== '/api/public/clan') {
      reply.header('Cache-Control', 'no-store');
    }
    const rule = limitFor(request.method, pathname);
    if (rule) {
      const retry = limiter.check(request.ip, rule);
      if (retry > 0) {
        return reply.code(429)
          .header('Retry-After', String(retry))
          .header('Cache-Control', 'no-store')
          .send({ message: 'Too many requests. Try again later.' });
      }
    }

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) ||
        !pathname.startsWith('/api/')) return;

    // Browser CSRF defenses: SameSite=Strict session cookie (auth.ts), required
    // non-simple request header, exact Origin, and Fetch Metadata validation.
    // Cross-origin JavaScript cannot send the custom header without CORS.
    const fetchSite = request.headers['sec-fetch-site'];
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return reply.code(403).send({ message: 'Cross-origin request denied' });
    }
    const origin = request.headers.origin;
    const allowed = process.env.APP_ORIGIN;
    if (
      origin &&
      allowed &&
      origin !== allowed &&
      !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin))
    ) {
      return reply.code(403).send({ message: 'Invalid origin' });
    }
    if (request.headers['x-requested-with'] !== 'clan-stats') {
      return reply.code(403).send({ message: 'Invalid request header' });
    }
  });
  const webRoot = resolve(__dirname, '../../web/dist');
  if (existsSync(webRoot)) {
    await app.register(fastifyStatic, { root: webRoot, prefix: '/', wildcard: false });
  }
  await app.listen({
    // Only HestiaCP's local Nginx should reach the application in production.
    host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'),
    port: Number(process.env.PORT || 3000),
  });
}

bootstrap().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
