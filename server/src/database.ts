import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { Generated, Kysely, SqliteDialect } from 'kysely';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type Role = 'owner' | 'admin' | 'member';

export interface Tables {
  settings: {
    id: number;
    clan_name: string;
    minimum_points: number;
    weights_json: string;
    leader_name: string;
    telegram_url: string;
    discord_url: string;
    contact_url: string;
  };
  accounts: {
    id: Generated<number>;
    username: string;
    display_name: string;
    role: Role;
    password_hash: string;
    locale: 'uk' | 'en';
    active: number;
    created_at: number;
  };
  shared_invites: {
    id: number;
    token_hash: string;
    created_by: number;
    active: number;
    created_at: number;
  };
  sessions: {
    token_hash: string;
    account_id: number;
    expires_at: number;
    extended_at: number;
    impersonated_account_id: number | null;
    impersonation_expires_at: number | null;
  };
  invites: {
    id: Generated<number>;
    token_hash: string;
    label: string;
    role: 'owner' | 'admin' | 'member';
    expires_at: number;
    used_at: number | null;
    created_by: number;
  };
  clans: { id: Generated<number>; name: string; normalized_name: string };
  wars: {
    id: Generated<number>;
    start_date: string;
    opponent_clan_id: number | null;
    our_score: number | null;
    opponent_score: number | null;
    ranking_imported_at: number | null;
    result_imported_at: number | null;
    is_championship: number;
    created_at: number;
  };
  players: {
    id: Generated<number>;
    name: string;
    normalized_name: string;
    account_id: number | null;
    active: number;
    created_at: number;
  };
  player_aliases: { normalized_name: string; player_id: number };
  player_labels: {
    player_id: number;
    telegram: number;
    discord: number;
    telegram_handle: string;
    discord_handle: string;
    tags_json: string;
    exception_reason: string;
    updated_at: number;
  };
  player_notes: {
    id: Generated<number>;
    player_id: number;
    author_id: number | null;
    body: string;
    category: 'note' | 'attention' | 'contact' | 'positive';
    created_at: number;
  };
  clan_roster_snapshots: {
    id: Generated<number>;
    captured_at: number;
    imported_at: number;
    reported_members: number;
    reported_power: number | null;
    screenshot_count: number;
  };
  clan_roster_entries: {
    snapshot_id: number;
    player_id: number;
    power: number;
    power_text: string;
  };
  audit_log: {
    id: Generated<number>;
    actor_id: number | null;
    action: string;
    entity: string;
    entity_id: number | null;
    details_json: string;
    created_at: number;
  };
  player_events: {
    id: Generated<number>;
    player_id: number;
    kind: string;
    previous_value: string | null;
    next_value: string | null;
    occurred_at: number;
  };
  player_scores: { war_id: number; player_id: number; position: number; points: number };
  war_days: {
    war_id: number;
    day_number: number;
    points: number;
    winner: 'ours' | 'opponent';
    mvp: string;
    mvp_player_id: number | null;
  };
}

@Injectable()
export class Db implements OnModuleDestroy {
  readonly connection: Database.Database;
  readonly query: Kysely<Tables>;

