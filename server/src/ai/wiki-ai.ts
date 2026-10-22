import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Injectable,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AuthenticatedRequest, SessionGuard } from '../auth';
import { AiQuota } from './quota';
import {
  approximateInputTokens,
  createWikiPrompt,
  searchWiki,
  sourcesFor,
  type AiLocale,
  type WikiSource,
} from './wiki-search';

const requestSchema = z.object({
  question: z.string().trim().min(3).max(400),
  locale: z.enum(['uk', 'en']),
  previous: z
    .object({
      question: z.string().trim().max(250),
      answer: z.string().trim().max(500),
    })
    .optional(),
}).strict();

type AiQuestion = z.infer<typeof requestSchema>;

interface AiResult {
  answer: string;
  sources: WikiSource[];
  cached: boolean;
}

const MODEL = 'gemma-4-31b-it';
const PROVIDER_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';
const CACHE_TTL = 6 * 60 * 60 * 1000;

@Injectable()
export class WikiAiService {
  private readonly quota = new AiQuota();
  private readonly cache = new Map<string, { result: AiResult; expires: number }>();
  private readonly pending = new Map<string, Promise<AiResult>>();

  status(): { enabled: boolean; model: string } {
    return { enabled: !!process.env.GEMINI_API_KEY, model: 'Gemma 4 31B' };
  }

  private async generate(prompt: { system: string; user: string }): Promise<string> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ServiceUnavailableException('AI_UNAVAILABLE');

    let response: Response;
    try {
      response = await fetch(PROVIDER_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 384,
            thinkingConfig: { thinkingLevel: 'minimal' },
          },
        }),
      });
    } catch {
      throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
    }

    if (response.status === 429) throw new HttpException('AI_PROVIDER_LIMIT', 429);
    if (!response.ok) throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
    }

    const root = payload as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = root?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('\n')
      .trim();
    if (!text) throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
    return text.slice(0, 1800);
  }

  async ask(input: unknown, accountId: number): Promise<AiResult> {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('AI_INVALID_QUESTION');
    const { question, locale, previous } = parsed.data as AiQuestion;
    if (!this.status().enabled) throw new ServiceUnavailableException('AI_UNAVAILABLE');

    const relevant = searchWiki(question, locale as AiLocale, previous?.question);
    if (!relevant.length) {
      return {
        answer:
          locale === 'uk'
            ? 'У нашій wiki поки немає достовірної відповіді на це питання. Спробуй уточнити тему або переглянь гайди.'
            : "Our wiki doesn't contain a reliable answer to that yet. Try a more specific question or browse the guides.",
        sources: [],
        cached: true,
      };
    }

    const prompt = createWikiPrompt(question, locale as AiLocale, relevant, previous);
    const sources = sourcesFor(relevant, locale as AiLocale);
    const signature = createHash('sha256')
      .update(JSON.stringify([MODEL, parsed.data]))
      .digest('hex');
    const cached = this.cache.get(signature);
    if (cached && cached.expires > Date.now()) return { ...cached.result, cached: true };
    if (cached) this.cache.delete(signature);

    const sharedRequest = this.pending.get(signature);
    if (sharedRequest) return { ...(await sharedRequest), cached: true };

    const estimatedTokens = approximateInputTokens(prompt);
    const error = this.quota.reserve(accountId, estimatedTokens);
    if (error) throw new HttpException(error, 429);

    const task = (async (): Promise<AiResult> => {
      try {
        const answer = await this.generate(prompt);
        const result: AiResult = { answer, sources, cached: false };
        if (this.cache.size >= 250) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(signature, { result, expires: Date.now() + CACHE_TTL });
        return result;
      } finally {
        this.quota.release();
      }
    })();
    this.pending.set(signature, task);
    try {
      return await task;
    } finally {
      this.pending.delete(signature);
    }
  }
}

@Controller('api/wiki-ai')
@UseGuards(SessionGuard)
export class WikiAiController {
  constructor(private readonly service: WikiAiService) {}

  @Get('status')
  status() {
    return this.service.status();
  }

  @Post('ask')
  ask(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.ask(body, request.account!.id);
  }
}
