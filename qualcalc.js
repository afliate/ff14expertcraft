'use strict';

// ============================================================
//  상수 & 데이터
// ============================================================

// 7.x 고난도 기준 levelDiv
const LEVEL_DIV = 180;

// 스킬 데이터
// type: 'progress' | 'quality' | 'buff' | 'durability' | 'special'
// cat:  팔레트 탭 카테고리
const SKILL_DATA = {
  /* ── 작업(progress) ── */
  muscleMemory:     { label: '근육 기억',       cat: 'progress', type: 'progress', eff: 300,  cp: 6,   dur: 10 },
  reflect:          { label: '진가',            cat: 'progress', type: 'progress', eff: 300,  cp: 6,   dur: 10, iqGain: 2 },
  basicSynth:       { label: '기초 합성',        cat: 'progress', type: 'progress', eff: 120,  cp: 0,   dur: 10 },
  carefulSynth:     { label: '모범 합성',        cat: 'progress', type: 'progress', eff: 180,  cp: 7,   dur: 10 },
  prudentSynth:     { label: '절약 작업',        cat: 'progress', type: 'progress', eff: 180,  cp: 18,  dur: 5  },
  groundwork:       { label: '집중 작업',        cat: 'progress', type: 'progress', eff: 360,  cp: 18,  dur: 20 },
  delicateSynth:    { label: '정밀 작업',        cat: 'progress', type: 'both',     eff: 100,  cp: 32,  dur: 10 },
  intensiveSynth:   { label: '집중 합성',        cat: 'progress', type: 'progress', eff: 400,  cp: 6,   dur: 10, condReq: 'good' },

  /* ── 가공(quality) ── */
  basicTouch:       { label: '기초 가공',        cat: 'quality',  type: 'quality',  eff: 100,  cp: 18,  dur: 10 },
  standardTouch:    { label: '표준 가공',        cat: 'quality',  type: 'quality',  eff: 125,  cp: 32,  dur: 10 },
  advancedTouch:    { label: '상급 가공',        cat: 'quality',  type: 'quality',  eff: 150,  cp: 46,  dur: 10 },
  prudentTouch:     { label: '절약 가공',        cat: 'quality',  type: 'quality',  eff: 100,  cp: 25,  dur: 5  },
  preparatoryTouch: { label: '밑가공',           cat: 'quality',  type: 'quality',  eff: 200,  cp: 40,  dur: 20, iqGain: 2 },
  preciseTouch:     { label: '집중 가공',        cat: 'quality',  type: 'quality',  eff: 150,  cp: 18,  dur: 10, condReq: 'good', iqGain: 2 },
  trainedFinesse:   { label: '장인의 기교',      cat: 'quality',  type: 'quality',  eff: 100,  cp: 32,  dur: 0  },
  byregotsBlessing: { label: '비레고의 축복',    cat: 'quality',  type: 'byregots', eff: 100,  cp: 24,  dur: 10 },
  trainedEye:       { label: '장인의 눈',        cat: 'quality',  type: 'trainedEye',eff:100,  cp: 250, dur: 10 },

  /* ── 버프(buff) ── */
  muscleMemoryBuff: null, // muscleMemory 는 progress 겸 버프 처리
  innovation:       { label: '혁신',            cat: 'buff',     type: 'buff',     cp: 18,  buffKey: 'innovation',  duration: 4  },
  veneration:       { label: '숭경',            cat: 'buff',     type: 'buff',     cp: 18,  buffKey: 'veneration',  duration: 4  },
  greatStrides:     { label: '장족의 발전',      cat: 'buff',     type: 'buff',     cp: 32,  buffKey: 'greatStrides',duration: 3  },
  finalAppraisal:   { label: '최종 확인',        cat: 'buff',     type: 'buff',     cp: 1,   buffKey: 'finalAppraisal',duration: 5 },
  manipulation:     { label: '교묘한 손놀림',    cat: 'durability',type:'buff',     cp: 96,  buffKey: 'manipulation', duration: 8 },
  wasteNot:         { label: '근검절약',         cat: 'durability',type:'buff',     cp: 56,  buffKey: 'wasteNot',    duration: 4  },
  wasteNot2:        { label: '장기 절약',        cat: 'durability',type:'buff',     cp: 98,  buffKey: 'wasteNot2',   duration: 8  },

  /* ── 내구 회복(durability) ── */
  mastersMend:      { label: '능숙한 땜질',      cat: 'durability',type:'repair',   cp: 88,  repairAmt: 30 },
  immaculateMend:   { label: '완벽한 땜질',      cat: 'durability',type:'repairFull',cp: 112 },

  /* ── 특수(special) ── */
  carefulObservation:{ label: '경과 관찰',       cat: 'special',  type: 'observe',  cp: 7  },
  tricksOfTrade:    { label: '비결',             cat: 'special',  type: 'tricks',   cp: 0,  condReq: 'good' },
};

