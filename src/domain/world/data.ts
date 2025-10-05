import type { WorldIndex, MapNode } from './types';

const MAP_LUMENFORD: MapNode = {
  id: 'LUMENFORD',
  name: '등불도시 루멘포드',
  description:
    '성유와 등불의 도시. 폭풍 전선을 막아내는 격자와 검은 수로 위에 지어진 난민 수도. 상업과 비밀, 의식과 과학이 얽혀 있다.',
  entryFieldId: 'gate',
  prev: null,
  next: 'BACKSTREETS',
  theme: {
    tag: 'dark-cyber-worn-teal',
    mood: 'tense-hopeful',
  },
  bg: {
    path: '/assets/bg/maps/lumenford/city_gate.webp',
    position: 'center 70%',
    focalPoint: 'city-gate-lantern',
    parallax: 0.1,
    overlay: 'grain',
    grade: 'cool',
    description:
      '야간, 젖은 현무암 도로 위로 청록빛 네온과 주황색 등불이 길게 번진다. ' +
      '우측엔 격자 탑이 청백색 아크 라인을 뽑고, 중앙 포커스는 성문 랜턴의 난반사. ' +
      '비막 구름이 낮게 깔려 있으며 원근으로 난민 행렬의 실루엣이 끊기지 않게 이어진다. ' +
      '질감은 금속/석재가 뚜렷하고, 색의 대비는 차갑고 낮으며, 공기엔 희미한 입자감(그레인).',
    gifRecommended: true,
    llmPrompt:
      'Dark cyber worn‑teal city gate at night; wet basalt road with teal neon reflections and amber lanterns; ' +
      'a lattice tower emits pale arc lines; low cloud ceiling; continuous refugee silhouettes; high material detail; cool grade; subtle grain; loopable parallax fog.',
  },
  music: {
    mood: 'ambient-industrial + muted choirs',
    tracks: [
      '/assets/audio/maps/lumenford/ambient.ogg',
      '/assets/audio/maps/lumenford/ambient.mp3',
      '/assets/audio/maps/shared/wind_low.ogg',
    ],
    loop: true,
    volume: 0.7,
    cuePoints: [
      { name: 'intro', time: 0 },
      { name: 'loop', time: 18.0 },
    ],
    description:
      '템포 느림(55~65BPM), 저역 서브 드론과 얇은 톤의 합창 패드. 틴/철제 잔향, 비 소리의 고역 쉼표. ' +
      '디스토션은 미세하게, 스테레오 폭 좁음→중간으로 서서히 확장. 청록 네온/등불 대비를 느끼게 하는 차분한 긴장.',
    llmPrompt:
      'Slow ambient industrial with distant muted choir; low sub drone, thin glassy pad; subtle metallic reverb; light rain hiss; minimal distortion; narrow→medium stereo swell; tense but hopeful.',
  },
  fields: [
    {
      id: 'gate',
      name: '성문(Entry)',
      kind: 'entry',
      description: '통행세와 통행증 검문이 이뤄지는 북문. 등불탑이 도시를 비춘다.',
      neighbors: ['market', 'docks'],
      bg: {
        path: '/assets/bg/maps/lumenford/gate_close.webp',
        position: 'center bottom',
        focalPoint: 'lantern-tower',
        overlay: 'grain',
        grade: 'cool',
        description:
          '클로즈업: 랜턴 기둥 하부, 금속 그릴에 떨어지는 비와 응축수. ' +
          '검문소 간판의 청록 네온이 깜빡이며 표면에 길게 반사. 인파는 허리 위 실루엣만, 흐림 심도 얕음.',
        gifRecommended: true,
        llmPrompt:
          'Close shot of lantern tower base with rain beads, teal neon flicker reflecting on metal grilles; shallow depth of field; loopable subtle flicker.',
      },
      musicCue: {
        mood: 'brass low + gate bustle',
        tracks: ['/assets/audio/maps/lumenford/gate.ogg'],
        loop: true,
        volume: 0.8,
        description:
          '저음 브라스 드론, 멀리서 웅성거림·발소리·장비 금속 마찰 샘플을 레이어. ' +
          '템포 프리, 간헐적 신호음(짧은 네온 플리커 샘플)로 포인트.',
        llmPrompt:
          'Low brass drone + crowd/footstep/metal scrapes ambience; free tempo; occasional short neon flicker tone; understated mix.',
      },
    },
    {
      id: 'market',
      name: '상점가',
      kind: 'market',
      description: '부두길드 상인과 밀수꾼이 섞여드는 시장. 정보와 장비가 교차한다.',
      neighbors: ['gate', 'archives'],
      bg: {
        path: '/assets/bg/maps/lumenford/market.webp',
        position: 'center 65%',
        overlay: 'grain',
        grade: 'cool',
        description:
          '좁은 골목형 상점가, 여러 색 온도의 네온 간판이 젖은 포장도로에 다중 반사. ' +
          '매연과 증기가 천천히 흘러가며 원근 빛이 퍼진다. 현수막과 전선이 프레임을 가로지르며 텍스처 감 강조.',
        gifRecommended: true,
        llmPrompt:
          'Worn teal cyberpunk market alley; mixed neon signage reflecting on wet pavement; slow steam plumes; hanging banners and cables crossing the frame; loopable steam motion.',
      },
      musicCue: {
        mood: 'rhythmic stalls + low pads',
        tracks: ['/assets/audio/maps/lumenford/market.ogg'],
        loop: true,
        volume: 0.7,
        description:
          '로우파이 리듬(경쾌 X), 목재 박자 샘플과 소프트 신스 베이스. ' +
          '상점 종소리/지폐·금속 소품의 미세한 폴리사운드를 사이드체인 없이 얕게 믹스.',
        llmPrompt:
          'Lo-fi market rhythm with wooden percussive ticks, soft synth bass, faint shop bells and coin/metal foley, no heavy sidechain; moderate space.',
      },
    },
    {
      id: 'archives',
      name: '학술 아케이브',
      kind: 'interior',
      description: '유적도서관 분소. 봉인된 열람실로 가는 허가증이 필요한 곳.',
      neighbors: ['market'],
      bg: {
        path: '/assets/bg/maps/lumenford/archives.webp',
        position: 'center 45%',
        overlay: 'fog',
        grade: 'cool',
        description:
          '유리 진공 케이스 속 청록빛 공허수정 샘플이 내부에서 은은히 발광. ' +
          '차가운 주광(6500K) 스폿, 라벨과 유물 표면에 가는 먼지 입자. 반사/굴절 표현 강조.',
        llmPrompt:
          'Museum-like archive interior with teal-glowing void shard in vacuum glass case; cool spotlights; dust motes; emphasize reflection/refraction details.',
      },
      musicCue: {
        mood: 'glass harmonics + hush',
        tracks: ['/assets/audio/maps/lumenford/archives.ogg'],
        loop: true,
        volume: 0.6,
      },
    },
    {
      id: 'docks',
      name: '부두',
      kind: 'docks',
      description: '검은 수로 위 격납 링. 프리 컴퍼니의 이착륙 포인트.',
      neighbors: ['gate'],
      bg: {
        path: '/assets/bg/maps/lumenford/docks.webp',
        position: 'center bottom',
        overlay: 'fog',
        grade: 'cool',
        description:
          '짙은 안개 위에 부표와 항로 표식 조명 라인이 리듬감 있게 연속. ' +
          '수면은 느린 장력파가 번지고, 격납고 조명은 간헐적으로 깜빡인다.',
        gifRecommended: true,
        llmPrompt:
          'Foggy docks with buoy beacons and runway-like light lines; slow water ripples; occasional hangar light flicker; loopable subtle motion.',
      },
      musicCue: {
        mood: 'low wind + distant horns',
        tracks: ['/assets/audio/maps/shared/wind_low.ogg'],
        loop: true,
        volume: 0.65,
        description:
          '저음 바람/해무 앰비언스, 멀리서 짧은 혼 경적이 드물게 울림. 잔향 길고 공간감 넓음.',
        llmPrompt:
          'Low wind/sea mist ambience; rare distant short foghorn calls; long tail reverb; wide spatial field.',
      },
    },
  ],
};

