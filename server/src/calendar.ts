export const DAY_POINTS = [1, 2, 2, 2, 2, 4] as const;

export function warStart(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceTuesday = (day.getUTCDay() + 5) % 7;
  day.setUTCDate(day.getUTCDate() - daysSinceTuesday);
  return day.toISOString().slice(0, 10);
}

export function shiftWar(start: string, weeks: number): string {
  const date = new Date(start + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + 7 * weeks);
  return date.toISOString().slice(0, 10);
}

export function importPermission(
  start: string,
  now = new Date(),
): { ranking: boolean; result: boolean } {
  const sunday = new Date(start + 'T00:00:00Z');
  sunday.setUTCDate(sunday.getUTCDate() + 5);
  const monday = new Date(sunday);
  monday.setUTCDate(monday.getUTCDate() + 1);
  return { ranking: now >= sunday, result: now >= monday };
}

export function weekState(start: string, now = new Date()): 'future' | 'active' | 'past' {
  const beginning = new Date(start + 'T00:00:00Z').getTime();
  const end = beginning + 6 * 86400000; // Monday 00:00 UTC
  const time = now.getTime();
  if (time < beginning) return 'future';
  if (time < end) return 'active';
  return 'past';
}

export function weekLabel(start: string): string {
  const to = new Date(start + 'T00:00:00Z');
  to.setUTCDate(to.getUTCDate() + 5);
  return start.slice(5) + ' – ' + to.toISOString().slice(5, 10);
}
