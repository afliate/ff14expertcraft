// ============================================================
//  qualcalc.js  ·  작업/품질 계산기
//  HARD_RECIPES 는 recipes.js 에서 로드됨
// ============================================================

// ── recipe-level-table.json 로드 ──
let RLVL_TABLE = {};
(async () => {
  try {
    RLVL_TABLE = await fetch('./recipe-level-table.json').then(r => r.json());
  } catch(e) {
    console.warn('recipe-level-table.json 로드 실패:', e);
  }
})();

function getRlvlParams(rlvl) {
  const data = RLVL_TABLE[String(rlvl)];
  if (data) return {
    pD: data.progressDivider,
    pM: data.progressModifier,
    qD: data.qualityDivider,
    qM: data.qualityModifier,
  };
  // fallback (JSON 로드 전 또는 없는 rlvl)
  if (rlvl >= 750) return { pD: 180, pM: 100, qD: 180, qM: 100 };
  if (rlvl >= 740) return { pD: 178, pM: 100, qD: 178, qM: 100 };
  if (rlvl >= 730) return { pD: 175, pM: 100, qD: 175, qM: 100 };
  if (rlvl >= 720) return { pD: 170, pM: 100, qD: 170, qM: 100 };
  if (rlvl >= 710) return { pD: 168, pM: 100, qD: 168, qM: 100 };
  if (rlvl >= 700) return { pD: 165, pM: 100, qD: 165, qM: 100 };
  return { pD: 160, pM: 100, qD: 160, qM: 100 };
}

// baseProgress = floor(crafts * 10/pD + 2)
// ※ 팀크래프트/라파엘 공식: pM(progressModifier)은 레시피 required progress에
//    이미 반영된 값이므로, 스킬 작업량 계산에는 base만 사용
function calcS0(crafts, rlvl) {
  const { pD } = getRlvlParams(rlvl);
  return Math.floor(crafts * 10 / pD + 2);
}

// 작업량 = floor(s0 × 효율/100 × 버프배율)
function calcWork(s0, efficiency, buffMult) {
  return Math.floor(s0 * efficiency / 100 * buffMult);
}

// c0 = floor(cons × 10/qD + 35) × qM/100
function calcC0(cons, rlvl) {
  const { qD, qM } = getRlvlParams(rlvl);
  const base = Math.floor(cons * 10 / qD + 35);
  return Math.floor(base * qM / 100);
}

// 통합 품질 계산
// 품질 = floor(c0 × IQ배율 × 효율/100 × (1 + 버프합))
function calcQuality(cons, rlvl, iqStacks, efficiency, buffSum) {
  const { qD, qM } = getRlvlParams(rlvl);
  const base = Math.floor(cons * 10 / qD + 35);
  const c0   = base * qM / 100;
  const iqMult = 1 + iqStacks * 0.1;
  return Math.floor(c0 * iqMult * efficiency / 100 * (1 + buffSum));
}

// ── 확신 오프너 조합 데이터 (상단 표) ──
// 버프는 덧셈 누적: 확신+0.5, 공경+0.5, 빠른진행+0.5
// 스킬 작업량 = floor(baseProgress × eff/100 × (1 + buffSum))
// ※ 공경(Veneration)은 작업량 0인 순수 버프스킬
const OPENER_COMBOS = [
  {
    id: 'shin-ko-kang',
    label: '확신 + 공경 + 강행 작업',
    chips: [
      {type:'buff',text:'확신'},{type:'sep',text:'+'},
      {type:'buff',text:'공경'},{type:'sep',text:'+'},
      {type:'work',text:'강행 작업'},
    ],
    // 확신(300%, 버프없음) + 공경(작업량0, 버프) + 강행(500%, 확신+0.5+공경+0.5 → ×2.5)
    shinEff: 300, shinBuff: 1.0,
    skillEff: 500, skillBuff: 2.5,
    stateBuff: 0, highlight: true,
  },
  {
    id: 'shin-ko-fast-kang',
    label: '확신 + 공경 + 빠른진행 + 강행',
    chips: [
      {type:'buff',text:'확신'},{type:'sep',text:'+'},
      {type:'buff',text:'공경'},{type:'sep',text:'+'},
      {type:'state',text:'빠른 진행'},{type:'sep',text:'+'},
      {type:'work',text:'강행 작업'},
    ],
    shinEff: 300, shinBuff: 1.0,
    skillEff: 500, skillBuff: 2.5,
    stateBuff: 0.5, highlight: false, // 빠른진행 +50% 추가
  },
  {
    id: 'shin-ko-jip',
    label: '확신 + 공경 + 집중 작업',
    chips: [
      {type:'buff',text:'확신'},{type:'sep',text:'+'},
      {type:'buff',text:'공경'},{type:'sep',text:'+'},
      {type:'work',text:'집중 작업'},
    ],
    shinEff: 300, shinBuff: 1.0,
    skillEff: 400, skillBuff: 2.5,
    stateBuff: 0, highlight: false,
  },
  {
    id: 'shin-ko-fast-mit',
    label: '확신 + 공경 + 빠른진행 + 밑작업',
    chips: [
      {type:'buff',text:'확신'},{type:'sep',text:'+'},
      {type:'buff',text:'공경'},{type:'sep',text:'+'},
      {type:'state',text:'빠른 진행'},{type:'sep',text:'+'},
      {type:'work',text:'밑작업'},
    ],
    shinEff: 300, shinBuff: 1.0,
    skillEff: 360, skillBuff: 2.5,
    stateBuff: 0.5, highlight: false,
  },
  {
    id: 'shin-ko-mit',
    label: '확신 + 공경 + 밑작업',
    chips: [
      {type:'buff',text:'확신'},{type:'sep',text:'+'},
      {type:'buff',text:'공경'},{type:'sep',text:'+'},
      {type:'work',text:'밑작업'},
    ],
    shinEff: 300, shinBuff: 1.0,
    skillEff: 360, skillBuff: 2.5,
    stateBuff: 0, highlight: false,
  },
];

// ── 스킬별 단독 참고 (하단 표) ──
const SKILL_REF = [
  {name:'강행 작업', eff:500},
  {name:'집중 작업', eff:400},
  {name:'밑작업',    eff:360},
  {name:'절약 작업', eff:180},
  {name:'모범 작업', eff:180},
  {name:'정밀 작업', eff:150},
  {name:'작업',      eff:120},
];

const FINISH_EFF = 120;


