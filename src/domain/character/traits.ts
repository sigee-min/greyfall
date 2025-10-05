import type { StatKey, TraitSpec } from '../../store/character';

export const TRAITS: TraitSpec[] = [
  {
    id: 'iron-grip',
    name: '강철 그립',
    cost: 3,
    statMods: { '근력': 2 },
    passives: [{ id: 'carry+', name: '운반 강화', description: '중장 장비 페널티 -1' }],
    description: '근력을 2 올리고, 중량 장비 페널티를 줄입니다.'
  },
  {
    id: 'sprinter',
    name: '질주자',
    cost: 3,
    statMods: { '운동신경': 2 },
    passives: [{ id: 'evade+', name: '회피 향상', description: '회피 판정 +1' }],
    description: '운동신경을 2 올리고, 회피 능력이 향상됩니다.'
  },
  {
    id: 'tinkerer',
    name: '수리공',
    cost: 3,
    statMods: { '손재주': 2 },
    passives: [{ id: 'repair+', name: '빠른 수리', description: '현장 수리 시간 25% 단축' }],
    description: '손재주를 2 올리고, 수리 속도가 빨라집니다.'
  },
  {
    id: 'medic',
    name: '의무병',
    cost: 3,
    statMods: { '의술': 2 },
    passives: [{ id: 'triage+', name: '신속 처치', description: '응급 처치 효과 +1' }],
    description: '의술을 2 올리고, 응급 처치가 강화됩니다.'
  },
  {
    id: 'engineer',
    name: '공학자',
    cost: 4,
    statMods: { '공학': 2, '손재주': 1 },
    passives: [{ id: 'blueprint+', name: '설계 이해', description: '복잡한 장치 난이도 -1' }],
    description: '공학 +2, 손재주 +1. 복잡한 장치 판정이 쉬워집니다.'
  },
  {
    id: 'insomnia',
    name: '불면증',
    cost: -3,
    passives: [{ id: 'regen-', name: '재생 저하', description: '체력 재생 -50%', negative: true }],
    description: '체력 재생이 50% 감소하는 대신 특성포인트를 3 회수합니다.'
  },
  {
    id: 'fragile',
    name: '허약 체질',
    cost: -2,
    statMods: { '근력': -1 },
    passives: [{ id: 'wound-', name: '상처 취약', description: '부상 판정 시 불리', negative: true }],
    description: '근력이 1 감소하고, 부상에 취약해지지만 포인트 2를 회수합니다.'
  },
  {
    id: 'steady-hands',
    name: '안정된 손',
    cost: 2,
    statMods: { '손재주': 1, '의술': 1 },
    passives: [{ id: 'stabilize+', name: '정밀 안정화', description: '정밀 작업 판정 +1' }],
    description: '손재주와 의술을 1씩 올리고, 정밀 작업 보너스를 얻습니다.'
  }
];