  constructor() {
    const directory = resolve(process.env.DATA_DIR || './data');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.connection = new Database(join(directory, 'clan.sqlite'));
    this.connection.pragma('journal_mode = WAL');
    this.connection.pragma('foreign_keys = OFF');
    this.connection.pragma('busy_timeout = 5000');
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), clan_name TEXT NOT NULL, minimum_points INTEGER NOT NULL, weights_json TEXT NOT NULL, leader_name TEXT NOT NULL DEFAULT '', telegram_url TEXT NOT NULL DEFAULT '', discord_url TEXT NOT NULL DEFAULT '', contact_url TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'uk', active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS shared_invites (id INTEGER PRIMARY KEY CHECK(id=1), token_hash TEXT UNIQUE NOT NULL, created_by INTEGER NOT NULL REFERENCES accounts(id), active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, extended_at INTEGER NOT NULL, impersonated_account_id INTEGER, impersonation_expires_at INTEGER);
      CREATE INDEX IF NOT EXISTS sessions_by_account ON sessions(account_id);
      CREATE TABLE IF NOT EXISTS invites (id INTEGER PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, label TEXT NOT NULL, role TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, created_by INTEGER NOT NULL REFERENCES accounts(id));
      CREATE TABLE IF NOT EXISTS clans (id INTEGER PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS wars (id INTEGER PRIMARY KEY, start_date TEXT UNIQUE NOT NULL, opponent_clan_id INTEGER REFERENCES clans(id), our_score INTEGER, opponent_score INTEGER, ranking_imported_at INTEGER, result_imported_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT UNIQUE NOT NULL, account_id INTEGER UNIQUE REFERENCES accounts(id), active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS player_scores (war_id INTEGER NOT NULL REFERENCES wars(id) ON DELETE CASCADE, player_id INTEGER NOT NULL REFERENCES players(id), position INTEGER NOT NULL, points INTEGER NOT NULL, PRIMARY KEY(war_id, player_id), UNIQUE(war_id, position));
      CREATE INDEX IF NOT EXISTS scores_by_player ON player_scores(player_id);
      CREATE TABLE IF NOT EXISTS player_aliases (normalized_name TEXT PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE);
      CREATE INDEX IF NOT EXISTS player_aliases_by_player ON player_aliases(player_id);
      CREATE TABLE IF NOT EXISTS player_labels (
        player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
        telegram INTEGER NOT NULL DEFAULT 0,
        discord INTEGER NOT NULL DEFAULT 0,
        telegram_handle TEXT NOT NULL DEFAULT '',
        discord_handle TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        exception_reason TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS player_notes (
        id INTEGER PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        author_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        body TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'note',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS player_notes_by_player ON player_notes(player_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS clan_roster_snapshots (
        id INTEGER PRIMARY KEY, captured_at INTEGER NOT NULL, imported_at INTEGER NOT NULL,
        reported_members INTEGER NOT NULL CHECK(reported_members BETWEEN 1 AND 100),
        reported_power REAL, screenshot_count INTEGER NOT NULL CHECK(screenshot_count BETWEEN 1 AND 10)
      );
      CREATE INDEX IF NOT EXISTS roster_snapshots_recent ON clan_roster_snapshots(captured_at DESC, id DESC);
      CREATE TABLE IF NOT EXISTS clan_roster_entries (
        snapshot_id INTEGER NOT NULL REFERENCES clan_roster_snapshots(id) ON DELETE CASCADE,
        player_id INTEGER NOT NULL REFERENCES players(id),
        power REAL NOT NULL CHECK(power >= 0),
        power_text TEXT NOT NULL,
        PRIMARY KEY(snapshot_id, player_id)
      );
      CREATE INDEX IF NOT EXISTS roster_entries_player ON clan_roster_entries(player_id, snapshot_id);
      CREATE TABLE IF NOT EXISTS war_days (war_id INTEGER NOT NULL REFERENCES wars(id) ON DELETE CASCADE, day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 6), points INTEGER NOT NULL, winner TEXT NOT NULL, mvp TEXT NOT NULL, PRIMARY KEY(war_id, day_number));
      CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id INTEGER, details_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS audit_log_recent ON audit_log(created_at DESC, id DESC);
      CREATE TABLE IF NOT EXISTS player_events (id INTEGER PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, kind TEXT NOT NULL, previous_value TEXT, next_value TEXT, occurred_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS player_events_history ON player_events(player_id, occurred_at DESC);
      INSERT OR IGNORE INTO settings(id,clan_name,minimum_points,weights_json) VALUES(1,'Ukrainians',100000,'[0.75,0.25]');
    `);
    const warColumns = this.connection.pragma('table_info(wars)') as { name: string }[];
    if (!warColumns.some((column) => column.name === 'is_championship')) {
      this.connection.exec('ALTER TABLE wars ADD COLUMN is_championship INTEGER NOT NULL DEFAULT 0');
    }
    const dayColumns = this.connection.pragma('table_info(war_days)') as { name: string }[];
    if (!dayColumns.some((column) => column.name === 'mvp_player_id')) {
      this.connection.exec(
        'ALTER TABLE war_days ADD COLUMN mvp_player_id INTEGER REFERENCES players(id)',
      );
      const days = this.connection
        .prepare("SELECT war_id, day_number, mvp FROM war_days WHERE winner='ours'")
        .all() as { war_id: number; day_number: number; mvp: string }[];
      const players = this.connection.prepare('SELECT id, normalized_name FROM players').all() as {
        id: number;
        normalized_name: string;
      }[];
      const aliases = this.connection
        .prepare('SELECT player_id AS id, normalized_name FROM player_aliases')
        .all() as { id: number; normalized_name: string }[];
      const lookup = new Map([...players, ...aliases].map((entry) => [entry.normalized_name, entry.id]));
      const update = this.connection.prepare(
        'UPDATE war_days SET mvp_player_id=? WHERE war_id=? AND day_number=?',
      );
      for (const day of days) {
        const playerId = lookup.get(normalizeName(day.mvp));
        if (playerId) update.run(playerId, day.war_id, day.day_number);
      }
    }
    // Older databases already have settings; add the optional public leader field in place.
    const settingsColumns = this.connection.pragma('table_info(settings)') as { name: string }[];
    if (!settingsColumns.some((column) => column.name === 'leader_name')) {
      this.connection.exec("ALTER TABLE settings ADD COLUMN leader_name TEXT NOT NULL DEFAULT ''");
    }
    for (const field of ['telegram_url', 'discord_url', 'contact_url'] as const) {
      if (!settingsColumns.some((column) => column.name === field)) {
        this.connection.exec(`ALTER TABLE settings ADD COLUMN ${field} TEXT NOT NULL DEFAULT ''`);
      }
    }
    const sessionColumns = this.connection.pragma('table_info(sessions)') as { name: string }[];
    if (!sessionColumns.some((column) => column.name === 'impersonated_account_id')) {
      this.connection.exec('ALTER TABLE sessions ADD COLUMN impersonated_account_id INTEGER');
    }
    if (!sessionColumns.some((column) => column.name === 'impersonation_expires_at')) {
      this.connection.exec('ALTER TABLE sessions ADD COLUMN impersonation_expires_at INTEGER');
    }
    // Existing installations used TOTP. Rebuild tables once to remove secrets entirely
    // while preserving account IDs, password hashes, sessions and invitations.
    const accountColumns = this.connection.pragma('table_info(accounts)') as { name: string }[];
    if (accountColumns.some((column) => column.name === 'totp_secret')) {
      this.connection.transaction(() => {
        this.connection.exec(`
          CREATE TABLE accounts_new (
            id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
            role TEXT NOT NULL, password_hash TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'uk',
            active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
          );
          INSERT INTO accounts_new(id,username,display_name,role,password_hash,locale,active,created_at)
            SELECT id,username,display_name,role,password_hash,'uk',active,created_at FROM accounts;
          DROP TABLE accounts;
          ALTER TABLE accounts_new RENAME TO accounts;
        `);
      })();
    }
    const invitationColumns = this.connection.pragma('table_info(invites)') as { name: string }[];
    if (invitationColumns.some((column) => column.name === 'setup_secret')) {
      this.connection.transaction(() => {
        this.connection.exec(`
          CREATE TABLE invites_new (
            id INTEGER PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL,
            label TEXT NOT NULL, role TEXT NOT NULL, expires_at INTEGER NOT NULL,
            used_at INTEGER, created_by INTEGER NOT NULL REFERENCES accounts(id)
          );
          INSERT INTO invites_new(id,token_hash,label,role,expires_at,used_at,created_by)
            SELECT id,token_hash,label,role,expires_at,used_at,created_by FROM invites;
          DROP TABLE invites;
          ALTER TABLE invites_new RENAME TO invites;
        `);
      })();
    }
    const playerColumns = this.connection.pragma('table_info(players)') as { name: string }[];
    if (!playerColumns.some((column) => column.name === 'account_id')) {
      this.connection.exec('ALTER TABLE players ADD COLUMN account_id INTEGER REFERENCES accounts(id)');
      this.connection.exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS players_account_unique ON players(account_id)',
      );
      // Existing users retain ownership of their historical player, matched by in-game name.
      this.connection.exec(`
        UPDATE players SET account_id = (
          SELECT accounts.id FROM accounts
          WHERE accounts.username = players.normalized_name AND accounts.active = 1 LIMIT 1
        ) WHERE account_id IS NULL
      `);
    }
    // Clear old enrollment secrets, then enforce FK constraints again.
    this.connection.exec('DROP TABLE IF EXISTS bootstrap');
    this.connection.pragma('foreign_keys = ON');
    this.connection.exec('DROP INDEX IF EXISTS account_single_owner');
    const integrity = this.connection.pragma('foreign_key_check') as unknown[];
    if (integrity.length) throw new Error('SQLite foreign key validation failed after migration');
    this.query = new Kysely<Tables>({ dialect: new SqliteDialect({ database: this.connection }) });
  }

  async onModuleDestroy() {
    await this.query.destroy();
  }
}

export function normalizeName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
