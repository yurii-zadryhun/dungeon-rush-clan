import { describe, expect, it } from 'vitest';
import { buildRecognition, type RecognitionScore } from './recognition';

const row = (warId: number, playerId: number, position: number, points: number,
  championship = false): RecognitionScore => ({
  warId, playerId, position, points, championship,
  start: '2026-10-' + String(warId).padStart(2, '0'), name: 'Player ' + playerId,
});

describe('clan recognition', () => {
  it('counts only known friendly MVPs and computes streaks across imported wars', () => {
    const result = buildRecognition([
      row(1, 1, 1, 100), row(1, 2, 2, 50),
      row(2, 1, 1, 110, true), row(3, 2, 1, 60),
      row(4, 1, 1, 120),
    ], [
      { playerId: 1, winner: 'ours' },
      { playerId: 1, winner: 'opponent' },
      { playerId: null, winner: 'ours' },
    ], [1, 2, 3, 4]);
    expect(result.warCount).toBe(4);
    expect(result.leaderboard.find((player) => player.id === 1)).toMatchObject({
      points: 330, firstPlaces: 3, mvps: 1, longestStreak: 2, championshipPoints: 110,
    });
    expect(result.leaderboard.find((player) => player.id === 2)?.longestStreak).toBe(1);
    expect(result.recent[0]).toMatchObject({ start: '2026-10-04', id: 1 });
  });
  it('does not fabricate awards without imported rankings', () => {
    expect(buildRecognition([], [], [])).toEqual({
      warCount: 0, leaderboard: [], awards: [], recent: [],
    });
  });
});
