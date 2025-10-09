import { useMemo } from 'react';
import type { LlmManagerKind } from '../../llm/llm-engine';

export type GuideLoaderState = {
  ready: boolean;
  progress: number | null;
  status: string | null;
  error: string | null;
  history: string[];
};

// No-LLM stub: immediately ready, no progress bar.
export function useGuideLoader(_options: { manager: LlmManagerKind; enabled?: boolean }): GuideLoaderState {
  return useMemo(() => ({ ready: true, progress: null, status: null, error: null, history: [] }), []);
}
