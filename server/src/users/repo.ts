import type Database from 'better-sqlite3';
import type { User, GoogleProfile } from './types.js';

function sha256Hex(input: string): string {
  try {
    // lightweight sync hash using Node crypto
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('node:crypto');
    return crypto.createHash('sha256').update(input).digest('hex');
  } catch {
    return input;
  }
}

export function upsertFromGoogle(db: Database.Database, profile: GoogleProfile, role: string): User {
  const now = Date.now();
  const emailHash = profile.email ? sha256Hex(profile.email.toLowerCase()) : null;
  db.prepare(
    `INSERT INTO users (sub, provider, email_hash, name, picture, role, created_at, last_login_at, last_seen_at)
     VALUES (@sub, 'google', @email_hash, @name, @picture, @role, @created_at, @last_login_at, @last_seen_at)
     ON CONFLICT(sub) DO UPDATE SET
       email_hash=excluded.email_hash,
       name=excluded.name,
       picture=excluded.picture,
       role=CASE WHEN users.role IN ('admin','sysadmin') THEN users.role ELSE excluded.role END,
       last_login_at=excluded.last_login_at,
       last_seen_at=excluded.last_seen_at`)
    .run({ sub: profile.sub, email_hash: emailHash, name: profile.name ?? null, picture: profile.picture ?? null, role, created_at: now, last_login_at: now, last_seen_at: now });
  const row = db.prepare('SELECT * FROM users WHERE sub=?').get(profile.sub) as User;
  return row;
}

export function getBySub(db: Database.Database, sub: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE sub=?').get(sub) as User | undefined;
  return row ?? null;
}

export function touchLastSeen(db: Database.Database, sub: string): void {
  db.prepare('UPDATE users SET last_seen_at=? WHERE sub=?').run(Date.now(), sub);
}

export function listUsers(
  db: Database.Database,
  limit = 50,
  offset = 0,
  opts?: { q?: string | null; sort?: 'id' | 'name' | 'role'; order?: 'asc' | 'desc' }
): Array<Pick<User, 'id' | 'name' | 'picture' | 'role'>> {
  const q = (opts?.q || '').trim();
  const sortCol = (opts?.sort || 'id');
  const order = (opts?.order || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const where = q ? 'WHERE name LIKE ?' : '';
  const sql = `SELECT id, name, picture, role FROM users ${where} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
  const rows = q
    ? (db.prepare(sql).all(`%${q}%`, limit, offset) as Array<Pick<User, 'id' | 'name' | 'picture' | 'role'>>)
    : (db.prepare(sql).all(limit, offset) as Array<Pick<User, 'id' | 'name' | 'picture' | 'role'>>);
  return rows;
}

export function countUsers(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(1) as c FROM users').get() as { c: number };
  return Number(row?.c ?? 0);
}

export function updateUserRole(db: Database.Database, id: number, role: 'user' | 'admin' | 'sysadmin'): boolean {
  const info = db.prepare('UPDATE users SET role=? WHERE id=?').run(role, id);
  return Number(info.changes || 0) > 0;
}

export function getById(db: Database.Database, id: number): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id=?').get(id) as User | undefined;
  return row ?? null;
}

export function countByRole(db: Database.Database, role: 'user' | 'admin' | 'sysadmin'): number {
  const row = db.prepare('SELECT COUNT(1) as c FROM users WHERE role=?').get(role) as { c: number };
  return Number(row?.c ?? 0);
}