// 팔레트 카테고리 레이블
const CAT_LABELS = {
  progress:   '작업',
  quality:    '가공',
  buff:       '버프',
  durability: '내구',
  special:    '특수',
};

// HQ 테이블 (품질% → HQ%)
const HQ_TABLE = [
  [0,1],[5,2],[9,3],[13,4],[17,5],[21,6],[25,7],[29,8],[33,9],[37,10],
  [41,11],[45,12],[49,13],[52,14],[55,15],[58,16],[61,17],[64,18],[67,19],[70,20],
  [73,21],[75,22],[77,23],[79,24],[81,25],[83,26],[85,27],[87,28],[89,29],[91,30],
  [92,31],[93,32],[94,34],[95,36],[96,40],[97,45],[98,52],[99,62],[100,100],
];

// ============================================================
//  계산 함수
// ============================================================

function getStats() {
  return {
    craftsmanship: parseInt(document.getElementById('qc-craftsmanship').value) || 0,
    control:       parseInt(document.getElementById('qc-control').value)       || 0,
    cp:            parseInt(document.getElementById('qc-cp').value)            || 0,
    level:         parseInt(document.getElementById('qc-level').value)         || 100,
  };
}

function getRecipe() {
  return {
    rlv:         parseInt(document.getElementById('qc-recipe-level').value)   || 690,
    baseProgress:parseInt(document.getElementById('qc-base-progress').value)  || 3900,
    baseQuality: parseInt(document.getElementById('qc-base-quality').value)   || 10920,
    durability:  parseInt(document.getElementById('qc-durability').value)     || 60,
  };
}

// 레벨 보정 계수 (팀크래프트 공식 기반)
function levelCorrection(playerLv, rlv) {
  const recipeClassLv = Math.floor(rlv / 5);   // rlv → 클래스 레벨 근사
  const diff = playerLv - recipeClassLv;
  if (diff >= 0) return 1.0 + Math.min(diff, 5) * 0.05;
  return Math.max(0.1, 1.0 + diff * 0.02);
}

// 작업량 1회
function calcProgress(craftsmanship, recipe, eff, buffs, playerLv) {
  const lc   = levelCorrection(playerLv, recipe.rlv);
  const vene = buffs.veneration > 0 ? 1.5 : 1.0;
  const mm   = buffs.muscleMemory > 0 ? 2.0 : 1.0;
  const base = Math.floor(craftsmanship * 10 / LEVEL_DIV + 2);
  return Math.floor(base * (eff / 100) * lc * vene * mm);
}

// 품질 1회
function calcQuality(control, recipe, eff, buffs, playerLv) {
  const lc     = levelCorrection(playerLv, recipe.rlv);
  const iq     = Math.min(buffs.innerQuiet, 10);
  const iqMod  = 1.0 + iq * 0.1;
  const innov  = buffs.innovation > 0   ? 1.5 : 1.0;
  const gs     = buffs.greatStrides > 0 ? 2.0 : 1.0;
  const base   = Math.floor(control * 10 / LEVEL_DIV + 35);
  return Math.floor(base * (eff / 100) * lc * iqMod * innov * gs);
}

// 비레고 품질 (IQ스택에 따라 효율 변동)
function calcByregots(control, recipe, buffs, playerLv) {
  const iq  = Math.min(buffs.innerQuiet, 10);
  const eff = 100 + iq * 20;   // IQ 10 → 효율 300%
  // greatStrides 는 calcQuality 안에서 처리
  return calcQuality(control, recipe, eff, buffs, playerLv);
}

