# Dungeon Rush · Clan War Archive

Private, lightweight clan-war dashboard. **NestJS + Fastify, React + Vite, SQLite/Kysely**, one process in production. Source code is maintained directly on `master`.

## Features

- Fully generated Tuesday–Sunday UTC war timeline; Mondays have no war.
- Separate rankings (from Sunday 00:00 UTC) and **final** war results (from Monday 00:00 UTC).
- Cloud Vision OCR for up to 10 weekly leaderboard screenshots + one final-result screenshot.
- Editable review of ranks, names, points, opponent, six daily winners and MVPs; duplicate ranks reconciled.
- Player entry/exit detection based on the latest *chronological* imported weekly ranking (including 0-point members).
- Rolling weighted leaderboard (75/25 by default), configurable minimum points, all-time average and latest-war widgets.
- Individual username/password accounts, owner-managed single-use invitation links, roles, revocation and server-side rolling sessions.
- SQLite WAL, transactional imports, bounded OCR requests, local OCR cache; no Redis or runtime frontend build.

## Requirements

- Node.js 22+, npm, HTTPS reverse proxy for production, enough disk space for SQLite and OCR cache.
- A Google Cloud project with **Cloud Vision API** enabled and an API key authorized to call it. Set API restrictions for Cloud Vision; keep the key on the server. Google Cloud billing/free tier conditions are account-dependent.
- Port 3000 by default; can be changed.

## Install

```sh
npm install
cp .env.example .env

openssl rand -hex 24          # paste as BOOTSTRAP_TOKEN in .env
# configure APP_ORIGIN and GOOGLE_VISION_API_KEY
npm run check
npm test
npm run build
npm start
```



Do not commit `.env`, `data`, screenshot uploads, service keys or real password-only link codes. Secrets and invitations should only be shared privately.

For local frontend hot reload, use `npm run dev`; Vite proxies API traffic to the NestJS process. Set `APP_ORIGIN` appropriately for the production origin, without a trailing slash. Enable HTTPS and `NODE_ENV=production` in production, and set `TRUST_PROXY=1` only behind a trusted reverse proxy that overwrites proxy headers. Cookies are HttpOnly + SameSite Strict + Secure in production.

## Roles

| Role | View | Import/settings | Invite/revoke |
| --- | --- | --- | --- |
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | No |
| Member | Yes | No | No |

Invitations expire after 7 days, are single-use links, and grant roles stored on the server. The invited member chooses their own username and password. Revoking an account also revokes its sessions.

## Business rules

- War begins **Tuesday 00:00 UTC**. Day 1–6 points: `[1,2,2,2,2,4]`, sum 13. Monday is off.
- Weekly player ranking is available from **Sunday 00:00 UTC**, but the war result is only final on **Monday 00:00 UTC**. A war may be partially imported. The two sections each allow **one first-time import**; editing/re-import is intentionally out of scope.
- Import confirmation is atomic. Older-war imports cannot overwrite current clan membership: activity is derived from the newest chronological imported roster.
- User identity is stable SQLite ID. Normalized names enable exact auto-match; OCR review lets the admin link a misread name to an existing player. Renaming and aliases are deferred.
- Calculated score uses the newest imported rankings, **not future/empty weeks**. Default weights 75%/25%; configured weights are normalized when fewer weeks exist. Missing players score zero for the missing week.
- All-time ranking uses mean weekly points across appearances; inactive players remain listed but dimmed.
- OCR responses are cached by SHA-256 of the screenshot bytes under `data/ocr-cache`, so retrying the identical image does not repeat the paid OCR request. The cache holds OCR text and player names: protect and back it up only if necessary.
- The Google OCR geometry parser is designed against supplied game screenshots and has offline tests. Since Vision results depend on image quality and font, **verify every field** during review.

## Code map

```text
server/src/
  database.ts       SQLite schema and Kysely wiring
  auth.ts           password-only, passwords, sessions, owner access management
  calendar.ts       Pure UTC calendar logic
  ranking.ts        Weighted and all-time ranking calculations
  wars.ts           Dashboard and settings API
  ocr.ts            Cloud Vision, geometric parsers, SHA cache
  import.ts         Atomic imports, roster reconciliation
  main.ts           Single Fastify/NestJS server and static assets
web/src/
  main.tsx          Authentication boundary and app state
  screens/          Auth, dashboard, import, settings, members
  styles.css        Game-inspired responsive widget styles
```

## Future MySQL migration

Keep business logic in NestJS services and SQL access in DB/repositories. The Kysely query API is dialect-independent; schema and SQLite-specific conflict handling must be migrated to MySQL. Do not share the SQLite file over a network filesystem.

## Validation

```sh
npm run check     # TypeScript backend + frontend
npm test          # offline parser/calendar tests
npm run build     # optimized React assets + compiled NestJS server
```

GitHub Actions checks all three on every push to `master`.
