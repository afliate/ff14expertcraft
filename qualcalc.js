// ============================================================
//  qualcalc.js  ·  Part A : 상수 & 데이터 테이블
// ============================================================

'use strict';

/* ── 기본 상수 ── */
const BASE_PROGRESS_DIVIDER = 10;   // 작업진척 기본 제수
const BASE_QUALITY_DIVIDER  = 10;   // 품질 기본 제수

/* ── 로테이션 계수 테이블 ──
   각 로테이션마다 c0q (품질 계수) 값이 다름
   공식: 품질 = floor( 기본효율 × c0q × 내적제어/100 × 품질버프 )
*/
const ROTATION_TABLE = {
  // key: 로테이션 이름
  // c0p: 작업진척 계수, c0q: 품질 계수
  'standard': { label: '표준 로테이션',    c0p: 1.00, c0q: 1.00 },
  'expert':   { label: '고난도 로테이션',  c0p: 1.00, c0q: 0.80 },
};

/* ── 작업 레벨별 기본 수치 테이블 ──
   { rlv: 레시피 레벨, baseProgress, baseQuality, durability }
*/
const RECIPE_LEVEL_TABLE = [
  // 7.x 고난도 레시피 기준
  { rlv: 690, baseProgress: 360, baseQuality: 460, durability: 70 },
  { rlv: 695, baseProgress: 370, baseQuality: 480, durability: 70 },
  { rlv: 700, baseProgress: 380, baseQuality: 500, durability: 70 },
  { rlv: 705, baseProgress: 390, baseQuality: 520, durability: 70 },
  { rlv: 710, baseProgress: 400, baseQuality: 540, durability: 70 },
  { rlv: 715, baseProgress: 410, baseQuality: 560, durability: 70 },
  { rlv: 720, baseProgress: 420, baseQuality: 580, durability: 70 },
];

/* ── 스킬 데이터 테이블 ──
   efficiency: 기본 효율(%)
   type: 'progress' | 'quality' | 'both'
   cpCost: CP 소모
*/
const SKILL_TABLE = {
  // ── 작업진척 스킬 ──
  'basicSynth':         { label: '기초 합성',       efficiency: 120, type: 'progress', cpCost: 0  },
  'carefulSynth':       { label: '모범 합성',        efficiency: 180, type: 'progress', cpCost: 7  },
  'prudentSynth':       { label: '검약 합성',        efficiency: 180, type: 'progress', cpCost: 18 },
  'groundwork':         { label: '집중 작업',        efficiency: 360, type: 'progress', cpCost: 18 },
  'groundworkHalf':     { label: '집중 작업(내구절반)', efficiency: 180, type: 'progress', cpCost: 18 },
  'delicateSynth':      { label: '정밀 작업',        efficiency: 100, type: 'both',     cpCost: 32 },
  'intensiveSynth':     { label: '집중 합성',        efficiency: 400, type: 'progress', cpCost: 6  },
  'muscleMemory':       { label: '근육 기억',        efficiency: 300, type: 'progress', cpCost: 6  },

  // ── 품질 스킬 ──
  'basicTouch':         { label: '기초 가공',        efficiency: 100, type: 'quality',  cpCost: 18 },
  'standardTouch':      { label: '표준 가공',        efficiency: 125, type: 'quality',  cpCost: 32 },
  'advancedTouch':      { label: '상급 가공',        efficiency: 150, type: 'quality',  cpCost: 46 },
  'prudentTouch':       { label: '검약 가공',        efficiency: 100, type: 'quality',  cpCost: 25 },
  'preparatoryTouch':   { label: '준비 가공',        efficiency: 200, type: 'quality',  cpCost: 40 },
  'trainedEye':         { label: '장인의 눈',        efficiency: 100, type: 'quality',  cpCost: 250},
  'byregotsBlessing':   { label: '비레고의 축복',    efficiency: 100, type: 'quality',  cpCost: 24 },
  'preciseTouch':       { label: '집중 가공',        efficiency: 150, type: 'quality',  cpCost: 18 },
  'refinedTouch':       { label: '정제 가공',        efficiency: 100, type: 'quality',  cpCost: 24 },
  'trainedFinesse':     { label: '장인의 기교',      efficiency: 100, type: 'quality',  cpCost: 32 },
  'immaculateMend':     { label: '완벽한 수선',      efficiency:   0, type: 'quality',  cpCost: 112},
};