// 내구 소모 (근검절약 버프 반영)
function duraCost(base, buffs) {
  if (buffs.wasteNot > 0 || buffs.wasteNot2 > 0) return Math.ceil(base / 2);
  return base;
}

// HQ% 계산
function calcHQ(qualityPct) {
  const pct = Math.min(100, Math.max(0, qualityPct));
  let hq = 1;
  for (const [q, h] of HQ_TABLE) {
    if (pct >= q) hq = h;
    else break;
  }
  return hq;
}

// ============================================================
//  시뮬레이션
// ============================================================

function simulate(sequence) {
  const stats  = getStats();
  const recipe = getRecipe();

  let progress   = 0;
  let quality    = 0;
  let dura       = recipe.durability;
  let cp         = stats.cp;
  let steps      = 0;
  let completed  = false;
  const log      = [];

  const buffs = {
    innerQuiet:      0,
    innovation:      0,
    veneration:      0,
    greatStrides:    0,
    manipulation:    0,
    wasteNot:        0,
    wasteNot2:       0,
    finalAppraisal:  0,
    muscleMemory:    0,
  };

  for (const key of sequence) {
    if (completed || dura <= 0) break;

    const sk = SKILL_DATA[key];
    if (!sk) continue;

    // CP 체크
    if (cp < (sk.cp || 0)) {
      log.push({ step: steps + 1, key, note: 'CP 부족 — 스킵' });
      continue;
    }
    cp -= (sk.cp || 0);
    steps++;

    // ── 버프 스킬 ──
    if (sk.type === 'buff') {
      buffs[sk.buffKey] = sk.duration;
      log.push({ step: steps, key, type: 'buff', label: sk.label });
    }

    // ── 내구 회복 ──
    else if (sk.type === 'repair') {
      dura = Math.min(dura + sk.repairAmt, recipe.durability);
      log.push({ step: steps, key, type: 'repair', label: sk.label, dura });
    }
    else if (sk.type === 'repairFull') {
      dura = recipe.durability;
      log.push({ step: steps, key, type: 'repair', label: sk.label, dura });
    }

    // ── 경과 관찰 ──
    else if (sk.type === 'observe') {
      log.push({ step: steps, key, type: 'observe', label: sk.label });
    }

    // ── 비결 (CP 회복) ──
    else if (sk.type === 'tricks') {
      cp = Math.min(cp + 20, stats.cp);
      log.push({ step: steps, key, type: 'tricks', label: sk.label, cp });
    }

    // ── 장인의 눈 (품질 100% 즉시) ──
    else if (sk.type === 'trainedEye') {
      quality = recipe.baseQuality;
      const dc = duraCost(sk.dur || 10, buffs);
      dura -= dc;
      log.push({ step: steps, key, type: 'quality', label: sk.label, gained: quality, quality, dura });
    }

    // ── 비레고의 축복 ──
    else if (sk.type === 'byregots') {
      const gained = calcByregots(stats.control, recipe, buffs, stats.level);
      quality += gained;
      if (buffs.greatStrides > 0) buffs.greatStrides = 0;
      buffs.innerQuiet = 0;
      const dc = duraCost(sk.dur || 10, buffs);
      dura -= dc;
      log.push({ step: steps, key, type: 'quality', label: sk.label, gained, quality, dura });
    }

    // ── 작업진척 ──
    else if (sk.type === 'progress') {
      let eff = sk.eff;
      // 집중 작업: 내구 < dur/2 이면 효율 절반
      if (key === 'groundwork' && dura < sk.dur) eff = Math.floor(eff / 2);

      const gained = calcProgress(stats.craftsmanship, recipe, eff, buffs, stats.level);
      progress += gained;

      // 근육 기억 버프 부여
      if (key === 'muscleMemory') buffs.muscleMemory = 5;

      const dc = duraCost(sk.dur || 10, buffs);
      dura -= dc;

      // IQ 부여 (reflect 등)
      if (sk.iqGain) buffs.innerQuiet = Math.min(buffs.innerQuiet + sk.iqGain, 10);

      log.push({ step: steps, key, type: 'progress', label: sk.label, gained, progress, dura });

      // 완성 체크
      if (progress >= recipe.baseProgress) {
        if (buffs.finalAppraisal > 0) {
          progress = recipe.baseProgress - 1;
          buffs.finalAppraisal = 0;
        } else {
          completed = true;
        }
      }
    }

    // ── 품질 ──
    else if (sk.type === 'quality') {
      const gained = calcQuality(stats.control, recipe, sk.eff, buffs, stats.level);
      quality += gained;

      if (buffs.greatStrides > 0) buffs.greatStrides = 0;
      if (buffs.innerQuiet > 0) {
        buffs.innerQuiet = Math.min(buffs.innerQuiet + (sk.iqGain || 1), 10);
      }

      const dc = duraCost(sk.dur || 10, buffs);
      dura -= dc;
      log.push({ step: steps, key, type: 'quality', label: sk.label, gained, quality, dura });
    }

    // ── both (정밀 작업) ──
    else if (sk.type === 'both') {
      const pGained = calcProgress(stats.craftsmanship, recipe, sk.eff, buffs, stats.level);
      const qGained = calcQuality(stats.control, recipe, sk.eff, buffs, stats.level);
      progress += pGained;
      quality  += qGained;
      if (buffs.innerQuiet > 0) buffs.innerQuiet = Math.min(buffs.innerQuiet + 1, 10);
      if (buffs.greatStrides > 0) buffs.greatStrides = 0;
      const dc = duraCost(sk.dur || 10, buffs);
      dura -= dc;
      log.push({ step: steps, key, type: 'both', label: sk.label, pGained, qGained, progress, quality, dura });

      if (progress >= recipe.baseProgress) {
        if (buffs.finalAppraisal > 0) { progress = recipe.baseProgress - 1; buffs.finalAppraisal = 0; }
        else completed = true;
      }
    }

    // ── 교묘한 손놀림 내구 회복 (매 스텝 후) ──
    if (buffs.manipulation > 0) {
      dura = Math.min(dura + 5, recipe.durability);
    }

    // ── 버프 카운트다운 ──
    ['innovation','veneration','greatStrides','manipulation',
     'wasteNot','wasteNot2','finalAppraisal','muscleMemory'].forEach(b => {
      if (buffs[b] > 0) buffs[b]--;
    });
  }

  const maxQuality   = recipe.baseQuality;
  const qualityPct   = Math.min(100, Math.floor(quality / maxQuality * 100));
  const hqPct        = calcHQ(qualityPct);

  return { progress, quality, dura, cp, steps, completed, log, recipe, maxQuality, qualityPct, hqPct };
}

