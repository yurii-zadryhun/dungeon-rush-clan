export type AiQuotaError = 'AI_BUSY' | 'AI_RATE_LIMIT' | 'AI_DAILY_LIMIT';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Intentionally below the published free-tier quota (30 RPM, 16K TPM, 14,400 RPD).
// Input-token estimates are conservative for Ukrainian as well as English.
export class AiQuota {
  private minute: { time: number; estimatedTokens: number }[] = [];
  private day: number[] = [];
  private users = new Map<number, { minute: number[]; day: number[] }>();
  private active = 0;

  reserve(userId: number, estimatedTokens: number, now = Date.now()): AiQuotaError | null {
    this.minute = this.minute.filter((entry) => now - entry.time < MINUTE);
    this.day = this.day.filter((time) => now - time < DAY);

    const current = this.users.get(userId) ?? { minute: [], day: [] };
    current.minute = current.minute.filter((time) => now - time < MINUTE);
    current.day = current.day.filter((time) => now - time < DAY);
    this.users.set(userId, current);

    if (this.active >= 3) return 'AI_BUSY';
    if (this.day.length >= 3000 || current.day.length >= 80) return 'AI_DAILY_LIMIT';
    if (
      this.minute.length >= 20 ||
      current.minute.length >= 4 ||
      this.minute.reduce((sum, entry) => sum + entry.estimatedTokens, 0) +
        estimatedTokens > 11_500
    ) {
      return 'AI_RATE_LIMIT';
    }

    this.active++;
    this.minute.push({ time: now, estimatedTokens });
    this.day.push(now);
    current.minute.push(now);
    current.day.push(now);
    return null;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
  }
}
