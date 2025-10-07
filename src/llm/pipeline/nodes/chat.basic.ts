import type { NodeTemplate } from '../types';

export const ChatBasicNode: NodeTemplate = {
  id: 'chat.basic',
  doc: '단순 대화: 시스템 역할 + 유저 메시지. 한국어 간결 응답.',
  prompt: {
    systemTpl: '${persona}\n\n응답은 간결하고 정확한 한국어로만 작성합니다.',
    userTpl: '${userSuffix}'
  },
  options: {
    temperature: 0.7,
    maxTokens: 512,
    timeoutMs: 20000
  }
};