// ============================================================
//  UI — 팔레트 렌더링
// ============================================================

let currentCat = 'progress';

function renderPalette() {
  const grid = document.getElementById('qc-palette');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(SKILL_DATA).forEach(([key, sk]) => {
    if (!sk || sk.cat !== currentCat) return;

    const btn = document.createElement('button');
    btn.className = 'qc-skill-btn';
    btn.type = 'button';

    // 아이콘 (ICONS 맵 활용 — index.html 에 이미 정의됨)
    const iconId = typeof ICONS !== 'undefined' ? ICONS[sk.label] : null;
    const folder = iconId && iconId.startsWith('06') ? '061000' : '001000';
    const imgHtml = iconId
      ? `<img src="https://xivapi.com/i/${folder}/${iconId}_hr1.png" alt="${sk.label}" onerror="this.style.display='none'">`
      : '';

    btn.innerHTML = `${imgHtml}<span class="qc-skill-label">${sk.label}</span>${sk.cp ? `<span class="qc-skill-cp">${sk.cp}CP</span>` : ''}`;
    btn.addEventListener('click', () => addSkill(key));
    grid.appendChild(btn);
  });
}

// 팔레트 탭 버튼 초기화
function initPaletteTabs() {
  document.querySelectorAll('.qc-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCat = btn.dataset.cat;
      document.querySelectorAll('.qc-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPalette();
    });
  });
}

// ============================================================
//  UI — 시퀀스
// ============================================================

let sequence = [];

function addSkill(key) {
  sequence.push(key);
  renderSequence();
  updateCpDisplay();
}

function removeSkill(idx) {
  sequence.splice(idx, 1);
  renderSequence();
  updateCpDisplay();
}

function undoSkill() {
  if (sequence.length === 0) return;
  sequence.pop();
  renderSequence();
  updateCpDisplay();
}

