import type { Intent } from './intent';

export function sketchPlan(intent: Intent, memoryFact?: string): string[] {
  const lines: string[] = [];
  switch (intent) {
    case 'greet':
      lines.push('인사를 받아들인다');
      lines.push('간단히 되묻거나 정보 제공을 제안한다');
      break;
    case 'ask':
      lines.push('질문 요지를 짧게 확인한다');
      lines.push('현재 상황에 맞는 핵심 답을 제공한다');
      break;
    case 'request':
      lines.push('요청의 가능 여부를 판단한다');
      lines.push('가능하면 수락/조건 제시, 불가면 대안 제시');
      break;
    default:
      lines.push('짧게 반응하고 다음 행동을 유도한다');
  }
  if (memoryFact) lines.push(`관련 기억을 한 줄 언급: ${memoryFact.slice(0, 24)}`);
  return lines.slice(0, 3);
}

