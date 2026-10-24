import { Controller, Get, Injectable, NotFoundException, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Db } from './database';
import { legalContent, type LegalPage, type Locale } from './legal-content';

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (char) => entities[char]);
}
function browserLocale(header: string): Locale {
  const choices = header
    .split(',')
    .map((part) => {
      const [language, weight] = part.trim().split(';q=');
      return {
        language: language.toLowerCase().split('-')[0],
        q: weight === undefined ? 1 : Number(weight),
      };
    })
    .filter((choice) => Number.isFinite(choice.q) && choice.q > 0)
    .sort((a, b) => b.q - a.q);
  return choices.find((choice) => choice.language === 'uk' || choice.language === 'en')?.language ===
    'en'
    ? 'en'
    : 'uk';
}

@Injectable()
export class SitePagesService {
  constructor(private readonly db: Db) {}

  async legalPage(page: LegalPage, locale: Locale, defaultPage: boolean): Promise<string> {
    const root = (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    const data = legalContent[locale][page];
    const record = await this.db.query
      .selectFrom('settings')
      .select('contact_url')
      .where('id', '=', 1)
      .executeTakeFirst();
    const labels =
      locale === 'uk'
        ? {
            archive: 'До клану',
            about: 'Про сайт',
            privacy: 'Конфіденційність',
            terms: 'Умови',
            contact: 'Зв’язатися',
            unofficial: 'Неофіційний фанатський сайт · Не пов’язаний із розробниками Dungeon Rush',
          }
        : {
            archive: 'Back to clan',
            about: 'About',
            privacy: 'Privacy',
            terms: 'Terms',
            contact: 'Get in touch',
            unofficial: 'Unofficial fan site · Not affiliated with Dungeon Rush developers',
          };
    const url = root + '/' + page + (defaultPage ? '' : '/' + locale);
    const nav = `<nav aria-label="Site information">
      <a href="/about/${locale}" ${page === 'about' ? 'aria-current="page"' : ''}>${labels.about}</a>
      <a href="/privacy/${locale}" ${page === 'privacy' ? 'aria-current="page"' : ''}>${labels.privacy}</a>
      <a href="/terms/${locale}" ${page === 'terms' ? 'aria-current="page"' : ''}>${labels.terms}</a>
    </nav>`;
    const sections = data.sections
      .map(
        (section) => `<section>
      <h2>${escapeHtml(section.heading)}</h2>
      ${section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
    </section>`,
      )
      .join('\n');
    const contact = record?.contact_url
      ? `<a class="legal-contact" href="${escapeHtml(record.contact_url)}" target="_blank" rel="noopener noreferrer">${labels.contact} ↗</a>`
      : `<a class="legal-contact" href="/public/${locale}">${labels.archive} ↗</a>`;
    return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#111214">
  <title>${escapeHtml(data.title)} | Ukrainians · Dungeon Rush</title>
  <meta name="description" content="${escapeHtml(data.description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="en" href="${root}/${page}/en">
  <link rel="alternate" hreflang="uk" href="${root}/${page}/uk">
  <link rel="alternate" hreflang="x-default" href="${root}/${page}">
  <link rel="icon" href="/assets/clan-emblem.png" type="image/png">
  <link rel="stylesheet" href="/assets/clan-public.css">
</head>
<body>
<div class="guest-page">
  <header class="guest-header">
    <a class="guest-brand" href="/public/${locale}"><img src="/assets/clan-emblem.png" width="32" height="35" alt=""><span>Ukrainians</span></a>
    <nav class="guest-languages" aria-label="Language">
      <a lang="uk" hreflang="uk" href="/${page}/uk" ${locale === 'uk' ? 'aria-current="page"' : ''}>🇺🇦 UA</a>
      <a lang="en" hreflang="en" href="/${page}/en" ${locale === 'en' ? 'aria-current="page"' : ''}>🇬🇧 EN</a>
    </nav>
  </header>
  <main class="legal-main">
    <a class="legal-back" href="/public/${locale}">← ${labels.archive}</a>
    <h1>${escapeHtml(data.title)}</h1>
    <p class="legal-intro">${escapeHtml(data.description)}</p>
    <article class="legal-body">${sections}</article>
    <div class="legal-contact-row">${contact}</div>
  </main>
  <footer class="guest-footer">${nav}<small>${labels.unofficial}</small></footer>
</div>
</body>
</html>`;
  }
}

@Controller()
export class SitePagesController {
  constructor(private readonly pages: SitePagesService) {}

  private app(reply: FastifyReply) {
    return reply
      .header('Cache-Control', 'no-store')
      .type('text/html; charset=utf-8')
      .send(readFileSync(resolve(__dirname, '../../web/dist/index.html'), 'utf8'));
  }

  @Get('login')
  login(@Res() reply: FastifyReply) {
    return this.app(reply);
  }

  @Get('invite/:token')
  invite(@Param('token') token: string, @Res() reply: FastifyReply) {
    if (!/^[A-Za-z0-9_-]{8,256}$/.test(token)) throw new NotFoundException();
    return this.app(reply);
  }

  private async legal(page: LegalPage, req: FastifyRequest, reply: FastifyReply, lang?: string) {
    if (lang !== undefined && lang !== 'uk' && lang !== 'en') throw new NotFoundException();
    if (!lang) reply.header('Vary', 'Accept-Language');
    const locale = lang ? (lang as Locale) : browserLocale(String(req.headers['accept-language'] || ''));
    return reply
      .header('Cache-Control', 'public, max-age=300')
      .type('text/html; charset=utf-8')
      .send(await this.pages.legalPage(page, locale, !lang));
  }

  @Get('about')
  about(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.legal('about', req, reply);
  }

  @Get('about/:locale')
  aboutTranslated(
    @Param('locale') lang: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    return this.legal('about', req, reply, lang);
  }

  @Get('privacy')
  privacy(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.legal('privacy', req, reply);
  }

  @Get('privacy/:locale')
  privacyTranslated(
    @Param('locale') lang: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    return this.legal('privacy', req, reply, lang);
  }

  @Get('terms')
  terms(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.legal('terms', req, reply);
  }

  @Get('terms/:locale')
  termsTranslated(
    @Param('locale') lang: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    return this.legal('terms', req, reply, lang);
  }
}
