import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const header = read('web/src/screens/SiteHeader.tsx');
const headerCss = read('web/src/screens/SiteHeader.css');
const archive = read('web/src/screens/ClanDashboard.tsx');
const mainCss = read('web/src/styles.css');
const players = read('web/src/screens/PlayersPage.tsx');
const playersCss = read('web/src/screens/PlayersPage.css');
const guestCss = read('web/public/assets/clan-public.css');
const publicHtml = read('server/src/public-clan.ts');
const management = read('web/src/screens/PlayerManagementPanel.tsx');
const managementCss = read('web/src/screens/PlayerManagementPanel.css');

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
assert.match(guestCss, /\.guest-languages/, 'Static guest UI supports no-JS language selection');
assert.match(publicHtml, /\/assets\/clan-public\.css/, 'Server serves public standalone stylesheet');
assert.doesNotMatch(publicHtml, /<GuestPage|GuestPage\.tsx/, 'Guest route is server-owned');
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
assert.doesNotMatch(management, /t\('staffOnly'\)/, 'Remove redundant staff-only badge');
assert.match(management, /setTimeout\(saveLabels, 600\)/, 'Player labels autosave after edits');
assert.match(management, /className=\{'management-toast '/, 'Save confirmations appear in a toast');
assert.match(managementCss, /\.management-toast\s*\{[\s\S]*?position: fixed;/, 'Toast is visible without scrolling');
assert.match(managementCss, /\.contact-choice\s*\{[\s\S]*?grid-template-columns:/, 'Channel handle aligns with checkbox');
assert.match(managementCss, /\.note-form-actions\s*\{[\s\S]*?grid-template-rows: 40px 40px;/, 'Note category and button are stacked right of textarea');
assert.match(managementCss, /\.note-form textarea\s*\{[\s\S]*?height: 88px;/, 'Note textarea matches stacked controls height');
console.log('UI regression checks passed');