/* ── 버프 스킬 데이터 ──
   duration: 지속 스텝
   bonus: 효율 보너스 배율 or 특수 효과 설명
*/
const BUFF_TABLE = {
  'innerQuiet':         { label: '내적 안정',   maxStack: 10, type: 'stack'   },
  'greatStrides':       { label: '탁월한 진보', duration: 3,  bonus: 2.0,     type: 'multiplier' },
  'innovation':         { label: '혁신',        duration: 4,  bonus: 0.5,     type: 'additive'   },
  'veneration':         { label: '숭경',        duration: 4,  bonus: 0.5,     type: 'additive'   },
  'manipulation':       { label: '마스터 메카',  duration: 8,  type: 'repair'  },
  'wasteNot':           { label: '근검절약',     duration: 4,  type: 'dura'    },
  'wasteNot2':          { label: '근검절약 II',  duration: 8,  type: 'dura'    },
  'finalAppraisal':     { label: '최종 감정',    duration: 5,  type: 'special' },
  'carefulObservation': { label: '세심한 관찰',  uses: 3,      type: 'special' },
};

// ============================================================
//  qualcalc.js  ·  Part B : 핵심 계산 함수
// ============================================================

/* ── 플레이어 스탯 읽기 ── */
function getPlayerStats() {
  return {
    craftsmanship: parseInt(document.getElementById('qc-craftsmanship').value) || 0,
    control:       parseInt(document.getElementById('qc-control').value)       || 0,
    cp:            parseInt(document.getElementById('qc-cp').value)            || 0,
    level:         parseInt(document.getElementById('qc-level').value)         || 90,
  };
}

/* ── 레시피 정보 읽기 ── */
function getRecipeInfo() {
  const rlv = parseInt(document.getElementById('qc-recipe-level').value) || 690;
  return RECIPE_LEVEL_TABLE.find(r => r.rlv === rlv) || RECIPE_LEVEL_TABLE;
}

/* ── 레벨 보정 계수 계산 ──
   플레이어 레벨과 레시피 레벨 차이에 따른 보정
   FFXIV 공식 기준
*/
function getLevelCorrection(playerLevel, recipeRlv) {
  const diff = playerLevel - Math.floor(recipeRlv / 5);
  if (diff >= 0) {
    return 1.0 + Math.min(diff, 5) * 0.05;   // 최대 +25%
  } else {
    return Math.max(0.1, 1.0 + diff * 0.02); // 레벨 낮으면 페널티
  }
}

/* ── 작업진척 1회 계산 ──
   공식: floor( 작업속도 / 제수 × 레벨보정 × 효율/100 × 버프배율 )
*/
function calcProgress(craftsmanship, recipe, efficiency, buffs) {
  const levelCorr = getLevelCorrection(
    parseInt(document.getElementById('qc-level').value) || 90,
    recipe.rlv
  );

  // 숭경(Veneration) 버프: +50% 작업진척
  const venerationBonus = buffs.veneration ? 1.5 : 1.0;
  // 근육 기억(Muscle Memory) 버프: +100% 작업진척
  const muscleBonus = buffs.muscleMemory ? 2.0 : 1.0;

  const base = Math.floor(
    (craftsmanship * 10) / recipe.baseProgress + 2
  );

  return Math.floor(
    base * (efficiency / 100) * levelCorr * venerationBonus * muscleBonus
  );
}

