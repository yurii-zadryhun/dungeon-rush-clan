import { Controller, Get, Injectable, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Db } from './database';

export interface PublicClanSnapshot {
  name: string;
  leader: string;
  record: { wins: number; losses: number };
  recentWars: {
    start: string;
    opponent: string | null;
    ourScore: number;
    opponentScore: number;
  }[];
}

// Deliberately independent of authenticated dashboard/ranking services.
// Only these whitelisted fields are ever exposed without a session.
@Injectable()
export class PublicClanService {
  constructor(private readonly db: Db) {}

  async snapshot(): Promise<PublicClanSnapshot> {
    const [settings, owner, results] = await Promise.all([
      this.db.query
        .selectFrom('settings')
        .select(['clan_name', 'leader_name'])
        .where('id', '=', 1)
        .executeTakeFirstOrThrow(),
      this.db.query
        .selectFrom('accounts')
        .select('display_name')
        .where('role', '=', 'owner')
        .where('active', '=', 1)
        .orderBy('created_at', 'asc')
        .orderBy('id', 'asc')
        .executeTakeFirst(),
      this.db.query
        .selectFrom('wars')
        .leftJoin('clans', 'wars.opponent_clan_id', 'clans.id')
        .select([
          'wars.start_date as start',
          'wars.our_score as ourScore',
          'wars.opponent_score as opponentScore',
          'clans.name as opponent',
        ])
        .where('wars.result_imported_at', 'is not', null)
        .orderBy('wars.start_date', 'desc')
        .execute(),
    ]);
    const completed = results.filter(
      (war): war is typeof war & { ourScore: number; opponentScore: number } =>
        war.ourScore !== null && war.opponentScore !== null,
    );
    return {
      name: settings.clan_name,
      leader: settings.leader_name.trim() || owner?.display_name || '—',
      record: {
        wins: completed.filter((war) => war.ourScore > war.opponentScore).length,
        losses: completed.filter((war) => war.ourScore < war.opponentScore).length,
      },
      recentWars: completed.slice(0, 12).map((war) => ({
        start: war.start,
        opponent: war.opponent,
        ourScore: war.ourScore,
        opponentScore: war.opponentScore,
      })),
    };
  }
}

const escapeHtml = (input: string) =>
  input.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });

export function renderClanDocument(template: string, clan: PublicClanSnapshot, origin: string) {
  const pageUrl = origin + '/clan';
  const imageUrl = origin + '/og-clan.jpg';
  const title = clan.name + ' | Dungeon Rush Clan';
  const description =
    'Explore ' +
    clan.name +
    ' in Dungeon Rush: clan leader, victory record and completed clan war results.';
  const markup = `<main style="max-width:860px;margin:40px auto;padding:20px;font-family:system-ui,sans-serif;color:#f9f8fa">
    <img src="/clan-emblem.png" alt="" width="90" height="95">
    <h1>${escapeHtml(clan.name)} — Dungeon Rush</h1>
    <p>Leader: ${escapeHtml(clan.leader)}</p>
    <p>Wins: ${clan.record.wins} · Losses: ${clan.record.losses}</p>
    <h2>Recent clan wars</h2>
    <ol>${clan.recentWars
      .map(
        (war) =>
          `<li>${escapeHtml(war.start)} · ${escapeHtml(war.opponent ?? 'Unknown opponent')} ·
      ${war.ourScore} : ${war.opponentScore} — ${war.ourScore > war.opponentScore ? 'Victory' : 'Defeat'}</li>`,
      )
      .join('')}</ol>
    <p><a href="/?login=1">Sign in to the private clan archive</a></p>
  </main>`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: clan.name,
    url: pageUrl,
    logo: origin + '/clan-emblem.png',
    description,
  }).replace(/</g, '\\u003c');
  const meta = `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Dungeon Rush Clan War Archive" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:locale:alternate" content="uk_UA" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(clan.name + ' clan emblem')}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <script type="application/ld+json">${jsonLd}</script>`;
  return template
    .replace(/<html lang="[^"]*">/, '<html lang="en">')
    .replace(/<title>[^<]*<\/title>/, '<title>' + escapeHtml(title) + '</title>')
    .replace(/<meta name="robots"[^>]*>/, '')
    .replace('</head>', meta + '\n</head>')
    .replace('<div id="root"></div>', '<div id="root">' + markup + '</div>');
}

@Controller()
export class PublicClanController {
  constructor(private readonly clan: PublicClanService) {}

  @Get('api/public/clan')
  async data(@Res() reply: FastifyReply) {
    const data = await this.clan.snapshot();
    return reply.header('Cache-Control', 'public, max-age=60').send(data);
  }

  @Get(['clan', 'clan/'])
  async page(@Res() reply: FastifyReply) {
    const snapshot = await this.clan.snapshot();
    const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    const template = readFileSync(resolve(__dirname, '../../web/dist/index.html'), 'utf8');
    return reply
      .header('Cache-Control', 'public, max-age=60')
      .type('text/html; charset=utf-8')
      .send(renderClanDocument(template, snapshot, origin));
  }

  @Get('robots.txt')
  robots(@Res() reply: FastifyReply) {
    const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    return reply
      .type('text/plain; charset=utf-8')
      .send(`User-agent: *\nDisallow: /api/\nDisallow: /?invite=\nSitemap: ${origin}/sitemap.xml\n`);
  }

  @Get('sitemap.xml')
  sitemap(@Res() reply: FastifyReply) {
    const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    return reply.type('application/xml; charset=utf-8').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${escapeHtml(origin + '/clan')}</loc></url>
</urlset>`);
  }
}
