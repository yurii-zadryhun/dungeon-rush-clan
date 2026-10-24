import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { Generated, Kysely, SqliteDialect } from 'kysely';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type Role = 'owner' | 'admin' | 'member';

export interface Tables {
  settings: { id: number; clan_name: string; minimum_points: number; weights_json: string };
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
  sessions: { token_hash: string; account_id: number; expires_at: number; extended_at: number };
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
  player_scores: { war_id: number; player_id: number; position: number; points: number };
  war_days: {
    war_id: number;
    day_number: number;
    points: number;
    winner: 'ours' | 'opponent';
    mvp: string;
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
      CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), clan_name TEXT NOT NULL, minimum_points INTEGER NOT NULL, weights_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'uk', active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS shared_invites (id INTEGER PRIMARY KEY CHECK(id=1), token_hash TEXT UNIQUE NOT NULL, created_by INTEGER NOT NULL REFERENCES accounts(id), active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, extended_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_by_account ON sessions(account_id);
      CREATE TABLE IF NOT EXISTS invites (id INTEGER PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, label TEXT NOT NULL, role TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, created_by INTEGER NOT NULL REFERENCES accounts(id));
      CREATE TABLE IF NOT EXISTS clans (id INTEGER PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS wars (id INTEGER PRIMARY KEY, start_date TEXT UNIQUE NOT NULL, opponent_clan_id INTEGER REFERENCES clans(id), our_score INTEGER, opponent_score INTEGER, ranking_imported_at INTEGER, result_imported_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT UNIQUE NOT NULL, account_id INTEGER UNIQUE REFERENCES accounts(id), active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS player_scores (war_id INTEGER NOT NULL REFERENCES wars(id) ON DELETE CASCADE, player_id INTEGER NOT NULL REFERENCES players(id), position INTEGER NOT NULL, points INTEGER NOT NULL, PRIMARY KEY(war_id, player_id), UNIQUE(war_id, position));
      CREATE INDEX IF NOT EXISTS scores_by_player ON player_scores(player_id);
      CREATE TABLE IF NOT EXISTS player_aliases (normalized_name TEXT PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE);
      CREATE INDEX IF NOT EXISTS player_aliases_by_player ON player_aliases(player_id);
      CREATE TABLE IF NOT EXISTS war_days (war_id INTEGER NOT NULL REFERENCES wars(id) ON DELETE CASCADE, day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 6), points INTEGER NOT NULL, winner TEXT NOT NULL, mvp TEXT NOT NULL, PRIMARY KEY(war_id, day_number));
      INSERT OR IGNORE INTO settings(id,clan_name,minimum_points,weights_json) VALUES(1,'Ukrainians',100000,'[0.75,0.25]');
    `);
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
