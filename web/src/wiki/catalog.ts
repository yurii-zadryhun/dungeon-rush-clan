import { gettingStarted } from './data/getting-started';
import { clanWars } from './data/clan-wars';
import { combatGuides } from './data/combat';
import { progressionGuides } from './data/progression';
import { researchGuides } from './data/research';
import type { WikiArticle } from './model';

export const wikiArticles: WikiArticle[] = [
  ...gettingStarted,
  ...clanWars,
  ...combatGuides,
  ...progressionGuides,
  ...researchGuides,
];

export const articleById = new Map(wikiArticles.map((article) => [article.id, article]));
