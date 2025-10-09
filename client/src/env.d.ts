declare global {
  interface ImportMetaEnv {
    readonly VITE_LLM_DEBUG?: string;
    readonly VITE_LLM_MAX_TOKENS?: string;
    readonly VITE_LLM_TIMEOUT_MS?: string;
    readonly VITE_LLM_COLD_TIMEOUT_MS?: string;
    readonly VITE_LLM_TWO_PHASE?: string;
    readonly VITE_LOGS_SERVER_URL?: string; // e.g., http://localhost:8080 (no trailing slash). Defaults to same-origin /api
    readonly VITE_LOGS_BASIC_USER?: string;
    readonly VITE_LOGS_BASIC_PASS?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
