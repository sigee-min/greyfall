import { useEffect, useRef, useState } from 'react';
import { getActiveModelPreset } from '../../llm/engine-selection';
import type { LlmManagerKind } from '../../llm/webllm-engine';
// LLM 모듈은 동적 import로 지연 로딩합니다.

export type GuideLoaderState = {
  ready: boolean;
  progress: number | null;
  status: string | null;
  error: string | null;
  history: string[];
};

export function useGuideLoader(options: { manager: LlmManagerKind; enabled?: boolean }): GuideLoaderState {
  const { manager, enabled = true } = options;

  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const startedRef = useRef(false);
  const [seq, setSeq] = useState(0);
  const lastUpdateAtRef = useRef<number | null>(null);

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
        setHistory([]);
        lastUpdateAtRef.current = Date.now();

        const { loadEngineByManager, ensureChatApiReady, probeChatApiActive } = await import('../../llm/webllm-engine');
        const presetBackend = getActiveModelPreset()?.backend;
        const onProgress = (report: { text?: string; progress?: number }) => {
          if (cancelled) return;
          setProgress((prev) => {
            const p = typeof report.progress === 'number' ? report.progress : undefined;
            if (p === undefined || Number.isNaN(p)) return prev ?? 0;
            const clamped = Math.min(1, Math.max(0, p));
            return Math.max(prev ?? 0, clamped);
          });
          if (report.text) {
            const txt = report.text as string;
            setStatus(txt);
            setHistory((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (txt !== last) next.push(txt);
              return next.slice(-8);
            });
          }
          lastUpdateAtRef.current = Date.now();
        };
        await loadEngineByManager(manager, onProgress as any);
        // Ensure chat API is actually callable before reporting ready
        const onEnsure = (report: { text?: string; progress?: number }) => {
          if (cancelled) return;
          if (report.text) {
            const txt = report.text as string;
            setStatus(txt);
            setHistory((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (txt !== last) next.push(txt);
              return next.slice(-8);
            });
          }
          if (typeof report.progress === 'number') {
            setProgress((prev) => Math.max(prev ?? 0, Math.min(1, Math.max(0, report.progress!))));
          }
          lastUpdateAtRef.current = Date.now();
        };
        await ensureChatApiReady(manager, 1_800_000, onEnsure as any);

        if (presetBackend === 'cpu') {
          if (cancelled) return;
          setReady(true);
          setProgress(null);
          setStatus(null);
        } else {
          // GPU: keep existing behaviour
          // Active probe to avoid proxy timing race (single check; no auto-retries)
          if (!(await probeChatApiActive(1200))) {
            const note = '상태를 확인하는 중이에요…';
            setHistory((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (note !== last) next.push(note);
              return next.slice(-8);
            });
          }

          if (cancelled) return;
          setReady(true);
          setProgress(null); // 완료 시 바 숨김
          setStatus(null);
        }
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

  
  return { ready, progress, status, error, history };
}
