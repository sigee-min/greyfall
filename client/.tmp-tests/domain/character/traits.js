export const TRAITS = [
    {
        id: 'iron-grip',
        name: '강철 그립',
        cost: 3,
        statMods: { 'Strength': 2 },
        passives: [{ id: 'carry+', name: '운반 강화', description: '중장 장비 페널티 -1' }],
        notes: ['중량이 큰 아이템을 자주 다루는 조합에 적합합니다.'],
        synergy: ['bruiser 와 함께 근접 위협 플레이에 유리합니다.'],
        description: '근력을 2 올리고, 중량 장비 페널티를 줄입니다.'
    },
    {
        id: 'sprinter',
        name: '질주자',
        cost: 3,
        statMods: { 'Agility': 2 },
        passives: [{ id: 'evade+', name: '회피 향상', description: '회피 판정 +1' }],
        notes: ['정찰/기습 탈출 루트 확보에 용이합니다.'],
        synergy: ['acrobat 과 병행 시 이동 관련 체크가 더욱 안정적입니다.'],
        description: '운동신경을 2 올리고, 회피 능력이 향상됩니다.'
    },
    {
        id: 'tinkerer',
        name: '수리공',
        cost: 3,
        statMods: { 'Dexterity': 2 },
        passives: [{ id: 'repair+', name: '빠른 수리', description: '현장 수리 시간 25% 단축' }],
        notes: ['장비 유지보수 중심 플레이에 유리합니다.'],
        description: '손재주를 2 올리고, 수리 속도가 빨라집니다.'
    },
    {
        id: 'medic',
        name: '의무병',
        cost: 3,
        statMods: { 'Medicine': 2 },
        passives: [{ id: 'triage+', name: '신속 처치', description: '응급 처치 효과 +1' }],
        synergy: ['surgeon 과 조합 시 의료 관련 체크를 더욱 안정적으로 진행합니다.'],
        description: '의술을 2 올리고, 응급 처치가 강화됩니다.'
    },
    {
        id: 'engineer',
        name: '공학자',
        cost: 4,
        statMods: { 'Engineering': 2, 'Dexterity': 1 },
        passives: [{ id: 'blueprint+', name: '설계 이해', description: '복잡한 장치 난이도 -1' }],
        notes: ['장치 해제/조작 루트가 많은 맵에서 효율이 높습니다.'],
        description: '공학 +2, 손재주 +1. 복잡한 장치 판정이 쉬워집니다.'
    },
    {
        id: 'insomnia',
        name: '불면증',
        cost: -3,
        passives: [{ id: 'regen-', name: '재생 저하', description: '체력 재생 -50%', negative: true }],
        notes: ['자주 피해를 받는 빌드와는 상성이 좋지 않습니다.'],
        description: '체력 재생이 50% 감소하는 대신 특성포인트를 3 회수합니다.'
    },
    {
        id: 'fragile',
        name: '허약 체질',
        cost: -2,
        statMods: { 'Strength': -1 },
        passives: [{ id: 'wound-', name: '상처 취약', description: '부상 판정 시 불리', negative: true }],
        notes: ['전면 교전보다 보조/지원 역할을 추천합니다.'],
        description: '근력이 1 감소하고, 부상에 취약해지지만 포인트 2를 회수합니다.'
    },
    {
        id: 'steady-hands',
        name: '안정된 손',
        cost: 2,
        statMods: { 'Dexterity': 1, 'Medicine': 1 },
        passives: [{ id: 'stabilize+', name: '정밀 안정화', description: '정밀 작업 판정 +1' }],
        synergy: ['precision 계열 체크에서 시너지가 발생합니다.'],
        description: '손재주와 의술을 1씩 올리고, 정밀 작업 보너스를 얻습니다.'
    },
    {
        id: 'field-medic',
        name: '전장 위의 의사',
        cost: 4,
        statMods: { 'Medicine': 2, 'Agility': 1 },
        passives: [{ id: 'revive+', name: '응급 소생', description: '의무 처치 실패 시 1회 재시도' }],
        notes: ['팀 생존력 향상에 크게 기여합니다.'],
        description: '의술 +2, 운동신경 +1. 응급 소생 재시도 기회를 얻습니다.'
    },
    {
        id: 'gearhead',
        name: '기박이',
        cost: 2,
        statMods: { 'Engineering': 1, 'Dexterity': 1 },
        passives: [{ id: 'jam-', name: '고장 방지', description: '장비 고장 확률 -15%' }],
        synergy: ['tinkerer 와의 조합으로 장비 관련 리스크를 낮춥니다.'],
        description: '공학/손재주 +1, 장비 고장이 덜 발생합니다.'
    },
    {
        id: 'bruiser',
        name: '난폭자',
        cost: 3,
        statMods: { 'Strength': 2 },
        passives: [{ id: 'intimidate+', name: '위협', description: '위협 판정 +1' }],
        notes: ['근접 제압/위협 기반의 전술과 궁합이 좋습니다.'],
        description: '근력이 2 증가하고 위협 판정이 유리합니다.'
    },
    {
        id: 'acrobat',
        name: '곡예사',
        cost: 3,
        statMods: { 'Agility': 2 },
        passives: [{ id: 'fall-', name: '낙하 피해 경감', description: '낙하 피해 1단계 감소' }],
        synergy: ['sprinter 와 병행 시 이동 관련 작업이 안정적입니다.'],
        description: '운동신경 +2, 낙하 피해를 줄입니다.'
    },
    {
        id: 'surgeon',
        name: '외과 전문',
        cost: 5,
        statMods: { 'Medicine': 3 },
        passives: [{ id: 'bleed-', name: '출혈 억제', description: '출혈 상태이상 발생률 -25%' }],
        notes: ['의학적 해결 루트가 많은 임무에서 고효율입니다.'],
        description: '의술 +3, 출혈 억제.'
    },
    {
        id: 'clumsy',
        name: '어설픔',
        cost: -2,
        statMods: { 'Agility': -1 },
        passives: [{ id: 'fumble+', name: '실수 빈발', description: '펌블 확률 +10%', negative: true }],
        notes: ['정밀 작업 비중이 큰 빌드와는 상성이 좋지 않습니다.'],
        description: '운동신경 -1, 펌블 확률 증가. 포인트 2 회수.'
    },
    {
        id: 'stoic',
        name: '강철 멘탈',
        cost: 2,
        passives: [{ id: 'fear-', name: '공포 내성', description: '공포 체크 보정 +1' }],
        notes: ['공포 유발 구간이 많은 맵에서 안정성을 제공합니다.'],
        description: '공포 체크에 강합니다.'
    },
    {
        id: 'mechanist',
        name: '기관공',
        cost: 4,
        statMods: { 'Engineering': 2, 'Strength': 1 },
        passives: [{ id: 'overclock+', name: '오버클럭', description: '장비 과부하 내성 +1' }],
        description: '공학 +2, 근력 +1. 장비 과부하에 강합니다.'
    },
    {
        id: 'precise-hands',
        name: '정밀한 손놀림',
        cost: 2,
        statMods: { 'Dexterity': 2 },
        passives: [{ id: 'crit+', name: '정밀타', description: '정밀 판정에서 크리티컬 범위 +1' }],
        description: '손재주 +2, 정밀 판정에 유리.'
    },
    {
        id: 'bookworm',
        name: '연구광',
        cost: 1,
        passives: [{ id: 'lore+', name: '지식', description: '지식 체크 보정 +1' }],
        description: '배경 지식이 풍부합니다.'
    },
    {
        id: 'hypochondria',
        name: '건강염려증',
        cost: -3,
        passives: [{ id: 'panic+', name: '과민 반응', description: '위기 시 패널티 -1', negative: true }],
        description: '위기 상황에서 불리하지만 포인트 3 회수.'
    },
    {
        id: 'field-inventor',
        name: '현장 발명가',
        cost: 3,
        statMods: { 'Engineering': 1, 'Dexterity': 1 },
        passives: [{ id: 'improv+', name: '즉흥 제작', description: '임시 장치 제작 성공률 +15%' }],
        description: '공학/손재주 +1, 즉흥 제작이 유리.'
    }
];
