/* ============================================================
 *  advisor.js · 다음 스킬 추천기 (UI 의존 없음)
 *
 *  engine.js 의 증가량 공식 위에 CP / 내구도 / 사용 조건 / 성공률 / 상태 효과를 얹고,
 *  현재 상태에서 빔 서치로 "끝까지 가는 계획"을 찾아 첫 스킬을 순위로 돌려준다.
 *
 *  스킬 수치(CP·내구·효율·지속)는 ffxiv-teamcraft/simulator (MIT, © 2019 Flavien Normand)
 *  의 액션 정의를 확인해 직접 작성했다. THIRD_PARTY_NOTICES.md 참고.
 *
 *  모델(v1): 현재 공정은 입력된 상태, 이후 공정은 '보통' 상태 가정. 성공률 <100% 스킬은
 *            기대값(증가량 × 성공률)으로 계산. 한국어 사이트·Thal's·AGPL 코드는 참고하지 않았다.
 *  브라우저: window.FFAdvisor / Node: require('./advisor.js')
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.FFAdvisor = factory(root.FFEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  // ── 스킬 정의 ─────────────────────────────────────────────
  // kind: prog | qual | buff | repair | cp | other
  // p: 효율, cp, dur, rate(성공률 0~1), iq(정신집중 증가), first(첫 공정 한정)
  const A = {
    basicS:   { ko: '모범 작업',   kind: 'prog', p: 120, cp: 0,  dur: 10 },
    careful:  { ko: '신중 작업',   kind: 'prog', p: 180, cp: 7,  dur: 10 },
    prudentS: { ko: '절약 작업',   kind: 'prog', p: 180, cp: 18, dur: 5, noWN: true },
    groundwork: { ko: '밑작업',    kind: 'prog', p: 360, cp: 18, dur: 20, halfIfLowDur: true },
    intensive: { ko: '집중 작업',  kind: 'prog', p: 400, cp: 6,  dur: 10, good: true },
    rapid:    { ko: '강행 작업',   kind: 'prog', p: 500, cp: 0,  dur: 10, rate: 0.5 },
    mm:       { ko: '확신',        kind: 'prog', p: 300, cp: 6,  dur: 10, first: true, setMM: true },

    basicT:   { ko: '가공',        kind: 'qual', p: 100, cp: 18, dur: 10, iq: 1 },
    standard: { ko: '중급 가공',   kind: 'qual', p: 125, cp: 32, dur: 10, iq: 1, comboCp: 18, comboFrom: ['basicT'] },
    advanced: { ko: '상급 가공',   kind: 'qual', p: 150, cp: 46, dur: 10, iq: 1, comboCp: 18, comboFrom: ['standard', 'observe'] },
    refined:  { ko: '세련 가공',   kind: 'qual', p: 100, cp: 24, dur: 10, iq: 1, bonusIqFrom: 'basicT' },
    prudentT: { ko: '절약 가공',   kind: 'qual', p: 100, cp: 25, dur: 5,  iq: 1, noWN: true },
    prep:     { ko: '밑가공',      kind: 'qual', p: 200, cp: 40, dur: 20, iq: 2 },
    precise:  { ko: '집중 가공',   kind: 'qual', p: 150, cp: 18, dur: 10, iq: 2, good: true },
    reflect:  { ko: '진가',        kind: 'qual', p: 300, cp: 6,  dur: 10, iq: 2, first: true },
    hasty:    { ko: '성급한 손길', kind: 'qual', p: 100, cp: 0,  dur: 10, iq: 1, rate: 0.6, setExp: true },
    daring:   { ko: '대담한 손길', kind: 'qual', p: 150, cp: 0,  dur: 10, iq: 1, rate: 0.6, needExp: true },
    finesse:  { ko: '장인의 황금손', kind: 'qual', p: 100, cp: 32, dur: 0, iq: 0, needIq10: true },
    delicate: { ko: '정교한 작업', kind: 'both', pp: 150, p: 100, cp: 32, dur: 10, iq: 1 },
    byregot:  { ko: '비레고의 축복', kind: 'qual', p: null, cp: 24, dur: 10, iq: 0, needIq: true, resetIq: true },

    ven:      { ko: '공경',        kind: 'buff', buff: 'ven',  dur_: 4, cp: 18, dur: 0 },
    inno:     { ko: '혁신',        kind: 'buff', buff: 'inno', dur_: 4, cp: 18, dur: 0 },
    gs:       { ko: '장족의 발전', kind: 'buff', buff: 'gs',   dur_: 3, cp: 32, dur: 0 },
    wn:       { ko: '근검절약',    kind: 'buff', buff: 'wn',   dur_: 4, cp: 56, dur: 0 },
    wn2:      { ko: '장기 절약',   kind: 'buff', buff: 'wn',   dur_: 8, cp: 98, dur: 0 },
    manip:    { ko: '교묘한 손놀림', kind: 'buff', buff: 'manip', dur_: 8, cp: 96, dur: 0 },
    ssh:      { ko: '우주 안정된 솜씨', kind: 'buff', buff: 'ssh', dur_: 3, cp: 0, dur: 0 },
    fa:       { ko: '최종 확인',   kind: 'buff', buff: 'fa',   dur_: 5, cp: 1,  dur: 0 },

    mend:     { ko: '능숙한 땜질', kind: 'repair', heal: 30, cp: 88,  dur: 0 },
    immac:    { ko: '완벽한 땜질', kind: 'repair', heal: Infinity, cp: 112, dur: 0 },
    observe:  { ko: '경과 관찰',   kind: 'other', cp: 7, dur: 0 },
    tricks:   { ko: '비결',        kind: 'cp', cp: 0, dur: 0, good: true },
  };
  const KEYS = Object.keys(A);

  // 상태 효과: pliant = CP 비용 절반, sturdy/robust = 내구 소모 절반, primed = 버프 +2,
  // malleable = 작업량 ×1.5, centered = 성공률 +25%p, good/excellent/poor = 품질 배율(엔진).
  const COND_QUAL = { good: 'good', excellent: 'excellent', poor: 'poor' };

  function newState(init) {
    const s = E.newState();
    return Object.assign(s, { cp: 0, dur: 0, wn: 0, manip: 0, fa: 0, exp: 0, ssh: 0 }, init || {});
  }

  // ── 사용 가능 여부 ────────────────────────────────────────
  function cost(def, s, cond) {
    let cp = def.cp;
    if (def.comboCp && def.comboFrom.includes(s.lastAction)) cp = def.comboCp;
    if (cond === 'pliant') cp = Math.ceil(cp / 2);
    let dur = def.dur;
    if (s.wn > 0) dur = Math.ceil(dur / 2);
    if (cond === 'sturdy' || cond === 'robust') dur = Math.ceil(dur / 2);
    return { cp, dur };
  }

  function canUse(key, s, ctx, cond) {
    const d = A[key];
    const c = cost(d, s, cond);
    if (c.cp > s.cp) return false;
    if (d.first && s.steps !== 0) return false;
    if (d.good && cond !== 'good' && cond !== 'excellent') return false;
    if (d.noWN && s.wn > 0) return false;
    if (d.needIq && s.iq < 1) return false;
    if (d.needIq10 && s.iq < 10) return false;
    if (d.needExp && !(s.exp > 0)) return false;
    if (key === 'fa' && s.fa > 0) return false;
    if (key === 'ssh' && s.ssh > 0) return false;
    return true;
  }

  // ── 한 공정 진행 ──────────────────────────────────────────
  // 반환: 새 상태. 사망(내구 0, 작업량 미달)이면 dead=true.
  function apply(s, key, ctx, cond, succ) {
    const d = A[key];
    const st = Object.assign({}, s);
    const c = cost(d, s, cond);
    const dura = (n) => (cond === 'primed' ? n + 2 : n);
    let rate = d.rate === undefined ? 1 : d.rate;
    if (cond === 'centered' && rate < 1) rate = Math.min(1, rate + 0.25);
    if (succ !== undefined && d.rate !== undefined) rate = succ ? 1 : 0; // 표본 모드: 성공/실패 확정
    if (s.ssh > 0 && d.rate !== undefined) rate = 1; // 우주 안정된 솜씨: 3공정 확정 성공

    st.cp -= c.cp;
    const was = { ven: s.ven, inno: s.inno, gs: s.gs, mm: s.mm, wn: s.wn, manip: s.manip, fa: s.fa, exp: s.exp, ssh: s.ssh };
    const fresh = {}; // 이번 공정에 새로 건 버프(틱에서 제외)
    const skipTick = key === 'fa'; // 최종 확인: 제작 공정이 진행되지 않음
    const heal0 = s.manip > 0 && !skipTick; // 교손은 건 다음 공정부터 회복

    if (d.kind === 'prog' || d.kind === 'both') {
      const base = E.baseProgress(ctx.craftsmanship, ctx.rp);
      let p = d.kind === 'both' ? d.pp : d.p;
      if (d.halfIfLowDur && s.dur < c.dur) p = p / 2;
      let g = E.progressGain(base, p, { malleable: cond === 'malleable', mm: s.mm > 0, ven: s.ven > 0 });
      g = g * rate;
      if (s.mm > 0) st.mm = 0;
      if (d.setMM) { st.mm = dura(5); fresh.mm = true; }
      let prog = st.progress + g;
      if (s.fa > 0 && prog >= ctx.target) { prog = ctx.target - 1; st.fa = 0; }
      st.progress = prog;
    }
    if (d.kind === 'qual' || d.kind === 'both') {
      const base = E.baseQuality(ctx.control, ctx.rp);
      const potency = key === 'byregot' ? Math.min(100 + s.iq * 20, 300) : d.p;
      let g = E.qualityGain(base, potency, {
        cond: COND_QUAL[cond] || 'normal', relic: ctx.relic, iq: s.iq, gs: s.gs > 0, inno: s.inno > 0,
      });
      g = g * rate;
      st.quality += g;
      if (s.gs > 0) st.gs = 0;
      if (d.resetIq) st.iq = 0;
      else {
        let add = d.iq;
        if (d.bonusIqFrom && s.lastAction === d.bonusIqFrom) add += 1;
        st.iq = Math.min(10, Math.round((s.iq + add * rate) * 10) / 10);
      }
      if (d.setExp) { st.exp = 1 + 1; fresh.exp = true; } // 다음 한 공정만 (아래 틱 후 1)
    } else if (d.kind === 'buff') {
      if (d.buff === 'wn') { st.wn = d.dur_; fresh.wn = true; }
      else if (d.buff === 'manip') { st.manip = d.dur_; fresh.manip = true; }
      else { st[d.buff] = dura(d.dur_); if (d.buff !== 'fa') fresh[d.buff] = true; else fresh.fa = true; }
    } else if (d.kind === 'repair') {
      st.dur = Math.min(ctx.maxDur, st.dur + d.heal);
    } else if (d.kind === 'cp') {
      st.cp = Math.min(ctx.maxCP, st.cp + 20);
    }

    // 내구 소모 (성공 여부와 무관)
    st.dur -= c.dur;

    // 교묘한 손놀림 회복
    if (heal0) st.dur = Math.min(ctx.maxDur, st.dur + 5);

    // 틱: 이번 공정에 새로 건 것은 줄이지 않는다. 최종 확인은 공정으로 치지 않아 다른 버프도 줄이지 않는다.
    for (const k of ['ven', 'inno', 'gs', 'mm', 'wn', 'manip', 'fa', 'ssh']) {
      if (fresh[k] || skipTick) continue;
      if (was[k] > 0 && st[k] > 0) st[k] = st[k] - 1;
    }
    if (fresh.exp) st.exp = 1; else if (was.exp > 0 && !skipTick) st.exp = 0;

    if (!skipTick) { st.steps = s.steps + 1; st.lastAction = key; }
    st.dead = st.progress < ctx.target && st.dur <= 0;
    st.done = st.progress >= ctx.target;
    return st;
  }

  // ── 점수 / 탐색 ───────────────────────────────────────────
  function score(s, ctx) {
    const qr = Math.min(1, s.quality / ctx.targetQuality);
    return (s.done ? 1000 : 0) + qr * 100 + (s.done ? s.cp * 0.01 : 0);
  }
  function heur(s, ctx) {
    // 빔 정렬용: 작업량 미달이면 작업량 진행도도 반영
    const pr = Math.min(1, s.progress / ctx.target);
    const qr = Math.min(1, s.quality / ctx.targetQuality);
    return pr * 60 + qr * 100 + s.cp * 0.02 + s.dur * 0.05 + s.iq * 0.5;
  }
  function keyOf(s) {
    return [Math.round(s.progress), Math.round(s.quality), s.cp, s.dur, s.iq, s.ven, s.inno, s.gs, s.mm, s.wn, s.manip, s.fa, s.exp, s.lastAction === 'basicT' || s.lastAction === 'standard' || s.lastAction === 'observe' ? s.lastAction : '-'].join(',');
  }

  // 현재 상태에서 key 를 쓴 뒤의 최선 계획 점수 (이후는 '보통' 상태 가정)
  function plan(start, ctx, opts) {
    const width = (opts && opts.width) || 200;
    const maxDepth = (opts && opts.depth) || 30;
    let beam = [{ s: start, path: [] }];
    let best = { s: start, path: [], sc: score(start, ctx) };
    for (let d = 0; d < maxDepth && beam.length; d++) {
      const next = new Map();
      for (const node of beam) {
        for (const k of KEYS) {
          if (!canUse(k, node.s, ctx, 'normal')) continue;
          const ns = apply(node.s, k, ctx, 'normal');
          if (ns.dead) continue;
          const path = node.path.concat(k);
          if (ns.done) {
            const sc = score(ns, ctx);
            if (sc > best.sc) best = { s: ns, path, sc };
            continue;
          }
          const kk = keyOf(ns);
          const h = heur(ns, ctx);
          const ex = next.get(kk);
          if (!ex || ex.h < h) next.set(kk, { s: ns, path, h });
        }
      }
      beam = [...next.values()].sort((a, b) => b.h - a.h).slice(0, width);
    }
    return best;
  }

  // ── 확률 모델 ─────────────────────────────────────────────
  // oddsJson = data/condition-odds.json 내용. overrides[flag] 가 있으면 그 표(실측값), 없으면 defaultRates.
  function conditionTable(oddsJson, rlvl) {
    const flag = oddsJson.rlvlFlags[String(rlvl)];
    const bits = oddsJson.flagBits;
    const ov = oddsJson.overrides && oddsJson.overrides[String(flag)];
    const rows = [];
    let sum = 0;
    for (const name of Object.keys(bits)) {
      if (name === 'normal' || name === 'excellent' || name === 'poor') continue;
      if (!(flag & bits[name])) continue;
      let r = ov ? (ov[name] || 0) : (oddsJson.defaultRates[name] || 0);
      if (!ov && oddsJson.flagAdjust) {
        for (const other of Object.keys(oddsJson.flagAdjust)) {
          const adj = oddsJson.flagAdjust[other][name];
          if (adj !== undefined && (flag & bits[other])) r = adj;
        }
      }
      rows.push([name, r]); sum += r;
    }
    return { flag, rows, normal: Math.max(0, 1 - sum) };
  }
  function drawCondition(table, prev, rnd) {
    if (prev === 'excellent') return 'poor';
    if (prev === 'goodOmen') return 'good';
    if (prev === 'robust') return 'sturdy';
    let x = rnd();
    for (const [n, r] of table.rows) { if ((x -= r) < 0) return n; }
    return 'normal';
  }

  // 계획(스킬 배열)을 표본 공정(상태·성공 확률 포함)으로 n 번 돌려 완료율/평균 품질을 구한다.
  // 계획대로 못 쓰는 스킬(CP 부족 등)은 건너뛰고, 끝나도 미완료면 모범 작업으로 마무리를 시도한다.
  function simulate(planKeys, start, ctx, oddsJson, n, rnd) {
    rnd = rnd || Math.random;
    const table = conditionTable(oddsJson, ctx.rp.rlvl);
    let ok = 0, qSum = 0, qOk = 0, qHit = 0;
    for (let i = 0; i < (n || 300); i++) {
      let s = start, cond = 'normal';
      for (const k of planKeys.slice(1)) {
        if (s.done || s.dead) break;
        cond = drawCondition(table, cond, rnd);
        if (!canUse(k, s, ctx, cond)) continue;
        s = apply(s, k, ctx, cond, rnd() < (A[k].rate === undefined ? 1 : A[k].rate));
      }
      for (let g = 0; g < 40 && !s.done && !s.dead; g++) {
        cond = drawCondition(table, cond, rnd);
        const k = canUse('careful', s, ctx, cond) ? 'careful' : 'basicS';
        s = apply(s, k, ctx, cond, true);
      }
      if (s.done) { ok++; qSum += s.quality; if (s.quality >= ctx.targetQuality) qHit++; }
    }
    const N = n || 300;
    return { pDone: ok / N, pQuality: qHit / N, avgQuality: ok ? qSum / ok : 0 };
  }

  // ── 반응형 정책 (조건을 보고 매 공정 고른다) ───────────────
  // 작업 흐름: ① 작업량을 마무리 1~2회 몫만 남기고 채움 → ② 품질 → ③ 남은 작업량으로 마무리.
  // variant: { opener:'auto', byregotIq:10, manipAt:… } — 여러 변형을 돌려 가장 좋은 쪽을 고른다.
  function progGainOf(s, key, ctx, cond) {
    const d = A[key]; let p = d.p;
    if (d.halfIfLowDur && s.dur < cost(d, s, cond).dur) p /= 2;
    return E.progressGain(E.baseProgress(ctx.craftsmanship, ctx.rp), p, { malleable: cond === 'malleable', mm: s.mm > 0, ven: s.ven > 0 });
  }
  function policy(s, ctx, cond, v) {
    const U = (k) => canUse(k, s, ctx, cond);
    const R = ctx.target - s.progress;
    const qDone = s.quality >= ctx.targetQuality;
    const gCareful = progGainOf(s, 'careful', ctx, cond), gBasic = progGainOf(s, 'basicS', ctx, cond);
    const finGain = Math.max(gBasic, U('careful') ? gCareful : 0);

    // 내구 관리 (진행 중 내구가 10 이하면 위험)
    if (s.dur <= 10 && R > finGain * 0.9) {
      if (U('immac') && s.cp >= 112 + 7) return 'immac';
      if (U('mend') && s.cp >= 88 + 7) return 'mend';
    }
    if (!s.manip && !s.wn && s.steps >= 2 && s.dur <= ctx.maxDur * 0.55 && U('manip') && s.cp >= 96 + 120 && !qDone) return 'manip';

    // ③ 마무리: 품질을 채웠거나 자원이 바닥났으면 작업량을 끝낸다
    const reserve = 7 + 6;
    const noMoreQuality = qDone || s.cp < 18 + reserve || s.dur < 20;
    if (R > 0 && noMoreQuality) {
      if (U('intensive') && progGainOf(s, 'intensive', ctx, cond) >= R) return 'intensive';
      if (U('basicS') && gBasic >= R) return 'basicS';
      if (U('careful') && gCareful >= R) return 'careful';
      if (U('groundwork') && progGainOf(s, 'groundwork', ctx, cond) >= R && s.dur >= cost(A.groundwork, s, cond).dur) return 'groundwork';
      if (U('intensive')) return 'intensive';
      if (U('groundwork') && s.dur >= cost(A.groundwork, s, cond).dur) return 'groundwork';
      if (U('careful')) return 'careful';
      return 'basicS';
    }

    // ① 작업량 채우기: 마무리 몫(finGain)을 남기고 끝내지 않는 범위에서 가장 큰 스킬
    if (R > finGain * 1.05 && (s.steps === 0 || R > ctx.target * (v.progFirst === false ? 0.45 : 0.15))) {
      if (s.steps === 0) return v.opener === 'reflect' && U('reflect') ? 'reflect' : (U('mm') ? 'mm' : 'basicS');
      if (!s.ven && s.cp >= 18 + 60 && R > ctx.target * 0.35 && U('ven')) return 'ven';
      const gRapid = progGainOf(s, 'rapid', ctx, cond);
      // 강행 작업 중심: 공경(또는 빠른 진행) 아래에서 강행을 적극 사용, 우주 안정된 솜씨로 확정 성공
      if (v.rapid && s.ven > 0 && !s.ssh && U('ssh') && R > gRapid * 2) return 'ssh';
      const order = v.rapid ? ['intensive', 'rapid', 'groundwork', 'careful', 'basicS'] : ['intensive', 'groundwork', 'careful', 'rapid', 'basicS'];
      for (const k of order) {
        if (!U(k)) continue;
        if (k === 'groundwork' && s.dur < cost(A.groundwork, s, cond).dur) continue;
        if (k === 'rapid' && !(v.rapid && (s.ven > 0 || s.ssh > 0 || cond === 'malleable')) && (s.cp >= 40 || R < ctx.target * 0.2)) continue;
        if (progGainOf(s, k, ctx, cond) < R - finGain * 0.9) return k;
      }
    }

    // ② 품질
    if (s.steps === 0 && U('reflect')) return 'reflect';
    if (!qDone) {
      const canByregot = U('byregot');
      const qLeft = ctx.targetQuality - s.quality;
      // 비결: 고품질일 때 CP가 모자라면 회복
      if (v.tricks && (cond === 'good') && s.cp < 40 + reserve && U('tricks')) return 'tricks';
      // 공경 아래 정교한 작업: 작업량과 품질을 동시에 (마무리 몫은 남김)
      if (v.delicate && s.ven > 0 && s.iq < 10 && R > finGain * 1.3 && s.cp >= 32 + reserve && s.dur > 10 && U('delicate')) return 'delicate';
      // 정신집중 10스택 이후 고품질이면 밑가공 연속 (내구 여유가 있을 때)
      if (v.chain && s.iq >= 10 && cond === 'good' && qLeft > ctx.targetQuality * 0.25 && s.cp >= 40 + reserve && s.dur >= cost(A.prep, s, cond).dur + 10 && U('prep')) return 'prep';
      const comboReady = s.cp >= 24 + 32 + (s.inno ? 0 : 18) + reserve;
      if (s.iq >= (v.byregotIq || 10) && canByregot) {
        if (!s.inno && s.cp >= 18 + 24 + reserve + (s.gs ? 0 : 32) && U('inno')) return 'inno';
        if (!s.gs && s.cp >= 32 + 24 + reserve && U('gs')) return 'gs';
        return 'byregot';
      }
      if (cond === 'good' || cond === 'excellent') { if (U('precise') && s.iq < 10) return 'precise'; }
      if ((cond === 'sturdy' || cond === 'robust') && s.dur >= 25 && s.cp >= 40 + reserve && s.iq <= 8 && U('prep')) return 'prep';
      if (!s.inno && s.iq < 10 && s.cp >= 18 + 40 + reserve && U('inno')) return 'inno';
      if (s.iq >= 10 && U('finesse') && s.cp >= 32 + reserve) return 'finesse';
      if (s.lastAction === 'standard' && U('advanced') && s.cp >= 18 + reserve) return 'advanced';
      if (s.lastAction === 'basicT' && U('standard') && s.cp >= 18 + reserve) return 'standard';
      if (s.cp >= 18 + reserve && U('basicT')) return 'basicT';
      if (U('daring')) return 'daring';
      if (U('hasty')) return 'hasty';
      if (canByregot && s.cp >= 24 + reserve) return 'byregot';
    }
    return U('basicS') ? 'basicS' : 'observe';
  }

  function rollout(start, ctx, first, cond0, table, rnd, v) {
    let s = apply(start, first, ctx, cond0, A[first].rate === undefined ? undefined : rnd() < A[first].rate);
    let cond = cond0, path = [first];
    for (let g = 0; g < 70 && !s.done && !s.dead; g++) {
      cond = drawCondition(table, cond, rnd);
      let k = policy(s, ctx, cond, v);
      if (!canUse(k, s, ctx, cond)) k = canUse('basicS', s, ctx, cond) ? 'basicS' : 'observe';
      s = apply(s, k, ctx, cond, A[k].rate === undefined ? undefined : rnd() < A[k].rate);
      path.push(k);
    }
    return { s, path };
  }

  const VARIANTS = [{ opener: 'mm', byregotIq: 10 }, { opener: 'reflect', byregotIq: 10 }, { opener: 'mm', byregotIq: 8 }, { opener: 'reflect', byregotIq: 8 },
    // 품질 먼저: 작업량은 절반 가까이만 채우고 품질을 쌓은 뒤 모범 작업/신중 작업으로 마무리
    { opener: 'mm', byregotIq: 10, progFirst: false }, { opener: 'reflect', byregotIq: 10, progFirst: false },
    // 플레이 스타일(영상·시트 기록 기반): 확신 오프너 → 작업량 먼저(강행 중심), 진가 오프너 → 품질 먼저
    { opener: 'mm', byregotIq: 10, rapid: true, delicate: true, chain: true, tricks: true, style: true },
    { opener: 'reflect', byregotIq: 10, progFirst: false, rapid: true, delicate: true, chain: true, tricks: true, style: true }];

  /** recommendPolicy: 후보 첫 스킬마다 반응형 정책으로 n 번 시뮬레이션해 완료/목표 품질 달성 확률을 구한다. */
  function recommendPolicy(state, ctx, cond, opts) {
    const o = opts || {};
    const table = conditionTable(o.odds, ctx.rp.rlvl);
    const n = o.samples || 200;
    const rnd = o.rnd || Math.random;
    const out = [];
    for (const k of KEYS) {
      if (!canUse(k, state, ctx, cond || 'normal')) continue;
      if (k === 'tricks' && state.cp >= ctx.maxCP - 20) continue;
      let best = null;
      for (const v of VARIANTS) {
        let ok = 0, qHit = 0, qSum = 0, cpLeft = 0, sample = null;
        for (let i = 0; i < n; i++) {
          const r = rollout(state, ctx, k, cond || 'normal', table, rnd, v);
          if (r.s.done) { ok++; qSum += r.s.quality; cpLeft += r.s.cp; if (r.s.quality >= ctx.targetQuality) qHit++; }
          if (!sample) sample = r.path;
        }
        const stat = { pDone: ok / n, pQuality: qHit / n, avgQuality: ok ? qSum / ok : 0, avgCp: ok ? cpLeft / ok : 0, variant: v, sample };
        stat.score = stat.pQuality * 300 + stat.pDone * 100 + Math.min(1, stat.avgQuality / ctx.targetQuality) * 50;
        if (!best || stat.score > best.score) best = stat;
      }
      out.push({ key: k, ko: A[k].ko, risk: best, plan: best.sample, score: best.score, ok: best.pDone > 0, quality: Math.floor(best.avgQuality), finishCp: Math.round(best.avgCp) });
    }
    if (o.hybrid !== false) {
      // 고정 계획(빔 서치)과 반응형 정책 중 후보마다 더 좋은 쪽을 쓴다
      const fixed = recommend(state, ctx, cond, { width: o.width || 160, depth: o.depth || 28, odds: o.odds, samples: n, rnd });
      for (const f of fixed) {
        const i = out.findIndex((x) => x.key === f.key);
        if (i < 0) out.push(Object.assign({ mode: '계획' }, f));
        else if (f.score > out[i].score) out[i] = Object.assign({ mode: '계획' }, f);
        else out[i].mode = '반응';
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /**
   * recommend(state, ctx, cond, opts) → [{ key, ko, ok, quality, finishCp, plan }] (점수 내림차순)
   *  state: newState({cp, dur, ...}) 로 만든 현재 상태
   *  ctx  : { craftsmanship, control, rp, relic, target, targetQuality, maxDur, maxCP }
   *  cond : 현재 공정의 상태 (normal/good/centered/sturdy/pliant/malleable/primed/goodOmen/robust …)
   */
  function recommend(state, ctx, cond, opts) {
    const out = [];
    for (const k of KEYS) {
      if (!canUse(k, state, ctx, cond || 'normal')) continue;
      const ns = apply(state, k, ctx, cond || 'normal');
      if (ns.dead) continue;
      const best = ns.done ? { s: ns, path: [], sc: score(ns, ctx) } : plan(ns, ctx, opts);
      const path = [k].concat(best.path);
      const risk = opts && opts.odds ? simulate(path, ns, ctx, opts.odds, opts.samples || 300, opts.rnd) : null;
      out.push({
        risk, key: k, ko: A[k].ko, ok: best.s.done,
        quality: Math.floor(best.s.quality), finishCp: best.s.cp,
        score: risk ? risk.pQuality * 300 + risk.pDone * 100 + Math.min(1, risk.avgQuality / ctx.targetQuality) * 50 : best.sc, plan: path,
      });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  return { ACTIONS: A, newState, canUse, cost, apply, plan, recommend, recommendPolicy, policy, conditionTable, drawCondition, simulate };
});
