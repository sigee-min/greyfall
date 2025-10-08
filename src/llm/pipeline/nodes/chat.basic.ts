import type { NodeTemplate } from '../types';

export const ChatBasicNode: NodeTemplate = {
  id: 'chat.basic',
  doc: '단순 대화: 시스템 역할(페르소나/컨텍스트) + 유저 메시지.',
  prompt: {
    systemTpl: '${persona}\n\n${systemSuffix}',
    userTpl: '${userSuffix}'
  },
  options: {
    temperature: 0.7,
    maxTokens: 512,
    timeoutMs: 20000
  }
};
