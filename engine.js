/* ============================================================
 *  engine.js · 작업량/품질 계산 엔진 (UI 의존 없음)
 *
 *  공식 출처: ffxiv-teamcraft/simulator (MIT, © 2019 Flavien Normand)
 *    - base progress/quality, 효율·버프·상태 배율, 내면의 평온 처리
 *  자세한 표기는 THIRD_PARTY_NOTICES.md 참고.
 *
 *  범위(v1): 작업량·품질 "증가량" 계산과 버프/IQ 추적만 다룬다.
 *            CP·내구도·사용 가능 조건·성공 확률은 다루지 않는다.
 *  브라우저: window.FFEngine / Node: require('./engine.js')
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FFEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Teamcraft Tables.LEVEL_TABLE[100]. 레시피 rlvl 이 이 값 이상일 때만 pm/qm 이 적용된다.
  const LEVEL_TABLE_100 = 690;
  const f32 = Math.fround;

  // recipe-level-table.json 항목 → 엔진 파라미터
  function paramsFromTable(rlvl, entry) {
    return {
      rlvl: Number(rlvl),
      pd: entry.progressDivider, pm: entry.progressModifier,
      qd: entry.qualityDivider, qm: entry.qualityModifier,
    };
  }

  function applyModifier(baseValue, modifier, rlvl, levelRlvl) {
    if (levelRlvl <= rlvl) return f32(baseValue * (modifier || 100) * f32(0.01));
    return Math.floor(baseValue);
  }

  // rp = { rlvl, pd, pm, qd, qm }
  function baseProgress(craftsmanship, rp, levelRlvl) {
    const base = (craftsmanship * 10) / rp.pd + 2;
    return Math.floor(applyModifier(base, rp.pm, rp.rlvl, levelRlvl || LEVEL_TABLE_100));
  }
  function baseQuality(control, rp, levelRlvl) {
    const base = (control * 10) / rp.qd + 35;
    return Math.floor(applyModifier(base, rp.qm, rp.rlvl, levelRlvl || LEVEL_TABLE_100));
  }

  // opts: { malleable, mm, ven }
  function progressGain(base, potency, opts) {
    const o = opts || {};
    let buff = 1;
    if (o.mm) buff += 1;
    if (o.ven) buff += 0.5;
    const cond = o.malleable ? 1.5 : 1;
    return Math.floor((base * cond * (potency * buff)) / 100);
  }

  // opts: { cond:'normal'|'good'|'excellent'|'poor', relic, iq, gs, inno } 또는 buffSum(gs/inno 대신)
  function qualityGain(base, potency, opts) {
    const o = opts || {};
    let cond = 1;
    if (o.cond === 'excellent') cond = 4;
    else if (o.cond === 'poor') cond = 0.5;
    else if (o.cond === 'good') cond = o.relic ? 1.75 : 1.5;
    const iq = o.iq || 0;
    let mult = 1;
    if (o.buffSum !== undefined) mult += o.buffSum; // 혁신 0.5 + 장족 1.0 같은 합산값
    else {
      if (o.gs) mult += 1;
      if (o.inno) mult += 0.5;
    }
    const buffMod = (1 * mult * (100 + iq * 10)) / 100;
    const eff = f32(potency * buffMod);
    return Math.floor((base * cond * eff) / 100);
  }

  // ── 스킬 표 (효율, IQ 증가) ──
  const PROGRESS_ACTIONS = {
    basicS: 120, careful: 180, prudentS: 180, groundwork: 360, intensive: 400, rapid: 500,
    mm: 300, // 확신: 다음 작업 스킬 +100% (5공정, 가공 가능 시 아님/예감 시 7)
  };
  const QUALITY_ACTIONS = {
    basicT: { p: 100, iq: 1 }, standard: { p: 125, iq: 1 }, advanced: { p: 150, iq: 1 },
    hasty: { p: 100, iq: 1 }, daring: { p: 150, iq: 1 }, prudentT: { p: 100, iq: 1 },
    prep: { p: 200, iq: 2 }, precise: { p: 150, iq: 2 }, reflect: { p: 300, iq: 2 },
    refined: { p: 100, iq: 1 }, finesse: { p: 100, iq: 1 },
    byregot: { p: null, iq: 0 }, // 효율 = min(100 + 20*IQ, 300), 사용 후 IQ 초기화
  };
  const BUFF_ACTIONS = { ven: 4, inno: 4, gs: 3 };

  // ── 상태 추적기 ──
  // Teamcraft 규칙: 공정 s 에서 건 버프는 공정 s+1 부터 줄어든다.
  function newState() {
    return { progress: 0, quality: 0, iq: 0, ven: 0, inno: 0, gs: 0, mm: 0, steps: 0, lastAction: null };
  }

  // step: { a: 스킬키, cond?: 상태, malleable?: bool }
  // ctx : { craftsmanship, control, rp, relic, primed? }
  function step(s, a, ctx, condition) {
    const st = Object.assign({}, s);
    const cond = condition || 'normal';
    const dur = (d) => (cond === 'primed' ? d + 2 : d);
    const was = { ven: s.ven, inno: s.inno, gs: s.gs, mm: s.mm };

    if (a in PROGRESS_ACTIONS) {
      const base = baseProgress(ctx.craftsmanship, ctx.rp);
      const g = progressGain(base, PROGRESS_ACTIONS[a], { malleable: cond === 'malleable', mm: a !== 'mm' && s.mm > 0, ven: s.ven > 0 });
      st.progress += g;
      if (a !== 'mm' && s.mm > 0) st.mm = 0;
      if (a === 'mm') st.mm = -dur(5); // 음수 = 이번 공정에 새로 검 (아래에서 정리)
    } else if (a in QUALITY_ACTIONS) {
      const q = QUALITY_ACTIONS[a];
      const base = baseQuality(ctx.control, ctx.rp);
      const potency = a === 'byregot' ? Math.min(100 + s.iq * 20, 300) : q.p;
      const g = qualityGain(base, potency, {
        cond: cond === 'good' || cond === 'excellent' || cond === 'poor' ? cond : 'normal',
        relic: ctx.relic, iq: s.iq, gs: s.gs > 0, inno: s.inno > 0,
      });
      st.quality += g;
      if (s.gs > 0) st.gs = 0;
      if (a === 'byregot') st.iq = 0;
      else {
        let add = q.iq;
        if (a === 'refined' && s.lastAction === 'basicT') add += 1;
        st.iq = Math.min(10, s.iq + add);
      }
    } else if (a in BUFF_ACTIONS) {
      st[a] = -dur(BUFF_ACTIONS[a]);
    } else {
      throw new Error('unknown action: ' + a);
    }

    // 버프 틱: 이번 공정에 새로 건 버프(음수 표시)는 줄이지 않는다.
    for (const k of ['ven', 'inno', 'gs', 'mm']) {
      if (st[k] < 0) st[k] = -st[k];
      else if (st[k] > 0 && was[k] > 0) st[k] = st[k] - 1;
    }
    st.steps = s.steps + 1;
    st.lastAction = a;
    return st;
  }

  function run(seq, ctx) {
    let s = newState();
    for (const it of seq) s = step(s, it.a, ctx, it.cond);
    return s;
  }

  return {
    LEVEL_TABLE_100, paramsFromTable, baseProgress, baseQuality, progressGain, qualityGain,
    PROGRESS_ACTIONS, QUALITY_ACTIONS, BUFF_ACTIONS, newState, step, run,
  };
});
