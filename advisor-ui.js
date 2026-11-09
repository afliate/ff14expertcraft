/* advisor-ui.js · "추천" 탭 UI. advisor.js / engine.js / recipe-level-table.json / data/*.json 사용 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let recipes = [], odds = null, table = null, busy = false;

  // 이름·색은 사이트의 상태 가이드와 동일
  const CONDS = [['normal', '보통'], ['good', '고품질'], ['centered', '안정'], ['sturdy', '견고'], ['pliant', '고효율'],
    ['malleable', '빠른 진행'], ['primed', '장기 지속'], ['goodOmen', '길조'], ['robust', '완강']];
  const COND_COLOR = { normal: '', good: '#e85a7a', centered: '#d4b840', sturdy: '#7aaed4', pliant: '#4dc890', malleable: '#4a7fd4', primed: '#b87ae0', goodOmen: '#e8a030', robust: '#60c0e8' };
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

  // 장비/음식/도핑 프리셋 (계산기 탭과 같은 값: index.html 의 GEAR_PRESETS 등) — 버튼 클릭 방식
  const sel = { gear: null, food: null, pot: null };
  function fillGear() {
    if (typeof GEAR_PRESETS === 'undefined') return;
    const groups = [['gear', GEAR_PRESETS, 'adv-gear-btns'], ['food', FOOD_BUFFS, 'adv-food-btns'], ['pot', POT_BUFFS, 'adv-pot-btns']];
    groups.forEach(([key, data, id]) => {
      const box = $(id);
      box.innerHTML = Object.keys(data).filter((k) => !(key !== 'gear' && k === '없음'))
        .map((k) => `<button type="button" class="preset-btn" data-k="${k}">${k}</button>`).join('');
      box.querySelectorAll('.preset-btn').forEach((b) => b.addEventListener('click', () => {
        const on = b.classList.contains('active');
        box.querySelectorAll('.preset-btn').forEach((x) => x.classList.remove('active'));
        sel[key] = on ? null : b.dataset.k;
        if (!on) b.classList.add('active');
        applyGear();
      }));
    });
  }
  function clearGearButtons() {
    sel.gear = sel.food = sel.pot = null;
    document.querySelectorAll('#adv-gear-btns .preset-btn, #adv-food-btns .preset-btn, #adv-pot-btns .preset-btn').forEach((b) => b.classList.remove('active'));
  }
  function applyGear() {
    const g = GEAR_PRESETS[sel.gear];
    if (!g) return;
    const z = { crafts: 0, cons: 0, cp: 0 };
    const f = FOOD_BUFFS[sel.food] || z, p = POT_BUFFS[sel.pot] || z;
    const e = $('adv-spec').checked ? { crafts: 20, cons: 20, cp: 15 } : z;
    $('adv-craft').value = g.crafts + f.crafts + p.crafts + e.crafts;
    $('adv-ctrl').value = g.cons + f.cons + p.cons + e.cons;
    $('adv-maxcp').value = g.cp + f.cp + p.cp + e.cp;
    $('adv-curcp').value = $('adv-maxcp').value;
  }

  function fillJobs() {
    $('adv-job').innerHTML = Object.keys(JOBS).map((k) => `<option value="${k}">${JOBS[k]}</option>`).join('');
    $('adv-cond').innerHTML = CONDS.map(([k, n]) => `<option value="${k}" style="color:${COND_COLOR[k] || ''}">${n}</option>`).join('');
    fillRecipes();
  }
  // 우주개척(코스믹 탐험) 레시피: rlvl 700~775. 그 밖(폐허 수도교 등)은 일반 고난도라 우주 도구·우주 안정된 솜씨를 쓸 수 없다
  const isCosmic = (r) => !!r && r.rlvl >= 700 && r.rlvl <= 775;
  function fillRecipes() {
    const job = $('adv-job').value;
    const list = recipes.filter((r) => r.job === job).sort((a, b) => b.rlvl - a.rlvl || a.id - b.id);
    const opt = (r) => `<option value="${r.id}">${r.name} (rlvl ${r.rlvl})</option>`;
    const cos = list.filter(isCosmic), reg = list.filter((r) => !isCosmic(r));
    $('adv-recipe').innerHTML = (cos.length ? `<optgroup label="우주개척 레시피">${cos.map(opt).join('')}</optgroup>` : '') +
      (reg.length ? `<optgroup label="일반 고난도 레시피">${reg.map(opt).join('')}</optgroup>` : '');
    showTargets(); hist = []; replay(); if (document.querySelector('#adv-hist-btns .adv-hbtn')) syncHistBtns();
  }
  function cur() { return recipes.find((r) => String(r.id) === $('adv-recipe').value); }
  function showTargets() {
    const r = cur();
    if (!r) return;
    $('adv-work').value = r.work; $('adv-qual').value = r.quality; $('adv-dur').value = r.durability;
    $('adv-curdur').value = r.durability;
    const cos = isCosmic(r), rc = $('adv-relic');
    rc.disabled = false; rc.checked = cos;
    $('adv-relic-note').textContent = '';
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
    $('adv-log-btns').innerHTML = names.map((n) => `<button class="calc-btn adv-logbtn" data-c="${n}" style="color:${COND_COLOR[n] || ''}">${ko[n] || n}</button>`).join('');
    $('adv-log-btns').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => logClick(b.dataset.c)));
    $('adv-log-sum').innerHTML = `<div class="adv-lognote">플래그 ${f} · 표본 ${L.n}공정 (강제 전이 ${L.forced || 0}공정 제외)</div>` +
      names.map((n) => `<div class="adv-logrow"><span style="color:${COND_COLOR[n] || ''}">${ko[n] || n}</span><b>${L.n ? Math.round(((L.c[n] || 0) / L.n) * 1000) / 10 : 0}%</b><i>${L.c[n] || 0}회</i></div>`).join('');
    renderCondBar();
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
    try { worker = new Worker('advisor-worker.js?v=20261109-37'); } catch (e) { worker = false; }
    return worker;
  }
  function buildCtx() {
    const r = cur();
    const rp = FFEngine.paramsFromTable(r.rlvl, table[String(r.rlvl)]);
    return { craftsmanship: num('adv-craft'), control: num('adv-ctrl'), rp, relic: $('adv-relic').checked, cosmic: isCosmic(r), specialist: $('adv-spec').checked,
      target: num('adv-work'), targetQuality: num('adv-qual'), maxDur: num('adv-dur'), maxCP: num('adv-maxcp') };
  }
  function collect() {
    const ctx = buildCtx();
    const lastMap = { '': null, basicT: 'basicT', standard: 'standard', observe: 'observe' };
    const state = FFAdvisor.newState({
      cp: num('adv-curcp'), dur: num('adv-curdur'), progress: num('adv-curprog'), quality: num('adv-curqual'),
      iq: num('adv-iq'), ven: num('adv-ven'), inno: num('adv-inno'), gs: num('adv-gs'), mm: num('adv-mm'),
      wn: num('adv-wn'), manip: num('adv-manip'), fa: num('adv-fa'), steps: 0,
      lastAction: lastMap[$('adv-last').value],
    });
    // 공정 수는 입력받지 않고 상태에서 유추: 뭔가 진행됐으면 첫 공정이 아님
    const st = state;
    if (histState) for (const k of ['ssh', 'hs', 'hsUsed', 'qiUsed', 'exp', 'tp', 'tpUsed', 'dcUsed', 'mmrUsed']) st[k] = histState[k] || 0;
    if (st.progress > 0 || st.quality > 0 || st.iq > 0 || st.dur < ctx.maxDur || st.lastAction || st.ven || st.inno || st.gs || st.mm || st.wn || st.manip || st.fa || st.cp < ctx.maxCP) st.steps = 1;
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


  // ── 지금 상태 버튼줄 (레시피에 나오는 상태만) ──
  // 레시피 데이터상 나오는 상태 (데이터가 틀릴 수 있어 나머지도 흐리게 남겨 눌러볼 수 있게 한다)
  function condPossible() {
    const f = flagOf(); if (!f || !odds) return ['normal'];
    return ['normal'].concat(CONDS.map((c) => c[0]).filter((k) => k !== 'normal' && odds.flagBits[k] && (Number(f) & odds.flagBits[k])));
  }
  function condNames() { return CONDS.map((c) => c[0]); }
  function setCond(k) {
    $('adv-cond').value = k;
    document.querySelectorAll('#adv-condbar .adv-cbtn').forEach((b) => b.classList.toggle('on', b.dataset.c === k));
  }
  function renderCondBar() {
    const bar = $('adv-condbar'); if (!bar) return;
    const ko = Object.fromEntries(CONDS), keep = $('adv-cond').value;
    const pos = condPossible();
    bar.innerHTML = condNames().map((k) => `<button type="button" class="adv-cbtn${pos.includes(k) ? '' : ' off'}" data-c="${k}"${pos.includes(k) ? '' : ' disabled'} title="${pos.includes(k) ? '' : '이 레시피에는 나오지 않는 상태예요'}" style="--cc:${COND_COLOR[k] || '#8aa'}">${ko[k]}</button>`).join('');
    bar.querySelectorAll('button:not([disabled])').forEach((b) => b.addEventListener('click', () => setCond(b.dataset.c)));
    setCond(pos.includes(keep) ? keep : 'normal');
  }
  // 진행 기록 한 칸 = 그 공정에서 본 상태 한 번의 실측. 기록 칸과 같이 쌓고, 되돌리기로 빼기
  function autoLog(i, cond) {
    if (!$('adv-autolog').checked || i === 0) return null; // 첫 공정은 항상 보통
    const f = flagOf(); if (!f) return null;
    const L = log[f] = log[f] || { n: 0, c: {}, forced: 0 };
    const prev = hist[i - 1] && hist[i - 1].cond;
    let d;
    if (prev && FORCED[prev]) { L.forced++; d = { f, forced: true }; }
    else { L.n++; L.c[cond] = (L.c[cond] || 0) + 1; d = { f, cond }; }
    saveLog(); return d;
  }
  function unLog(d) {
    if (!d) return; const L = log[d.f]; if (!L) return;
    if (d.forced) L.forced = Math.max(0, (L.forced || 0) - 1);
    else { L.n = Math.max(0, L.n - 1); L.c[d.cond] = Math.max(0, (L.c[d.cond] || 0) - 1); }
    saveLog();
  }
  function undo() { const h = hist.pop(); if (h) unLog(h.lg); renderLog(); replay(); }

  // ── 스킬 기록: 쓴 스킬 아이콘을 누르면 현재 상태를 자동 계산해 입력칸에 채운다 ──
  let hist = []; // { k, cond, ok }
  let histState = null; // 기록으로 계산한 상태(입력칸에 없는 값: 우주 안정된 솜씨·일심불란 등)
  // 공식 가이드 기준 분류
  const HIST_GROUPS = [
    ['첫 공정 (작업 전에만)', ['mm', 'reflect']],
    ['작업량', ['basicS', 'careful', 'prudentS', 'groundwork', 'intensive', 'rapid', 'delicate']],
    ['품질', ['basicT', 'standard', 'advanced', 'refined', 'prudentT', 'prep', 'precise', 'hasty', 'daring', 'finesse', 'byregot']],
    ['버프', ['ven', 'inno', 'gs', 'wn', 'wn2', 'manip', 'fa']],
    ['전문장인 전용', ['hs', 'qi', 'dc']],
    ['우주개척 전용', ['ssh', 'mmr']],
    ['수리·기타', ['mend', 'immac', 'observe', 'tricks', 'tp']],
  ];
  function setIf(id, v) { const el = $(id); if (el) el.value = Math.round(v * 10) / 10; }
  function replay() {
    if (!cur()) return;
    const ctx = buildCtx();
    let s = FFAdvisor.newState({ cp: ctx.maxCP, dur: ctx.maxDur });
    for (const h of hist) s = FFAdvisor.apply(s, h.k, ctx, h.cond, h.ok);
    histState = hist.length ? s : null;
    setIf('adv-curprog', Math.floor(s.progress)); setIf('adv-curqual', Math.floor(s.quality)); setIf('adv-curdur', s.dur); setIf('adv-curcp', s.cp);
    setIf('adv-iq', Math.floor(s.iq));
    for (const [id, k] of [['ven', 'ven'], ['inno', 'inno'], ['gs', 'gs'], ['mm', 'mm'], ['fa', 'fa']]) setIf('adv-' + id, s[k]);
    setIf('adv-wn', s.wn); setIf('adv-manip', s.manip);
    const last = ['basicT', 'standard', 'observe'].includes(s.lastAction) ? s.lastAction : '';
    $('adv-last').value = last;
    const CN = Object.fromEntries(CONDS);
    $('adv-hist').innerHTML = (hist.length ? hist.map((h, i) => {
      const risky = FFAdvisor.ACTIONS[h.k].rate !== undefined;
      const c = COND_COLOR[h.cond] || '';
      return `<span class="adv-h${h.ok === false ? ' fail' : ''}${risky ? ' risky' : ''}" style="--cc:${c || 'transparent'}" data-i="${i}" title="${i + 1}공정 · ${CN[h.cond] || h.cond}${h.ok === false ? ' · 실패' : ''}${risky ? ' (눌러서 성공/실패 전환)' : ''}">${ico(h.k)}<i style="${c ? `color:${c};border-color:${c}` : ''}">${CN[h.cond] || h.cond}</i>${h.ok === false ? '<b>실패</b>' : ''}</span>`;
    }).join('') + '<button type="button" class="adv-undo" title="마지막 스킬 되돌리기">↶</button>' : '<span class="calc-sub">아직 기록이 없어요. 위에서 지금 상태를 고르고, 쓴 스킬을 눌러 주세요.</span>');
    const ub = $('adv-hist').querySelector('.adv-undo'); if (ub) ub.addEventListener('click', undo);
    $('adv-hist').querySelectorAll('.risky').forEach((el) => el.addEventListener('click', () => {
      const h = hist[Number(el.dataset.i)]; h.ok = h.ok === false ? undefined : false; replay();
    }));
    $('adv-hist-sum').textContent = hist.length ? `${s.steps}공정 진행 → 작업량 ${Math.floor(s.progress)}/${ctx.target} · 품질 ${Math.floor(s.quality)}/${ctx.targetQuality} · 내구 ${s.dur} · CP ${s.cp}` : '';
  }
  function syncHistBtns() {
    const r = cur(), spec = $('adv-spec').checked, cos = isCosmic(r);
    document.querySelectorAll('#adv-hist-btns .adv-hbtn').forEach((b) => {
      const k = b.dataset.k, off = (FFAdvisor.ACTIONS[k].spec && !spec) || (FFAdvisor.ACTIONS[k].cosmic && !cos) || (k === 'ssh' && !cos);
      b.disabled = !!off; b.style.opacity = off ? '.3' : '';
    });
  }
  function fillHistBtns() {
    const A = FFAdvisor.ACTIONS;
    $('adv-hist-btns').innerHTML = HIST_GROUPS.map(([g, ks]) => `<div class="adv-hgrp"><span class="adv-hlbl">${g}</span><span class="adv-hrow">${ks.map((k) => `<button type="button" class="adv-hbtn" data-k="${k}" title="${A[k].ko}${A[k].good ? ' (고품질일 때만)' : ''}">${ico(k)}${A[k].good ? '<em>고</em>' : ''}</button>`).join('')}</span></div>`).join('');
    syncHistBtns();
    $('adv-hist-btns').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.k, A2 = FFAdvisor.ACTIONS;
      if (A2[k].first && hist.length) return;
      const cond = $('adv-cond').value, i = hist.length;
      const h = { k, cond, ok: undefined }; h.lg = autoLog(i, cond);
      hist.push(h);
      setCond(FORCED[cond] || 'normal');
      renderLog(); replay();
    }));
  }

  function pct(x) { return Math.round(x * 100) + '%'; }
  const ICON = { basicS: 1501, careful: 1986, prudentS: 1520, groundwork: 1518, intensive: 1514, rapid: 1988, mm: 1994,
    basicT: 1502, standard: 1516, advanced: 1519, refined: 1522, prudentT: 1535, prep: 1507, precise: 1524, reflect: 1982,
    hasty: 1989, daring: 1998, finesse: 1997, delicate: 1503, byregot: 1975, ven: 1995, hs: 1996, qi: 1999, dc: 1984, mmr: '061277', tp: 1926, inno: 1987, gs: 1955, wn: 1992,
    wn2: 1993, manip: 1985, ssh: 1953, fa: 1983, mend: 1952, immac: 1950, observe: 1954, tricks: 1990 };
  function iconUrl(k) { const id = String(ICON[k]); return id.length === 6 ? `https://xivapi.com/i/061000/${id}_hr1.png` : `https://xivapi.com/i/001000/00${id}_hr1.png`; }
  window.ffSkillIcon = iconUrl;
  function ico(k) { return `<img class="adv-ico" src="${iconUrl(k)}" alt="${FFAdvisor.ACTIONS[k].ko}" onerror="this.style.display='none'">`; }
  function skill(k, mark) {
    const a = FFAdvisor.ACTIONS[k], id = ICON[k];
    const img = id ? `<img class="adv-ico" src="${iconUrl(k)}" alt="" onerror="this.style.display='none'">` : '';
    return `<span class="adv-sk">${img}<span>${a.ko}</span>${mark && a.good ? '<em class="adv-good">고품질일 때</em>' : ''}</span>`;
  }
  function render(res) {
    if (!res.length) { $('adv-out').innerHTML = '<div class="calc-sub">쓸 수 있는 스킬이 없어요. 입력을 확인해 주세요.</div>'; return; }
    const seq = (arr, off) => arr.map((k, i) => skill(k, off + i > 0)).join('<span class="adv-arrow">→</span>');
    $('adv-out').innerHTML = res.slice(0, 6).map((x, i) => `
      <div class="adv-card${i === 0 ? ' top' : ''}">
        <div class="adv-head"><span class="adv-rank">${i + 1}</span><span class="adv-name">${skill(x.key, false)}</span>
          <span class="adv-pill">완료 ${pct(x.risk.pDone)}</span><span class="adv-pill">목표 품질 ${pct(x.risk.pQuality)}</span>
          <span class="adv-pill">평균 품질 ${Math.round(x.risk.avgQuality)}</span>${x.mode ? `<span class="adv-pill">${x.mode === '계획' ? '고정 계획 기준' : '상태 반응 기준'}</span>` : ''}</div>
        <div class="adv-plan">${seq(x.plan.slice(0, 8), 0)}${x.plan.length > 8 ? `<details class="adv-rest"><summary>이후 ${x.plan.length - 8}공정 예상 (상태에 따라 달라져요)</summary><div class="adv-rest-body">${seq(x.plan.slice(8), 8)}</div></details>` : ''}</div>
      </div>`).join('') +
      '<div class="calc-sub adv-note">완료·품질 확률은 이 스킬로 시작해 끝까지 시뮬레이션한 값이에요. 「고품질일 때」 표시가 붙은 스킬은 그 시점에 상태가 고품질일 때만 쓸 수 있어요. 이후 상태 확률은 임시 기본값이라 실측과 다를 수 있어요.</div>';
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('adv-job')) return;
    fillGear();
    fillHistBtns();
    $('adv-hist-undo').addEventListener('click', undo);
    $('adv-hist-reset').addEventListener('click', () => { hist = []; replay(); });
    $('adv-spec').addEventListener('change', () => { applyGear(); syncHistBtns(); });
    ['adv-craft', 'adv-ctrl', 'adv-maxcp'].forEach((id) => $(id).addEventListener('input', clearGearButtons));
    $('adv-job').addEventListener('change', () => { fillRecipes(); lastLogged = null; renderLog(); });
    $('adv-recipe').addEventListener('change', () => { showTargets(); hist = []; replay(); });
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
