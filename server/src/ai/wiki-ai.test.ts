import { afterEach, describe, expect, it, vi } from 'vitest';
import { WikiAiService } from './wiki-ai';
import { AiQuota } from './quota';
import { approximateInputTokens, createWikiPrompt, searchWiki, sourcesFor } from './wiki-search';

afterEach(() => vi.unstubAllGlobals());

describe('bilingual wiki retrieval', () => {
  it('locates matching subjects without using AI', () => {
    expect(searchWiki('How do I level Divine equipment to 130?', 'en')
      .some((section) => section.articleId === 'gear-130')).toBe(true);
    expect(searchWiki('Коли витрачати кістки у війні?', 'uk')
      .some((section) => ['war-saving', 'war-boxes', 'war-calendar'].includes(section.articleId))).toBe(true);
    expect(searchWiki('Як працює CDT -100% у PvP?', 'uk').length).toBeGreaterThan(0);
  });

  it('refuses irrelevant content and never invents article IDs', () => {
    expect(searchWiki('carbonara pasta tomatoes', 'en')).toEqual([]);
    const matches = searchWiki('Triple Hit and Critical Damage Taken', 'en');
    const sources = sourcesFor(matches, 'en');
    expect(new Set(sources.map((source) => source.id)).size).toBe(sources.length);
    expect(sources.every((source) => /^[a-z0-9-]+$/.test(source.id))).toBe(true);
  });

  it('keeps requests bounded and grounded with a minimal prompt', () => {
    const chunks = searchWiki('Ranged Defense and CDT against PvP', 'en');
    const prompt = createWikiPrompt('Ranged Defense and CDT against PvP', 'en', chunks);
    expect(prompt.system).toContain('ONLY using the wiki extracts');
    expect(prompt.user).toContain('QUESTION:');
    expect(approximateInputTokens(prompt)).toBeLessThan(4000);
  });
});

describe('free-tier quota guard', () => {
  it('limits per-user minute and resets after time passes', () => {
    const quota = new AiQuota();
    for (let i = 0; i < 4; i++) {
      expect(quota.reserve(1, 200, 100_000)).toBeNull();
      quota.release();
    }
    expect(quota.reserve(1, 200, 100_000)).toBe('AI_RATE_LIMIT');
    expect(quota.reserve(1, 200, 161_000)).toBeNull();
  });

  it('respects global token budget and concurrency', () => {
    const quota = new AiQuota();
    expect(quota.reserve(1, 6000, 100_000)).toBeNull();
    expect(quota.reserve(2, 6000, 100_000)).toBe('AI_RATE_LIMIT');
    quota.release();
    const next = new AiQuota();
    expect(next.reserve(1, 200, 100_000)).toBeNull();
    expect(next.reserve(2, 200, 100_000)).toBeNull();
    expect(next.reserve(3, 200, 100_000)).toBeNull();
    expect(next.reserve(4, 200, 100_000)).toBe('AI_BUSY');
  });
});

describe('wiki AI generation', () => {
  it('sends only relevant excerpts and caches identical questions', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-only-do-not-use');
    const fake = vi.fn(async (_url: string, options: RequestInit) => {
      expect(options.headers).toMatchObject({ 'x-goog-api-key': 'test-only-do-not-use' });
      const body = JSON.parse(String(options.body));
      expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal');
      expect(body.contents[0].parts[0].text).not.toContain('password_hash');
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'The wiki says CDT reduces ordinary critical-hit bonus damage.' }] } }],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fake);

    const service = new WikiAiService();
    const first = await service.ask({ question: 'How does CDT affect PvP?', locale: 'en' }, 12);
    expect(first.sources.length).toBeGreaterThan(0);
    expect(first.cached).toBe(false);
    const second = await service.ask({ question: 'How does CDT affect PvP?', locale: 'en' }, 12);
    expect(second.cached).toBe(true);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it('does not call the provider when the topic is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-only-do-not-use');
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    const result = await new WikiAiService().ask({ question: 'carbonara pasta tomatoes', locale: 'en' }, 1);
    expect(result.sources).toEqual([]);
    expect(fake).not.toHaveBeenCalled();
  });
});
