// ============================================================
//  qualcalc.js  ·  작업/품질 계산기
//  HARD_RECIPES 는 recipes.js 에서 로드됨
// ============================================================

// ── rlvl별 progressDivider / progressModifier ──
function getRlvlParams(rlvl) {
  if (rlvl >= 750) return { pD: 180, pM: 90 };
  if (rlvl >= 740) return { pD: 178, pM: 90 };
  if (rlvl >= 730) return { pD: 175, pM: 90 };
  if (rlvl >= 720) return { pD: 170, pM: 90 };
  if (rlvl >= 710) return { pD: 168, pM: 90 };
  if (rlvl >= 700) return { pD: 165, pM: 85 };
  return { pD: 160, pM: 80 };
}

// s0 = floor((crafts * 10/pD + 2) * pM/100)
function calcS0(crafts, rlvl) {
  const { pD, pM } = getRlvlParams(rlvl);
  return Math.floor((crafts * 10 / pD + 2) * pM / 100);
}

// 작업량 = floor(s0 × 효율/100 × 버프배율)
function calcWork(s0, efficiency, buffMult) {
  return Math.floor(s0 * efficiency / 100 * buffMult);
}

// c0 = floor((cons*10/150 + 35) * 75/100)
function calcC0(cons) {
  return Math.floor((cons * 10 / 150 + 35) * 75 / 100);
}

