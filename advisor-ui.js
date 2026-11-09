/* advisor-ui.js · "추천" 탭 UI. advisor.js / engine.js / recipe-level-table.json / data/*.json 사용 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let recipes = [], odds = null, table = null, busy = false;

  const CONDS = [['normal', '보통'], ['good', '고품질'], ['centered', '안정'], ['sturdy', '견고'], ['pliant', '고효율'],
    ['malleable', '작업 유연'], ['primed', '장기 지속'], ['goodOmen', '호조의 징조'], ['robust', '강건']];
  const JOBS = { CRP: '목수', BSM: '대장장이', ARM: '갑주제작사', GSM: '보석공예가', LTW: '가죽공예가', WVR: '재봉사', ALC: '연금술사', CUL: '요리사' };

  async function load() {
    try {
      const [r, o, t] = await Promise.all([
        fetch('data/expert-recipes.json').then((x) => x.json()),
        fetch('data/condition-odds.json').then((x) => x.json()),
        fetch('recipe-level-table.json').then((x) => x.json()),
      ]);
      recipes = r.recipes; odds = o; table = t;
      fillJobs();
    } catch (e) {
      $('adv-msg').textContent = '데이터를 불러오지 못했어요 (파일로 직접 열면 안 되고 웹 주소로 열어야 해요).';
    }
  }

  function fillJobs() {
    $('adv-job').innerHTML = Object.keys(JOBS).map((k) => `<option value="${k}">${JOBS[k]}</option>`).join('');
    $('adv-cond').innerHTML = CONDS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
    fillRecipes();
  }
  function fillRecipes() {
    const job = $('adv-job').value, q = $('adv-filter').value.trim();
    const list = recipes.filter((r) => r.job === job && (!q || (r.name || '').includes(q))).sort((a, b) => b.rlvl - a.rlvl || a.id - b.id);
    $('adv-recipe').innerHTML = list.map((r) => `<option value="${r.id}">${r.name} (rlvl ${r.rlvl})</option>`).join('');
    showTargets();
  }
  function cur() { return recipes.find((r) => String(r.id) === $('adv-recipe').value); }
  function showTargets() {
    const r = cur();
    if (!r) return;
    $('adv-work').value = r.work; $('adv-qual').value = r.quality; $('adv-dur').value = r.durability;
    $('adv-curdur').value = r.durability;
  }
  const num = (id) => Number($(id).value) || 0;

  function run() {
    if (busy) return;
    const r = cur();
    if (!r) return;
    busy = true;
    $('adv-out').innerHTML = '<div class="calc-sub">계산 중… (몇 초 걸려요)</div>';
    setTimeout(() => {
      try {
        const rp = FFEngine.paramsFromTable(r.rlvl, table[String(r.rlvl)]);
        const ctx = { craftsmanship: num('adv-craft'), control: num('adv-ctrl'), rp, relic: $('adv-relic').checked,
          target: num('adv-work'), targetQuality: num('adv-qual'), maxDur: num('adv-dur'), maxCP: num('adv-maxcp') };
        const lastMap = { '': null, basicT: 'basicT', standard: 'standard', observe: 'observe' };
        const s = FFAdvisor.newState({
          cp: num('adv-curcp'), dur: num('adv-curdur'), progress: num('adv-curprog'), quality: num('adv-curqual'),
          iq: num('adv-iq'), ven: num('adv-ven'), inno: num('adv-inno'), gs: num('adv-gs'), mm: num('adv-mm'),
          wn: num('adv-wn'), manip: num('adv-manip'), fa: num('adv-fa'), steps: num('adv-steps'),
          lastAction: lastMap[$('adv-last').value],
        });
        const res = FFAdvisor.recommend(s, ctx, $('adv-cond').value, { width: 60, depth: 26, odds, samples: 300 });
        render(res);
      } catch (e) {
        $('adv-out').innerHTML = '<div class="calc-sub">오류: ' + e.message + '</div>';
      }
      busy = false;
    }, 30);
  }

  function pct(x) { return Math.round(x * 100) + '%'; }
  function render(res) {
    if (!res.length) { $('adv-out').innerHTML = '<div class="calc-sub">쓸 수 있는 스킬이 없어요. 입력을 확인해 주세요.</div>'; return; }
    const A = FFAdvisor.ACTIONS;
    $('adv-out').innerHTML = res.slice(0, 6).map((x, i) => `
      <div class="adv-card${i === 0 ? ' top' : ''}">
        <div class="adv-head"><span class="adv-rank">${i + 1}</span><span class="adv-name">${x.ko}</span>
          <span class="adv-pill">완료 ${pct(x.risk.pDone)}</span><span class="adv-pill">목표 품질 ${pct(x.risk.pQuality)}</span>
          <span class="adv-pill">평균 품질 ${Math.round(x.risk.avgQuality)}</span></div>
        <div class="adv-plan">${x.plan.map((k) => A[k].ko).join(' → ')}</div>
      </div>`).join('') +
      '<div class="calc-sub adv-note">완료·품질 확률은 이 스킬로 시작해 이후 같은 계획을 따라갈 때의 값이에요. 이후 상태 확률은 임시 기본값이라 실측과 다를 수 있어요.</div>';
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('adv-job')) return;
    $('adv-job').addEventListener('change', fillRecipes);
    $('adv-filter').addEventListener('input', fillRecipes);
    $('adv-recipe').addEventListener('change', showTargets);
    $('adv-run').addEventListener('click', run);
    load();
  });
})();
