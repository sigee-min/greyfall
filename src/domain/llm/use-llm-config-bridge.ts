import { useEffect, useMemo, useRef, useState } from 'react';
import type { RegisterLobbyHandler, PublishLobbyMessage } from '../chat/use-chat-net-sync';
import type { ComputeBackend } from '../../llm/model-presets';

export type LlmConfigPayload = {
  modelId: string;
  backend: ComputeBackend;
};

export function useBroadcastLlmConfig(options: {
  enabled: boolean;
  payload: LlmConfigPayload;
  publish: PublishLobbyMessage;
}) {
  const { enabled, payload, publish } = options;
  const sentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const key = `${payload.modelId}:${payload.backend}`;
    if (sentRef.current === key) return;
    const ok = publish('llm:config', payload, 'llm-config');
    if (ok) sentRef.current = key;
  }, [enabled, payload, publish]);
}

export function useReceiveLlmConfig(options: { register: RegisterLobbyHandler }) {
  const { register } = options;
  const [state, setState] = useState<LlmConfigPayload | null>(null);

  useEffect(() => {
    return register('llm:config', (message) => {
      const body = message.body as LlmConfigPayload;
      if (typeof body?.modelId === 'string' && (body as any)?.backend) {
        setState({ modelId: body.modelId, backend: (body as any).backend });
      }
    });
  }, [register]);

  return useMemo(() => state, [state]);
}

