import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { AppConfig } from '../config.js';
import { getDb } from './connection.js';

function parseMigration(filePath: string): { version: string; up: string } {
  const name = filePath.split('/').pop() as string;
  const version = name.replace(/\.sql$/, '');
  const raw = readFileSync(filePath, 'utf8');
  const up = raw.split(/--\s*down[\s\S]*/i)[0].replace(/--\s*up\s*/i, '').trim();
  return { version, up };
}

export async function migrate(cfg: AppConfig): Promise<void> {
  const db = await getDb(cfg);
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL) WITHOUT ROWID;'
  );
  const applied = new Set<string>(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all().map((r: any) => r.version as string)
  );
  // Prefer bundled migrations under server/migrations; fallback to DATA_ROOT/db/migrations
  const primaryDir = join(process.cwd(), 'migrations');
  const fallbackDir = join(cfg.dataRoot, 'db', 'migrations');
  let files: string[] = [];
  try { files = readdirSync(primaryDir).filter((f) => f.endsWith('.sql')).sort().map((f) => join(primaryDir, f)); } catch { files = []; }
  if (files.length === 0) {
    try { files = readdirSync(fallbackDir).filter((f) => f.endsWith('.sql')).sort().map((f) => join(fallbackDir, f)); } catch { files = []; }
  }
  for (const file of files) {
    const { version, up } = parseMigration(file);
    if (applied.has(version)) continue;
    const tx = db.transaction(() => {
      if (up) db.exec(up);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, Date.now());
    });
    tx();
  }
}
