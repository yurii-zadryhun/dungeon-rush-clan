import { Controller, Get, Injectable, NotFoundException, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Db } from './database';

export interface PublicClanSnapshot {
  name: string;
  leader: string;
  contactUrl: string;
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
        .select(['clan_name', 'leader_name', 'contact_url'])
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
      contactUrl: settings.contact_url,
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

type PublicLocale = 'uk' | 'en';

function detectLocale(header: string): PublicLocale {
  const languages = header.split(',').map((part) => {
    const [code, q] = part.trim().split(';q=');
    return { language: code?.toLowerCase().split('-')[0], quality: q === undefined ? 1 : Number(q) };
  });
  const result = languages
    .filter((item) => item.quality > 0 && Number.isFinite(item.quality))
    .sort((a, b) => b.quality - a.quality)
    .find((item) => item.language === 'uk' || item.language === 'en');
  return result?.language === 'en' ? 'en' : 'uk';
}

function warLabel(start: string, locale: PublicLocale): string {
  const from = new Date(start + 'T00:00:00Z');
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 5);
  return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(from, to);
}

export function renderClanDocument(
  template: string,
  clan: PublicClanSnapshot,
  origin: string,
  locale: PublicLocale = 'en',
  isDefaultPage = false,
) {
  const uk = locale === 'uk';
  const messages = uk
    ? {
        archive: 'Архів війн клану',
        leader: 'Лідер',
        contact: 'Зв’язатися',
        wins: 'Перемоги',
        losses: 'Поразки',
        history: 'Історія війн',
        login: 'Увійти',
        unknown: 'Невідомий суперник',
        victory: 'Перемога',
        defeat: 'Поразка',
        noWars: 'Поки немає завершених війн.',
        language: 'Мова',
        description: 'клан у Dungeon Rush. Історія воєн, суперники та результати останніх битв.',
      }
    : {
        archive: 'Clan war archive',
        leader: 'Leader',
        contact: 'Get in touch',
        wins: 'Wins',
        losses: 'Losses',
        history: 'Clan war history',
        login: 'Sign in',
        unknown: 'Unknown opponent',
        victory: 'Victory',
        defeat: 'Defeat',
        noWars: 'No completed clan wars yet.',
        language: 'Language',
        description: 'a Dungeon Rush clan. Discover our war history, opponents and latest results.',
      };
  const pageUrl = origin + (isDefaultPage ? '/clan' : '/clan/' + locale);
  const imageUrl = origin + '/assets/og-clan.jpg';
  const title = clan.name + ' | Dungeon Rush ' + messages.history;
  const description = clan.name + ' — ' + messages.description;
  const wars = clan.recentWars
    .map((war) => {
      const victory = war.ourScore > war.opponentScore;
      const draw = war.ourScore === war.opponentScore;
      const status = draw ? '' : victory ? 'victory' : 'defeat';
      return `<li class="guest-war ${status}">
      <div class="guest-war-info">
        <time class="guest-war-date" datetime="${escapeHtml(war.start)}">${escapeHtml(warLabel(war.start, locale))}</time>
        <strong>${escapeHtml(clan.name)} <span class="guest-versus">vs</span> ${escapeHtml(war.opponent || messages.unknown)}</strong>
      </div>
      <div class="guest-war-result">
        <b>${war.ourScore} : ${war.opponentScore}</b>
        <small>${draw ? '—' : victory ? messages.victory : messages.defeat}</small>
      </div>
    </li>`;
    })
    .join('\n');

  const markup = `<div class="guest-page">
    <header class="guest-header">
      <a href="/clan" class="guest-brand" aria-label="${escapeHtml(messages.archive)}">
        <img src="/assets/clan-emblem.png" width="32" height="35" alt="">
        <span>${escapeHtml(messages.archive)}</span>
      </a>
      <div class="guest-actions">
        <nav class="guest-languages" aria-label="${escapeHtml(messages.language)}">
          <a href="/clan/uk" lang="uk" hreflang="uk" ${uk ? 'aria-current="page"' : ''}>🇺🇦 UA</a>
          <a href="/clan/en" lang="en" hreflang="en" ${!uk ? 'aria-current="page"' : ''}>🇬🇧 EN</a>
        </nav>
        <a class="guest-signin" href="/?login=1">${escapeHtml(messages.login)} <span aria-hidden="true">↗</span></a>
      </div>
    </header>
    <main class="guest-main">
      <section class="panel guest-hero" aria-labelledby="clan-title">
        <div class="guest-intro">
          <div class="guest-emblem-wrap">
            <img src="/assets/clan-emblem.png" alt="${escapeHtml(clan.name)} clan emblem"
              width="132" height="144" fetchpriority="high">
          </div>
          <div class="guest-hero-text">
            <h1 id="clan-title">${escapeHtml(clan.name)}</h1>
            <p class="guest-game">Dungeon Rush</p>
            <div class="guest-identity-actions">
              <div class="guest-leader">
                <svg class="guest-crown" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" role="img" aria-label="${escapeHtml(messages.leader)}">
                  <path d="M3 7.5 7.5 12 12 5.5 16.5 12 21 7.5 19.3 18.3H4.7L3 7.5Z" fill="currentColor"/>
                  <path d="M5 20.5h14" stroke-linecap="round"/>
                </svg>
                <strong>${escapeHtml(clan.leader)}</strong>
              </div>
              ${
                clan.contactUrl
                  ? `<a class="guest-contact-link" href="${escapeHtml(clan.contactUrl)}"
                rel="noopener noreferrer" target="_blank"><span>${escapeHtml(messages.contact)}</span><span class="guest-contact-arrow" aria-hidden="true">↗</span></a>`
                  : ''
              }
            </div>
          </div>
        </div>
      </section>
      <section class="panel guest-record" aria-label="${escapeHtml(messages.archive)}">
        <div class="guest-record-item"><strong class="friendly">${clan.record.wins}</strong><span>${escapeHtml(messages.wins)}</span></div>
        <span class="guest-record-divider" aria-hidden="true"></span>
        <div class="guest-record-item"><strong class="enemy">${clan.record.losses}</strong><span>${escapeHtml(messages.losses)}</span></div>
      </section>
      <section class="panel guest-history" aria-labelledby="history-title">
        <div class="guest-section-head"><h2 id="history-title">${escapeHtml(messages.history)}</h2></div>
        ${wars ? '<ol class="guest-wars">' + wars + '</ol>' : '<p class="guest-empty">' + escapeHtml(messages.noWars) + '</p>'}
      </section>
    </main>
  </div>`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: clan.name,
    url: pageUrl,
    logo: origin + '/assets/clan-emblem.png',
    description,
    ...(clan.contactUrl
      ? { contactPoint: { '@type': 'ContactPoint', contactType: 'community', url: clan.contactUrl } }
      : {}),
  }).replace(/</g, '\\u003c');
  const meta = `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <link rel="alternate" hreflang="en" href="${origin}/clan/en" />
    <link rel="alternate" hreflang="uk" href="${origin}/clan/uk" />
    <link rel="alternate" hreflang="x-default" href="${origin}/clan" />
    <link rel="stylesheet" href="/assets/clan-public.css" />
    <link rel="preload" href="/assets/clan-emblem.png" as="image" fetchpriority="high" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Dungeon Rush Clan War Archive" />
    <meta property="og:locale" content="${uk ? 'uk_UA' : 'en_US'}" />
    <meta property="og:locale:alternate" content="${uk ? 'en_US' : 'uk_UA'}" />
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
  return (
    template
      .replace(/<html lang="[^"]*">/, '<html lang="' + locale + '">')
      .replace(/<title>[^<]*<\/title>/, '<title>' + escapeHtml(title) + '</title>')
      .replace(/<meta name="robots"[^>]*>/, '')
      .replace(/<meta\s+name="description"[\s\S]*?\/>/g, '')
      // Do not ship the authenticated React app or its CSS to public visitors.
      .replace(/<script[^>]*type="module"[^>]*><\/script>/g, '')
      .replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '')
      .replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '')
      .replace('</head>', meta + '\n</head>')
      .replace('<div id="root"></div>', '<div id="root">' + markup + '</div>')
  );
}

@Controller()
export class PublicClanController {
  constructor(private readonly clan: PublicClanService) {}

  @Get('api/public/clan')
  async data(@Res() reply: FastifyReply) {
    const data = await this.clan.snapshot();
    return reply.header('Cache-Control', 'public, max-age=60').send(data);
  }

  private async html(reply: FastifyReply, locale: PublicLocale, isDefaultPage = false) {
    const snapshot = await this.clan.snapshot();
    const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    const template = readFileSync(resolve(__dirname, '../../web/dist/index.html'), 'utf8');
    return reply
      .header('Cache-Control', 'public, max-age=60')
      .type('text/html; charset=utf-8')
      .send(renderClanDocument(template, snapshot, origin, locale, isDefaultPage));
  }

  @Get('clan')
  async page(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    return this.html(
      reply.header('Vary', 'Accept-Language'),
      detectLocale(String(request.headers['accept-language'] || '')),
      true,
    );
  }

  @Get('clan/:locale')
  async translated(@Param('locale') locale: string, @Res() reply: FastifyReply) {
    if (locale !== 'uk' && locale !== 'en') throw new NotFoundException();
    return this.html(reply, locale);
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
  <url><loc>${escapeHtml(origin + '/clan/en')}</loc></url>
  <url><loc>${escapeHtml(origin + '/clan/uk')}</loc></url>
</urlset>`);
  }
}