/* ── 품질 1회 계산 ──
   공식: floor( 제어력 / 제수 × 레벨보정 × 효율/100 × IQ보정 × 버프배율 )
*/
function calcQuality(control, recipe, efficiency, buffs) {
  const levelCorr = getLevelCorrection(
    parseInt(document.getElementById('qc-level').value) || 90,
    recipe.rlv
  );

  // 내적 안정(Inner Quiet) 스택: 스택당 +10% 제어력
  const iqStack   = Math.min(buffs.innerQuiet || 0, 10);
  const iqBonus   = 1.0 + iqStack * 0.1;

  // 혁신(Innovation) 버프: +50% 품질
  const innovBonus = buffs.innovation ? 1.5 : 1.0;
  // 탁월한 진보(Great Strides) 버프: +100% 품질 (1회 소비)
  const gsBonus    = buffs.greatStrides ? 2.0 : 1.0;

  const base = Math.floor(
    (control * 10) / recipe.baseQuality + 35
  );

  return Math.floor(
    base * (efficiency / 100) * levelCorr * iqBonus * innovBonus * gsBonus
  );
}

/* ── 비레고의 축복 품질 계산 ──
   효율 = 100 + IQ스택 × 20  (최대 스택 10 → 효율 300%)
*/
function calcByregotsQuality(control, recipe, buffs) {
  const iqStack  = Math.min(buffs.innerQuiet || 0, 10);
  const efficiency = 100 + iqStack * 20;
  return calcQuality(control, recipe, efficiency, buffs);
}

/* ── 집중 작업(Groundwork) 내구 절반 패널티 체크 ──
   현재 내구 < 집중 작업 소모 내구(20)의 절반 → 효율 절반
*/
function getGroundworkEfficiency(currentDura) {
  return currentDura >= 20 ? 360 : 180;
}

/* ── 내구 소모 계산 ──
   근검절약 버프 시 소모 내구 절반(올림)
*/
function calcDuraCost(baseCost, buffs) {
  if (buffs.wasteNot || buffs.wasteNot2) {
    return Math.ceil(baseCost / 2);
  }
  return baseCost;
}

