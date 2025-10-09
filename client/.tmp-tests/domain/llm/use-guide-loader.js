import { useMemo } from 'react';
// No-LLM stub: immediately ready, no progress bar.
export function useGuideLoader(_options) {
    return useMemo(() => ({ ready: true, progress: null, status: null, error: null, history: [] }), []);
}
