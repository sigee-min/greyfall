import { useEffect, useRef, useState } from 'react';
import type { LlmManagerKind } from '../../llm/qwen-webgpu';
import { loadQwenEngineByManager } from '../../llm/qwen-webgpu';

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
        setStatus('엔진 초기화 중…');

        await loadQwenEngineByManager(manager, (report: { text?: string; progress?: number }) => {
          if (cancelled) return;
          setProgress((prev) => {
            const p = typeof report.progress === 'number' ? report.progress : undefined;
            if (p === undefined || Number.isNaN(p)) return prev ?? 0;
            const clamped = Math.min(1, Math.max(0, p));
            return Math.max(prev ?? 0, clamped);
          });
          if (report.text) setStatus(mapProgressText(report.text));
        });

        if (cancelled) return;
        setReady(true);
        setProgress(null); // 완료 시 바 숨김
        setStatus('엔진 준비 완료');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus('안내인 영입 실패');
        setReady(false);
        startedRef.current = false; // 재시도 허용
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, manager]);

  return { ready, progress, status, error };
}

function mapProgressText(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('download') || t.includes('fetch')) return '모델 내려받는 중…';
  if (t.includes('load tokenizer') || t.includes('token')) return '토크나이저 준비 중…';
  if (t.includes('compile') || t.includes('kernel') || t.includes('shader')) return 'WebGPU 컴파일 중…';
  if (t.includes('initialize') || t.includes('init') || t.includes('start')) return '엔진 초기화 중…';
  if (t.includes('warmup') || t.includes('prefill')) return '엔진 예열 중…';
  if (t.includes('finish') || t.includes('ready')) return '엔진 준비 완료';
  return '자료를 불러오는 중…';
}
