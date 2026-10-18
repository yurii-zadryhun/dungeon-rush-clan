import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Db } = require('../server/dist/database.js');
const directory = mkdtempSync(join(tmpdir(), 'clan-schema-migration-'));
process.env.DATA_DIR = directory;

async function run() {
  try {
    const legacy = new Database(join(directory, 'clan.sqlite'));
    legacy.exec(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
        role TEXT NOT NULL, password_hash TEXT NOT NULL, totp_secret TEXT NOT NULL,
        last_totp_step INTEGER NOT NULL DEFAULT -1, active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE invites (
        id INTEGER PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, label TEXT NOT NULL,
        role TEXT NOT NULL, setup_secret TEXT, expires_at INTEGER NOT NULL,
        used_at INTEGER, created_by INTEGER NOT NULL REFERENCES accounts(id)
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL, extended_at INTEGER NOT NULL
      );
      CREATE TABLE bootstrap (id INTEGER PRIMARY KEY CHECK(id=1), secret TEXT NOT NULL, expires_at INTEGER NOT NULL);
      INSERT INTO accounts VALUES (42, 'owner', 'Owner', 'owner', 'salt:hash', 'legacy-totp-secret', 21, 1, 111);
      INSERT INTO invites VALUES (7, 'invite-token-hash', 'Guest', 'member', 'legacy-setup-secret', 99999, NULL, 42);
      INSERT INTO sessions VALUES ('session-hash', 42, 99999, 100);
      INSERT INTO bootstrap VALUES (1, 'legacy-secret', 99999);
    `);
    legacy.close();

    const service = new Db();
    const sql = service.connection;
    const account = sql.prepare('SELECT id, username, role, password_hash, locale FROM accounts WHERE id=42').get();
    assert.deepEqual(account, { id: 42, username: 'owner', role: 'owner', password_hash: 'salt:hash', locale: 'uk' });
    const session = sql.prepare('SELECT token_hash, account_id FROM sessions').get();
    assert.deepEqual(session, { token_hash: 'session-hash', account_id: 42 });
    const invitation = sql.prepare('SELECT token_hash, created_by FROM invites').get();
    assert.deepEqual(invitation, { token_hash: 'invite-token-hash', created_by: 42 });
    assert.equal(sql.pragma('table_info(accounts)').some(column => column.name === 'totp_secret'), false);
    assert.equal(sql.pragma('table_info(invites)').some(column => column.name === 'setup_secret'), false);
    assert.equal(sql.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name='bootstrap'").get().count, 0);
    assert.deepEqual(sql.pragma('foreign_key_check'), []);
    await service.onModuleDestroy();
    console.log('Legacy SQLite migration passed');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