/* ── 전체 시뮬레이션 ──
   스킬 배열을 순서대로 실행하며 최종 품질 / 작업진척 / 내구 / CP 반환
*/
function simulate(skillSequence) {
  const stats  = getPlayerStats();
  const recipe = getRecipeInfo();

  let progress  = 0;
  let quality   = 0;
  let durability = recipe.durability;
  let cp        = stats.cp;
  let step      = 0;
  let completed = false;

  // 버프 상태
  let buffs = {
    innerQuiet:   0,      // 스택 수
    greatStrides: 0,      // 남은 스텝
    innovation:   0,
    veneration:   0,
    manipulation: 0,
    wasteNot:     0,
    wasteNot2:    0,
    finalAppraisal: 0,
    muscleMemory: 0,
  };

  const log = [];

  for (const skillKey of skillSequence) {
    if (completed) break;
    if (durability <= 0) break;

    step++;

    // ── CP 소모 체크 ──
    const skill = SKILL_TABLE[skillKey] || BUFF_TABLE[skillKey];
    if (!skill) continue;

    const cpCost = skill.cpCost || 0;
    if (cp < cpCost) {
      log.push({ step, skill: skillKey, error: 'CP 부족' });
      break;
    }
    cp -= cpCost;

    // ── 버프 스킬 처리 ──
    if (skillKey === 'innerQuiet') {
      buffs.innerQuiet = 1;
      log.push({ step, skill: skillKey, type: 'buff', note: 'IQ 시작' });

    } else if (skillKey === 'greatStrides') {
      buffs.greatStrides = 3;
      log.push({ step, skill: skillKey, type: 'buff' });

    } else if (skillKey === 'innovation') {
      buffs.innovation = 4;
      log.push({ step, skill: skillKey, type: 'buff' });

    } else if (skillKey === 'veneration') {
      buffs.veneration = 4;
      log.push({ step, skill: skillKey, type: 'buff' });

    } else if (skillKey === 'manipulation') {
      buffs.manipulation = 8;
      log.push({ step, skill: skillKey, type: 'buff' });

    } else if (skillKey === 'wasteNot') {
      buffs.wasteNot = 4;
      log.push({ step, skill: skillKey, type: 'buff' });

    } else if (skillKey === 'wasteNot2') {
      buffs.wasteNot2 = 8;
      log.push({ step, skill: skillKey, type: 'buff' });

    } else if (skillKey === 'finalAppraisal') {
      buffs.finalAppraisal = 5;
      log.push({ step, skill: skillKey, type: 'buff' });

    // ── 작업진척 스킬 처리 ──
    } else if (SKILL_TABLE[skillKey]?.type === 'progress') {
      let eff = SKILL_TABLE[skillKey].efficiency;
      if (skillKey === 'groundwork') {
        eff = getGroundworkEfficiency(durability);
      }
      const gained = calcProgress(stats.craftsmanship, recipe, eff, buffs);
      progress += gained;

      // 내구 소모
      const duraCost = calcDuraCost(10, buffs); // 기본 내구 소모 10
      durability -= duraCost;

      // 근육 기억 버프 소비
      if (skillKey === 'muscleMemory') {
        buffs.muscleMemory = 5;
      }

      log.push({ step, skill: skillKey, type: 'progress', gained, progress, durability });

      // 완성 체크 (최종 감정 있으면 1 남김)
      if (progress >= recipe.baseProgress * 10) {
        if (buffs.finalAppraisal > 0) {
          progress = recipe.baseProgress * 10 - 1;
          buffs.finalAppraisal = 0;
        } else {
          completed = true;
        }
      }

    // ── 품질 스킬 처리 ──
    } else if (SKILL_TABLE[skillKey]?.type === 'quality') {
      let gained = 0;
      if (skillKey === 'byregotsBlessing') {
        gained = calcByregotsQuality(stats.control, recipe, buffs);
        buffs.innerQuiet = 0; // 비레고 사용 후 IQ 초기화
      } else {
        gained = calcQuality(stats.control, recipe, SKILL_TABLE[skillKey].efficiency, buffs);
      }

      // IQ 스택 증가 (비레고 제외)
      if (skillKey !== 'byregotsBlessing' && buffs.innerQuiet > 0) {
        buffs.innerQuiet = Math.min(buffs.innerQuiet + 1, 10);
      }

      // 탁월한 진보 소비
      if (buffs.greatStrides > 0) buffs.greatStrides = 0;

      quality += gained;

      // 내구 소모
      let duraCost = calcDuraCost(10, buffs);
      if (skillKey === 'prudentTouch') duraCost = calcDuraCost(5, buffs);
      durability -= duraCost;

      log.push({ step, skill: skillKey, type: 'quality', gained, quality, durability });

    // ── 정밀 작업(both) 처리 ──
    } else if (SKILL_TABLE[skillKey]?.type === 'both') {
      const pGained = calcProgress(stats.craftsmanship, recipe, SKILL_TABLE[skillKey].efficiency, buffs);
      const qGained = calcQuality(stats.control, recipe, SKILL_TABLE[skillKey].efficiency, buffs);
      progress  += pGained;
      quality   += qGained;

      if (buffs.innerQuiet > 0) {
        buffs.innerQuiet = Math.min(buffs.innerQuiet + 1, 10);
      }

      const duraCost = calcDuraCost(10, buffs);
      durability -= duraCost;

      log.push({ step, skill: skillKey, type: 'both', pGained, qGained, progress, quality, durability });

      if (progress >= recipe.baseProgress * 10) {
        if (buffs.finalAppraisal > 0) {
          progress = recipe.baseProgress * 10 - 1;
          buffs.finalAppraisal = 0;
        } else {
          completed = true;
        }
      }
    }

    // ── 마스터 메카(Manipulation) 내구 회복 ──
    if (buffs.manipulation > 0) {
      durability = Math.min(durability + 5, recipe.durability);
    }

    // ── 버프 카운트다운 ──
    if (buffs.greatStrides  > 0) buffs.greatStrides--;
    if (buffs.innovation    > 0) buffs.innovation--;
    if (buffs.veneration    > 0) buffs.veneration--;
    if (buffs.manipulation  > 0) buffs.manipulation--;
    if (buffs.wasteNot      > 0) buffs.wasteNot--;
    if (buffs.wasteNot2     > 0) buffs.wasteNot2--;
    if (buffs.finalAppraisal > 0) buffs.finalAppraisal--;
    if (buffs.muscleMemory  > 0) buffs.muscleMemory--;
  }

  return {
    progress,
    quality,
    durability,
    cp,
    steps: step,
    completed,
    log,
    recipe,
    maxQuality: recipe.baseQuality * 10,
    qualityPercent: Math.min(100, Math.floor((quality / (recipe.baseQuality * 10)) * 100)),
  };
}

