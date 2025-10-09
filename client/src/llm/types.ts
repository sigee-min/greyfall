export type ProgressReport = {
  // Optional run identifier to correlate events within a single initialisation/generation run
  runId?: string | null;
  text?: string | null;
  progress?: number | null;
  // Optional phase label for future multi-backend mapping
  phase?: string | null;
};
