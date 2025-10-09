import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export type AppConfig = {
  port: number;
  dataRoot: string;
  maxFileSizeBytes: number; // rotation threshold
  authEnabled: boolean;
  users: Record<string, string>; // username -> password (plaintext)
};

function parseUsers(envValue: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!envValue) return out;
  const pairs = envValue.split(/[;,]+/).map((s) => s.trim()).filter(Boolean);
  for (const p of pairs) {
    const [user, pass] = p.split(':');
    if (user && pass) out[user] = pass;
  }
  return out;
}

export async function loadConfig(): Promise<AppConfig> {
  const port = Number(process.env.PORT || 8080);
  const dataRoot = process.env.DATA_ROOT || join(process.cwd(), 'data', 'llm-logs');
  const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 100);
  const maxFileSizeBytes = Math.max(1, maxFileSizeMb) * 1024 * 1024;
  const authEnabled = String(process.env.AUTH_BASIC_ENABLED || 'true').toLowerCase() !== 'false';
  const users = parseUsers(process.env.AUTH_USERS || 'admin:admin');
  await mkdir(dataRoot, { recursive: true });
  return { port, dataRoot, maxFileSizeBytes, authEnabled, users };
}