const MAP_BACKSTREETS: MapNode = {
  id: 'BACKSTREETS',
  name: '루멘포드 뒷골목',
  description:
    '도시와 도시 사이를 꿰매는 골목망. 젖은 콘크리트, 청록 네온, 증기가 교차하며 빠르게 이동하기 좋지만 매복도 잦다.',
  entryFieldId: 'alley-gate',
  prev: 'LUMENFORD',
  next: 'LIBRARY',
  theme: { tag: 'dark-cyber-worn-teal', mood: 'noir-transit' },
  bg: {
    path: '/assets/bg/maps/backstreets/main.webp',
    position: 'center 65%',
    overlay: 'grain',
    grade: 'cool',
    description:
      '좁은 뒷골목. 파이프에서 뿜어 나오는 흰 증기가 천천히 흘러가고, 낡은 청록 네온 간판이 불규칙하게 깜빡인다. ' +
      '빗방울이 드문드문 떨어져 젖은 아스팔트에 타원형 반사를 만든다. 세탁줄과 전선이 프레임을 가로지른다.',
    gifRecommended: true,
    llmPrompt:
      'Narrow worn‑teal cyberpunk back alley; slow steam from wall pipes; irregular teal neon flicker; sparse raindrops on wet asphalt; laundry lines and cables crossing; subtle loop.',
  },
  music: {
    mood: 'noir ticks + alley ambience',
    tracks: ['/assets/audio/maps/backstreets/noir.ogg'],
    loop: true,
    volume: 0.65,
    description:
      '미세한 메트로놈틱한 틱(우드/플라스틱), 낮은 패드, 물 떨어지는 잔향과 배기팬 저역 소음. ' +
      '템포는 느리고, 공간감은 좁은 골목 리버브를 적용.',
    llmPrompt:
      'Minimal noir percussive ticks (wood/plastic), low pad, dripping water tails and low fan hum; slow tempo; narrow alley reverb; restrained mix.',
  },
  fields: [
    {
      id: 'alley-gate',
      name: '골목 입구(Entry)',
      kind: 'entry',
      description: '큰 도로에서 꺾여 들어오는 입구. 보안 카메라와 낡은 표지판.',
      neighbors: ['market-passage', 'checkpoint'],
      bg: {
        path: '/assets/bg/maps/backstreets/alley_gate.webp',
        position: 'center 70%',
        overlay: 'grain',
        grade: 'cool',
        description:
          '골목 표지판의 흐릿한 페인트, 고드름처럼 맺힌 물방울. 카메라 적외선 LED 링이 아주 약하게 빛난다.',
        gifRecommended: true,
        llmPrompt:
          'Alley mouth with faded signage, hanging droplets like tiny icicles; faint IR LED ring glow on a security cam; subtle loop.',
      },
    },
    {
      id: 'market-passage',
      name: '시장 통로',
      kind: 'market',
      description: '상점 뒤편 통로. 목재 팔레트와 포장 상자 더미, 빠르게 지나가는 그림자.',
      neighbors: ['alley-gate', 'rooftops'],
      bg: {
        path: '/assets/bg/maps/backstreets/market_passage.webp',
        position: 'center 60%',
        overlay: 'grain',
        grade: 'cool',
        description:
          '젖은 시멘트 바닥에 팔레트의 거친 나뭇결, 상자 라벨의 바랜 잉크. 간헐적 발소리 그림자가 벽면을 스친다.',
        gifRecommended: true,
        llmPrompt:
          'Back‑market passage with wet concrete, rough wooden pallets, faded ink labels; occasional shadow of footsteps sliding across the wall; seamless loop.',
      },
    },
    {
      id: 'checkpoint',
      name: '임시 검문소',
      kind: 'infrastructure',
      description: '메쉬 펜스와 이동식 배리어. 출입 기록표가 비에 젖어 들러붙어 있다.',
      neighbors: ['alley-gate'],
      bg: {
        path: '/assets/bg/maps/backstreets/checkpoint.webp',
        position: 'center',
        overlay: 'grain',
        grade: 'cool',
        description:
          '메쉬 펜스에 물방울이 맺혀 작게 반짝이고, 이동식 배리어의 반사띠가 젖은 바닥에서 늘어진다.',
        llmPrompt:
          'Mesh fence with beads of water, portable barrier with retroreflective tape elongated on wet ground; cool tone; high texture detail.',
      },
    },
    {
      id: 'rooftops',
      name: '지붕길',
      kind: 'district',
      description: '비상 사다리를 타고 오르는 지붕길. 전선과 환기구, 낮게 흐르는 구름.',
      neighbors: ['market-passage'],
      bg: {
        path: '/assets/bg/maps/backstreets/rooftops.webp',
        position: 'center 45%',
        overlay: 'fog',
        grade: 'cool',
        description:
          '지붕 위 전선 다발과 회색 환기구. 멀리 바람에 밀린 구름층이 낮게 흐른다. 드문 번개가 먼 곳에서 반짝.',
        gifRecommended: true,
        llmPrompt:
          'Rooftop with cable bundles and gray vents; low clouds drifting; occasional distant lightning glint; subtle parallax fog; loopable.',
      },
    },
  ],
};