// ── 확신 오프너 조합 데이터 (상단 표) ──
// shinWork  = floor(s0 × 3.0)          확신 자체 작업량 (효율300)
// skillWork = floor(s0 × eff/100 × (skillBuff + stateBuff))
// total     = shinWork + skillWork
const OPENER_COMBOS = [
  {
    id: 'shin-ko-kang',
    label: '확신 + 공경 + 강행 작업',
    chips: [
      {type:'buff',text:'확신'},{type:'sep',text:'+'},
      {type:'buff',text:'공경'},{type:'sep',text:'+'},
      {type:'work',text:'강행 작업'},
    ],
    skillEff: 500, skillBuff: 1.5, stateBuff: 0, highlight: true,
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
    skillEff: 500, skillBuff: 1.5, stateBuff: 0.5, highlight: false,
  },
  {
    id: 'shin-ko-jip',
    label: '확신 + 공경 + 집중 작업',
    chips: [
      {type:'buff',text:'확신'},{type:'sep',text:'+'},
      {type:'buff',text:'공경'},{type:'sep',text:'+'},
      {type:'work',text:'집중 작업'},
    ],
    skillEff: 400, skillBuff: 1.5, stateBuff: 0, highlight: false,
  },
  {
    id: 'shin-ko-mit',
    label: '확신 + 공경 + 밑작업',
    chips: [
      {type:'buff',text:'확신'},{type:'sep',text:'+'},
      {type:'buff',text:'공경'},{type:'sep',text:'+'},
      {type:'work',text:'밑작업'},
    ],
    skillEff: 360, skillBuff: 1.5, stateBuff: 0, highlight: false,
  },
  {
    id: 'shin-ko-work',
    label: '확신 + 공경 + 작업',
    chips: [
      {type:'buff',text:'확신'},{type:'sep',text:'+'},
      {type:'buff',text:'공경'},{type:'sep',text:'+'},
      {type:'work',text:'작업'},
    ],
    skillEff: 120, skillBuff: 1.5, stateBuff: 0, highlight: false,
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
const QUALITY_ROTATIONS = [
  // 비레고 계열
  {
    id: 'jang-hyeok-bire',
    label: '장족 + 혁신 + 비레고 (10스택)',
    category: '비레고',
    chips: [
      {type:'buff',text:'장족의 발전'},{type:'sep',text:'+'},
      {type:'buff',text:'혁신'},{type:'sep',text:'+'},
      {type:'quality',text:'비레고 ×10스택'},
    ],
    qualityFn: c0 => c0 * 15,
    cpCost: 74, durCost: 50,
    note: '실측값 기준', highlight: true,
  },
  {
    id: 'jang-hyeok-mit2-bire',
    label: '장족 + 혁신 + 밑가공×2 + 비레고',
    category: '비레고',
    chips: [
      {type:'buff',text:'장족의 발전'},{type:'sep',text:'+'},
      {type:'buff',text:'혁신'},{type:'sep',text:'+'},
      {type:'quality',text:'밑가공×2'},{type:'sep',text:'+'},
      {type:'quality',text:'비레고 ×10스택'},
    ],
    qualityFn: c0 => Math.floor(c0 * 31.5),
    cpCost: 206, durCost: 90,
    note: '시트 기준 근사', highlight: false,
  },
  {
    id: 'hyeok-bire',
    label: '혁신 + 비레고 (10스택, 장족 없음)',
    category: '비레고',
    chips: [
      {type:'buff',text:'혁신'},{type:'sep',text:'+'},
      {type:'quality',text:'비레고 ×10스택'},
    ],
    qualityFn: c0 => Math.floor(c0 * 7.5),
    cpCost: 42, durCost: 50,
    note: '장족 없이 혁신만', highlight: false,
  },
  // 밑가공 계열
  {
    id: 'jang-hyeok-mit1',
    label: '장족 + 혁신 + 밑가공',
    category: '밑가공',
    chips: [
      {type:'buff',text:'장족의 발전'},{type:'sep',text:'+'},
      {type:'buff',text:'혁신'},{type:'sep',text:'+'},
      {type:'quality',text:'밑가공'},
    ],
    qualityFn: c0 => Math.floor(c0 * 5),
    cpCost: 142, durCost: 20,
    note: '장족+혁신 버프 포함', highlight: false,
  },
  {
    id: 'hyeok-mit1',
    label: '혁신 + 밑가공',
    category: '밑가공',
    chips: [
      {type:'buff',text:'혁신'},{type:'sep',text:'+'},
      {type:'quality',text:'밑가공'},
    ],
    qualityFn: c0 => Math.floor(c0 * 3),
    cpCost: 58, durCost: 20,
    note: '', highlight: false,
  },
  {
    id: 'hyeok-mit2',
    label: '혁신 + 밑가공 2회',
    category: '밑가공',
    chips: [
      {type:'buff',text:'혁신'},{type:'sep',text:'+'},
      {type:'quality',text:'밑가공×2'},
    ],
    qualityFn: c0 => Math.floor(c0 * 3) * 2,
    cpCost: 98, durCost: 40,
    note: '', highlight: false,
  },
  {
    id: 'hyeok-mit3',
    label: '혁신 + 밑가공 3회',
    category: '밑가공',
    chips: [
      {type:'buff',text:'혁신'},{type:'sep',text:'+'},
      {type:'quality',text:'밑가공×3'},
    ],
    qualityFn: c0 => Math.floor(c0 * 3) * 3,
    cpCost: 138, durCost: 60,
    note: '혁신 4턴 내', highlight: false,
  },
  // 절약 가공 계열
  {
    id: 'jang-hyeok-jeol',
    label: '장족 + 혁신 + 절약 가공',
    category: '절약 가공',
    chips: [
      {type:'buff',text:'장족의 발전'},{type:'sep',text:'+'},
      {type:'buff',text:'혁신'},{type:'sep',text:'+'},
      {type:'quality',text:'절약 가공'},
    ],
    qualityFn: c0 => Math.floor(c0 * 2.5),
    cpCost: 120, durCost: 5,
    note: '내구 5 소모', highlight: false,
  },
  {
    id: 'hyeok-jeol2',
    label: '혁신 + 절약 가공 2회',
    category: '절약 가공',
    chips: [
      {type:'buff',text:'혁신'},{type:'sep',text:'+'},
      {type:'quality',text:'절약 가공×2'},
    ],
    qualityFn: c0 => Math.floor(c0 * 1) * 2,
    cpCost: 68, durCost: 10,
    note: '', highlight: false,
  },
  // 마무리
  {
    id: 'sanggup',
    label: '상급 가공',
    category: '마무리',
    chips: [{type:'quality',text:'상급 가공'}],
    qualityFn: c0 => Math.floor(c0 * 1.5),
    cpCost: 46, durCost: 10,
    note: '', highlight: false,
  },
  {
    id: 'jang-sanggup',
    label: '장족 + 상급 가공',
    category: '마무리',
    chips: [
      {type:'buff',text:'장족의 발전'},{type:'sep',text:'+'},
      {type:'quality',text:'상급 가공'},
    ],
    qualityFn: c0 => Math.floor(c0 * 1.5 * 2),
    cpCost: 78, durCost: 10,
    note: '', highlight: false,
  },
];

// ============================================================
//  작업 계산기 UI
// ============================================================

let calcRegion = '';
let calcGroup = '';
let calcVariantIdx = 0;
let calcMode = 'preset';

function switchCalcMode(mode, btn) {
  calcMode = mode;
  btn.closest('.mode-toggle').querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('work-preset-mode').style.display = mode === 'preset' ? '' : 'none';
  document.getElementById('work-custom-mode').style.display = mode === 'custom' ? '' : 'none';
  if (mode === 'custom') calcCustomWork();
  else renderWorkResult_main();
}

function onRegionChange() {
  calcRegion = document.getElementById('sel-region').value;
  calcGroup = '';
  calcVariantIdx = 0;
  buildGroupSelector();
  renderWorkResult_main();
}

function onGroupChange() {
  calcGroup = document.getElementById('sel-group').value;
  calcVariantIdx = 0;
  renderWorkResult_main();
}

function onCraftsChange() {
  const el = document.getElementById('crafts-input');
  el.classList.toggle('filled', el.value !== '');
  if (calcMode === 'preset') renderWorkResult_main();
  else calcCustomWork();
}

function selectVariant(idx) {
  calcVariantIdx = idx;
  renderWorkResult_main();
}

function buildGroupSelector() {
  const sel = document.getElementById('sel-group');
  if (!calcRegion) {
    sel.innerHTML = '<option value="">── 지역을 먼저 선택 ──</option>';
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = '<option value="">── 레시피 선택 ──</option>';
  const groups = [...new Set(
    HARD_RECIPES.filter(r => r.region === calcRegion).map(r => r.group)
  )];
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    sel.appendChild(opt);
  });
}

function calcCustomWork() {
  const crafts     = parseInt(document.getElementById('crafts-input').value)    || 0;
  const workReq    = parseInt(document.getElementById('custom-work').value)     || 0;
  const quality    = parseInt(document.getElementById('custom-quality').value)  || 0;
  const durability = parseInt(document.getElementById('custom-dur').value)      || 0;
  const rlvl       = parseInt(document.getElementById('custom-rlvl').value)     || 720;
  const s0 = calcS0(crafts, rlvl);
  const fakeRecipe = {
    work: workReq, quality, durability,
    rlvl, group: '커스텀', region: '', tag: '', missionName: ''
  };
  renderWorkHTML(s0, fakeRecipe, '', 'custom');
}

function renderWorkResult_main() {
  const resultEl = document.getElementById('work-result');
  if (!calcRegion || !calcGroup) {
    resultEl.innerHTML = `<div class="c-empty-state"><div class="c-empty-icon">⚒</div><p>지역과 레시피를 선택하면<br>작업량 계산 결과가 표시됩니다</p></div>`;
    return;
  }
  const variants = HARD_RECIPES.filter(r => r.region === calcRegion && r.group === calcGroup);
  if (!variants.length) return;

  const crafts = parseInt(document.getElementById('crafts-input').value) || 0;

  let variantUI = '';
  if (variants.length > 1) {
    variantUI = `<div class="c-result-card"><div class="c-result-card-title">레시피 변형 선택</div><div class="variant-selector">`;
    variants.forEach((v, i) => {
      variantUI += `<button class="variant-btn ${i === calcVariantIdx ? 'active' : ''}" onclick="selectVariant(${i})">
        <span><b style="color:var(--text-bright)">${v.tag}</b>
        ${v.missionName ? `<span style="font-size:10px;color:var(--text-dim);margin-left:6px;">${v.missionName}</span>` : ''}</span>
        <span class="variant-meta">
          <span>작업량 <b>${v.work.toLocaleString()}</b></span>
          <span>내구 <b>${v.durability}</b></span>
          <span>rlvl <b>${v.rlvl}</b></span>
        </span>
      </button>`;
    });
    variantUI += `</div></div>`;
  }

  const recipe = variants[Math.min(calcVariantIdx, variants.length - 1)];
  const s0 = calcS0(crafts, recipe.rlvl);
  renderWorkHTML(s0, recipe, variantUI, 'preset');
}

function renderWorkHTML(s0, recipe, variantUI, mode) {
  const resultEl  = document.getElementById('work-result');
  const workReq   = recipe.work;
  const finishWork = calcWork(s0, FINISH_EFF, 1);
  const regionNames = { oizys: '오이지스', paenna: '파엔나', dongyeong: '동경의 만', '': '' };

  // ── 확신 작업량 (효율 300) ──
  const shinWork = calcWork(s0, 300, 1);

  // ── 오프너 조합 행 계산 ──
  const openerRows = OPENER_COMBOS.map(combo => {
    const totalBuff = combo.skillBuff * (1 + combo.stateBuff); // 버프는 곱셈
    const skillWork = calcWork(s0, combo.skillEff, totalBuff);
    const total     = shinWork + skillWork;
    return { ...combo, shinWork, skillWork, total };
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
      actionHtml = `<div class="action-box ok"><div class="action-icon">✅</div><div class="action-text">확신 오프너만으로 <b>작업량 충족</b>! 마무리 스킬만 사용하면 됩니다.</div></div>`;
    } else if (durability > 0 && neededKang <= maxKang) {
      actionHtml = `<div class="action-box ok"><div class="action-icon">⚡</div><div class="action-text">강행 작업 <b>${neededKang}회</b> 필요 (${kangWork.toLocaleString()} × ${neededKang}) — 가능 횟수 <b>${maxKang}회</b> ✔</div></div>`;
    } else if (durability > 0) {
      actionHtml = `<div class="action-box warn"><div class="action-icon">⚠️</div><div class="action-text">강행 작업 <b>${neededKang}회 필요</b> / 가능 <b>${maxKang}회</b> — 다른 작업 스킬 혼용 검토 필요</div></div>`;
    } else {
      actionHtml = `<div class="action-box warn"><div class="action-icon">⚡</div><div class="action-text">오프너 후 남은 진행도 <b>${remaining.toLocaleString()}</b> — 강행 작업 약 <b>${neededKang}회</b> 필요 (내구도 미입력)</div></div>`;
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
        <div class="recipe-stat"><div class="stat-lbl">s0 (효율100)</div><div class="stat-val ok">${s0}</div></div>
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
          ${openerRows.map(row => `
          <tr class="${row.highlight ? 'highlight' : ''}">
            <td><div class="skill-chips">${row.chips.map(c => `<span class="chip ${c.type}">${c.text}</span>`).join('')}</div></td>
            <td class="num">${row.skillEff}</td>
            <td class="num">${row.skillWork.toLocaleString()}</td>
            <td class="num"><b>${row.total.toLocaleString()}</b></td>
          </tr>`).join('')}
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
        <thead><tr><th>스킬</th><th class="num">효율</th><th class="num">작업량</th></tr></thead>
        <tbody>
          ${skillRows.map(row => `<tr>
            <td><span class="chip work">${row.name}</span></td>
            <td class="num">${row.eff}</td>
            <td class="num">${row.workAmt.toLocaleString()}</td>
          </tr>`).join('')}
          <tr style="opacity:.5">
            <td><span class="chip">마무리 '작업'</span></td>
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

let qRegion = '', qGroup = '', qVariantIdx = 0;

function onQRegionChange() {
  qRegion = document.getElementById('q-region').value;
  qGroup = ''; qVariantIdx = 0;
  buildQGroupSelector();
  renderQuality();
}

function onQGroupChange() {
  qGroup = document.getElementById('q-group').value;
  qVariantIdx = 0;
  buildQVariantSelector();
  renderQuality();
}

function onQVariantChange() {
  qVariantIdx = parseInt(document.getElementById('q-variant').value) || 0;
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

  // 교묘한 손놀림 1스택 = 8회 공정 × +5 = 최대 +40
  const gyomyoBonus = stacks * 40;
  const totalDur = current + gyomyoBonus;

  hiddenDur.value = totalDur;
  calcBox.style.display = 'block';

  if (current && stacks) {
    calcBox.innerHTML = `현재 내구 <b style="color:var(--text-bright)">${current}</b> + 교묘 ${stacks}스택 <span style="color:var(--text-dim)">(+${gyomyoBonus})</span> = 사용 가능 내구 <b style="color:var(--accent)">${totalDur}</b>`;
  } else if (current) {
    calcBox.innerHTML = `현재 내구 <b style="color:var(--text-bright)">${current}</b> (교묘 스택 없음)`;
  } else {
    calcBox.innerHTML = `교묘 ${stacks}스택 → 최대 +${gyomyoBonus} 내구 회복 예정`;
  }

  renderQuality();
}

function onQualityChange() {
  ['q-cons','q-cp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('filled', el.value !== '');
  });
  renderQuality();
}

function buildQGroupSelector() {
  const sel = document.getElementById('q-group');
  if (!qRegion) {
    sel.innerHTML = '<option value="">── 지역을 먼저 선택 ──</option>';
    sel.disabled = true; return;
  }
  sel.disabled = false;
  sel.innerHTML = '<option value="">── 레시피 선택 ──</option>';
  [...new Set(HARD_RECIPES.filter(r => r.region === qRegion).map(r => r.group))].forEach(g => {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    sel.appendChild(opt);
  });
}

function buildQVariantSelector() {
  const field = document.getElementById('q-variant-field');
  const sel = document.getElementById('q-variant');
  const variants = HARD_RECIPES.filter(r => r.region === qRegion && r.group === qGroup);
  if (variants.length <= 1) { field.style.display = 'none'; return; }
  field.style.display = '';
  sel.innerHTML = '';
  variants.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${v.tag} — 품질 ${v.quality.toLocaleString()} / 내구 ${v.durability}`;
    sel.appendChild(opt);
  });
}

function renderQuality() {
  const resultEl = document.getElementById('quality-result');
  const cons = parseInt(document.getElementById('q-cons').value) || 0;
  const cp   = parseInt(document.getElementById('q-cp').value)   || 0;
  const durInput = parseInt(document.getElementById('q-dur').value) || 0;

  if (!qRegion || !qGroup || !cons) {
    resultEl.innerHTML = `<div class="c-empty-state"><div class="c-empty-icon">✨</div><p>레시피와 가공 숙련도를 입력하면<br>품질 로테이션 결과가 표시됩니다</p></div>`;
    return;
  }

  const variants = HARD_RECIPES.filter(r => r.region === qRegion && r.group === qGroup);
  if (!variants.length) return;
  const recipe = variants[Math.min(qVariantIdx, variants.length - 1)];

  const durLimit = durInput || recipe.durability;
  if (!durInput && recipe.durability) {
    document.getElementById('q-dur').placeholder = `레시피 기본: ${recipe.durability}`;
  }

  const c0 = calcC0(cons);
  const qualityGoal = recipe.quality;
  const regionNames = { oizys: '오이지스', paenna: '파엔나', dongyeong: '동경의 만' };

  function getBadge(n) {
    if (!n) return '';
    if (n.includes('EX+')) return `<span class="recipe-badge badge-explus">EX+</span>`;
    if (n.includes('EX'))  return `<span class="recipe-badge badge-ex">EX</span>`;
    return `<span class="recipe-badge badge-normal">일반</span>`;
  }

  const categories = [...new Set(QUALITY_ROTATIONS.map(r => r.category))];
  const rows = QUALITY_ROTATIONS.map(rot => {
    const q = rot.qualityFn(c0);
    const remaining = qualityGoal - q;
    const pct = Math.min(100, Math.round(q / qualityGoal * 100));
    const ok = q >= qualityGoal;
    const cpOk = cp === 0 || rot.cpCost <= cp;
    const durOk = durLimit === 0 || rot.durCost <= durLimit;
    return { ...rot, q, remaining, pct, ok, cpOk, durOk };
  });

  // 변형 선택 UI
  let variantUI = '';
  if (variants.length > 1) {
    variantUI = `<div class="c-result-card"><div class="c-result-card-title">레시피 변형 선택</div><div class="variant-selector">`;
    variants.forEach((v, i) => {
      variantUI += `<button class="variant-btn ${i === qVariantIdx ? 'active' : ''}" onclick="qVariantIdx=${i};document.getElementById('q-variant').value=${i};renderQuality()">
        <span><b style="color:var(--text-bright)">${v.tag}</b>
        <span style="font-size:10px;color:var(--text-dim);margin-left:6px;">${v.missionName}</span></span>
        <span class="variant-meta">
          <span>품질 <b>${v.quality.toLocaleString()}</b></span>
          <span>내구 <b>${v.durability}</b></span>
          <span>rlvl <b>${v.rlvl}</b></span>
        </span>
      </button>`;
    });
    variantUI += `</div></div>`;
  }

  // 카테고리별 테이블
  let tableHtml = '';
  categories.forEach(cat => {
    const catRows = rows.filter(r => r.category === cat);
    tableHtml += `
    <div class="c-result-card">
      <div class="c-result-card-title">${cat} 로테이션</div>
      <table class="rotation-table">
        <thead><tr><th>스킬 조합</th><th class="num">품질</th><th class="num">달성률</th><th class="num">남은 품질</th><th class="num">CP</th><th class="num">내구</th></tr></thead>
        <tbody>
          ${catRows.map(row => {
            const sc = row.ok ? 'ok' : row.pct >= 80 ? 'warn' : '';
            return `<tr class="${row.highlight ? 'highlight' : ''}">
              <td>
                <div class="skill-chips">${row.chips.map(c => `<span class="chip ${c.type}">${c.text}</span>`).join('')}</div>
                ${row.note ? `<div style="font-size:10px;color:var(--text-dim);margin-top:2px;">${row.note}</div>` : ''}
              </td>
              <td class="num"><b class="${sc}">${row.q.toLocaleString()}</b>${row.ok ? ' ✔' : ''}</td>
              <td class="num">
                <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">
                  <div style="width:60px;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden;">
                    <div style="width:${row.pct}%;height:100%;background:${row.ok ? 'var(--green)' : row.pct>=80 ? 'var(--yellow)' : 'var(--accent-dim)'};"></div>
                  </div>
                  <span class="${sc}">${row.pct}%</span>
                </div>
              </td>
              <td class="num ${sc}">${row.ok ? '달성 ✔' : '+' + row.remaining.toLocaleString()}</td>
              <td class="num ${row.cpOk ? '' : 'bad'}">${row.cpCost}<span style="color:var(--text-dim);font-size:10px;">CP</span></td>
              <td class="num ${row.durOk ? '' : 'bad'}">${row.durCost > 0 ? '-' + row.durCost : '−'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  });

  resultEl.innerHTML = `
    ${variantUI}
    <div class="recipe-info-card">
      <div class="recipe-info-header">
        ${getBadge(recipe.missionName)}
        <span class="recipe-name">${recipe.group}</span>
        <span style="font-size:11px;color:var(--text-dim)">${regionNames[recipe.region] || ''}</span>
      </div>
      <div class="recipe-stats">
        <div class="recipe-stat"><div class="stat-lbl">최고 품질</div><div class="stat-val warn">${qualityGoal.toLocaleString()}</div></div>
        <div class="recipe-stat"><div class="stat-lbl">내구도</div><div class="stat-val">${durLimit}</div></div>
        <div class="recipe-stat"><div class="stat-lbl">rlvl</div><div class="stat-val">${recipe.rlvl}</div></div>
        <div class="recipe-stat"><div class="stat-lbl">c0</div><div class="stat-val ok">${c0}</div></div>
      </div>
    </div>
    ${tableHtml}
  `;
}
