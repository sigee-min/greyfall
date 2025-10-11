import type { Quest } from '../../domain/quest/types';

export const TutorialQuest: Quest = {
  id: 'q.tutorial.1',
  title: '튜토리얼 — 첫 임무',
  summary: '로비에서 준비를 마치고 출격 절차를 익히세요.',
  stages: [
    {
      id: 'stage.1',
      title: '도움말 단말 확인',
      objectives: [
        { id: 'obj.visit.terminal', kind: 'visit', target: 'location.help.terminal', description: '도움말 단말에 접근' }
      ],
      next: 'stage.2'
    },
    {
      id: 'stage.2',
      title: '장비 점검',
      objectives: [
        { id: 'obj.collect.medkit', kind: 'collect', target: 'item.medkit', count: 1, description: '구급 키트 획득' }
      ],
      next: 'stage.3'
    },
    {
      id: 'stage.3',
      title: '브리핑 청취',
      objectives: [
        { id: 'obj.talk.brief', kind: 'talk', target: 'npc.brief.officer', description: '지휘관에게 브리핑 받기' }
      ]
    }
  ],
  rewards: [{ kind: 'xp', amount: 100 }]
};

