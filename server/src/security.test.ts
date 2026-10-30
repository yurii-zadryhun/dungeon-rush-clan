import { describe, expect, it } from 'vitest';
import { limitFor, RequestLimiter } from './security';

describe('request rate limits', () => {
  it('separates authentication, registration, OCR, API reads and guest requests', () => {
    expect(limitFor('POST', '/api/auth/login')?.group).toBe('authentication');
    expect(limitFor('POST', '/api/auth/invite/abc/register')?.group).toBe('registration');
    expect(limitFor('POST', '/api/ocr')?.group).toBe('ocr');
    expect(limitFor('POST', '/api/ocr/clan')?.group).toBe('ocr');
    expect(limitFor('GET', '/clan/en')?.group).toBe('public-page');
    expect(limitFor('GET', '/api/public/clan')?.group).toBe('public-data');
    expect(limitFor('GET', '/api/players')?.group).toBe('api-reads');
    expect(limitFor('PATCH', '/api/settings')?.group).toBe('mutations');
    expect(limitFor('GET', '/assets/a.jpg')).toBeNull();
  });

  it('blocks at threshold and supplies a retry interval', () => {
    const limiter = new RequestLimiter();
    const limit = { group: 'test', max: 2, windowMs: 5000 };
    expect(limiter.check('1.2.3.4', limit, 1000)).toBe(0);
    expect(limiter.check('1.2.3.4', limit, 1001)).toBe(0);
    expect(limiter.check('1.2.3.4', limit, 1002)).toBe(5);
    expect(limiter.check('5.6.7.8', limit, 1002)).toBe(0);
    expect(limiter.check('1.2.3.4', limit, 6001)).toBe(0);
  });

  it('keeps independent budgets per endpoint class and per IP', () => {
    const limiter = new RequestLimiter();
    expect(limiter.check('client', { group: 'ocr', max: 1, windowMs: 60000 }, 100)).toBe(0);
    expect(limiter.check('client', { group: 'ocr', max: 1, windowMs: 60000 }, 100)).toBe(60);
    expect(limiter.check('client', { group: 'api-reads', max: 1, windowMs: 60000 }, 100)).toBe(0);
    const quota = limiter.usage('client', { group: 'ocr', max: 1, windowMs: 60000 }, 100);
    expect(quota).toEqual({ limit: 1, remaining: 0, windowSeconds: 60, resetAt: 60100 });
    expect(limiter.usage('client', { group: 'ocr', max: 1, windowMs: 60000 }, 60100).remaining).toBe(1);
  });
});
