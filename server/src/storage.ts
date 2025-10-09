import { createReadStream, createWriteStream, statSync, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import type { AppConfig } from './config.js';
import type { IndexEntry, LlmLogRecord } from './types.js';
import { sanitizeType, utcDateFolder } from './utils.js';

export type AppendResult = { file: string; rev: number };

export class LlmStorage {
  constructor(private cfg: AppConfig) {}

  private dateDir(dateStr: string) {
    return resolve(this.cfg.dataRoot, dateStr);
  }

  private indexDir(dateStr: string) {
    return resolve(this.dateDir(dateStr), '_index');
  }

  private indexPath(dateStr: string, type: string) {
    return resolve(this.indexDir(dateStr), `${sanitizeType(type)}.index.json`);
  }

  private async ensureDateDirs(dateStr: string) {
    await mkdir(this.dateDir(dateStr), { recursive: true });
    await mkdir(this.indexDir(dateStr), { recursive: true });
  }

  private async listRotatedFiles(dateStr: string, type: string): Promise<string[]> {
    const dir = this.dateDir(dateStr);
    const base = `${sanitizeType(type)}.json`;
    const files = await readdir(dir).catch(() => [] as string[]);
    return files
      .filter((f) => f === base || f.startsWith(`${sanitizeType(type)}-`) && f.endsWith('.json'))
      .sort();
  }

  private async pickActiveFile(dateStr: string, type: string): Promise<string> {
    const files = await this.listRotatedFiles(dateStr, type);
    if (files.length === 0) return `${sanitizeType(type)}.json`;
    return files[files.length - 1];
  }

  private async rotateIfNeeded(dateStr: string, type: string, file: string): Promise<string> {
    const full = resolve(this.dateDir(dateStr), file);
    try {
      const st = statSync(full);
      if (st.size < this.cfg.maxFileSizeBytes) return file;
    } catch {
      return file; // not exists yet
    }
    // rotate: find next suffix
    const dir = this.dateDir(dateStr);
    const baseName = sanitizeType(type);
    const files = await this.listRotatedFiles(dateStr, type);
    const maxIdx = files
      .map((f) => {
        const m = new RegExp(`^${baseName}-(\\d{4})\\.json$`).exec(f);
        return m ? Number(m[1]) : 0;
      })
      .reduce((a, b) => Math.max(a, b), 0);
    const next = `${baseName}-${String(maxIdx + 1).padStart(4, '0')}.json`;
    return next;
  }

  private async readIndex(dateStr: string, type: string): Promise<Record<string, IndexEntry>> {
    const path = this.indexPath(dateStr, type);
    try {
      const buf = await readFile(path, 'utf8');
      return JSON.parse(buf) as Record<string, IndexEntry>;
    } catch {
      return {};
    }
  }

  private async writeIndex(dateStr: string, type: string, idx: Record<string, IndexEntry>): Promise<void> {
    const path = this.indexPath(dateStr, type);
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(idx), 'utf8');
    await rename(tmp, path);
  }

  async append(dateStr: string, type: string, record: LlmLogRecord): Promise<AppendResult> {
    await this.ensureDateDirs(dateStr);
    const dir = this.dateDir(dateStr);
    const active = await this.pickActiveFile(dateStr, type);
    const file = await this.rotateIfNeeded(dateStr, type, active);
    const full = resolve(dir, file);
    await new Promise<void>((resolveWrite, reject) => {
      const out = createWriteStream(full, { flags: 'a' });
      out.on('error', reject);
      out.on('finish', () => resolveWrite());
      out.end(JSON.stringify(record) + '\n');
    });

    const idx = await this.readIndex(dateStr, type);
    const prev = idx[record.request_id];
    idx[record.request_id] = {
      file: basename(full),
      rev: record.rev,
      tombstone: record.op === 'delete' ? true : prev?.tombstone && record.op !== 'create' ? prev.tombstone : false,
      lastUpdated: Date.now(),
    };
    await this.writeIndex(dateStr, type, idx);
    return { file: basename(full), rev: record.rev };
  }

  async getLatestIndex(dateStr: string, type: string, id: string): Promise<IndexEntry | null> {
    const idx = await this.readIndex(dateStr, type);
    return idx[id] || null;
  }

  async listDates(): Promise<string[]> {
    const entries = await readdir(this.cfg.dataRoot).catch(() => [] as string[]);
    return entries.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e)).sort();
  }

  async listTypes(dateStr: string): Promise<string[]> {
    const dir = this.dateDir(dateStr);
    const entries = await readdir(dir).catch(() => [] as string[]);
    return entries
      .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      .map((f) => f.replace(/-(\d{4})\.json$/, '.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
  }

  async readRecords(dateStr: string, type: string): Promise<LlmLogRecord[]> {
    const files = await this.listRotatedFiles(dateStr, type);
    const dir = this.dateDir(dateStr);
    const out: LlmLogRecord[] = [];
    for (const f of files) {
      const full = resolve(dir, f);
      const data = await readFile(full, 'utf8').catch(() => '');
      if (!data) continue;
      const lines = data.split(/\n/).filter(Boolean);
      for (const line of lines) {
        try {
          out.push(JSON.parse(line));
        } catch {}
      }
    }
    return out;
  }
}

