import type { Locale } from './i18n';

export function formatWarRange(start: string, locale: Locale): string {
  const beginning = new Date(start + 'T00:00:00.000Z');
  const ending = new Date(beginning);
  ending.setUTCDate(ending.getUTCDate() + 5);
  const formatter = new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return formatter.formatRange(beginning, ending);
}
