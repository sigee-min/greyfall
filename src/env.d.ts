declare global {
  interface ImportMetaEnv {
    readonly VITE_LLM_DEBUG?: string;
    readonly VITE_LLM_MAX_TOKENS?: string;
    readonly VITE_LLM_TIMEOUT_MS?: string;
    readonly VITE_LLM_COLD_TIMEOUT_MS?: string;
    readonly VITE_LLM_TWO_PHASE?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
