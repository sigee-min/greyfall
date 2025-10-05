import { useMemo } from 'react';

export function useChatUiState(channelOpen: boolean) {
  const placeholder = useMemo(() => {
    if (!channelOpen) {
      return '세션 연결 대기 중… (보내면 연결 후 전송됩니다)';
    }
    return '메시지를 입력하세요 (Shift+Enter로 줄바꿈)';
  }, [channelOpen]);

  return { placeholder } as const;
}