// ============================================================
//  qualcalc.js  ·  Part C : UI 렌더링 & 이벤트 핸들러
// ============================================================

/* ── 로테이션 빌더 UI 렌더링 ── */
function renderRotationBuilder() {
  const container = document.getElementById('qc-rotation-builder');
  if (!container) return;

  container.innerHTML = '';

  Object.entries(SKILL_TABLE).forEach(([key, skill]) => {
    const btn = document.createElement('button');
    btn.className   = `qc-skill-btn qc-skill-${skill.type}`;
    btn.dataset.key = key;
    btn.textContent = skill.label;

    // CP 표시
    if (skill.cpCost > 0) {
      const cp = document.createElement('span');
      cp.className   = 'qc-skill-cp';
      cp.textContent = `${skill.cpCost}CP`;
      btn.appendChild(cp);
    }

    btn.addEventListener('click', () => addSkillToSequence(key));
    container.appendChild(btn);
  });

  // 버프 스킬도 추가
  Object.entries(BUFF_TABLE).forEach(([key, buff]) => {
    const btn = document.createElement('button');
    btn.className   = 'qc-skill-btn qc-skill-buff';
    btn.dataset.key = key;
    btn.textContent = buff.label;

    if (buff.cpCost > 0) {
      const cp = document.createElement('span');
      cp.className   = 'qc-skill-cp';
      cp.textContent = `${buff.cpCost}CP`;
      btn.appendChild(cp);
    }

    btn.addEventListener('click', () => addSkillToSequence(key));
    container.appendChild(btn);
  });
}

/* ── 현재 로테이션 시퀀스 배열 ── */
let currentSequence = [];

/* ── 스킬 시퀀스에 추가 ── */
function addSkillToSequence(key) {
  currentSequence.push(key);
  renderSequence();
  runSimulation();
}

/* ── 스킬 시퀀스에서 제거 ── */
function removeSkillFromSequence(index) {
  currentSequence.splice(index, 1);
  renderSequence();
  runSimulation();
}

/* ── 시퀀스 UI 렌더링 ── */
function renderSequence() {
  const container = document.getElementById('qc-sequence');
  if (!container) return;

  container.innerHTML = '';

  if (currentSequence.length === 0) {
    container.innerHTML = '<p class="qc-seq-empty">스킬을 추가해주세요.</p>';
    return;
  }

  currentSequence.forEach((key, index) => {
    const skill = SKILL_TABLE[key] || BUFF_TABLE[key];
    if (!skill) return;

    const chip = document.createElement('div');
    chip.className = `qc-seq-chip qc-skill-${skill.type || 'buff'}`;

    const label = document.createElement('span');
    label.className   = 'qc-seq-label';
    label.textContent = `${index + 1}. ${skill.label}`;

    const del = document.createElement('button');
    del.className   = 'qc-seq-del';
    del.textContent = '✕';
    del.addEventListener('click', () => removeSkillFromSequence(index));

    chip.appendChild(label);
    chip.appendChild(del);
    container.appendChild(chip);
  });
}

/* ── 시뮬레이션 실행 & 결과 렌더링 ── */
function runSimulation() {
  if (currentSequence.length === 0) {
    clearResult();
    return;
  }

  const result = simulate(currentSequence);
  renderResult(result);
}

/* ── 결과 초기화 ── */
function clearResult() {
  const el = document.getElementById('qc-result');
  if (el) el.innerHTML = '<p class="qc-result-empty">로테이션을 구성해주세요.</p>';
}

