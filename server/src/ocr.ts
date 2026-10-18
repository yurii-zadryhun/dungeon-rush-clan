import { BadRequestException, Controller, Injectable, Post, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { AdminGuard, SessionGuard } from './auth';
import { DAY_POINTS } from './calendar';
import { Db, normalizeName } from './database';

export interface Word {
  text: string;
  x: number;
  y: number;
}

export interface VisionText {
  words: Word[];
  raw: string;
  width: number;
  height: number;
}

export interface OcrPlayer {
  position: number;
  name: string;
  points: number;
  source: number;
}

export interface OcrDay {
  day: number;
  points: number;
  winner: 'ours' | 'opponent' | null;
  mvp: string;
}

export interface OcrResult {
  opponent: string;
  ourScore: number | null;
  opponentScore: number | null;
  days: OcrDay[];
  warnings: string[];
}

function groupLines(words: Word[], threshold: number): Word[][] {
  const sorted = words.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { y: number; words: Word[] }[] = [];
  for (const word of sorted) {
    let row = rows.find((row) => Math.abs(row.y - word.y) <= threshold);
    if (!row) {
      row = { y: word.y, words: [] };
      rows.push(row);
    }
    row.words.push(word);
    row.y = (row.y * (row.words.length - 1) + word.y) / row.words.length;
  }
  return rows.sort((a, b) => a.y - b.y).map((row) => row.words.sort((a, b) => a.x - b.x));
}

function tokens(line: Word[]): string {
  return line
    .map((w) => w.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toInt(value: string): number | null {
  const digits = value.replace(/[,\s.]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

export function parsePlayers(
  text: VisionText,
  source = 0,
): { players: OcrPlayer[]; warnings: string[] } {
  const warnings: string[] = [];
  const players: OcrPlayer[] = [];
  const lines = groupLines(
    text.words.filter((w) => w.y >= text.height * 0.39 && w.y <= text.height * 0.8),
    Math.max(10, text.height * 0.012),
  );
  for (const row of lines) {
    const line = tokens(row);
    const rankIndex = row.findIndex((w) => /^\d{1,2}$/.test(w.text.trim()) && w.x < text.width * 0.34);
    if (rankIndex < 0) continue;
    const position = Number(row[rankIndex].text);
    if (position < 1 || position > 100) continue;
    const candidate = row.slice(rankIndex + 1).filter((w) => w.text.toLowerCase() !== 'pts');
    // Real screenshots position numeric scores to the right of player names.
    let scoreIndex = candidate.findIndex(
      (w) => w.x > text.width * 0.55 && /^(?:\d{1,3}(?:[,\s.]\d{3})+|\d{4,}|0)$/.test(w.text),
    );
    if (scoreIndex < 0)
      scoreIndex = candidate.findIndex((w) => /^[\d,]+$/.test(w.text) && w.x > text.width * 0.51);
    if (scoreIndex < 0) {
      warnings.push('Rank ' + position + ': points not recognized (' + line + ')');
      continue;
    }
    // Vision occasionally splits 1,642,222 into 1,642 and 222.
    const scoreWords = candidate.slice(scoreIndex).filter((w) => w.x <= text.width * 0.92);
    const scoreText = scoreWords
      .map((w) => w.text)
      .join('')
      .replace(/pts/gi, '');
    let points = toInt(scoreText);
    if (points === null) points = toInt(candidate[scoreIndex].text);
    const name = candidate
      .slice(0, scoreIndex)
      .map((w) => w.text)
      .join(' ')
      .trim();
    if (!name || points === null || points > 1_000_000_000) {
      warnings.push('Rank ' + position + ': check ' + line);
      continue;
    }
    players.push({ position, name, points, source });
  }
  if (!players.length) {
    warnings.push(
      'Could not confidently find ranking rows; check screenshot and enter players manually.',
    );
    // Fallback for OCR that only exposes plain text, no geometry.
    const lines = text.raw
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const joined = lines.slice(i, i + 3).join(' ');
      const match = joined.match(/^(\d{1,2})\s+(.+?)\s+([\d,]{1,15})\s*pts\b/i);
      if (match) {
        const pts = toInt(match[3]);
        if (pts !== null)
          players.push({ position: Number(match[1]), name: match[2], points: pts, source });
      }
    }
  }
  return { players, warnings };
}

function cleanName(text: string) {
  return text
    .replace(/\b(Tier|server)\b.*$/i, '')
    .replace(/[^\p{L}\p{N}_ .-]/gu, '')
    .trim();
}

export function parseWar(text: VisionText, ours: string): OcrResult {
  const warnings: string[] = [];
  const lines = groupLines(text.words, Math.max(10, text.height * 0.012));
  let ourScore: number | null = null,
    opponentScore: number | null = null;
  const scoreLines = lines.filter((row) =>
    row.some((w) => w.y >= text.height * 0.39 && w.y <= text.height * 0.48),
  );
  for (const row of scoreLines) {
    const match = tokens(row).match(/\b(\d{1,2})\s*:\s*(\d{1,2})\b/);
    if (match) {
      ourScore = Number(match[1]);
      opponentScore = Number(match[2]);
      break;
    }
  }
  if (ourScore === null) {
    const match = text.raw.match(/\b(\d{1,2})\s*:\s*(\d{1,2})\b/);
    if (match) {
      ourScore = Number(match[1]);
      opponentScore = Number(match[2]);
    }
  }
  if (ourScore === null) warnings.push('Final score not recognized.');
  const rightHeader = lines
    .filter((row) => row.some((w) => w.y >= text.height * 0.46 && w.y <= text.height * 0.54))
    .flat()
    .filter((w) => w.x >= text.width * 0.58 && w.x <= text.width * 0.89);
  let opponent = cleanName(tokens(rightHeader));
  // Avoid accidentally treating metadata such as Tier / server as opponent name.
  opponent = opponent.split(' ')[0] || '';
  if (!opponent || normalizeName(opponent) === normalizeName(ours))
    warnings.push('Verify opponent clan name.');
  const days: OcrDay[] = [];
  for (const row of lines) {
    if (!row.some((w) => w.y >= text.height * 0.57 && w.y <= text.height * 0.85)) continue;
    const line = tokens(row);
    const match = line.match(/Day\s*([1-6])\b/i);
    if (!match) continue;
    const day = Number(match[1]);
    if (days.some((d) => d.day === day)) continue;
    const winnerText = cleanName(
      tokens(row.filter((w) => w.x >= text.width * 0.43 && w.x < text.width * 0.69)),
    );
    const mvp = tokens(row.filter((w) => w.x >= text.width * 0.69 && w.x <= text.width * 0.92))
      .replace(/^-$/, '')
      .trim();
    const normalized = normalizeName(winnerText);
    let winner: 'ours' | 'opponent' | null = null;
    if (normalized && normalized.includes(normalizeName(ours))) winner = 'ours';
    else if (normalized && opponent && normalized.includes(normalizeName(opponent))) winner = 'opponent';
    if (!winner) warnings.push('Day ' + day + ': choose winner manually.');
    if (!mvp) warnings.push('Day ' + day + ': MVP was not recognized.');
    days.push({ day, points: DAY_POINTS[day - 1], winner, mvp });
  }
  if (days.length !== 6)
    warnings.push('Found ' + days.length + '/6 days. Complete missing days manually.');
  days.sort((a, b) => a.day - b.day);
  return { opponent, ourScore, opponentScore, days, warnings };
}

@Injectable()
export class VisionService {
  private readonly cacheDir: string;

  constructor() {
    this.cacheDir = resolve(process.env.DATA_DIR || './data', 'ocr-cache');
    mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
  }

  async read(image: Buffer): Promise<VisionText> {
    const key = createHash('sha256').update(image).digest('hex');
    const path = join(this.cacheDir, key + '.json');
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as VisionText;
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) throw new BadRequestException('GOOGLE_VISION_API_KEY is not configured');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response: Response;
    try {
      response = await fetch(
        'https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(apiKey),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: image.toString('base64') },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              },
            ],
          }),
          signal: controller.signal,
        },
      );
    } catch {
      throw new BadRequestException('Cloud OCR service unavailable');
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const failure = (await response.json().catch(() => null)) as {
        error?: { message?: string; status?: string };
      } | null;
      const detail = failure?.error?.message?.replace(/key=[^\s&]+/gi, 'key=[redacted]');
      const reason = detail || failure?.error?.status || 'Unknown provider error';
      throw new BadRequestException(`Google Cloud Vision (HTTP ${response.status}): ${reason}`);
    }
    const payload: any = await response.json();
    const result = payload.responses?.[0];
    if (result?.error) throw new BadRequestException('Cloud OCR: ' + String(result.error.message));
    const full = result?.fullTextAnnotation;
    const page = full?.pages?.[0];
    if (!page) throw new BadRequestException('No text detected in image');
    const words: Word[] = [];
    for (const block of page.blocks || [])
      for (const paragraph of block.paragraphs || [])
        for (const word of paragraph.words || []) {
          const text = (word.symbols || []).map((s: any) => s.text).join('');
          const box = word.boundingBox?.vertices || [];
          if (!text || !box.length) continue;
          words.push({
            text,
            x: Math.min(...box.map((p: any) => p.x || 0)),
            y: Math.min(...box.map((p: any) => p.y || 0)),
          });
        }
    const extracted: VisionText = {
      words,
      raw: String(full.text || ''),
      width: Number(page.width),
      height: Number(page.height),
    };
    writeFileSync(path, JSON.stringify(extracted), { mode: 0o600 });
    return extracted;
  }
}

