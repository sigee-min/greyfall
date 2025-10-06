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
  // Pin the 'fast' manager to Gemma 3 4B IT (q4bf16_1) hosted on Hugging Face
  // Ref: https://huggingface.co/mlc-ai/gemma-3-4b-it-q4bf16_1-MLC
  fast: {
    ids: ['gemma-3-4b-it-q4bf16_1-MLC'],
    appConfig: {
      useIndexedDBCache: false,
      model_list: [
        {
          // Hugging Face repository for the model artifacts
          model: 'https://huggingface.co/mlc-ai/gemma-3-4b-it-q4bf16_1-MLC',
          // The model id WebLLM will use
          model_id: 'gemma-3-4b-it-q4bf16_1-MLC',
          // Prebuilt model library (WASM) compatible with current WebLLM version
          model_lib:
            'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48/gemma-3-4b-it-q4bf16_1-ctx4k_cs1k-webgpu.wasm',
          // Optional runtime overrides mirrored from mlc-chat-config.json
          overrides: {
            context_window_size: 4096
          }
        }
      ]
    }
  }
};
