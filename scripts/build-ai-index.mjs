import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDir = resolve(root, 'web/src/wiki/data');
const files = ['getting-started', 'clan-wars', 'combat', 'progression', 'research'];
const localeKeys = ['en', 'uk'];
const entries = [];

function sections(body) {
  return body
    .split(/^## /m)
    .filter(Boolean)
    .map((part) => {
      const [heading, ...lines] = part.trim().split('\n');
      return {
        heading: heading.trim(),
        text: lines.join('\n')
          .replace(/\[([^\]]+)\]\((?:wiki:[^)]+|https?:\/\/[^)]+)\)/g, '$1')
          .replace(/\*\*/g, '')
          .replace(/^> /gm, '')
          .trim(),
      };
    });
}

for (const file of files) {
  const source = readFileSync(resolve(sourceDir, file + '.ts'), 'utf8');
  const match = source.match(/export const \w+: WikiArticle\[\] = ([\s\S]+);\s*$/);
  if (!match) throw new Error('Could not parse wiki articles from ' + file);
  const articles = JSON.parse(match[1]);
  for (const article of articles) {
    const en = sections(article.body.en);
    const uk = sections(article.body.uk);
    if (en.length !== uk.length) {
      throw new Error('Different wiki section counts: ' + article.id);
    }
    for (let index = 0; index < en.length; index++) {
      entries.push({
        id: article.id + ':' + index,
        articleId: article.id,
        evidence: article.evidence,
        category: article.category,
        title: article.title,
        summary: article.summary,
        heading: { en: en[index].heading, uk: uk[index].heading },
        text: { en: en[index].text, uk: uk[index].text },
      });
    }
  }
}

if (entries.length < 100) throw new Error('Wiki index unexpectedly small');
const target = resolve(root, 'server/src/ai/wiki-index.json');
mkdirSync(resolve(root, 'server/src/ai'), { recursive: true });
writeFileSync(target, JSON.stringify(entries) + '\n');
console.log('Generated bilingual AI wiki index: ' + entries.length + ' sections');
