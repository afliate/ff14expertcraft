/* macro-ui.js · "매크로" 탭 UI. macro.js / advisor.js / engine.js / data/*.json 사용 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const num = (id) => Number($(id).value) || 0;
  const JOBS = { CRP: '목수', BSM: '대장장이', ARM: '갑주제작사', GSM: '보석공예가', LTW: '가죽공예가', WVR: '재봉사', ALC: '연금술사', CUL: '요리사' };
  let recipes = [], odds = null, table = null, worker = null, reqId = 0;
  const sel = { gear: null, food: null, pot: null };

  const isCosmic = (r) => !!r && r.rlvl >= 700 && r.rlvl <= 775;
  const cur = () => recipes.find((r) => String(r.id) === $('mc-recipe').value);

  async function load() {
    try {
      const [r, o, t] = await Promise.all([
        fetch('data/expert-recipes.json').then((x) => x.json()),
        fetch('data/condition-odds.json').then((x) => x.json()),
        fetch('recipe-level-table.json').then((x) => x.json()),
      ]);
      recipes = r.recipes; odds = o; table = t;
      $('mc-job').innerHTML = Object.keys(JOBS).map((k) => `<option value="${k}">${JOBS[k]}</option>`).join('');
      fillRecipes();
    } catch (e) { $('mc-msg').textContent = '데이터를 불러오지 못했어요 (웹 주소로 열어야 해요).'; }
  }
  function fillRecipes() {
    const job = $('mc-job').value;
    const list = recipes.filter((r) => r.job === job).sort((a, b) => a.rlvl - b.rlvl || a.id - b.id); // 오래된 레시피가 위
    const opt = (r) => `<option value="${r.id}">${r.name} (rlvl ${r.rlvl})</option>`;
    const cos = list.filter(isCosmic), reg = list.filter((r) => !isCosmic(r));
    $('mc-recipe').innerHTML = (reg.length ? `<optgroup label="일반 고난도 레시피">${reg.map(opt).join('')}</optgroup>` : '') +
      (cos.length ? `<optgroup label="우주개척 레시피">${cos.map(opt).join('')}</optgroup>` : '');
    showTargets();
  }
  function showTargets() {
    const r = cur(); if (!r) return;
    $('mc-work').value = r.work; $('mc-qual').value = r.quality; $('mc-dur').value = r.durability;
    $('mc-relic').checked = isCosmic(r);
    $('mc-out').innerHTML = '';
  }

  // 장비/음식/도핑 프리셋 (추천 탭과 같은 값)
  function fillGear() {
    if (typeof GEAR_PRESETS === 'undefined') return;
    [['gear', GEAR_PRESETS, 'mc-gear-btns'], ['food', FOOD_BUFFS, 'mc-food-btns'], ['pot', POT_BUFFS, 'mc-pot-btns']].forEach(([key, data, id]) => {
      const box = $(id);
      box.innerHTML = Object.keys(data).filter((k) => !(key !== 'gear' && k === '없음')).map((k) => `<button type="button" class="preset-btn" data-k="${k}">${k}</button>`).join('');
      box.querySelectorAll('.preset-btn').forEach((b) => b.addEventListener('click', () => {
        const on = b.classList.contains('active');
        box.querySelectorAll('.preset-btn').forEach((x) => x.classList.remove('active'));
        sel[key] = on ? null : b.dataset.k;
        if (!on) b.classList.add('active');
        applyGear();
      }));
    });
  }
  function applyGear() {
    const g = GEAR_PRESETS[sel.gear]; if (!g) return;
    const z = { crafts: 0, cons: 0, cp: 0 }, f = FOOD_BUFFS[sel.food] || z, p = POT_BUFFS[sel.pot] || z;
    const e = $('mc-spec').checked ? { crafts: 20, cons: 20, cp: 15 } : z;
    $('mc-craft').value = g.crafts + f.crafts + p.crafts + e.crafts;
    $('mc-ctrl').value = g.cons + f.cons + p.cons + e.cons;
    $('mc-maxcp').value = g.cp + f.cp + p.cp + e.cp;
  }

  function buildCtx() {
    const r = cur();
    return { craftsmanship: num('mc-craft'), control: num('mc-ctrl'), rp: FFEngine.paramsFromTable(r.rlvl, table[String(r.rlvl)]),
      relic: $('mc-relic').checked, cosmic: isCosmic(r), specialist: $('mc-spec').checked,
      target: num('mc-work'), targetQuality: num('mc-qual'), maxDur: num('mc-dur'), maxCP: num('mc-maxcp') };
  }
  const pct = (x) => Math.round(x * 100) + '%';
  function skillChip(k) {
    const a = FFAdvisor.ACTIONS[k], url = window.ffSkillIcon ? window.ffSkillIcon(k) : '';
    return `<span class="adv-sk">${url ? `<img class="adv-ico" src="${url}" alt="" onerror="this.style.display='none'">` : ''}<span>${a.ko}</span></span>`;
  }
  function planHTML(p, i, top) {
    const texts = FFMacro.toText(p.path);
    return `<div class="adv-card${top ? ' top' : ''}">
      <div class="adv-head"><span class="adv-rank">${i + 1}</span><span class="adv-pill">${p.steps}공정</span><span class="adv-pill">${FFAdvisor.ACTIONS[p.path[0]].ko} 시작</span>
        <span class="adv-pill">목표 품질 달성 ${pct(p.risk.pQuality)}</span><span class="adv-pill">완료 ${pct(p.risk.pDone)}</span>
        <span class="adv-pill">남는 CP ${p.cp}</span></div>
      <div class="adv-plan">${p.path.map(skillChip).join('<span class="adv-arrow">→</span>')}</div>
      <div class="mc-texts">${texts.map((t, n) => `<div class="mc-text"><div class="mc-texthead"><span>매크로 ${texts.length > 1 ? n + 1 : ''}</span><button type="button" class="calc-btn mc-copy">복사</button></div><pre>${t}</pre></div>`).join('')}</div>
    </div>`;
  }
  function render(res) {
    const out = $('mc-out');
    if (!res.ok) {
      const b = res.best, r = cur();
      out.innerHTML = `<div class="adv-card"><div class="adv-head"><span class="adv-pill">매크로로는 어려워요</span></div>
        <div class="calc-sub">상태를 보통으로 가정하고 확정 성공 스킬만 써도 목표 품질에 닿는 순서를 못 찾았어요${b ? ` (가장 높게 채운 품질 ${Math.floor(b.quality)} / ${r.quality})` : ''}.
        이 레시피는 스펙이 더 필요하거나 상태를 보고 판단해야 해요. <a href="#advisor" onclick="switchTab('advisor');return false;">추천 탭</a>에서 상태를 보며 진행해 보세요.</div></div>`;
      return;
    }
    const top = res.plans[0];
    // 다른 후보: 시작 스킬이 다른 것을 먼저 하나씩 보여준다
    const seenOpen = new Set([top.path[0]]), diff = [], same = [];
    res.plans.slice(1).forEach((p) => { if (!seenOpen.has(p.path[0])) { seenOpen.add(p.path[0]); diff.push(p); } else same.push(p); });
    const rest = diff.concat(same);
    out.innerHTML = (res.marginFailed ? '<div class="calc-sub">고른 품질 여유까지는 채우지 못해서 원래 목표 품질 기준으로 찾았어요.</div>' : '') + planHTML(top, 0, true) +
      (rest.length ? `<details class="adv-details"><summary>다른 후보 ${Math.min(rest.length, 5)}개 보기</summary>${rest.slice(0, 5).map((p, i) => planHTML(p, i + 1, false)).join('')}</details>` : '') +
      '<div class="calc-sub adv-note">상태를 보통으로 가정해 찾은 순서예요. 달성 확률은 실제 상태 확률로 시뮬레이션한 값이고, 100%가 아니면 상태에 따라 목표 품질에 못 닿을 수 있어요. 상태 확률은 임시 기본값이라 실측과 다를 수 있어요.</div>';
    out.querySelectorAll('.mc-copy').forEach((b) => b.addEventListener('click', () => {
      const t = b.closest('.mc-text').querySelector('pre').textContent;
      const done = () => { b.textContent = '복사됨'; setTimeout(() => { b.textContent = '복사'; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, done); else done();
    }));
  }
  function run() {
    if (!cur() || !odds) return;
    const ctx = buildCtx(), margin = Number($('mc-margin').value) || 0;
    $('mc-msg').textContent = '찾는 중이에요… (몇 초 걸려요)'; $('mc-run').disabled = true; $('mc-out').innerHTML = '';
    const finish = (res, err) => {
      $('mc-run').disabled = false; $('mc-msg').textContent = err ? '계산 중 문제가 생겼어요: ' + err : '';
      if (res) render(res);
    };
    const id = ++reqId;
    const search = (c, m) => {
      // 시작 스킬 3가지를 워커 3개로 동시에 찾는다 (워커를 못 쓰면 순서대로)
      const jobs = FFMacro.VARIANTS.map((_, v) => new Promise((ok, no) => {
        let w; try { w = new Worker('macro-worker.js?v=20261109-37'); } catch (e) { ok(FFMacro.searchVariant(c, { margin: m }, v)); return; }
        w.onmessage = (e) => { w.terminate(); e.data.error ? no(new Error(e.data.error)) : ok(e.data.res); };
        w.onerror = (e) => { w.terminate(); no(new Error(e.message || '알 수 없는 오류')); };
        w.postMessage({ id, ctx: c, opts: { margin: m }, variant: v });
      }));
      return Promise.all(jobs);
    };
    (async () => {
      try {
        let res = FFMacro.rank(ctx, odds, await search(ctx, margin), {});
        if (!res.ok && margin) { res = FFMacro.rank(ctx, odds, await search(ctx, 0), {}); res.marginFailed = true; }
        if (id === reqId) finish(res);
      } catch (e) { if (id === reqId) finish(null, String(e.message || e)); }
    })();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('mc-job')) return;
    fillGear();
    $('mc-job').addEventListener('change', fillRecipes);
    $('mc-recipe').addEventListener('change', showTargets);
    $('mc-spec').addEventListener('change', applyGear);
    $('mc-run').addEventListener('click', run);
    load();
  });
})();