const MAP_LIBRARY: MapNode = {
  id: 'LIBRARY',
  name: '유적도서관',
  description:
    '봉인된 지하 열람실과 의식실이 연결된 잔해 도서관. 지식은 힘이지만 대가가 따른다.',
  entryFieldId: 'atrium',
  prev: 'BACKSTREETS',
  next: 'CAUSEWAY',
  theme: { tag: 'dark-cyber-worn-teal', mood: 'mystic-danger' },
  bg: {
    path: '/assets/bg/maps/library/atrium.webp',
    position: 'center 55%',
    focalPoint: 'broken-oculus',
    parallax: 0.08,
    overlay: 'fog',
    grade: 'cool',
    description:
      '붕괴된 원형 천창(오쿨러스) 아래로 하얀 먼지가 빛기둥 속에 부유. ' +
      '바닥은 금이 간 대리석과 파편, 중간 톤의 청록 잔광이 룬 장식에 얕게 번짐. 공기 습한 느낌.',
    llmPrompt:
      'Collapsed oculus with volumetric light shafts full of dust motes; cracked marble floor with fragments; faint teal afterglow on runes; moist cool air; fog overlay.',
  },
  music: {
    mood: 'choral shards + sub bass',
    tracks: [
      '/assets/audio/maps/library/echoes.ogg',
      '/assets/audio/maps/library/echoes.mp3',
    ],
    loop: true,
    volume: 0.65,
    cuePoints: [{ name: 'loop', time: 12.0 }],
    description:
      '파편화된 합창(미세하게 디튜닝), 낮은 서브 베이스가 서서히 파도처럼 부풀었다 가라앉음. ' +
      '금속성 종소리의 롱테일 리버브를 극히 낮은 볼륨으로 배경에 배치.',
    llmPrompt:
      'Fragmented choir with slight detuning; slow swelling sub-bass; very low metallic chime tails; eerie but restrained; long reverb.',
  },
  fields: [
    {
      id: 'atrium',
      name: '아트리움(Entry)',
      kind: 'entry',
      description: '귤빛 유리 조각과 부러진 기둥이 난무하는 중앙 홀.',
      neighbors: ['stacks', 'scriptorium'],
      bg: {
        path: '/assets/bg/maps/library/atrium_close.webp',
        position: 'center',
        overlay: 'fog',
        grade: 'cool',
        description:
          '원형 난간과 중앙 제단 클로즈업. 제단 표면에 오래된 긁힘과 그을음, 옆 계단의 미세한 먼지층. ' +
          '광선이 천천히 흔들리는 듯한 연출(루프 가능).',
        gifRecommended: true,
        llmPrompt:
          'Close on circular balustrade and central dais; aged scratches and soot; thin dust layer on steps; gentle swaying volumetric light; seamless loop.',
      },
    },
    {
      id: 'stacks',
      name: '서가',
      kind: 'interior',
      description: '봉인 라벨이 붙은 서가. 사서 드론의 잔해가 보인다.',
      neighbors: ['atrium', 'vault'],
      bg: {
        path: '/assets/bg/maps/library/stacks.webp',
        position: 'center 60%',
        overlay: 'grain',
        grade: 'cool',
        description:
          '높은 서가가 만드는 협곡 같은 복도, 책등에 달라붙은 오래된 표찰. 먼지는 아주 미세하게 부유. ' +
          '카메라는 눈높이, 원근을 강조하는 좁은 시야.',
        llmPrompt:
          'Narrow canyon-like aisle between tall stacks; aged labels on book spines; minimal dust drift; eye-level camera; compressed perspective.',
      },
    },
    {
      id: 'scriptorium',
      name: '필사실',
      kind: 'interior',
      description: '의식 도면과 공허문자 낙서가 겹쳐진 작업대들.',
      neighbors: ['atrium'],
      bg: {
        path: '/assets/bg/maps/library/scriptorium.webp',
        position: 'center 55%',
        overlay: 'grain',
        grade: 'cool',
        description:
          '묵은 잉크 번짐과 촛농자국이 겹친 작업대. 유리 파편 위에 점状 반사가 어지럽게 찍힌다. ' +
          '푸른 잔광이 금속 펜촉을 스치듯 반짝.',
        llmPrompt:
          'Scriptorium desks stained with old ink and wax; scattered glass shards with point highlights; faint teal glint on metal nibs.',
      },
    },
    {
      id: 'vault',
      name: '의식 보관실',
      kind: 'vault',
      description: '차갑게 진동하는 봉인 룬. 접근에는 허가와 대가가 필요하다.',
      neighbors: ['stacks'],
      bg: {
        path: '/assets/bg/maps/library/vault.webp',
        position: 'center 45%',
        overlay: 'fog',
        grade: 'cool',
        description:
          '두꺼운 금속 금고문, 깊게 새겨진 룬 홈에서 강한 청록 발광이 새어 나온다. ' +
          '주변 공기에는 아주 얇은 김이 올라오듯 미세한 빛 먼지가 흐른다.',
        gifRecommended: true,
        llmPrompt:
          'Massive metal vault door with deeply engraved runes emitting strong teal light; thin shimmering dust like heat haze; loopable subtle pulse.',
      },
    },
  ],
};

