import { describe, expect, it, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { OcrController, type VisionService, type VisionText } from './ocr';
import type { Db } from './database';

describe('clan OCR diagnostic response', () => {
  it('returns unchanged Vision text/coordinates plus per-image parser output for troubleshooting', async () => {
    const recognized: VisionText = {
      raw: 'Power 77.80q\nMembers 48/50\nКРОСТ\n5.59q',
      width: 420,
      height: 450,
      words: [
        { text: 'Power', x: 13, y: 40 },
        { text: '77.80q', x: 150, y: 40 },
        { text: 'Members', x: 13, y: 90 },
        { text: '48/50', x: 150, y: 90 },
        { text: 'КРОСТ', x: 21, y: 190 },
        { text: '5.59q', x: 21, y: 245 },
      ],
    };
    const read = vi.fn().mockResolvedValue(recognized);
    const vision = { read } as unknown as VisionService;
    const request = {
      parts: async function* () {
        yield { type: 'field', fieldname: 'headerHeight', value: '120' };
        yield {
          type: 'file',
          fieldname: 'mosaic',
          mimetype: 'image/jpeg',
          toBuffer: async () => Buffer.from([0xff, 0xd8, 0xff]),
        };
      },
    } as unknown as FastifyRequest;

    const result = await new OcrController(vision, {} as Db).clan(request);
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.players).toEqual([{ name: 'КРОСТ', power: 5.59e15, powerText: '5.59q', source: 1 }]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toEqual({
      image: 1,
      headerHeight: 120,
      vision: recognized,
      parsed: expect.objectContaining({
        players: result.players,
        reportedMembers: 48,
        capacity: 50,
        reportedPowerText: '77.80q',
      }),
    });
    const copied = JSON.stringify(result, null, 2);
    expect(copied).toContain(JSON.stringify(recognized.raw));
    expect(copied).toContain('"x": 21');
    expect(copied).toContain('"headerHeight": 120');
    expect(copied).not.toContain('image/jpeg');
  });
});
