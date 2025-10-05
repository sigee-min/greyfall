export type LlmCardChoice = {
  id: string;
  label: string;
  risk: string;
  target: number;
};

export type LlmCardResponse = {
  promptId: string;
  narrative: string;
  choices: LlmCardChoice[];
};

export type CardPrompt = {
  scene: string;
  intent: string;
  constraints?: string[];
};

export async function requestChoices(_prompt: CardPrompt): Promise<LlmCardResponse> {
  if (!('gpu' in navigator)) {
    throw new Error('WebGPU unavailable – cannot run local LLM.');
  }

  // Placeholder: integrate WebLLM runtime here.
  return {
    promptId: crypto.randomUUID(),
    narrative: 'The model is offline. Use manual narration.',
    choices: [
      { id: 'fallback-1', label: 'Maintain position and observe', risk: 'time', target: 10 },
      { id: 'fallback-2', label: 'Advance cautiously', risk: 'noise', target: 13 }
    ]
  };
}
