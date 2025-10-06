import { commandRegistry } from '../command-registry';

export type AllowedSummary = {
  allowedList: string[];
  allowedSet: Set<string>;
  allowedCmdsText: string;
  capabilitiesDoc: string;
};

export function summariseAllowed(): AllowedSummary {
  const list = commandRegistry.list();
  const allowedList = list.map((c) => c.cmd);
  const allowedCmdsText = allowedList.join(' | ');
  const allowedSet = new Set(allowedList);
  const capabilitiesDoc = list
    .map((c) => `- ${c.cmd}: ${c.doc}`)
    .join('\n');
  return { allowedList, allowedSet, allowedCmdsText, capabilitiesDoc };
}

export function buildTwoPhaseCmdPrompt(allowedCmdsText: string): string {
  return [
    '역할: 실시간 게임 진행 보조자(심판자) — 간결하고 안전하게 명령만 선택합니다.',
    `허용 명령(cmd): ${allowedCmdsText}`,
    '아래 형식의 JSON 한 줄로만 출력하세요:',
    '{"cmd":"<명령>"}',
    '설명이나 추가 텍스트는 쓰지 마세요.'
  ].join('\\n');
}

export function buildTwoPhaseBodyPrompt(chosenCmd: string): string {
  let bodyHint = '';
  if (chosenCmd === 'chat') bodyHint = 'body는 string (메시지 텍스트) 입니다.';
  else if (chosenCmd === 'llm.readyz') bodyHint = 'body는 string, 임의의 값이어도 됩니다.';
  else if (chosenCmd === 'mission.start') bodyHint = 'body는 비워도 됩니다(null 또는 빈 객체).';
  return [
    '역할: 실시간 게임 진행 보조자(심판자) — 간결하고 안전하게 명령만 선택합니다.',
    `선택한 명령(cmd): ${chosenCmd}`,
    bodyHint,
    '아래 형식의 JSON 한 줄로만 출력하세요:',
    '{"cmd":"<명령>","body":<고정타입>}'
  ].join('\\n');
}

export function buildScorePrompts(allowedCmdsText: string, userPrompt: string, outJson: string): { sys: string; user: string } {
  const sys = '너는 출력 검토관이다. 아래 JSON 출력이 사용자 요청과 규칙을 따르는지 0~10점으로 평가하고, JSON 한 줄로만 돌려줘: {"score": <0..10>, "reason": "..."}';
  const user = [
    '허용 명령(cmd): ' + allowedCmdsText,
    '사용자 요청:',
    userPrompt,
    '생성된 출력(JSON):',
    outJson
  ].join('\\n');
  return { sys, user };
}

