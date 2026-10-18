import { describe, expect, it } from 'vitest';
import { importPermission, shiftWar, warStart, weekState } from './calendar';

describe('UTC war calendar', () => {
  it('Tuesday begins a war, Sunday is final day, Monday is off', () => {
    expect(warStart(new Date('2026-10-13T00:00:00Z'))).toBe('2026-10-13');
    expect(warStart(new Date('2026-10-18T23:59:59Z'))).toBe('2026-10-13');
    expect(warStart(new Date('2026-10-19T12:00:00Z'))).toBe('2026-10-13');
    expect(warStart(new Date('2026-10-20T00:00:00Z'))).toBe('2026-10-20');
    expect(shiftWar('2026-10-13', 1)).toBe('2026-10-20');
  });
  it('allows ranking from Sunday, final results from Monday', () => {
    const start = '2026-10-13';
    expect(importPermission(start, new Date('2026-10-17T23:59:59Z'))).toEqual({ ranking: false, result: false });
    expect(importPermission(start, new Date('2026-10-18T00:00:00Z'))).toEqual({ ranking: true, result: false });
    expect(importPermission(start, new Date('2026-10-19T00:00:00Z'))).toEqual({ ranking: true, result: true });
  });
  it('marks finished war past from Monday UTC', () => {
    expect(weekState('2026-10-13', new Date('2026-10-18T12:00:00Z'))).toBe('active');
    expect(weekState('2026-10-13', new Date('2026-10-19T00:00:00Z'))).toBe('past');
  });
});
