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
      fillJobs(); renderLog();
    } catch (e) {
      $('adv-msg').textContent = '데이터를 불러오지 못했어요 (파일로 직접 열면 안 되고 웹 주소로 열어야 해요).';
    }
  }

  // 장비/음식/도핑 프리셋 (계산기 탭과 같은 값: index.html 의 GEAR_PRESETS 등)
  function fillGear() {
    if (typeof GEAR_PRESETS === 'undefined') return;
    const opt = (o, first) => `<option value="">${first}</option>` + Object.keys(o).map((k) => `<option>${k}</option>`).join('');
    $('adv-gear').innerHTML = opt(GEAR_PRESETS, '직접 입력');
    $('adv-food').innerHTML = opt(FOOD_BUFFS, '없음').replace('<option>없음</option>', '');
    $('adv-pot').innerHTML = opt(POT_BUFFS, '없음').replace('<option>없음</option>', '');
  }
  function applyGear() {
    const g = GEAR_PRESETS[$('adv-gear').value];
    if (!g) return;
    const f = FOOD_BUFFS[$('adv-food').value] || { crafts: 0, cons: 0, cp: 0 };
    const p = POT_BUFFS[$('adv-pot').value] || { crafts: 0, cons: 0, cp: 0 };
    const e = $('adv-spec').checked ? { crafts: 20, cons: 20, cp: 15 } : { crafts: 0, cons: 0, cp: 0 };
    $('adv-craft').value = g.crafts + f.crafts + p.crafts + e.crafts;
    $('adv-ctrl').value = g.cons + f.cons + p.cons + e.cons;
    $('adv-maxcp').value = g.cp + f.cp + p.cp + e.cp;
    $('adv-curcp').value = $('adv-maxcp').value;
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

  // ── 조건 기록 (실측) ─────────────────────────────────────
  const LOG_KEY = 'ffec-cond-log-v1';
  const FORCED = { goodOmen: 'good', robust: 'sturdy', excellent: 'poor' };
  let log = {}, useLog = false, lastLogged = null;
  function loadLog() { try { log = JSON.parse(localStorage.getItem(LOG_KEY) || '{}'); } catch (e) { log = {}; } }
  function saveLog() { try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) {} }
  function flagOf() { const r = cur(); return r ? String(odds.rlvlFlags[String(r.rlvl)]) : null; }
  function logRates(flag) {
    const L = log[flag]; if (!L || !L.n) return null;
    const out = {}; for (const k in L.c) out[k] = L.c[k] / L.n; return out;
  }
  function currentOdds() {
    if (!useLog) return odds;
    const o = JSON.parse(JSON.stringify(odds)); const f = flagOf(); const rates = f && logRates(f);
    if (rates) o.overrides[f] = rates;
    return o;
  }
  function logClick(name) {
    const f = flagOf(); if (!f) return;
    const L = log[f] = log[f] || { n: 0, c: {}, forced: 0 };
    // 직전이 호조의 징조/강건/극상이면 이번 상태는 정해져 있으므로 표본에서 제외
    if (lastLogged && FORCED[lastLogged]) L.forced++;
    else { L.n++; L.c[name] = (L.c[name] || 0) + 1; }
    lastLogged = name; saveLog(); renderLog();
  }
  function renderLog() {
    const f = flagOf(); if (!f || !odds) return;
    const bits = odds.flagBits;
    const names = ['normal'].concat(Object.keys(bits).filter((k) => !['normal', 'excellent', 'poor'].includes(k) && (Number(f) & bits[k])));
    const ko = Object.fromEntries(CONDS);
    const L = log[f] || { n: 0, c: {}, forced: 0 };
    $('adv-log-btns').innerHTML = names.map((n) => `<button class="calc-btn adv-logbtn" data-c="${n}">${ko[n] || n}</button>`).join('');
    $('adv-log-btns').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => logClick(b.dataset.c)));
    $('adv-log-sum').textContent = `플래그 ${f} · 표본 ${L.n}공정 (강제 전이 ${L.forced || 0}공정 제외) — ` +
      names.map((n) => `${ko[n] || n} ${L.n ? Math.round(((L.c[n] || 0) / L.n) * 1000) / 10 : 0}%`).join(' / ');
  }

  function logExport() {
    const f = flagOf(); const r = f && logRates(f); if (!r) return;
    const txt = JSON.stringify({ [f]: Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'normal').map(([k, v]) => [k, Math.round(v * 1000) / 1000])), n: log[f].n }, null, 2);
    $('adv-log-out').value = txt; $('adv-log-out').select();
    try { document.execCommand('copy'); } catch (e) {}
  }


  let worker = null, reqId = 0;
  function getWorker() {
    if (worker) return worker;
    try { worker = new Worker('advisor-worker.js?v=20261109-11'); } catch (e) { worker = false; }
    return worker;
  }
  function collect() {
    const r = cur();
    const rp = FFEngine.paramsFromTable(r.rlvl, table[String(r.rlvl)]);
    const ctx = { craftsmanship: num('adv-craft'), control: num('adv-ctrl'), rp, relic: $('adv-relic').checked,
      target: num('adv-work'), targetQuality: num('adv-qual'), maxDur: num('adv-dur'), maxCP: num('adv-maxcp') };
    const lastMap = { '': null, basicT: 'basicT', standard: 'standard', observe: 'observe' };
    const state = FFAdvisor.newState({
      cp: num('adv-curcp'), dur: num('adv-curdur'), progress: num('adv-curprog'), quality: num('adv-curqual'),
      iq: num('adv-iq'), ven: num('adv-ven'), inno: num('adv-inno'), gs: num('adv-gs'), mm: num('adv-mm'),
      wn: num('adv-wn'), manip: num('adv-manip'), fa: num('adv-fa'), steps: num('adv-steps'),
      lastAction: lastMap[$('adv-last').value],
    });
    return { state, ctx, cond: $('adv-cond').value, opts: { samples: 200 }, odds: currentOdds() };
  }
  function run() {
    if (busy) return;
    if (!cur()) return;
    busy = true;
    $('adv-run').disabled = true;
    $('adv-out').innerHTML = '<div class="calc-sub">계산 중…</div>';
    const done = () => { busy = false; $('adv-run').disabled = false; };
    let msg;
    try { msg = collect(); } catch (e) { $('adv-out').innerHTML = '<div class="calc-sub">오류: ' + e.message + '</div>'; done(); return; }
    const w = getWorker();
    if (w) {
      const id = ++reqId;
      w.onmessage = (ev) => {
        if (ev.data.id !== id) return;
        if (ev.data.error) $('adv-out').innerHTML = '<div class="calc-sub">오류: ' + ev.data.error + '</div>';
        else render(ev.data.res);
        done();
      };
      w.onerror = (ev) => { $('adv-out').innerHTML = '<div class="calc-sub">오류: ' + (ev.message || '계산 실패') + '</div>'; worker = null; done(); };
      w.postMessage(Object.assign({ id }, msg));
    } else {
      setTimeout(() => { // 워커를 못 쓰는 환경: 화면 멈춤을 감수하고 직접 계산
        try { render(FFAdvisor.recommendPolicy(msg.state, msg.ctx, msg.cond, Object.assign({}, msg.opts, { odds: msg.odds }))); }
        catch (e) { $('adv-out').innerHTML = '<div class="calc-sub">오류: ' + e.message + '</div>'; }
        done();
      }, 30);
    }
  }

  function pct(x) { return Math.round(x * 100) + '%'; }
  function render(res) {
    if (!res.length) { $('adv-out').innerHTML = '<div class="calc-sub">쓸 수 있는 스킬이 없어요. 입력을 확인해 주세요.</div>'; return; }
    const A = FFAdvisor.ACTIONS;
    $('adv-out').innerHTML = res.slice(0, 6).map((x, i) => `
      <div class="adv-card${i === 0 ? ' top' : ''}">
        <div class="adv-head"><span class="adv-rank">${i + 1}</span><span class="adv-name">${x.ko}</span>
          <span class="adv-pill">완료 ${pct(x.risk.pDone)}</span><span class="adv-pill">목표 품질 ${pct(x.risk.pQuality)}</span>
          <span class="adv-pill">평균 품질 ${Math.round(x.risk.avgQuality)}</span>${x.mode ? `<span class="adv-pill">${x.mode === '계획' ? '고정 계획 기준' : '상태 반응 기준'}</span>` : ''}</div>
        <div class="adv-plan">${x.plan.map((k) => A[k].ko).join(' → ')}</div>
      </div>`).join('') +
      '<div class="calc-sub adv-note">완료·품질 확률은 이 스킬로 시작해 끝까지 시뮬레이션한 값이에요 (고정 계획과 상태에 반응하는 방식 중 더 좋은 쪽). 이후 상태 확률은 임시 기본값이라 실측과 다를 수 있어요.</div>';
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('adv-job')) return;
    fillGear();
    ['adv-gear', 'adv-food', 'adv-pot', 'adv-spec'].forEach((id) => $(id).addEventListener('change', applyGear));
    ['adv-craft', 'adv-ctrl', 'adv-maxcp'].forEach((id) => $(id).addEventListener('input', () => { $('adv-gear').value = ''; }));
    $('adv-job').addEventListener('change', () => { fillRecipes(); lastLogged = null; renderLog(); });
    $('adv-filter').addEventListener('input', fillRecipes);
    $('adv-recipe').addEventListener('change', showTargets);
    $('adv-run').addEventListener('click', run);
    loadLog();
    $('adv-recipe').addEventListener('change', () => { lastLogged = null; renderLog(); });
    $('adv-uselog').addEventListener('change', (e) => { useLog = e.target.checked; });
    $('adv-log-reset').addEventListener('click', () => { const f = flagOf(); if (f && confirm('이 플래그의 기록을 모두 지울까요?')) { delete log[f]; lastLogged = null; saveLog(); renderLog(); } });
    $('adv-log-export').addEventListener('click', logExport);
    $('adv-log-break').addEventListener('click', () => { lastLogged = null; });
    load();
  });
})();
