import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export type AppConfig = {
  port: number;
  dataRoot: string;
  maxFileSizeBytes: number; // rotation threshold
  // session-only auth
  jwtSecret: string;
  sessionTtlSec: number;
  cookieName: string;
  refreshSkewSec: number; // seconds before expiry to refresh
};

export async function loadConfig(): Promise<AppConfig> {
  // Dedicated server port to avoid clashes with other services
  const port = Number(process.env.SERVER_PORT || 8080);
  const dataRoot = process.env.DATA_ROOT || join(process.cwd(), 'data');
  const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 100);
  const maxFileSizeBytes = Math.max(1, maxFileSizeMb) * 1024 * 1024;
  const jwtSecret = process.env.JWT_SECRET || 'change-me';
  const sessionTtlSec = Number(process.env.SESSION_TTL_SEC || 60 * 60 * 5); // default 5h
  // Fix session cookie name to GREYFALLID (no env override)
  const cookieName = 'GREYFALLID';
  const refreshSkewSec = Number(process.env.SESSION_REFRESH_SKEW_SEC || 900); // default 15m
  await mkdir(dataRoot, { recursive: true });
  return { port, dataRoot, maxFileSizeBytes, jwtSecret, sessionTtlSec, cookieName, refreshSkewSec };
}