const MAP_CAUSEWAY: MapNode = {
  id: 'CAUSEWAY',
  name: '폭풍 경계 가도',
  description:
    '도시와 도시 사이의 외곽 순환로. 유리먼지와 잔잔한 낙진이 바람을 타고 스치며, 멀리 폭풍벽이 번개로 깜빡인다.',
  entryFieldId: 'outer-ring',
  prev: 'LIBRARY',
  next: 'SEWERS',
  theme: { tag: 'dark-cyber-worn-teal', mood: 'windswept-peril' },
  bg: {
    path: '/assets/bg/maps/causeway/main.webp',
    position: 'center 55%',
    overlay: 'fog',
    grade: 'cool',
    description:
      '넓은 외곽 가도, 바닥에는 바랜 차선과 균열. 낮게 깔린 먼지층이 바람에 쓸려가며, ' +
      '수평선 너머 폭풍벽에서 희미한 번개가 주기적으로 번쩍인다.',
    gifRecommended: true,
    llmPrompt:
      'Wide outer causeway with faded lane markings and cracks; low dust layer swept by wind; distant storm wall with periodic lightning; loopable wind motion.',
  },
  music: {
    mood: 'wind wall + distant thunder',
    tracks: ['/assets/audio/maps/causeway/wind_wall.ogg'],
    loop: true,
    volume: 0.6,
    description:
      '넓은 바람 소리와 먼 폭풍의 저주파 우르릉. 때때로 얇은 금속판 공명음이 짧게 섞인다. 공간감은 매우 넓음.',
    llmPrompt:
      'Broad wind wall ambience with low distant thunder; occasional thin metal resonance; very wide spatial field; restrained dynamics.',
  },
  fields: [
    {
      id: 'outer-ring',
      name: '외곽 링(Entry)',
      kind: 'entry',
      description: '순환로 진입 구간. 표지판과 바리케이드 잔해.',
      neighbors: ['storm-bridge', 'watchpost'],
      bg: {
        path: '/assets/bg/maps/causeway/outer_ring.webp',
        position: 'center 60%',
        overlay: 'grain',
        grade: 'cool',
        description:
          '휘어진 표지판, 찢긴 배너 천 조각이 바람에 팔랑. 고정 볼트가 녹슬어 텍스처가 선명하다.',
        gifRecommended: true,
        llmPrompt:
          'Bent signposts and torn banner strips flapping in the wind; rusty bolts with sharp texture; loopable flutter.',
      },
    },
    {
      id: 'storm-bridge',
      name: '폭풍교',
      kind: 'infrastructure',
      description: '낙차를 넘어가는 다리. 유리먼지가 바람에 반짝이며 지나간다.',
      neighbors: ['outer-ring', 'watchpost'],
      bg: {
        path: '/assets/bg/maps/causeway/storm_bridge.webp',
        position: 'center 55%',
        overlay: 'fog',
        grade: 'cool',
        description:
          '다리 상판 위로 미세한 유리먼지와 모래가 줄무늬로 쓸려간다. 손잡이 금속 표면에 작은 점상 반짝임.',
        gifRecommended: true,
        llmPrompt:
          'Bridge deck with fine glass dust swept into striations; tiny point glints along metal handrails; loopable wind/dust motion.',
      },
    },
    {
      id: 'watchpost',
      name: '감시초소',
      kind: 'junction',
      description: '폐쇄된 초소. 도로 위 카메라와 비상 조명만 살아 있다.',
      neighbors: ['outer-ring', 'storm-bridge'],
      bg: {
        path: '/assets/bg/maps/causeway/watchpost.webp',
        position: 'center',
        overlay: 'grain',
        grade: 'cool',
        description:
          '작은 박스형 초소 내부에 잔광. 외부 비상등이 간헐적으로 점멸하며 주변 바닥에 장방형 빛 패턴을 만든다.',
        gifRecommended: true,
        llmPrompt:
          'Boxy roadside watchpost with faint interior afterglow; exterior emergency light blinking intermittently, casting rectangular light patterns; loopable.',
      },
    },
  ],
};