function clearSequence() {
  sequence = [];
  renderSequence();
  updateCpDisplay();
  hideResult();
}

function renderSequence() {
  const container = document.getElementById('qc-sequence');
  if (!container) return;

  if (sequence.length === 0) {
    container.innerHTML = '<p class="qc-empty-msg">아직 추가된 스킬이 없습니다 🙂</p>';
    document.getElementById('qc-step-count').textContent = '스텝 : 0';
    document.getElementById('qc-total-cp').textContent   = '총 CP 소비 : 0';
    return;
  }

  container.innerHTML = '';
  let totalCp = 0;

  sequence.forEach((key, idx) => {
    const sk = SKILL_DATA[key];
    if (!sk) return;
    totalCp += (sk.cp || 0);

    const chip = document.createElement('div');
    chip.className = 'qc-sequence-item';

    const iconId = typeof ICONS !== 'undefined' ? ICONS[sk.label] : null;
    const folder = iconId && iconId.startsWith('06') ? '061000' : '001000';
    const imgHtml = iconId
      ? `<img src="https://xivapi.com/i/${folder}/${iconId}_hr1.png" alt="${sk.label}" onerror="this.style.display='none'">`
      : '';

    chip.innerHTML = `
      <span class="qc-seq-num">${idx + 1}</span>
      ${imgHtml}
      <span class="qc-seq-label">${sk.label}</span>
      ${sk.cp ? `<span class="qc-seq-cp">${sk.cp}CP</span>` : ''}
      <button class="qc-seq-del" type="button" onclick="removeSkill(${idx})">✕</button>
    `;
    container.appendChild(chip);
  });

  document.getElementById('qc-step-count').textContent = `스텝 : ${sequence.length}`;
  document.getElementById('qc-total-cp').textContent   = `총 CP 소비 : ${totalCp}`;
}

function updateCpDisplay() {
  const stats  = getStats();
  const totalCp = sequence.reduce((sum, key) => sum + (SKILL_DATA[key]?.cp || 0), 0);
  const remain  = stats.cp - totalCp;
  const badge   = document.getElementById('qc-cp-display');
  if (badge) {
    badge.textContent = `CP : ${remain} / ${stats.cp}`;
    badge.style.color = remain < 0 ? 'var(--red)' : '';
  }
}

// ============================================================
//  UI — 결과 렌더링 (B안: 각 id에 값 주입)
// ============================================================

function hideResult() {
  const sec = document.getElementById('qc-result-section');
  if (sec) sec.classList.add('qc-hidden');
}

function showResult(result) {
  const sec = document.getElementById('qc-result-section');
  if (!sec) return;
  sec.classList.remove('qc-hidden');

  // 작업량
  const progressPct = Math.min(100, Math.floor(result.progress / result.recipe.baseProgress * 100));
  document.getElementById('qc-res-progress').textContent  = `${result.progress.toLocaleString()} / ${result.recipe.baseProgress.toLocaleString()}`;
  document.getElementById('qc-bar-progress').style.width  = `${progressPct}%`;
  document.getElementById('qc-pct-progress').textContent  = `${progressPct}%`;

  // 품질
  document.getElementById('qc-res-quality').textContent   = `${result.quality.toLocaleString()} / ${result.maxQuality.toLocaleString()}`;
  document.getElementById('qc-bar-quality').style.width   = `${result.qualityPct}%`;
  document.getElementById('qc-pct-quality').textContent   = `${result.qualityPct}%`;

  // 내구도
  const duraPct = Math.max(0, Math.floor(result.dura / result.recipe.durability * 100));
  document.getElementById('qc-res-durability').textContent = `${result.dura} / ${result.recipe.durability}`;
  document.getElementById('qc-bar-durability').style.width = `${duraPct}%`;
  document.getElementById('qc-pct-durability').textContent = `${duraPct}%`;

  // HQ
  document.getElementById('qc-res-hq').textContent        = `${result.hqPct}%`;
  document.getElementById('qc-bar-hq').style.width        = `${result.hqPct}%`;
  document.getElementById('qc-res-hq-sub').textContent    = `품질 ${result.qualityPct}% 달성 시`;

  // 제작 성공 여부
  const statusEl   = document.getElementById('qc-craft-status');
  const statusText = document.getElementById('qc-craft-status-text');
  if (statusEl && statusText) {
    statusEl.classList.remove('qc-hidden');
    if (result.completed) {
      statusText.textContent = '제작 성공 ✅';
      statusEl.style.color   = 'var(--green)';
    } else {
      statusText.textContent = '작업량 미달 ❌';
      statusEl.style.color   = 'var(--red)';
    }
  }

  // 단계별 로그
  renderLog(result.log);
}

