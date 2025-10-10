import type { AppConfig } from '../config.js';
import { getDb } from '../db/connection.js';
import { upsertFromGoogle, getBySub, touchLastSeen, countUsers, updateUserRole, getById, countByRole } from './repo.js';
import type { GoogleProfile, User, Role } from './types.js';

function parseList(env: string | undefined): string[] {
  return (env || '')
    .split(/[;,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function decideRole(gp: GoogleProfile): Role {
  const sysadmins = parseList(process.env.SYSADMIN_EMAILS);
  const admins = parseList(process.env.ADMIN_EMAILS);
  const domains = parseList(process.env.ALLOWED_EMAIL_DOMAINS);
  const email = (gp.email || '').toLowerCase();
  if (email && sysadmins.includes(email)) return 'sysadmin';
  if (email && admins.includes(email)) return 'admin';
  if (email && domains.some((d) => email.endsWith(`@${d}`))) return 'user';
  return 'user';
}

export async function upsertGoogleUser(cfg: AppConfig, gp: GoogleProfile): Promise<User> {
  const db = await getDb(cfg);
  const existing = countUsers(db);
  const role: Role = existing === 0 ? 'sysadmin' : decideRole(gp);
  const u = upsertFromGoogle(db, gp, role);
  return u;
}

export async function getUserProfile(cfg: AppConfig, sub: string): Promise<Pick<User, 'id' | 'name' | 'picture' | 'role'> | null> {
  const db = await getDb(cfg);
  const u = getBySub(db, sub);
  if (!u) return null;
  touchLastSeen(db, sub);
  return { id: u.id, name: u.name, picture: u.picture, role: (u.role as any) };
}

export async function setUserRole(cfg: AppConfig, id: number, role: Role): Promise<boolean> {
  const db = await getDb(cfg);
  const current = getById(db, id);
  if (!current) return false;
  if (String(current.role) === 'sysadmin' && role !== 'sysadmin') {
    const sysadmins = countByRole(db, 'sysadmin');
    if (sysadmins <= 1) {
      // Prevent removing the last sysadmin
      throw Object.assign(new Error('Cannot demote the last sysadmin'), { code: 'LAST_SYSADMIN' });
    }
  }
  return updateUserRole(db, id, role);
}
