// Command alias/normalisation to make models robust to user chat conventions
// Maps common variants like "/start" -> "mission.start"

export function normaliseCmdAlias(input: string, allowed: Set<string>): string {
  let s = String(input || '').trim();
  // strip leading slash or punctuation commonly used in chat bots
  if (s.startsWith('/')) s = s.slice(1);
  s = s.replace(/\s+/g, '').toLowerCase();

  const map: Record<string, string> = {
    // mission.start
    start: 'mission.start',
    missionstart: 'mission.start',
    mission_start: 'mission.start',
    begin: 'mission.start',
    launch: 'mission.start',
    시작: 'mission.start',
    출발: 'mission.start',
    시작해: 'mission.start',

    // readyz
    ready: 'llm.readyz',
    readyz: 'llm.readyz',
    health: 'llm.readyz',
    ping: 'llm.readyz',
    status: 'llm.readyz',
    준비: 'llm.readyz',
    상태: 'llm.readyz',

    // chat
    chat: 'chat',
    say: 'chat',
    message: 'chat',
    speak: 'chat',
    reply: 'chat',
    대화: 'chat',
    말해: 'chat',
    말: 'chat',
    응답: 'chat',
    메시지: 'chat'
  };

  const candidate = map[s] ?? s;
  return allowed.has(candidate) ? candidate : s;
}