function renderLog(log) {
  const el = document.getElementById('qc-step-log');
  if (!el) return;

  el.innerHTML = log.map(entry => {
    let detail = '';
    if (entry.type === 'progress') detail = `진척 +${entry.gained.toLocaleString()} → ${entry.progress.toLocaleString()} | 내구 ${entry.dura}`;
    else if (entry.type === 'quality') detail = `품질 +${entry.gained.toLocaleString()} → ${entry.quality.toLocaleString()} | 내구 ${entry.dura}`;
    else if (entry.type === 'both')   detail = `진척 +${entry.pGained} / 품질 +${entry.qGained} | 내구 ${entry.dura}`;
    else if (entry.type === 'buff')   detail = '버프 적용';
    else if (entry.type === 'repair') detail = `내구 → ${entry.dura}`;
    else if (entry.type === 'tricks') detail = `CP → ${entry.cp}`;
    else if (entry.note)              detail = entry.note;

    return `<div class="qc-log-row">
      <span class="qc-log-step">${entry.step}</span>
      <span class="qc-log-name">${entry.label || entry.key}</span>
      <span class="qc-log-detail">${detail}</span>
    </div>`;
  }).join('');
}

// ============================================================
//  역산
// ============================================================

function runReverse() {
  const targetHQ = parseInt(document.getElementById('qc-target-hq').value) || 90;
  const recipe   = getRecipe();
  const stats    = getStats();

  // 목표 HQ% 달성에 필요한 최소 품질%
  let minQPct = 100;
  for (const [q, h] of HQ_TABLE) {
    if (h >= targetHQ) { minQPct = q; break; }
  }

  const minQuality = Math.ceil(recipe.baseQuality * minQPct / 100);
  const lc         = levelCorrection(stats.level, recipe.rlv);

  // 비레고 IQ10 + 혁신 기준 역산
  // base = floor(control * 10 / LEVEL_DIV + 35)
  // quality = base * 3.0(효율300%) * lc * 2.0(IQ10) * 1.5(혁신)
  const totalMult  = 3.0 * lc * 2.0 * 1.5;
  const baseNeeded = minQuality / totalMult;
  const minControl = Math.ceil((baseNeeded - 35) * LEVEL_DIV / 10);

  const resEl = document.getElementById('qc-reverse-result');
  if (!resEl) return;
  resEl.classList.remove('qc-hidden');
  document.getElementById('qc-reverse-control').textContent = minControl.toLocaleString();
  document.getElementById('qc-reverse-quality').textContent = minQuality.toLocaleString();
  document.getElementById('qc-reverse-hq').textContent      = `${targetHQ}%`;
}

// ============================================================
//  초기화
// ============================================================

function initQualCalc() {
  initPaletteTabs();
  renderPalette();
  renderSequence();
  hideResult();

  // 시뮬레이션 버튼
  const simBtn = document.getElementById('qc-simulate-btn');
  if (simBtn) {
    simBtn.addEventListener('click', () => {
      if (sequence.length === 0) return;
      const result = simulate(sequence);
      showResult(result);
    });
  }

  // 초기화 버튼
  const clearBtn = document.getElementById('qc-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearSequence);

  // 되돌리기 버튼
  const undoBtn = document.getElementById('qc-undo-btn');
  if (undoBtn) undoBtn.addEventListener('click', undoSkill);

  // 역산 버튼
  const revBtn = document.getElementById('qc-reverse-btn');
  if (revBtn) revBtn.addEventListener('click', runReverse);

  // 스탯 입력 변경 시 CP 뱃지 업데이트
  ['qc-craftsmanship','qc-control','qc-cp','qc-level'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCpDisplay);
  });
}

document.addEventListener('DOMContentLoaded', initQualCalc);
