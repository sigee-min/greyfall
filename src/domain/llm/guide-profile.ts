import type { LlmManagerKind } from '../../llm/webllm-engine';

export function guideDisplayName(kind: LlmManagerKind): string {
  switch (kind) {
    case 'hasty':
      return '강림';
    case 'fast':
      return '백무상';
    case 'smart':
      return '흑무상';
    default:
      return '심판자';
  }
}
