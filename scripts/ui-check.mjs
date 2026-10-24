import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const header = read('web/src/screens/SiteHeader.tsx');
const headerCss = read('web/src/screens/SiteHeader.css');
const archive = read('web/src/screens/ClanDashboard.tsx');
const mainCss = read('web/src/styles.css');
const players = read('web/src/screens/PlayersPage.tsx');
const playersCss = read('web/src/screens/PlayersPage.css');
const guest = read('web/src/screens/GuestPage.tsx');
const publicHtml = read('server/src/public-clan.ts');

assert.match(
  header,
  /className="top-navigation shell-navigation"/,
  'Navigation uses themed shell classes',
);
assert.match(
  headerCss,
  /\.shell-header \.shell-navigation a\s*\{/,
  'Desktop navigation links have styles',
);
assert.match(headerCss, /\.shell-header \.shell-navigation a\.active\s*\{/, 'Active links are styled');
assert.match(
  archive,
  /className="game-button secondary full war-edit-button"/,
  'Edit war uses standard button',
);
assert.match(mainCss, /\.war-content \.war-edit-button\s*\{/, 'Edit war geometry is declared');
assert.match(archive, /className="dashboard-top dashboard-top-compact"/, 'Rankings use compact layout');
assert.match(archive, /className="leaderboard-tabs"/, 'Rankings have a metric switch');
assert.match(players, /className="players-column-head"/, 'Player metrics have one shared header');
assert.match(players, /className="players-tab-count"/, 'Roster and account counts appear in tabs');
assert.match(
  playersCss,
  /\.directory-player\s*\{[\s\S]*?grid-template-columns: var\(--player-columns\)/,
  'Rows align with their headings',
);
assert.match(guest, /src="\/assets\/clan-emblem\.png"/, 'Guest page loads proxied assets');
assert.doesNotMatch(
  guest,
  /publicShare|publicIntro|publicResultsOnly|publicCompletedWars|publicClanProfile/,
  'Guest has no redundant content',
);
assert.match(publicHtml, /\/assets\/og-clan\.jpg/, 'SEO image uses proxied path');
assert.match(publicHtml, /\/assets\/clan-emblem\.png/, 'Crawler image uses proxied path');
assert.ok(
  existsSync(new URL('../web/public/assets/og-clan.jpg', import.meta.url)),
  'OG graphic committed',
);
assert.ok(
  existsSync(new URL('../web/public/assets/clan-emblem.png', import.meta.url)),
  'Clan emblem committed',
);
console.log('UI regression checks passed');
