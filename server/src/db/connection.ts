import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { AppConfig } from '../config.js';

let dbInstance: Database.Database | null = null;

export async function getDb(cfg: AppConfig): Promise<Database.Database> {
  if (dbInstance) return dbInstance;
  const dbPath = join(cfg.dataRoot, 'db', 'app.sqlite');
  await mkdir(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');
  db.pragma('busy_timeout = 5000');
  dbInstance = db;
  return dbInstance;
}

export function closeDb() {
  try { dbInstance?.close(); } catch {}
  dbInstance = null;
}

