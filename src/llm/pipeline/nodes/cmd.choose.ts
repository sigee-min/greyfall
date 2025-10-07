import type { NodeTemplate, PipelineCtx } from '../types';
import { summariseAllowed } from '../../../domain/ai/gateway/prompts';
import { parseAICommand } from '../../../domain/ai/ai-router';

export const CmdChooseNode: NodeTemplate = {
  id: 'cmd.choose',
  doc: '허용된 명령 목록 중 하나를 JSON 한 줄 {"cmd":"..."}로 선택',
  prompt: {
    systemTpl: [
      '역할: 실시간 게임 진행 보조자(심판자) — 간결하고 안전하게 명령만 선택합니다.',
      '가능한 명령과 설명:',
      '${capabilitiesDoc}',
      '허용 명령(cmd): ${allowedCmdsText}',
      '명령(cmd)은 위의 목록과 "정확히 동일한" 문자열만 허용됩니다.',
      '오직 유효한 JSON 객체 한 줄로만 출력하세요. 코드 블록/설명 금지.',
      '{"cmd":"<명령>"}'
    ].join('\n'),
    userTpl: ''
  },
  options: {
    temperature: 0,
    maxTokens: 24,
    timeoutMs: 8000
  },
  validate: async (raw: string, ctx: PipelineCtx) => {
    const parsed = parseAICommand(raw);
    const { allowedSet } = summariseAllowed();
    if (parsed && allowedSet.has(parsed.cmd)) {
      // record into ctx for downstream
      ctx.scratch.chosenCmd = parsed.cmd;
      return { ok: true, fixed: raw };
    }
    return { ok: false, error: 'invalid-cmd' };
  }
};

