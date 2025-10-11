export type PersonaContext = {
  name: string;
  archetype?: string;
  style?: string;
  goals?: string[];
  taboo?: string[];
};

export function buildSystemPrompt(persona: PersonaContext): string {
  const goals = (persona.goals ?? []).slice(0, 3).join(', ');
  const taboo = (persona.taboo ?? []).slice(0, 3).join(', ');
  return [
    `너는 ${persona.name}이다.`,
    persona.archetype ? `아키타입: ${persona.archetype}.` : '',
    persona.style ? `말투: ${persona.style}.` : '',
    goals ? `목표: ${goals}.` : '',
    taboo ? `금기: ${taboo}.` : ''
  ].filter(Boolean).join(' ');
}

export const SAFETY_PROMPT = '메타발화와 공격적 표현을 피하고, 설정을 벗어나지 말 것.';

