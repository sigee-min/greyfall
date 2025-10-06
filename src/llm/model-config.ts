// Code-level model overrides for WebLLM.
// Edit this file to pin custom model ids or provide an appConfig with custom artifact URLs.
// No environment variables required.

import type { LlmManagerKind } from './webllm-engine';

export type ModelRegistryConfig = {
  // Ordered list of candidate model ids; first that initialises wins.
  ids?: string[];
  // Optional custom appConfig to register models not present in WebLLM's default registry.
  // Example shape:
  // {
  //   model_list: [
  //     { model_id: 'MyCustom-7B-Instruct-q4f16_1-MLC', model_url: 'https://cdn.example.com/mlc/MyCustom-7B/' }
  //   ]
  // }
  appConfig?: Record<string, unknown>;
};

export const MODEL_OVERRIDES: Partial<Record<LlmManagerKind, ModelRegistryConfig>> = {
  // fast → Gemma 2 2B Instruct (q4f16_1)
  fast: {
    ids: ['gemma-2-2b-it-q4f16_1-MLC'],
    appConfig: {
      useIndexedDBCache: false,
      model_list: [
        {
          model: 'https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC',
          model_id: 'gemma-2-2b-it-q4f16_1-MLC',
          model_lib:
            'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm',
          overrides: { context_window_size: 4096 }
        }
      ]
    }
  },
  // smart → Gemma 2 9B Instruct (q4f16_1)
  smart: {
    ids: ['gemma-2-9b-it-q4f16_1-MLC'],
    appConfig: {
      useIndexedDBCache: false,
      model_list: [
        {
          model: 'https://huggingface.co/mlc-ai/gemma-2-9b-it-q4f16_1-MLC',
          model_id: 'gemma-2-9b-it-q4f16_1-MLC',
          model_lib:
            'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48/gemma-2-9b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm',
          overrides: { context_window_size: 4096 }
        }
      ]
    }
  }
};