@Controller('api/ocr')
@UseGuards(SessionGuard, AdminGuard)
export class OcrController {
  constructor(
    private readonly vision: VisionService,
    private readonly db: Db,
  ) {}

  @Post()
  async process(@Req() req: FastifyRequest) {
    const files: { type: 'ranking' | 'result'; buffer: Buffer }[] = [];
    for await (const part of (req as any).parts()) {
      if (part.type !== 'file') continue;
      if (part.fieldname !== 'ranking' && part.fieldname !== 'result')
        throw new BadRequestException('Unexpected image field');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(part.mimetype))
        throw new BadRequestException('PNG, JPEG or WebP required');
      const buffer = await part.toBuffer();
      if (buffer.length > 6 * 1024 * 1024) throw new BadRequestException('Image exceeds 6 MB');
      files.push({ type: part.fieldname, buffer });
      if (files.length > 11)
        throw new BadRequestException('Maximum 10 ranking screenshots and one result');
    }
    const rankingImages = files.filter((f) => f.type === 'ranking');
    const resultImages = files.filter((f) => f.type === 'result');
    if (rankingImages.length > 10 || resultImages.length > 1 || !files.length)
      throw new BadRequestException('Invalid image count');
    const settings = await this.db.query
      .selectFrom('settings')
      .select('clan_name')
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
    const warnings: string[] = [];
    const players: OcrPlayer[] = [];
    for (const [index, file] of rankingImages.entries()) {
      const result = parsePlayers(await this.vision.read(file.buffer), index + 1);
      warnings.push(...result.warnings.map((w) => 'Image ' + (index + 1) + ': ' + w));
      players.push(...result.players);
    }
    const unique = new Map<number, OcrPlayer>();
    const normalized = new Map<string, number>();
    for (const p of players) {
      const existing = unique.get(p.position);
      if (existing) {
        if (normalizeName(existing.name) !== normalizeName(p.name) || existing.points !== p.points)
          warnings.push('Conflicting duplicated rank #' + p.position + '; review before confirming.');
        continue;
      }
      if (normalized.has(normalizeName(p.name))) {
        warnings.push('Duplicate name ' + p.name + ' found at multiple ranks.');
        continue;
      }
      unique.set(p.position, p);
      normalized.set(normalizeName(p.name), p.position);
    }
    const result = resultImages.length
      ? parseWar(await this.vision.read(resultImages[0].buffer), settings.clan_name)
      : null;
    if (result) warnings.push(...result.warnings);
    return { players: [...unique.values()].sort((a, b) => a.position - b.position), result, warnings };
  }
}
