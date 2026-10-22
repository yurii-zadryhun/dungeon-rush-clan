import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'getting-started',
  'clan-wars',
  'combat',
  'progression',
  'research',
];
const categories = new Set(['start', 'wars', 'combat', 'progress', 'research']);
const levels = new Set(['beginner', 'intermediate', 'advanced']);
const evidence = new Set(['practical', 'observed', 'theory']);
const ids = new Set();
const all = [];

for (const name of paths) {
  const source = readFileSync(resolve(root, 'web/src/wiki/data', name + '.ts'), 'utf8');
  const match = source.match(/export const \w+: WikiArticle\[\] = ([\s\S]+);\s*$/);
  assert.ok(match, 'Could not read ' + name);
  const articles = JSON.parse(match[1]);
  all.push(...articles);
}

assert.ok(all.length >= 25, 'The wiki should contain the complete initial guide collection');
for (const article of all) {
  assert.match(article.id, /^[a-z0-9-]+$/);
  assert.ok(!ids.has(article.id), 'Duplicate article: ' + article.id);
  ids.add(article.id);
  assert.ok(categories.has(article.category), article.id + ': invalid category');
  assert.ok(levels.has(article.level), article.id + ': invalid level');
  assert.ok(evidence.has(article.evidence), article.id + ': invalid evidence label');
  for (const field of ['title', 'summary', 'body']) {
    for (const locale of ['en', 'uk']) {
      assert.ok(typeof article[field][locale] === 'string' && article[field][locale].trim(),
        article.id + ': missing ' + field + '.' + locale);
    }
  }
  for (const locale of ['en', 'uk']) {
    assert.ok(article.body[locale].length >= 350, article.id + ': too short in ' + locale);
  }
}

for (const article of all) {
  for (const id of article.related ?? []) {
    assert.ok(ids.has(id), article.id + ': missing related article ' + id);
  }
  for (const locale of ['en', 'uk']) {
    for (const match of article.body[locale].matchAll(/\]\(wiki:([a-z0-9-]+)\)/g)) {
      assert.ok(ids.has(match[1]), article.id + ': broken internal link ' + match[1]);
    }
  }
  for (const link of article.links ?? []) {
    assert.match(link.url, /^https:\/\//, article.id + ': non-HTTPS external link');
    assert.ok(link.label.en && link.label.uk, article.id + ': untranslated external link');
  }
}

console.log('Wiki OK: ' + all.length + ' complete bilingual articles; unique ids and links verified');
