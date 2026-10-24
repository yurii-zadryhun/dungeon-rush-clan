import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const scores = Object.entries(report.categories ?? {}).map(
  ([key, value]) => key + ': ' + Math.round(100 * (value.score ?? 0)),
);
console.log('URL: ' + report.finalDisplayedUrl);
console.log('SCORES: ' + scores.join(' / '));
for (const key of [
  'first-contentful-paint',
  'largest-contentful-paint',
  'speed-index',
  'total-blocking-time',
  'cumulative-layout-shift',
  'server-response-time',
]) {
  const item = report.audits?.[key];
  if (item) console.log(key + ': ' + item.displayValue + ' (score ' + item.score + ')');
}
const issues = Object.values(report.audits ?? {})
  .filter(
    (item) =>
      item.score !== null &&
      item.score !== undefined &&
      item.score < 0.95 &&
      (item.details?.type !== 'opportunity' || item.details?.overallSavingsMs > 0),
  )
  .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
  .slice(0, 14);
for (const item of issues)
  console.log(
    'ISSUE: ' + item.id + ' ' + item.title + ' (' + item.score + ') ' + (item.displayValue ?? ''),
  );