/* ── 결과 렌더링 ── */
function renderResult(result) {
  const el = document.getElementById('qc-result');
  if (!el) return;

  const qPct  = result.qualityPercent;
  const hqPct = calcHQPercent(qPct);

  // 품질 바 색상
  const barColor = qPct >= 100 ? '#4caf50'
                 : qPct >= 75  ? '#8bc34a'
                 : qPct >= 50  ? '#ffc107'
                 :                '#f44336';

  el.innerHTML = `
    <div class="qc-result-grid">

      <div class="qc-result-card ${result.completed ? 'success' : 'fail'}">
        <span class="qc-result-icon">${result.completed ? '✅' : '❌'}</span>
        <span class="qc-result-title">완성 여부</span>
        <span class="qc-result-value">${result.completed ? '완성' : '미완성'}</span>
      </div>

      <div class="qc-result-card">
        <span class="qc-result-icon">✨</span>
        <span class="qc-result-title">품질</span>
        <span class="qc-result-value">${result.quality.toLocaleString()} / ${result.maxQuality.toLocaleString()}</span>
        <div class="qc-bar-wrap">
          <div class="qc-bar" style="width:${qPct}%; background:${barColor};"></div>
        </div>
        <span class="qc-result-sub">${qPct}%</span>
      </div>

      <div class="qc-result-card">
        <span class="qc-result-icon">🌟</span>
        <span class="qc-result-title">HQ 확률</span>
        <span class="qc-result-value hq">${hqPct}%</span>
      </div>

      <div class="qc-result-card">
        <span class="qc-result-icon">🔨</span>
        <span class="qc-result-title">작업진척</span>
        <span class="qc-result-value">${result.progress.toLocaleString()}</span>
      </div>

      <div class="qc-result-card">
        <span class="qc-result-icon">🛡️</span>
        <span class="qc-result-title">남은 내구</span>
        <span class="qc-result-value ${result.durability <= 0 ? 'danger' : ''}">
          ${result.durability} / ${result.recipe.durability}
        </span>
      </div>

      <div class="qc-result-card">
        <span class="qc-result-icon">💠</span>
        <span class="qc-result-title">남은 CP</span>
        <span class="qc-result-value">${result.cp}</span>
      </div>

      <div class="qc-result-card">
        <span class="qc-result-icon">🔢</span>
        <span class="qc-result-title">총 스텝</span>
        <span class="qc-result-value">${result.steps} 스텝</span>
      </div>

    </div>

    <details class="qc-log-detail">
      <summary>📋 스텝별 로그 보기</summary>
      <div class="qc-log-wrap">
        ${renderLog(result.log)}
      </div>
    </details>
  `;
}

/* ── HQ 확률 계산 ──
   FFXIV 공식 HQ 테이블 기반 근사값
*/
function calcHQPercent(qualityPct) {
  // 공식 HQ 테이블 (품질% → HQ%)
  const hqTable = [
    [0,  1], [5,  2], [9,  3], [13, 4], [17, 5],
    [21, 6], [25, 7], [29, 8], [33,  9], [37, 10],
    [41, 11],[45, 12],[49, 13],[52, 14],[55, 15],
    [58, 16],[61, 17],[64, 18],[67, 19],[70, 20],
    [73, 21],[75, 22],[77, 23],[79, 24],[81, 25],
    [83, 26],[85, 27],[87, 28],[89, 29],[91, 30],
    [92, 31],[93, 32],[94, 34],[95, 36],[96, 40],
    [97, 45],[98, 52],[99, 62],[100,100],
  ];

  const pct = Math.min(100, Math.max(0, qualityPct));
  let hq = 1;
  for (const [q, h] of hqTable) {
    if (pct >= q) hq = h;
    else break;
  }
  return hq;
}

/* ── 스텝 로그 렌더링 ── */
function renderLog(log) {
  if (!log || log.length === 0) return '<p>로그 없음</p>';

  return log.map(entry => {
    const skill = SKILL_TABLE[entry.skill] || BUFF_TABLE[entry.skill] || { label: entry.skill };
    let detail  = '';

    if (entry.type === 'progress') {
      detail = `진척 +${entry.gained} → ${entry.progress} | 내구 ${entry.durability}`;
    } else if (entry.type === 'quality') {
      detail = `품질 +${entry.gained} → ${entry.quality} | 내구 ${entry.durability}`;
    } else if (entry.type === 'both') {
      detail = `진척 +${entry.pGained} / 품질 +${entry.qGained} | 내구 ${entry.durability}`;
    } else if (entry.type === 'buff') {
      detail = entry.note || '버프 적용';
    } else if (entry.error) {
      detail = `⚠️ ${entry.error}`;
    }

    return `
      <div class="qc-log-row qc-log-${entry.type || 'buff'}">
        <span class="qc-log-step">${entry.step}</span>
        <span class="qc-log-name">${skill.label}</span>
        <span class="qc-log-detail">${detail}</span>
      </div>
    `;
  }).join('');
}