// ── 품질 로테이션 데이터 ──
// ※ qualityFn(c0iq) 를 받음 — c0iq는 IQ 10스택이 반영된 품질 기반값
//
// 버프 배율 정리 (게임 공식):
//   혁신(Innovation)    : 해당 action 효율 × 1.5
//   장족의 발전(Great Strides): 해당 action 효율 × 2 (한 번만)
//   비레고(Byregot's)   : 효율 = 100 + 20 × IQ스택  (10스택 = 300)
//   밑가공(Prep Touch)  : 효율 200 (내구 20 소모)
//   절약 가공(Prudent)  : 효율 100 (내구 5 소모)
//   상급 가공(Advanced) : 효율 150
//
// 단일 스킬 품질 = floor(c0iq × eff/100 × 혁신배율 × 장족배율)
// ── 품질 로테이션 데이터 ──
// ※ 새 구조: efficiency + buffSum + iqStacks 로 정의
//   품질 계산은 calcQuality(cons, iqStacks, efficiency, buffSum) 사용
//
// 버프 배율 정리 (게임 공식):
//   혁신(Innovation)         : +0.5  (덧셈 누적)
//   장족의 발전(Great Strides): +1.0  (덧셈 누적, 한 번만)
//   비레고(Byregot's)        : 효율 = 100 + 20 × IQ스택  (10스택 = 300)
//   밑가공(Prep Touch)       : 효율 200 (내구 20)
//   절약 가공(Prudent)       : 효율 100 (내구 5)
//   상급 가공(Advanced)      : 효율 150 (내구 10)
//
// multiStep: true 인 경우 steps 배열로 다단 계산
// ── 스킬 아이콘 맵 (qualcalc 내부용) ──
const SKILL_ICONS = {
  '작업':           { id: '001501' },
  '가공':           { id: '001502' },
  '정밀 작업':      { id: '001503' },
  '밑가공':         { id: '001507' },
  '집중 작업':      { id: '001514' },
  '중급 가공':      { id: '001516' },
  '밑작업':         { id: '001518' },
  '상급 가공':      { id: '001519' },
  '절약 작업':      { id: '001520' },
  '절약 가공':      { id: '001535' },
  '경과 관찰':      { id: '001954' },
  '장족의 발전':    { id: '001955' },
  '비레고의 축복':  { id: '001975' },
  '진가':           { id: '001982' },
  '교묘한 손놀림':  { id: '001985' },
  '모범 작업':      { id: '001986' },
  '혁신':           { id: '001987' },
  '강행 작업':      { id: '001988' },
  '성급한 손길':    { id: '001989' },
  '근검절약':       { id: '001992' },
  '확신':           { id: '001994' },
  '공경':           { id: '001995' },
  '장인의 황금손':  { id: '001997' },
  '대담한 손길':    { id: '001998' },
  '신속한 혁신':    { id: '001999' },
};

function skillIcon(name) {
  const sk = SKILL_ICONS[name];
  if (!sk) return `<span class="rota-skill-text">${name}</span>`;
  return `<img class="rota-skill-icon" src="https://xivapi.com/i/001000/${sk.id}_hr1.png" alt="${name}" title="${name}" onerror="this.style.display='none'">`;
}

function skillSeq(names) {
  return names.map(n => skillIcon(n)).join('');
}

