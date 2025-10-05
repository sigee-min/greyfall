import { useEffect, useRef, useState } from 'react';
import type { LlmManagerKind } from '../../llm/qwen-webgpu';
// LLM 모듈은 동적 import로 지연 로딩합니다.

export type GuideLoaderState = {
  ready: boolean;
  progress: number | null;
  status: string | null;
  error: string | null;
};

export function useGuideLoader(options: { manager: LlmManagerKind; enabled?: boolean }): GuideLoaderState {
  const { manager, enabled = true } = options;

  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const [seq, setSeq] = useState(0);
  const lastUpdateAtRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    const run = async () => {
      try {
        setReady(false);
        setError(null);
        setProgress(0);
        setStatus(null);
        lastUpdateAtRef.current = Date.now();

        const { loadQwenEngineByManager, ensureChatApiReady, probeChatApiActive, resetQwenEngine } = await import('../../llm/qwen-webgpu');
        await loadQwenEngineByManager(manager, (report: { text?: string; progress?: number }) => {
          if (cancelled) return;
          setProgress((prev) => {
            const p = typeof report.progress === 'number' ? report.progress : undefined;
            if (p === undefined || Number.isNaN(p)) return prev ?? 0;
            const clamped = Math.min(1, Math.max(0, p));
            return Math.max(prev ?? 0, clamped);
          });
          if (report.text) setStatus(report.text);
          lastUpdateAtRef.current = Date.now();
        });
        // Ensure chat API is actually callable before reporting ready
        await ensureChatApiReady(8000);
        // Active probe to avoid proxy timing race
        if (!(await probeChatApiActive(1200))) {
          await new Promise((r) => setTimeout(r, 300));
        }

        if (cancelled) return;
        setReady(true);
        setProgress(null); // 완료 시 바 숨김
        setStatus(null);
        attemptsRef.current = 0;
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus(msg);
        setReady(false);
        startedRef.current = false; // 재시도 허용
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, manager, seq]);

  // Watchdog: 진행 업데이트가 오래 없으면 자동 재시도(최대 2회)
  useEffect(() => {
    if (!enabled) return;
    if (ready || error) return;
    const id = window.setInterval(() => {
      const last = lastUpdateAtRef.current;
      if (!startedRef.current) return;
      if (last == null) return;
      const elapsed = Date.now() - last;
      if (elapsed > 30000 && attemptsRef.current < 2) {
        // 30초 이상 진전이 없으면 재시도
        attemptsRef.current += 1;
        setStatus('진행이 지연되어 재시도합니다…');
        // 동적 임포트 스코프 바깥이므로 비동기로 호출
        void (async () => {
          try {
            const mod = await import('../../llm/qwen-webgpu');
            mod.resetQwenEngine();
          } catch {
            // ignore
          }
        })();
        startedRef.current = false;
        setProgress(0);
        setSeq((n) => n + 1);
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [enabled, ready, error]);

  return { ready, progress, status, error };
}
