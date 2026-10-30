// Lightweight process-local limiter for a single PM2 worker. Fixed windows and bounded
// storage prevent attackers from growing the tracking map indefinitely.
export interface Limit {
  group: string;
  max: number;
  windowMs: number;
}

export const OCR_SCAN_LIMIT: Limit = { group: 'ocr', max: 8, windowMs: 10 * 60_000 };

export function limitFor(method: string, pathname: string): Limit | null {
  if (pathname === '/clan' || pathname === '/clan/' || /^\/clan\/(uk|en)\/?$/.test(pathname)) {
    return { group: 'public-page', max: 150, windowMs: 60_000 };
  }
  if (!pathname.startsWith('/api/')) return null;
  if (pathname === '/api/auth/login' || pathname === '/api/auth/bootstrap')
    return { group: 'authentication', max: 20, windowMs: 10 * 60_000 };
  if (/^\/api\/auth\/invite\/[^/]+\/register$/.test(pathname))
    return { group: 'registration', max: 10, windowMs: 10 * 60_000 };
  if (pathname === '/api/ocr' || pathname === '/api/ocr/clan') return OCR_SCAN_LIMIT;
  if (pathname === '/api/wiki-ai/ask') return { group: 'ai', max: 25, windowMs: 60_000 };
  if (pathname === '/api/public/clan') return { group: 'public-data', max: 150, windowMs: 60_000 };
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS')
    return { group: 'mutations', max: 150, windowMs: 60_000 };
  return { group: 'api-reads', max: 400, windowMs: 60_000 };
}

interface Bucket {
  hits: number;
  resetAt: number;
}

export class RequestLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private calls = 0;

  usage(key: string, limit: Limit, now = Date.now()) {
    const bucket = this.buckets.get(limit.group + ':' + key);
    const active = bucket && bucket.resetAt > now ? bucket : null;
    return {
      limit: limit.max,
      remaining: active ? Math.max(0, limit.max - active.hits) : limit.max,
      windowSeconds: limit.windowMs / 1000,
      resetAt: active ? active.resetAt : null,
    };
  }

  check(ip: string, limit: Limit, now = Date.now()): number {
    this.calls++;
    if (this.calls % 256 === 0 || this.buckets.size >= 8000) {
      for (const [key, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(key);
      }
    }
    const key = limit.group + ':' + ip;
    const existing = this.buckets.get(key);
    if (existing && existing.resetAt > now) {
      if (existing.hits >= limit.max) {
        return Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      }
      existing.hits++;
      return 0;
    }
    // Bound memory even under requests from many distinct addresses.
    if (!existing && this.buckets.size >= 8000) return Math.ceil(limit.windowMs / 1000);
    this.buckets.set(key, { hits: 1, resetAt: now + limit.windowMs });
    return 0;
  }
}

// Shared across Fastify middleware and authenticated OCR endpoints.
export const requestLimiter = new RequestLimiter();