// tag: '' = 일반, '전문' = 전문장인 전용, '저내구도' = 저내구도
// cpCost: CP 소모 합계 (시트 기준)
// durCost: 소모 내구 (마무리 작업 10 포함)
// 품질 계산은 multiStep steps[]로 자동 계산
// ─────────────────────────────────────────────
const QUALITY_ROTATIONS = [

  // ══ 일반 마무리 로테이션 ══

  { id:'r01', tag:'',
    label:'장족+혁신+밑가공+밑가공+장족+비레고',
    skills:['장족의 발전','혁신','밑가공','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 }, // 밑가공 (장족+혁신)
      { efficiency:200, buffSum:0.5, iqStacks:10 }, // 밑가공 (혁신)
      { efficiency:300, buffSum:1.5, iqStacks:10 }, // 비레고 (장족)
    ], cpCost:186, durCost:50 },

  { id:'r02', tag:'',
    label:'장족+혁신+밑가공+상급+장족+비레고',
    skills:['장족의 발전','혁신','밑가공','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:192, durCost:50 },

  { id:'r03', tag:'',
    label:'장족+혁신+밑가공+중급+장족+비레고',
    skills:['장족의 발전','혁신','밑가공','중급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:125, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:178, durCost:50 },

  { id:'r04', tag:'',
    label:'장족+혁신+밑가공+가공+장족+비레고',
    skills:['장족의 발전','혁신','밑가공','가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:164, durCost:50 },

  { id:'r05', tag:'',
    label:'장족+혁신+밑가공+절약가공+장족+비레고',
    skills:['장족의 발전','혁신','밑가공','절약 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:171, durCost:45 },

  { id:'r06', tag:'',
    label:'혁신+밑가공+밑가공+장족+비레고',
    skills:['혁신','밑가공','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:0.5, iqStacks:10 },
      { efficiency:200, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:154, durCost:50 },

  { id:'r07', tag:'',
    label:'혁신+절약가공×4+혁신+장족+비레고',
    skills:['혁신','절약 가공','절약 가공','절약 가공','절약 가공','혁신','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:192, durCost:50 },

  { id:'r08', tag:'',
    label:'경관+상급+장족+혁신+경관+상급+장족+비레고',
    skills:['경과 관찰','상급 가공','장족의 발전','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:0,   iqStacks:10 }, // 경관+상급 (버프 없음)
      { efficiency:150, buffSum:1.5, iqStacks:10 }, // 경관+상급 (장족+혁신)
      { efficiency:300, buffSum:1.5, iqStacks:10 }, // 비레고 (장족+혁신)
    ], cpCost:156, durCost:40 },

  { id:'r09', tag:'',
    label:'장족+혁신+밑가공+장족+비레고',
    skills:['장족의 발전','혁신','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 }, // 비레고 (2번째장족+혁신)
    ], cpCost:146, durCost:40 },

  { id:'r10', tag:'',
    label:'장족+혁신+근검+밑가공+장족+비레고',
    skills:['장족의 발전','혁신','근검절약','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:202, durCost:20 },

  { id:'r11', tag:'',
    label:'혁신+절약가공×3+혁신+장족+비레고',
    skills:['혁신','절약 가공','절약 가공','절약 가공','혁신','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:167, durCost:35 },

  { id:'r12', tag:'',
    label:'장족+혁신+경관+상급+장족+비레고',
    skills:['장족의 발전','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:131, durCost:30 },

  { id:'r13', tag:'',
    label:'혁신+가공+중급+장족+비레고',
    skills:['혁신','가공','중급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:125, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:110, durCost:40 },

  { id:'r14', tag:'',
    label:'혁신+절약가공×2+장족+비레고',
    skills:['혁신','절약 가공','절약 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:124, durCost:30 },

  { id:'r15', tag:'',
    label:'혁신+가공+성손+장족+비레고',
    skills:['혁신','가공','성급한 손길','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0,   iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:92, durCost:40 },

  { id:'r16', tag:'',
    label:'혁신+중급+장족+비레고',
    skills:['혁신','중급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:125, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:106, durCost:30 },

  { id:'r17', tag:'',
    label:'혁신+가공+장족+비레고',
    skills:['혁신','가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:92, durCost:30 },

  { id:'r18', tag:'',
    label:'혁신+절약가공+장족+비레고',
    skills:['혁신','절약 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:99, durCost:25 },

  { id:'n01', tag:'',
    label:'혁신+장인황금손+장인황금손+장족+비레고',
    skills:['혁신','장인의 황금손','장인의 황금손','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 }, // 황금손1 (혁신)
      { efficiency:100, buffSum:0.5, iqStacks:10 }, // 황금손2 (혁신)
      { efficiency:300, buffSum:1.5, iqStacks:10 }, // 비레고 (장족)
    ], cpCost:138, durCost:30 },

  { id:'n02', tag:'',
    label:'혁신+경관+상급+장족+비레고',
    skills:['혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:0.5, iqStacks:10 }, // 경관→상급 (혁신)
      { efficiency:300, buffSum:1.5, iqStacks:10 }, // 비레고 (장족)
    ], cpCost:99, durCost:30 },

  { id:'n04', tag:'',
    label:'혁신+절약+가공+장족+비레고',
    skills:['혁신','절약 가공','가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 }, // 절약 (혁신)
      { efficiency:100, buffSum:0.5, iqStacks:10 }, // 가공 (혁신)
      { efficiency:300, buffSum:1.5, iqStacks:10 }, // 비레고 (장족)
    ], cpCost:117, durCost:30 },

  { id:'r19', tag:'',
    label:'장족+혁신+비레고',
    skills:['장족의 발전','혁신','비레고의 축복'],
    efficiency:300, buffSum:1.5, iqStacks:10,
    cpCost:74, durCost:20 },

  { id:'r20', tag:'전문장인',
    label:'신속한혁신+장족+비레고',
    skills:['신속한 혁신','장족의 발전','비레고의 축복'],
    efficiency:300, buffSum:1.0, iqStacks:10,
    cpCost:56, durCost:20 },

  // ══ 전문장인 전용 ══

  { id:'p01', tag:'전문',
    label:'[전문] 교손+경관+장족+혁신+밑가공+절약×3+혁신+절약+장족+비레고',
    skills:['교묘한 손놀림','경과 관찰','장족의 발전','혁신','밑가공','절약 가공','절약 가공','절약 가공','혁신','절약 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.0, iqStacks:10 },
    ], cpCost:404, durCost:40 },

  { id:'p02', tag:'전문',
    label:'[전문] 교손+경관+장족+혁신+밑가공+절약×3+혁신+장족+비레고',
    skills:['교묘한 손놀림','경과 관찰','장족의 발전','혁신','밑가공','절약 가공','절약 가공','절약 가공','혁신','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:382, durCost:40 },

  { id:'p03', tag:'전문',
    label:'[전문] 교손+장족+혁신+중급+밑가공+장족+비레고',
    skills:['교묘한 손놀림','장족의 발전','혁신','중급 가공','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:125, buffSum:1.5, iqStacks:10 }, // 중급 (장족+혁신)
      { efficiency:200, buffSum:0.5, iqStacks:10 }, // 밑가공 (혁신, 장족소진)
      { efficiency:300, buffSum:1.5, iqStacks:10 }, // 비레고 (2번째장족+혁신)
    ], cpCost:263, durCost:40 },

  { id:'p04', tag:'전문',
    label:'[전문] 교손+경관+혁신+중급+밑가공+장족+비레고',
    skills:['교묘한 손놀림','경과 관찰','혁신','중급 가공','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:125, buffSum:0.5, iqStacks:10 },
      { efficiency:200, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:248, durCost:40 },

  { id:'p05', tag:'전문',
    label:'[전문] 교손+장족+혁신+밑가공+장족+밑가공+장족+혁신+밑가공+장족+비레고',
    skills:['교묘한 손놀림','장족의 발전','혁신','밑가공','장족의 발전','밑가공','장족의 발전','혁신','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:200, buffSum:1.0, iqStacks:10 },
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:349, durCost:50 },

  { id:'p06', tag:'전문',
    label:'[전문] 교손+장족+혁신+밑가공+장족+밑가공+절약+혁신+경관+상급+장족+비레고',
    skills:['교묘한 손놀림','장족의 발전','혁신','밑가공','장족의 발전','밑가공','절약 가공','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:200, buffSum:1.0, iqStacks:10 },
      { efficiency:100, buffSum:0,   iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:382, durCost:40 },

  { id:'p07', tag:'전문',
    label:'[전문] 교손+혁신+경관+상급×2+경관+상급×2+장족+혁신+경관+상급+장족+비레고',
    skills:['교묘한 손놀림','혁신','경과 관찰','상급 가공','경과 관찰','상급 가공','혁신','경과 관찰','상급 가공','경과 관찰','상급 가공','장족의 발전','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:343, durCost:50 },

  { id:'p08', tag:'전문',
    label:'[전문] 교손+혁신+경관+상급×2+장족+혁신+밑가공+절약+장족+비레고',
    skills:['교묘한 손놀림','혁신','경과 관찰','상급 가공','경과 관찰','상급 가공','장족의 발전','혁신','밑가공','절약 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:335, durCost:25 },

  { id:'p09', tag:'전문',
    label:'[전문] 교손+혁신+경관+상급×4+혁신+경관+상급×3+장족+비레고',
    skills:['교묘한 손놀림','혁신','경과 관찰','상급 가공','경과 관찰','상급 가공','혁신','경과 관찰','상급 가공','경과 관찰','상급 가공','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:317, durCost:30 },

  { id:'p10', tag:'전문',
    label:'[전문] 장족+혁신+근검+밑가공+장족+밑가공+장족+혁신+경관+상급+장족+비레고',
    skills:['장족의 발전','혁신','근검절약','밑가공','장족의 발전','밑가공','장족의 발전','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:200, buffSum:1.0, iqStacks:10 },
      { efficiency:150, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:349, durCost:40 },

  { id:'p11', tag:'전문',
    label:'[전문] 장족+혁신+근검+밑가공+장족+밑가공+장족+혁신+가공+장족+비레고',
    skills:['장족의 발전','혁신','근검절약','밑가공','장족의 발전','밑가공','장족의 발전','혁신','가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:200, buffSum:1.0, iqStacks:10 },
      { efficiency:100, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:343, durCost:40 },

  { id:'p12', tag:'전문',
    label:'[전문] 장족+혁신+근검+밑가공+장족+밑가공+혁신+경관+상급+장족+비레고',
    skills:['장족의 발전','혁신','근검절약','밑가공','장족의 발전','밑가공','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:200, buffSum:1.0, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:278, durCost:60 },

  { id:'p13', tag:'전문',
    label:'[전문] 장족+혁신+경관+상급+장족+밑가공+장족+혁신+경관+상급+장족+비레고',
    skills:['장족의 발전','혁신','경과 관찰','상급 가공','장족의 발전','밑가공','장족의 발전','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:1.5, iqStacks:10 },
      { efficiency:200, buffSum:1.0, iqStacks:10 },
      { efficiency:150, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:404, durCost:40 },

  { id:'p14', tag:'전문',
    label:'[전문] 장족+혁신+경관+상급+경관+상급+장족+혁신+밑가공+장족+비레고',
    skills:['장족의 발전','혁신','경과 관찰','상급 가공','경과 관찰','상급 가공','장족의 발전','혁신','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:1.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:382, durCost:30 },

  { id:'p15', tag:'전문',
    label:'[전문] 장족+혁신+경관+상급+경관+상급+장족+혁신+경관+상급+장족+비레고',
    skills:['장족의 발전','혁신','경과 관찰','상급 가공','경과 관찰','상급 가공','장족의 발전','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:1.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:382, durCost:30 },

  { id:'p16', tag:'전문',
    label:'[전문] 혁신+경관+상급+경관+상급+장족+혁신+경관+상급+장족+비레고',
    skills:['혁신','경과 관찰','상급 가공','경과 관찰','상급 가공','장족의 발전','혁신','경과 관찰','상급 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:1.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:231, durCost:50 },

  // ══ 저내구도 ══

  { id:'d01', tag:'저내구도',
    label:'[저내구] 교손+경관+장족+혁신+밑가공+절약×3+혁신+절약+장족+비레고',
    skills:['교묘한 손놀림','경과 관찰','장족의 발전','혁신','밑가공','절약 가공','절약 가공','절약 가공','혁신','절약 가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:404, durCost:40 },

  { id:'d02', tag:'저내구도',
    label:'[저내구] 교손+경관+장족+혁신+밑가공+절약×3+혁신+장족+비레고',
    skills:['교묘한 손놀림','경과 관찰','장족의 발전','혁신','밑가공','절약 가공','절약 가공','절약 가공','혁신','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:200, buffSum:1.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:382, durCost:40 },

  { id:'d03', tag:'저내구도',
    label:'[저내구] 교손+장족+혁신+중급+밑가공+장족+비레고',
    skills:['교묘한 손놀림','장족의 발전','혁신','중급 가공','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:125, buffSum:1.5, iqStacks:10 },
      { efficiency:200, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:274, durCost:35 },

  { id:'d04', tag:'저내구도',
    label:'[저내구] 교손+경관+혁신+중급+밑가공+장족+비레고',
    skills:['교묘한 손놀림','경과 관찰','혁신','중급 가공','밑가공','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:125, buffSum:0.5, iqStacks:10 },
      { efficiency:200, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:248, durCost:35 },

  // ══ 비레고 단독 ══

  { id:'b01', tag:'',
    label:'비레고의 축복',
    skills:['비레고의 축복'],
    efficiency:300, buffSum:0, iqStacks:10,
    cpCost:24, durCost:10 },

  { id:'b02', tag:'',
    label:'혁신+비레고',
    skills:['혁신','비레고의 축복'],
    efficiency:300, buffSum:0.5, iqStacks:10,
    cpCost:42, durCost:10 },

  { id:'b03', tag:'',
    label:'장족+비레고',
    skills:['장족의 발전','비레고의 축복'],
    efficiency:300, buffSum:1.0, iqStacks:10,
    cpCost:56, durCost:10 },

  { id:'b04', tag:'',
    label:'장족+혁신+비레고',
    skills:['장족의 발전','혁신','비레고의 축복'],
    efficiency:300, buffSum:1.5, iqStacks:10,
    cpCost:74, durCost:10 },

  // ══ CP X (성손/대손 포함) ══

  { id:'cx01', tag:'',
    label:'혁신+성손+대손×3+혁신+성손+대손+장족+비레고',
    skills:['혁신','성급한 손길','대담한 손길','성급한 손길','대담한 손길','혁신','성급한 손길','대담한 손길','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:92, durCost:80 },

  { id:'cx02', tag:'',
    label:'혁신+성손+대손×2+혁신+장족+비레고',
    skills:['혁신','성급한 손길','대담한 손길','성급한 손길','대담한 손길','혁신','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:92, durCost:60 },

  { id:'cx03', tag:'',
    label:'혁신+성손+대손+장족+비레고',
    skills:['혁신','성급한 손길','대담한 손길','장족의 발전','비레고의 축복'],
    multiStep:true, steps:[
      { efficiency:100, buffSum:0.5, iqStacks:10 },
      { efficiency:150, buffSum:0.5, iqStacks:10 },
      { efficiency:300, buffSum:1.5, iqStacks:10 },
    ], cpCost:74, durCost:40 },
];


// ============================================================
//  작업 계산기 UI
// ============================================================

// ── 통합 계산기 상태 ──
let calcRegionVal = '', calcCategoryVal = '', calcGroupVal = '', calcVariantIdx = 0;

// category 매핑
const CAT_DISPLAY = { 'A': 'A등급', 'A-EX': 'A등급 EX', '시간제': '시간제', '날씨제': '날씨제', '기타': '기타' };
const CAT_ORDER   = ['A', 'A-EX', '시간제', '날씨제', '기타'];

function onRegionChange() {
  calcRegionVal   = document.getElementById('sel-region').value;
  calcCategoryVal = '';
  calcGroupVal    = '';
  calcVariantIdx  = 0;

  const catSel = document.getElementById('sel-category');
  catSel.innerHTML = '<option value="">── 카테고리 선택 ──</option>';
  catSel.disabled = !calcRegionVal;

  if (calcRegionVal) {
    const cats = [...new Set(HARD_RECIPES.filter(r => r.region === calcRegionVal).map(r => r.category || 'A-EX'))];
    CAT_ORDER.filter(c => cats.includes(c)).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = CAT_DISPLAY[c] || c;
      catSel.appendChild(opt);
    });
  }

  document.getElementById('recipe-pill-bar').style.display = 'none';
  resetCalcResults();
}

function onCategoryChange() {
  calcCategoryVal = document.getElementById('sel-category').value;
  calcGroupVal    = '';
  calcVariantIdx  = 0;
  buildRecipePills();
  resetCalcResults();
}

function buildRecipePills() {
  const bar = document.getElementById('recipe-pill-bar');
  bar.innerHTML = '';
  if (!calcRegionVal || !calcCategoryVal) { bar.style.display = 'none'; return; }

  const recipes = HARD_RECIPES.filter(r => r.region === calcRegionVal && (r.category || 'A-EX') === calcCategoryVal);
  const groups  = [...new Set(recipes.map(r => r.group))].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));

  // 그룹별 색 할당
  const GROUP_COLORS = ['#5ab8d4','#c8b840','#a06ccc','#4dc890','#e85a7a'];
  const colorMap = {};
  groups.forEach((g, i) => { colorMap[g] = GROUP_COLORS[i % GROUP_COLORS.length]; });

  let html = '';
  groups.forEach((grp, gi) => {
    const items = recipes.filter(r => r.group === grp);
    const col   = colorMap[grp];
    html += `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:6px;">`;
    items.forEach((r, i) => {
      if (i > 0) html += `<span style="font-size:10px;color:var(--text-dim)">→</span>`;
      html += `<button class="variant-pill" style="border-color:${col}33;" data-group="${r.group}" data-vidx="${i}"
        onclick="selectRecipePill('${r.group}',${i},this)">
        <span class="vp-tag" style="color:${col}">${r.tag}</span>
        <span class="vp-meta">${r.durability} · ${r.work.toLocaleString()}</span>
        <span class="vp-meta" style="color:var(--green)">${r.quality.toLocaleString()}</span>
      </button>`;
    });
    html += `</div>`;
  });

  bar.innerHTML = html;
  bar.style.display = 'block';
}

function selectRecipePill(group, vidx, btn) {
  document.querySelectorAll('#recipe-pill-bar .variant-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  calcGroupVal   = group;
  calcVariantIdx = vidx;
  // 레시피 바뀌면 마무리 입력값 리셋
  ['q-current-quality','q-dur-current','q-gyomyo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('filled'); }
  });
  const hiddenDur = document.getElementById('q-dur');
  const calcBox   = document.getElementById('q-dur-calc');
  if (hiddenDur) hiddenDur.value = '';
  if (calcBox)   { calcBox.style.display = 'none'; calcBox.innerHTML = ''; }
  updateQDurPlaceholder();
  renderBothResults();
}

function onCraftsChange() {
  const el = document.getElementById('crafts-input');
  if (el) el.classList.toggle('filled', el.value !== '');
  renderBothResults();
}

function resetCalcResults() {
  document.getElementById('calc-tab-work').innerHTML = `<div class="c-empty-state"><div class="c-empty-icon">⚒</div><p>지역과 레시피를 선택하면<br>작업량 계산 결과가 표시됩니다</p></div>`;
  document.getElementById('calc-tab-qual').innerHTML = `<div class="c-empty-state"><div class="c-empty-icon">✨</div><p>레시피와 능력치를 입력하면<br>품질 마무리 로테이션이 표시됩니다</p></div>`;
}

function renderBothResults() {
  if (!calcRegionVal || !calcGroupVal) { resetCalcResults(); return; }
  const variants = HARD_RECIPES.filter(r => r.region === calcRegionVal && r.group === calcGroupVal);
  if (!variants.length) return;
  const recipe = variants[Math.min(calcVariantIdx, variants.length - 1)];
  const crafts = parseInt(document.getElementById('crafts-input').value) || 0;
  const s0     = calcS0(crafts, recipe.rlvl);
  renderWorkHTML(s0, recipe, '');
  renderQuality();
}

function renderWorkHTML(s0, recipe, variantUI) {
  const resultEl  = document.getElementById('calc-tab-work');
  const workReq   = recipe.work;
  const finishWork = calcWork(s0, FINISH_EFF, 1);
  const regionNames = { oizys: '오이지스', paenna: '파엔나', dongyeong: '동경의 만', '': '' };

  // ── 오프너 조합 행 계산 ──
  const openerRows = OPENER_COMBOS.map(combo => {
    const shinWork  = calcWork(s0, combo.shinEff,  combo.shinBuff);
    const koWork    = 0; // 공경은 작업량 0인 순수 버프스킬
    const skillWork = Math.floor(s0 * combo.skillEff / 100 * combo.skillBuff * (1 + combo.stateBuff));
    const total     = shinWork + koWork + skillWork;
    return { ...combo, shinWork, koWork, skillWork, total };
  });

  // 기준: 확신+공경+강행 (첫 번째 조합)
  const mainOpener  = openerRows[0];
  const remaining   = workReq > 0 ? workReq - mainOpener.total : null;

  // ── 스킬별 단독 작업량 ──
  const skillRows = SKILL_REF.map(sk => ({ ...sk, workAmt: calcWork(s0, sk.eff, 1) }));
  const kangWork  = skillRows[0].workAmt; // 강행 단독

  // 강행 횟수 계산 (내구 기준)
  const durability = typeof recipe.durability === 'number' ? recipe.durability : 0;
  const maxKang    = durability > 0 ? Math.floor((durability - 10) / 10) : 0;
  const neededKang = (remaining !== null && remaining > 0 && kangWork > 0)
    ? Math.ceil(remaining / kangWork) : 0;

  function getBadge(n) {
    if (!n) return '';
    if (n.includes('EX+')) return `<span class="recipe-badge badge-explus">EX+</span>`;
    if (n.includes('EX'))  return `<span class="recipe-badge badge-ex">EX</span>`;
    return `<span class="recipe-badge badge-normal">일반</span>`;
  }

  // ── 강행 횟수 안내 박스 ──
  let actionHtml = '';
  if (remaining !== null) {
    if (remaining <= 0) {
      // 오프너만으로 작업량 초과 → 진가 오프너 권장
      actionHtml = `<div class="action-box ok"><div class="action-icon">💡</div><div class="action-text">확신 오프너로 작업량이 바로 완성돼요. <b>진가 오프너</b>로 시작하는 게 더 좋아요 — 작업량 걱정 없이 품질에 집중할 수 있어요.</div></div>`;
    } else if (durability > 0 && neededKang <= maxKang) {
      actionHtml = `<div class="action-box ok"><div class="action-icon">⚡</div><div class="action-text">강행 작업 <b>${neededKang}회</b> 필요 (${kangWork.toLocaleString()} × ${neededKang}) — 가능 횟수 <b>${maxKang}회</b> ✔ <span style="font-size:10px;color:var(--text-dim)">공경 없는 기준</span></div></div>`;
    } else if (durability > 0) {
      actionHtml = `<div class="action-box warn"><div class="action-icon">⚠️</div><div class="action-text">강행 작업 <b>${neededKang}회 필요</b> / 가능 <b>${maxKang}회</b> — 다른 작업 스킬 혼용 검토 필요 <span style="font-size:10px;color:var(--text-dim)">공경 없는 기준</span></div></div>`;
    } else {
      actionHtml = `<div class="action-box warn"><div class="action-icon">⚡</div><div class="action-text">오프너 후 남은 진행도 <b>${remaining.toLocaleString()}</b> — 강행 작업 약 <b>${neededKang}회</b> 필요 <span style="font-size:10px;color:var(--text-dim)">공경 없는 기준 · 내구도 미입력</span></div></div>`;
    }
  }

  const remClass = remaining === null ? '' : remaining <= 0 ? 'ok' : remaining > workReq * 0.5 ? 'bad' : 'warn';

  resultEl.innerHTML = `
    ${variantUI}
    <div class="recipe-info-card">
      <div class="recipe-info-header">
        ${getBadge(recipe.missionName)}
        <span class="recipe-name">${recipe.group || '커스텀'}</span>
        ${recipe.region ? `<span style="font-size:11px;color:var(--text-dim)">${regionNames[recipe.region] || ''}</span>` : ''}
      </div>
      <div class="recipe-stats">
        <div class="recipe-stat"><div class="stat-lbl">작업량</div><div class="stat-val warn">${workReq ? workReq.toLocaleString() : '−'}</div></div>
        <div class="recipe-stat"><div class="stat-lbl">최고품질</div><div class="stat-val">${recipe.quality ? recipe.quality.toLocaleString() : '−'}</div></div>
        <div class="recipe-stat"><div class="stat-lbl">내구도</div><div class="stat-val">${recipe.durability || '−'}</div></div>
      </div>
    </div>

    <div class="c-result-card">
      <div class="c-result-card-title">확신 오프너 로테이션</div>
      <table class="rotation-table">
        <thead>
          <tr>
            <th>스킬 조합</th>
            <th class="num">효율</th>
            <th class="num">스킬 작업량</th>
            <th class="num">확신 + 스킬 합산</th>
          </tr>
        </thead>
        <tbody>
          ${openerRows.map(row => {
            return `
          <tr class="${row.highlight ? 'highlight' : ''}">
            <td><div class="skill-chips">${row.chips.map(c => {
              if (c.type === 'sep') return `<span class="chip sep">${c.text}</span>`;
              const sk = SKILL_ICONS[c.text];
              const iconHtml = sk ? `<img class="chip-icon" src="https://xivapi.com/i/001000/${sk.id}_hr1.png" alt="${c.text}" onerror="this.style.display='none'">` : '';
              return `<span class="chip ${c.type}">${iconHtml}${c.text}</span>`;
            }).join('')}</div></td>
            <td class="num">${row.skillEff}</td>
            <td class="num">${row.skillWork.toLocaleString()}</td>
            <td class="num"><b>${row.total.toLocaleString()}</b></td>
          </tr>`;}).join('')}
        </tbody>
      </table>
      ${remaining !== null ? `
      <div class="work-total-box">
        <div>
          <div class="work-total-label">오프너 후 남은 진행도</div>
          <div class="work-remain-info">
            <span>작업량 <b>${workReq.toLocaleString()}</b></span>
            <span>−</span>
            <span>확신+공경+강행 <b>${mainOpener.total.toLocaleString()}</b></span>
            <span>=</span>
          </div>
        </div>
        <div class="work-total-val ${remClass}">${remaining.toLocaleString()}</div>
      </div>` : ''}
      ${actionHtml}
    </div>

    <div class="c-result-card">
      <div class="c-result-card-title">스킬별 1회 작업량 참고</div>
      <table class="rotation-table">
        <thead><tr>
          <th>스킬</th>
          <th class="num">효율</th>
          <th class="num">작업량</th>
        </tr></thead>
        <tbody>
          ${skillRows.map(row => `<tr>
            <td><div class="skill-chips"><span class="chip work"><img class="chip-icon" src="https://xivapi.com/i/001000/${(SKILL_ICONS[row.name]||{}).id||'001501'}_hr1.png" onerror="this.style.display='none'">${row.name}</span></div></td>
            <td class="num">${row.eff}</td>
            <td class="num">${row.workAmt.toLocaleString()}</td>
          </tr>`).join('')}
          <tr style="opacity:.5">
            <td><div class="skill-chips"><span class="chip">마무리 '작업'</span></div></td>
            <td class="num">120</td>
            <td class="num">${finishWork.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      <div style="font-size:10px;color:var(--text-dim);margin-top:8px;">※ 마무리 '작업' 수치는 참고용이며 총 작업량에 포함되지 않습니다.</div>
    </div>
  `;
}


// ============================================================
//  품질 계산기 UI
// ============================================================

function updateQDurPlaceholder() {
  const el = document.getElementById('q-dur-current');
  if (!el) return;
  const variants = HARD_RECIPES.filter(r => r.region === calcRegionVal && r.group === calcGroupVal);
  if (!variants.length) { el.placeholder = '예: 55'; el.max = ''; return; }
  const recipe = variants[Math.min(calcVariantIdx, variants.length - 1)];
  el.placeholder = `최대 ${recipe.durability}`;
  el.max = recipe.durability;
}

function onQualityChange() {
  ['q-cons','q-cp','q-current-quality'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('filled', el.value !== '');
  });
  renderQuality();
}

function calcQualDur() {
  const current = parseInt(document.getElementById('q-dur-current').value) || 0;
  const stacks  = parseInt(document.getElementById('q-gyomyo').value) || 0;
  const hiddenDur = document.getElementById('q-dur');
  const calcBox   = document.getElementById('q-dur-calc');

  if (!current && !stacks) {
    hiddenDur.value = '';
    calcBox.style.display = 'none';
    renderQuality();
    return;
  }

  // 교묘한 손놀림: 남은 스택 수 × 5 내구 회복 (스택당 1턴 = +5)
  // 마무리 작업용 내구 10 차감 → 가공에 실제 사용 가능한 내구
  const FINISH_DUR = 10;                       // 마무리 '작업' 내구 소모
  const gyomyoBonus = stacks * 5;              // 남은 턴 × 5 회복
  const totalDur = Math.max(0, current + gyomyoBonus - FINISH_DUR);

  hiddenDur.value = totalDur;
  calcBox.style.display = 'block';

  if (current && stacks) {
    calcBox.innerHTML = `현재 내구 <b style="color:var(--text-bright)">${current}</b> + 교묘 ${stacks}스택 <span style="color:var(--text-dim)">(+${gyomyoBonus})</span> − 마무리 <span style="color:var(--text-dim)">(-${FINISH_DUR})</span> = 가공 가능 내구 <b style="color:var(--accent)">${totalDur}</b>`;
  } else if (current) {
    calcBox.innerHTML = `현재 내구 <b style="color:var(--text-bright)">${current}</b> − 마무리 <span style="color:var(--text-dim)">(-${FINISH_DUR})</span> = 가공 가능 내구 <b style="color:var(--accent)">${totalDur}</b> (교묘 스택 없음)`;
  } else {
    calcBox.innerHTML = `교묘 ${stacks}스택 → 최대 +${gyomyoBonus} 내구 회복 예정 (마무리 -${FINISH_DUR})`;
  }

  renderQuality();
}

function renderQuality() {
  const resultEl = document.getElementById('calc-tab-qual');
  if (!resultEl) return;
  const cons = parseInt(document.getElementById('q-cons').value) || 0;
  const cp   = parseInt(document.getElementById('q-cp').value)   || 0;
  const durInput = parseInt(document.getElementById('q-dur').value) || 0;

  if (!calcRegionVal || !calcGroupVal || !cons) {
    resultEl.innerHTML = `<div class="c-empty-state"><div class="c-empty-icon">✨</div><p>레시피와 가공 숙련도를 입력하면<br>품질 로테이션 결과가 표시됩니다</p></div>`;
    return;
  }

  const variants = HARD_RECIPES.filter(r => r.region === calcRegionVal && r.group === calcGroupVal);
  if (!variants.length) return;
  const recipe = variants[Math.min(calcVariantIdx, variants.length - 1)];

  const durLimit = durInput || recipe.durability;
  const rlvl   = recipe.rlvl;
  const c0    = calcC0(cons, rlvl);
  const c0iq  = calcC0(cons, rlvl); // IQ는 calcQuality 내부에서 처리
  const qualityGoal = recipe.quality;
  const regionNames = { oizys: '오이지스', paenna: '파엔나', dongyeong: '동경의 만' };

  function getBadge(n) {
    if (!n) return '';
    if (n.includes('EX+')) return `<span class="recipe-badge badge-explus">EX+</span>`;
    if (n.includes('EX'))  return `<span class="recipe-badge badge-ex">EX</span>`;
    return `<span class="recipe-badge badge-normal">일반</span>`;
  }

  // ── 전문장인 여부 ──
  const isExpert = document.getElementById('q-expert')?.checked || false;

  // ── 현재 품질 (rows 계산 전에 선언 필요) ──
  const currentQuality = parseInt(document.getElementById('q-current-quality').value) || 0;

  // ── 로테이션 계산 (전문 필터링 포함) ──
  const rows = QUALITY_ROTATIONS.filter(rot => {
    if (rot.tag === '전문') return isExpert;
    return true;
  }).map(rot => {
    let q;
    if (rot.multiStep) {
      q = rot.steps.reduce(
        (sum, s) => sum + calcQuality(cons, rlvl, s.iqStacks, s.efficiency, s.buffSum), 0
      );
    } else {
      q = calcQuality(cons, rlvl, rot.iqStacks, rot.efficiency, rot.buffSum);
    }
    const remaining = (qualityGoal - currentQuality) - q;
    const pct = Math.min(100, Math.round((currentQuality + q) / qualityGoal * 100));
    const ok    = (currentQuality + q) >= qualityGoal;
    const cpOk  = cp === 0 || rot.cpCost <= cp;
    const durOk = durLimit === 0 || rot.durCost <= durLimit;
    const canDo = cpOk && durOk;  // CP·내구 조건 모두 만족
    return { ...rot, q, remaining, pct, ok, cpOk, durOk, canDo };
  });

  // ── 추천 로테이션 선정 ──
  // 조건 만족(canDo) + 품질 달성(ok) 중 품질 가장 높은 것
  const reachable = rows.filter(r => r.canDo && r.ok);
  const best = reachable.sort((a, b) => b.q - a.q)[0] || null;

  // ── 정렬: 조건OK+달성 → 조건OK+미달성(달성률 높은순) → 조건불가 ──
  const sorted = [
    ...rows.filter(r => r.canDo && r.ok).sort((a, b) => b.q - a.q),
    ...rows.filter(r => r.canDo && !r.ok).sort((a, b) => b.pct - a.pct),
    ...rows.filter(r => !r.canDo).sort((a, b) => b.pct - a.pct),
  ];

  // 변형 UI는 상단 바에서 이미 처리됨
  let variantUI = '';

  // ── 품질 진행 바 ──
  const neededQuality = Math.max(0, qualityGoal - currentQuality);
  const pctCurrent    = Math.min(100, Math.round(currentQuality / qualityGoal * 100));
  const achieved      = neededQuality === 0;

  const progressHtml = `
    <div class="qp-layout">
      <div class="qp-right">
        <div class="qp-row">
          <span class="qp-label">현재</span>
          <div class="qp-bar-wrap"><div class="qp-bar current" style="width:${pctCurrent}%"></div></div>
          <span class="qp-num">${currentQuality.toLocaleString()}</span>
        </div>
        <div class="qp-row">
          <span class="qp-label">최대</span>
          <div class="qp-bar-wrap"><div class="qp-bar max" style="width:100%"></div></div>
          <span class="qp-num">${qualityGoal.toLocaleString()}</span>
        </div>
        <div class="qp-footer">
          <span>남은 품질 <b class="${achieved ? 'ok' : 'highlight'}">${achieved ? '달성 ✔' : '+' + neededQuality.toLocaleString()}</b></span>
          <span>달성률 <b>${pctCurrent}%</b></span>
          <span style="margin-left:auto;">내구 <b style="color:var(--text-bright)">${durLimit || '−'}</b></span>
        </div>
      </div>
    </div>`;

  // ── 추천 카드 ──
  let recommendHtml = '';
  if (best) {
    recommendHtml = `
    <div class="rec-card">
      <div class="rec-card-header">
        <span class="rec-badge">★ 추천</span>
        <span class="rec-quality">${(currentQuality + best.q).toLocaleString()}</span>
        <span class="rec-quality-label">/ ${qualityGoal.toLocaleString()}</span>
        ${currentQuality > 0 ? `<span style="font-size:11px;color:var(--text-dim);">(+${best.q.toLocaleString()})</span>` : ''}
        <span class="rec-achieved">달성 ✔</span>
      </div>
      <div class="rec-chips">
        ${skillSeq(best.skills)}
      </div>
      <div class="rec-meta">
        <span class="rec-meta-item">CP <b>${best.cpCost}</b></span>
        <span class="rec-meta-sep">·</span>
        <span class="rec-meta-item">내구 <b>-${best.durCost}</b></span>
        ${best.note ? `<span class="rec-meta-sep">·</span><span class="rec-meta-item" style="color:var(--text-dim)">${best.note}</span>` : ''}
      </div>
    </div>`;
  } else {
    // 달성 가능한 로테이션이 없을 때
    const bestCanDo = rows.filter(r => r.canDo).sort((a, b) => b.q - a.q)[0];
    recommendHtml = `
    <div class="rec-card rec-card-fail">
      <div class="rec-card-header">
        <span class="rec-badge rec-badge-fail">⚠ 달성 불가</span>
        <span class="rec-quality" style="color:var(--text-dim)">${bestCanDo ? (currentQuality + bestCanDo.q).toLocaleString() : '−'}</span>
        <span class="rec-quality-label">/ ${qualityGoal.toLocaleString()}</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:6px;">
        현재 수치로는 CP·내구 조건을 만족하면서 품질을 달성할 수 있는 로테이션이 없어요.<br>
        ${bestCanDo ? `조건 내 최대 품질: <b style="color:var(--text-bright)">${(currentQuality + bestCanDo.q).toLocaleString()}</b> (목표까지 <b style="color:var(--yellow)">+${(qualityGoal - currentQuality - bestCanDo.q).toLocaleString()}</b> 부족)` : ''}
      </div>
    </div>`;
  }


  // ── 카드 렌더 ──
  function renderRotaCard(row) {
    const isBest = best && row.id === best.id;
    const qColor = row.ok ? 'var(--green)' : 'var(--text-dim)';
    const tagHtml = row.tag === '전문'
      ? `<span class="rota-badge tag-expert">전문장인</span>`
      : row.tag === '저내구도'
      ? `<span class="rota-badge tag-lowdur">저내구도</span>`
      : '';
    const cpBad  = !row.cpOk  ? ' style="color:var(--red)"' : '';
    const durBad = !row.durOk ? ' style="color:var(--red)"' : '';
    const disabled = !row.canDo ? ' rota-card-disabled' : '';
    const bestBorder = isBest ? ' rota-card-best' : '';
    return `
    <div class="rota-card${bestBorder}${disabled}" style="width:100%;min-width:0;box-sizing:border-box;">
      <div class="rota-card-icons">${skillSeq(row.skills)}</div>
      <div class="rota-card-mid">
        <div class="rota-card-meta">
          <span${durBad}>내구 <b>${row.durCost}</b></span>
          <span${cpBad}>CP <b>${row.cpCost}</b></span>
        </div>
        ${tagHtml ? `<div class="rota-card-tags">${tagHtml}</div>` : ''}
      </div>
      <div class="rota-card-quality" style="color:${qColor}">
        ${(currentQuality + row.q).toLocaleString()}
        ${currentQuality > 0 ? `<div style="font-size:10px;color:var(--text-dim);font-weight:400;">+${row.q.toLocaleString()}</div>` : ''}
      </div>
    </div>`;
  }

  const canDoRows   = sorted.filter(r => r.canDo);
  const cantDoRows  = sorted.filter(r => !r.canDo);
  const bestCards   = canDoRows.filter(r => best && r.id === best.id).map(renderRotaCard).join('');
  const okCards     = canDoRows.filter(r => !(best && r.id === best.id)).map(renderRotaCard).join('');
  const cantCards   = cantDoRows.map(renderRotaCard).join('');
  const cantDivider = cantDoRows.length
    ? `<div class="rota-divider cant-divider">
        <button class="cant-toggle" onclick="this.closest('.cant-divider').classList.toggle('open')">
          <span>조건 미충족 · ${cantDoRows.length}개</span>
          <svg class="cant-arrow" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="cant-body" style="overflow:hidden;width:100%;">${cantCards}</div>
      </div>`
    : '';

  resultEl.innerHTML = `
    ${variantUI}
    <div class="recipe-info-card">
      <div class="recipe-info-header">
        ${getBadge(recipe.missionName)}
        <span class="recipe-name">${recipe.group}</span>
        <span style="font-size:11px;color:var(--text-dim)">${regionNames[recipe.region] || ''}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text-dim)">rlvl <b style="color:var(--text-bright)">${recipe.rlvl}</b></span>
      </div>
      ${progressHtml}
    </div>

    ${recommendHtml}

    <div class="c-result-card">
      <div class="c-result-card-title">마무리 로테이션 목록</div>
      ${bestCards ? `<div class="rota-section-label">★ 추천</div>${bestCards}` : ''}
      ${okCards   ? `<div class="rota-section-label">가능</div>${okCards}` : ''}
      ${cantDivider}
    </div>
  `;
}
