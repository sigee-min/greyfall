// Canonical prompt template helpers for request types.
// These are not wired into runtime by default; they serve as
// a single source for consistent system instructions across tasks.

export type Locale = 'ko' | 'en';

export type SectionBundle = Partial<{
  context: string;
  recentChat: string;
  requester: string; // single-line snapshot of requester (self)
  actors: string[];
  positions: string[];
  hazards: string[];
  rules: string[];
  inventory: string[];
  targetsEligible: string[]; // typed lines e.g., "heal:[p:bravo]"
  rolls: string[];
  effects: string[];
}>;

function joinLines(lines: string[] | undefined): string | null {
  if (!lines || lines.length === 0) return null;
  const filtered = lines.map((l) => String(l ?? '').trim()).filter(Boolean);
  return filtered.length ? filtered.join('\n') : null;
}

function addSection(buf: string[], title: string, content: string | null | undefined) {
  if (!content) return;
  buf.push(`${title}`);
  buf.push(content);
}

export function buildSystemFromSections(persona: string, sections: SectionBundle): string {
  const out: string[] = [];
  const p = (persona ?? '').trim();
  if (p) out.push(p);
  addSection(out, '맥락', (sections.context ?? '').trim() || null);
  addSection(out, '최근 채팅(최대 10개)', (sections.recentChat ?? '').trim() || null);
  addSection(out, '요청자', (sections.requester ?? '').trim() || null);
  addSection(out, '액터 목록', joinLines(sections.actors));
  addSection(out, '위치', joinLines(sections.positions));
  addSection(out, '지형/위험 요소', joinLines(sections.hazards));
  addSection(out, '규칙', joinLines(sections.rules));
  addSection(out, '인벤토리', joinLines(sections.inventory));
  addSection(out, '대상 후보', joinLines(sections.targetsEligible));
  addSection(out, 'Rolls', joinLines(sections.rolls));
  addSection(out, 'Effects', joinLines(sections.effects));
  return out.join('\n\n').trim();
}

export function planDirectives(locale: Locale = 'ko'): string {
  if (locale === 'en') {
    return [
      'Task: choose action/checks/hazards/targets only from the provided lists.',
      'Forbidden: numbers, dice results, HP changes, extra text.',
      'Output exactly one JSON object in a single line (no code blocks):',
      '{"action":"<id>","checks":["<id>"],"hazards":["<id>"],"targets":["<actorId>"],"item":"<key>","meta":{"reason":"..."}}'
    ].join('\n');
  }
  return [
    '과업: 제공된 목록에서 행동/검사/위험/대상만 선택합니다.',
    '금지: 숫자/주사위/HP 변경/추가 텍스트.',
    '출력: 한 줄 JSON 객체만(코드블록 금지):',
    '{"action":"<id>","checks":["<id>"],"hazards":["<id>"],"targets":["<actorId>"],"item":"<key>","meta":{"reason":"..."}}'
  ].join('\n');
}

export function narrateDirectives(locale: Locale = 'ko'): string {
  if (locale === 'en') {
    return [
      'Task: write 1–3 concise sentences describing the outcome.',
      'Use only the facts/numbers from Rolls/Effects. Do not invent details.'
    ].join('\n');
  }
  return [
    '과업: 결과를 1–3문장으로 간결히 서술합니다.',
    'Rolls/Effects에 있는 사실/수치만 인용하고 새로운 수치/사실은 만들지 않습니다.'
  ].join('\n');
}

export function briefDirectives(locale: Locale = 'ko'): string {
  return locale === 'en'
    ? 'Task: write a 1–3 sentence scene brief.'
    : '과업: 장면 요약을 1–3문장으로 작성합니다.';
}

export function detailDirectives(locale: Locale = 'ko'): string {
  return locale === 'en'
    ? 'Task: expand the highlighted element into 1–2 sentences.'
    : '과업: 지정된 요소를 1–2문장으로 확장합니다.';
}

export function rulesExtractDirectives(locale: Locale = 'ko'): string {
  if (locale === 'en') {
    return [
      'Task: suggest up to 3 rule keys relevant to the question.',
      'Output exactly one JSON line: {"keys":["..."]}'
    ].join('\n');
  }
  return [
    '과업: 질문과 관련된 규칙 키를 최대 3개 제안합니다.',
    '출력: 한 줄 JSON: {"keys":["..."]}'
  ].join('\n');
}

