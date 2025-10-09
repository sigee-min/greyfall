import { createWithEqualityFn } from 'zustand/traditional';
const MAX_ERRORS = 8;
const initialSnapshot = {
    status: 'idle',
    completed: 0,
    total: 0,
    lastEntry: null,
    startedAt: null,
    finishedAt: null,
    errors: [],
};
export const useAssetPreloadStore = createWithEqualityFn((set) => ({
    ...initialSnapshot,
    manager: null,
    attachManager: (manager) => set({ manager }),
    handleEvent: (event) => set((prev) => {
        switch (event.type) {
            case 'status':
                return { ...prev, status: event.status };
            case 'start':
                return {
                    ...prev,
                    completed: 0,
                    total: event.total,
                    startedAt: prev.startedAt ?? Date.now(),
                    finishedAt: null,
                };
            case 'progress':
                return {
                    ...prev,
                    completed: event.completed,
                    total: event.total,
                    lastEntry: event.entry,
                };
            case 'error': {
                const error = {
                    url: event.entry.url,
                    message: event.error,
                    at: Date.now(),
                };
                const errors = [...prev.errors, error].slice(-MAX_ERRORS);
                return {
                    ...prev,
                    completed: event.completed,
                    total: event.total,
                    lastEntry: event.entry,
                    errors,
                };
            }
            case 'done':
                return {
                    ...prev,
                    status: 'done',
                    completed: event.completed,
                    total: event.total,
                    finishedAt: Date.now(),
                };
            default:
                return prev;
        }
    }),
    initialiseSnapshot: (plannedTotal) => set(() => ({
        status: 'running',
        completed: 0,
        total: plannedTotal,
        lastEntry: null,
        startedAt: Date.now(),
        finishedAt: null,
        errors: [],
    })),
    clearSnapshot: () => set(() => ({ ...initialSnapshot, manager: null })),
}));
export const selectAssetPreloadSnapshot = (state) => ({
    status: state.status,
    completed: state.completed,
    total: state.total,
    lastEntry: state.lastEntry,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    errors: state.errors,
});
export const selectAssetPreloadManager = (state) => state.manager;
