import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './module';

async function bootstrap() {
  try { process.loadEnvFile('.env'); } catch { /* environment provided by deployment */ }
  if(process.env.NODE_ENV==='production' && !/^https:\/\//.test(process.env.APP_ORIGIN||'')) throw new Error('Production APP_ORIGIN must be an HTTPS origin');
  const app=await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter({trustProxy:process.env.TRUST_PROXY==='1',bodyLimit:1024*1024}),{logger:['log','warn','error']});
  await app.register(cookie);
  await app.register(multipart,{limits:{fileSize:6*1024*1024,files:11,fields:2}});
  const http=app.getHttpAdapter().getInstance();
  http.addHook('onRequest',async (request,reply)=>{
    reply.header('X-Content-Type-Options','nosniff');
    reply.header('X-Frame-Options','DENY');
    reply.header('Referrer-Policy','no-referrer');
    if(!['POST','PUT','PATCH','DELETE'].includes(request.method)||!request.url.startsWith('/api/')) return;
    const origin=request.headers.origin;
    const allowed=process.env.APP_ORIGIN;
    if(origin&&allowed&&origin!==allowed&&!(process.env.NODE_ENV!=='production'&&/^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin))) {
      return reply.code(403).send({message:'Invalid origin'});
    }
    if(request.headers['x-requested-with']!=='clan-stats') return reply.code(403).send({message:'Invalid request header'});
  });
  const webRoot=resolve(__dirname,'../../web/dist');
  if(existsSync(webRoot)) {
    await app.register(fastifyStatic,{root:webRoot,prefix:'/',wildcard:false});
    http.setNotFoundHandler((req,reply)=>{
      if(req.url.startsWith('/api/')) return reply.code(404).send({message:'Not found'});
      if(req.method==='GET' || req.method==='HEAD') return reply.sendFile('index.html');
      return reply.code(404).send({message:'Not found'});
    });
  }
  await app.listen({host:'0.0.0.0',port:Number(process.env.PORT||3000)});
}
bootstrap().catch(e=>{console.error(e);process.exitCode=1;});
