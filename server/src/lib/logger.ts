export type LogLevel = 'info' | 'warn' | 'error';

function format(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const base = { ts, level, message } as Record<string, unknown>;
  const line = JSON.stringify(meta ? { ...base, ...meta } : base);
  return line;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    try { console.log(format('info', message, meta)); } catch { /* noop */ }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    try { console.warn(format('warn', message, meta)); } catch { /* noop */ }
  },
  error(message: string, meta?: Record<string, unknown>) {
    try { console.error(format('error', message, meta)); } catch { /* noop */ }
  }
};

export function genRequestId(): string {
  try {
    const rnd = Math.random().toString(36).slice(2, 8);
    const t = Date.now().toString(36);
    return `${t}${rnd}`.toUpperCase();
  } catch {
    return String(Date.now());
  }
}

