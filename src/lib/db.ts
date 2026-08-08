import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "graphloom.sqlite");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  dbInstance = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      provider TEXT NOT NULL DEFAULT 'personal',
      provider_subject TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'idle',
      last_sync_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tables_meta (
      id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS columns_meta (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL REFERENCES tables_meta(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      data_type TEXT NOT NULL DEFAULT 'text',
      sample_values_json TEXT NOT NULL DEFAULT '[]',
      distinct_count INTEGER NOT NULL DEFAULT 0,
      null_ratio REAL NOT NULL DEFAULT 0,
      description TEXT,
      is_pk INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS table_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id TEXT NOT NULL REFERENCES tables_meta(id) ON DELETE CASCADE,
      row_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_table_id TEXT NOT NULL,
      source_column_id TEXT NOT NULL,
      target_table_id TEXT NOT NULL,
      target_column_id TEXT NOT NULL,
      confidence REAL NOT NULL,
      overlap_ratio REAL NOT NULL,
      shared_values INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'suggested',
      rationale TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ontology_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      raw_text TEXT NOT NULL,
      parsed_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dictionary_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      name TEXT NOT NULL,
      definition TEXT NOT NULL,
      source TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
    CREATE INDEX IF NOT EXISTS idx_connectors_project ON connectors(project_id);
    CREATE INDEX IF NOT EXISTS idx_tables_project ON tables_meta(project_id);
    CREATE INDEX IF NOT EXISTS idx_columns_table ON columns_meta(table_id);
    CREATE INDEX IF NOT EXISTS idx_rows_table ON table_rows(table_id);
    CREATE INDEX IF NOT EXISTS idx_rel_project ON relationships(project_id);
    CREATE INDEX IF NOT EXISTS idx_dict_project ON dictionary_entries(project_id);
  `);
}

export function nowIso() {
  return new Date().toISOString();
}