/* ── 시퀀스 초기화 버튼 ── */
function clearSequence() {
  currentSequence = [];
  renderSequence();
  clearResult();
}

/* ── 역산: 목표 HQ%를 위한 최소 제어력 계산 ── */
function calcMinControl() {
  const targetHQ  = parseInt(document.getElementById('qc-target-hq').value)  || 100;
  const recipe    = getRecipeInfo();
  const playerLv  = parseInt(document.getElementById('qc-level').value)       || 90;

  // 목표 HQ%에 필요한 최소 품질%
  const hqTable = [
    [0,1],[5,2],[9,3],[13,4],[17,5],[21,6],[25,7],[29,8],[33,9],[37,10],
    [41,11],[45,12],[49,13],[52,14],[55,15],[58,16],[61,17],[64,18],[67,19],[70,20],
    [73,21],[75,22],[77,23],[79,24],[81,25],[83,26],[85,27],[87,28],[89,29],[91,30],
    [92,31],[93,32],[94,34],[95,36],[96,40],[97,45],[98,52],[99,62],[100,100],
  ];

  // 목표 HQ%를 달성하는 최소 품질%
  let minQPct = 100;
  for (const [q, h] of hqTable) {
    if (h >= targetHQ) { minQPct = q; break; }
  }

  const minQuality    = Math.ceil(recipe.baseQuality * 10 * minQPct / 100);
  const levelCorr     = getLevelCorrection(playerLv, recipe.rlv);

  // 비레고 IQ10 기준 역산 (가장 효율적인 단일 스킬)
  // 비레고 효율 = 300%, IQ10 보너스 = 2.0, 혁신 = 1.5
  const byregoEff     = 3.0;   // 300%
  const iqBonus       = 2.0;   // IQ 10스택
  const innovBonus    = 1.5;   // 혁신 버프

  // base = floor(control * 10 / baseQuality + 35)
  // quality = base × byregoEff × levelCorr × iqBonus × innovBonus
  // → base = minQuality / (byregoEff × levelCorr × iqBonus × innovBonus)
  // → control = (base - 35) × baseQuality / 10

  const baseNeeded  = minQuality / (byregoEff * levelCorr * iqBonus * innovBonus);
  const minControl  = Math.ceil((baseNeeded - 35) * recipe.baseQuality / 10);

  const resultEl = document.getElementById('qc-reverse-result');
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="qc-reverse-card">
        <p>🎯 목표 HQ: <strong>${targetHQ}%</strong></p>
        <p>📊 필요 품질%: <strong>${minQPct}%</strong>
           (${minQuality.toLocaleString()} / ${(recipe.baseQuality * 10).toLocaleString()})</p>
        <p>🎮 최소 제어력: <strong>${minControl.toLocaleString()}</strong>
           <span class="qc-note">(비레고+IQ10+혁신 기준)</span></p>
      </div>
    `;
  }
}

/* ── 스탯 입력 변경 시 자동 재계산 ── */
function bindStatInputs() {
  const ids = ['qc-craftsmanship', 'qc-control', 'qc-cp', 'qc-level', 'qc-recipe-level'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', runSimulation);
  });
}

/* ── 초기화 (DOMContentLoaded) ── */
function initQualCalc() {
  renderRotationBuilder();
  renderSequence();
  clearResult();
  bindStatInputs();

  // 시퀀스 초기화 버튼
  const clearBtn = document.getElementById('qc-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearSequence);

  // 역산 버튼
  const reverseBtn = document.getElementById('qc-reverse-btn');
  if (reverseBtn) reverseBtn.addEventListener('click', calcMinControl);
}

document.addEventListener('DOMContentLoaded', initQualCalc);