const MAP_SEWERS: MapNode = {
  id: 'SEWERS',
  name: '공허 수로',
  description:
    '도시 아래 흐르는 검은 물길. 소음은 멀리 퍼지고 빛은 큰 대가를 부른다.',
  entryFieldId: 'outfall',
  prev: 'CAUSEWAY',
  next: null,
  theme: { tag: 'dark-cyber-worn-teal', mood: 'perilous' },
  bg: {
    path: '/assets/bg/maps/sewers/outfall.webp',
    position: 'center bottom',
    focalPoint: 'spillway',
    parallax: 0.06,
    overlay: 'fog',
    grade: 'cool',
    description:
      '벽돌 아치형 터널 말단에서 낙차를 두고 물이 분출되어 얇은 수막을 만든다. ' +
      '벽면엔 물때와 산화 얼룩, 바닥엔 격자 배수로가 반사로 번들거린다. 공기는 탁하고 차갑다.',
    gifRecommended: true,
    llmPrompt:
      'Brick arch tunnel outfall with thin waterfall sheet; oxidized stains; wet grates reflecting light; cold, murky air; loopable water motion.',
  },
  music: {
    mood: 'low drones + water',
    tracks: [
      '/assets/audio/maps/sewers/drone.ogg',
      '/assets/audio/maps/sewers/drip.ogg',
    ],
    loop: true,
    volume: 0.6,
    description:
      '저주파 드론과 불규칙 물방울/수막 소리. 드론은 일정하지 않게 미세한 피치 변화를 가지며, 공간감은 터널 잔향을 강조.',
    llmPrompt:
      'Low-frequency drone with irregular dripping and thin waterfall noise; subtle pitch drift; strong tunnel reverb; cold and oppressive.',
  },
  fields: [
    {
      id: 'outfall',
      name: '방류구(Entry)',
      kind: 'entry',
      description: '커다란 방류구와 수막. 미끄러운 철제 난간.',
      neighbors: ['channel'],
      bg: {
        path: '/assets/bg/maps/sewers/outfall_close.webp',
        position: 'center bottom',
        overlay: 'fog',
        grade: 'cool',
        description:
          '수막 비말의 미세 입자, 녹과 칠이 벗겨진 난간 표면 거칠기. 물길에 흔들리는 조명 반사. ' +
          '저속 루프에 적합한 잔잔한 흐름.',
        gifRecommended: true,
        llmPrompt:
          'Close shot of misting water sheet and chipped rusty railing texture; shimmering light on flow; gentle seamless loop.',
      },
    },
    {
      id: 'channel',
      name: '본류',
      kind: 'infrastructure',
      description: '중앙 수로. 수면 아래에서 금속성 공명이 들린다.',
      neighbors: ['outfall', 'junction'],
      bg: {
        path: '/assets/bg/maps/sewers/channel.webp',
        position: 'center 65%',
        overlay: 'grain',
        grade: 'cool',
        description:
          '직선 본류가 멀리 사라지며 양측 벽엔 희미한 조명 라인이 연속. 수면엔 느린 흐름의 파형이 반복. 습기 찬 벽돌 질감 강조.',
        gifRecommended: true,
        llmPrompt:
          'Long straight channel with faint repeating light lines along walls; slow waveform ripples; moist brick texture; loopable flow.',
      },
    },
    {
      id: 'junction',
      name: '분기점',
      kind: 'junction',
      description: '세 갈래로 갈라지는 연결부. 소용돌이가 생긴다.',
      neighbors: ['channel', 'breakwater'],
      bg: {
        path: '/assets/bg/maps/sewers/junction.webp',
        position: 'center 55%',
        overlay: 'grain',
        grade: 'cool',
        description:
          '세 갈래 분기, 바닥의 노란 안전 발판과 방향 표식. 물이 합쳐지는 와류가 중앙에 작게 생기며 리듬감 있게 반복.',
        gifRecommended: true,
        llmPrompt:
          'Three-way junction with yellow safety plates and directional markings; small central eddy where flows meet; rhythmic repeating motion.',
      },
    },
    {
      id: 'breakwater',
      name: '파제벽',
      kind: 'ruin',
      description: '붕괴된 벽체와 떠내려온 잔해. 공허 흔적체가 남아 있다.',
      neighbors: ['junction'],
      bg: {
        path: '/assets/bg/maps/sewers/breakwater.webp',
        position: 'center 60%',
        overlay: 'fog',
        grade: 'cool',
        description:
          '균열난 벽체와 찌그러진 난간, 떠내려와 걸린 잔해 뭉치. 물 표면엔 느린 기포와 소용돌이가 드문 간격으로 일어난다.',
        gifRecommended: true,
        llmPrompt:
          'Cracked wall and bent railings with tangled debris; slow bubbles and occasional small whirlpools; subtle loop.',
      },
    },
  ],
};

export const WORLD_STATIC: WorldIndex = {
  id: 'GREYFALL_CORE',
  name: 'Greyfall — Solas Basin',
  head: 'LUMENFORD',
  maps: [MAP_LUMENFORD, MAP_BACKSTREETS, MAP_LIBRARY, MAP_CAUSEWAY, MAP_SEWERS],
};
