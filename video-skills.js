/* video-skills.js · 공정마다 읽은 작업량/품질 변화량으로 어떤 스킬을 썼는지 맞춘다 (UI 의존 없음)
 *
 * 입력 : 한 제작의 공정 목록 [{step, cond, p, q}]  (p,q = 그 공정을 시작할 때 화면의 현재 작업량/품질, 못 읽었으면 null)
 * 출력 : {bp, bq, cost, acts:[{step, key, alts:[...], dp, dq}]}
 * 방법 : 스킬 효율·상태·버프 배율은 engine.js 공식을 그대로 쓰고, 이 영상의 '기본 작업량/품질'(bp, bq)은
 *        관찰한 변화량에 맞는 값을 찾아낸다. 그다음 공정마다 변화량이 맞는 스킬을 빔 서치로 고른다.
 *        같은 변화량을 내는 스킬(가공/절약 가공/성급한 손길 등)은 구분할 수 없어 alts 에 같이 담는다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./advisor.js'));
  else root.VLSkills = factory(root.FFEngine, root.FFAdvisor);
})(typeof self !== 'undefined' ? self : this, function (E, ADV) {
  'use strict';
  const A = ADV.ACTIONS;
  const COND_Q = { good: 'good', excellent: 'excellent', poor: 'poor' };
  // 변화량으로 구분 가능한 스킬 + 변화량 0인 버프 3종 + '그 밖(근검절약·땜질 등)'
  const KEYS = Object.keys(A).filter((k) => ['prog', 'qual', 'both'].includes(A[k].kind) || ['ven', 'inno', 'gs'].includes(k));
  const NONE = 'none';
  const NOSTEP = new Set(['fa', 'hs', 'qi', 'tp', 'dc', 'mmr']);   // 공정 번호가 안 올라가는 스킬은 기록에 안 잡힌다

  const fresh0 = () => ({ iq: 0, ven: 0, inno: 0, gs: 0, mm: 0, exp: 0, last: '' });
  function act(s, key, cond, bp, bq, succ) {
    const st = Object.assign({}, s), fr = {}, was = { ven: s.ven, inno: s.inno, gs: s.gs, mm: s.mm, exp: s.exp };
    const dura = (n) => (cond === 'primed' ? n + 2 : n);
    let dp = 0, dq = 0;
    if (key !== NONE) {
      const d = A[key];
      const rate = d.rate === undefined ? 1 : (succ ? 1 : 0);
      if (d.kind === 'prog' || d.kind === 'both') {
        const p = d.kind === 'both' ? d.pp : d.p;
        dp = E.progressGain(bp, p, { malleable: cond === 'malleable', mm: s.mm > 0, ven: s.ven > 0 }) * rate;
        if (s.mm > 0) st.mm = 0;
        if (d.setMM) { st.mm = dura(5); fr.mm = 1; }
      }
      if (d.kind === 'qual' || d.kind === 'both') {
        const pot = key === 'byregot' ? Math.min(100 + s.iq * 20, 300) : d.p;
        dq = E.qualityGain(bq, pot, { cond: COND_Q[cond] || 'normal', iq: s.iq, gs: s.gs > 0, inno: s.inno > 0 }) * rate;
        if (s.gs > 0) st.gs = 0;
        if (d.resetIq) st.iq = 0;
        else { let add = d.iq || 0; if (d.bonusIqFrom && s.last === d.bonusIqFrom) add += 1; st.iq = Math.min(10, Math.round((s.iq + add * rate) * 10) / 10); }
        if (d.setExp) { st.exp = 1; fr.exp = 1; }
      }
      if (d.kind === 'buff' && ['ven', 'inno', 'gs'].includes(d.buff)) { st[d.buff] = dura(d.dur_); fr[d.buff] = 1; }
    }
    for (const k of ['ven', 'inno', 'gs', 'mm']) if (!fr[k] && was[k] > 0 && st[k] > 0) st[k] -= 1;
    if (!fr.exp && was.exp > 0) st.exp = 0;
    st.last = key;
    return { s: st, dp, dq };
  }
  function allowed(s, key, cond, first) {
    if (key === NONE) return true;
    const d = A[key];
    if (d.first && !first) return false;
    if (d.needIq && s.iq < 1) return false;
    if (d.needIq10 && s.iq < 10) return false;
    if (d.needExp && !(s.exp > 0)) return false;
    return true;
  }
  const mism = (pred, obs) => { const e = Math.abs(pred - obs); return e === 0 ? 0 : e <= 1 ? 0.1 : 1; };
  const skey = (s) => [s.iq, s.ven, s.inno, s.gs, s.mm, s.exp, s.last === 'basicT' ? 'b' : ''].join(',');

  // 관찰 목록을 공정 번호 순서로 정리: 연속된 공정만 변화량을 계산
  function prep(steps) {
    const by = new Map(); steps.forEach((x) => by.set(x.step, x));
    const lo = Math.min(...by.keys()), hi = Math.max(...by.keys()), seq = [];
    for (let n = lo; n <= hi; n++) seq.push(by.get(n) || { step: n, cond: 'normal', p: null, q: null, miss: true });
    return seq;
  }
  function deltas(seq) {
    return seq.map((x, i) => {
      const y = seq[i + 1]; if (!y) return { dp: null, dq: null };
      return { dp: x.p != null && y.p != null ? y.p - x.p : null, dq: x.q != null && y.q != null ? y.q - x.q : null };
    });
  }

  // 빔 서치로 한 제작을 풀고 {cost, path:[{key,alts}]} 를 돌려준다
  function decode(seq, dl, bp, bq, width, only) {
    width = width || 40;
    let beam = [{ s: fresh0(), cost: 0, path: [] }];
    const last = seq.length - 1;
    for (let i = 0; i < last; i++) {                       // 마지막 공정은 결과를 못 봐서 푸는 대상이 아니다
      const cond = seq[i].cond, { dp, dq } = dl[i], next = new Map();
      for (const node of beam) {
        for (const key of KEYS.concat(NONE)) {
          if (!allowed(node.s, key, cond, i === 0)) continue;
          const d = key === NONE ? null : A[key];
          for (const succ of (d && d.rate !== undefined ? [true, false] : [true])) {
            const r = act(node.s, key, cond, bp, bq, succ);
            let c = node.cost;
            if (dp != null && only !== 'q') c += mism(r.dp, dp); if (dq != null && only !== 'p') c += mism(r.dq, dq);
            if (key === NONE) c += 0; else if (!d.kind || d.kind === 'buff') c += 0.05;      // 변화 없는 공정은 버프가 꼭 필요할 때만 버프로 본다
            if (d && !succ) c += 0.3;
            if (d && d.good && cond !== 'good' && cond !== 'excellent') c += 0.3;     // 집중 작업/집중 가공은 고품질에서만
            const k = skey(r.s) + '|' + (succ ? 1 : 0), o = next.get(k);
            if (!o || c < o.cost) next.set(k, { s: r.s, cost: c, path: node.path.concat({ key, succ, dp: r.dp, dq: r.dq }) });
          }
        }
      }
      beam = [...next.values()].sort((a, b) => a.cost - b.cost).slice(0, width);
      if (!beam.length) return null;
    }
    const best = beam[0];
    return { cost: best.cost, path: best.path, beam };
  }

  // 변화량이 실제 스킬 배율로 설명되는 bp(기본 작업량) 후보
  const MP = [1, 1.5, 2, 2.5, 2.25, 3, 3.75], EP = [120, 180, 360, 400, 500, 300, 150];
  function bpCandidates(dls) {
    const dps = dls.filter((x) => x > 0), sc = [];
    for (let bp = 40; bp <= 900; bp++) {
      let tot = 0;
      for (const dp of dps) { let m0 = 9; for (const m of MP) for (const e of EP) { const er = Math.abs(Math.floor(bp * m * e / 100) - dp); if (er < m0) m0 = er; } tot += Math.min(m0, 3); }
      sc.push([tot, bp]);
    }
    sc.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const top = sc[0] ? sc[0][0] : 0;
    return sc.filter((x) => x[0] <= top + 1).map((x) => x[1]).slice(0, 40);
  }
  const MQ = [1, 1.5, 2, 2.5], CQ = [1, 1.5, 4, 0.5], EQ = [100, 125, 150, 200, 300];
  function bqCandidates(dq0) {
    const out = new Set();
    if (!(dq0 > 0)) return [];
    for (let bq = 35; bq <= 1000; bq++) {
      let ok = false;
      for (const m of MQ) { for (const c of CQ) { for (const e of EQ) if (Math.abs(Math.floor(bq * c * e * m / 100) - dq0) <= 1) { ok = true; break; } if (ok) break; } if (ok) break; }
      if (ok) out.add(bq);
    }
    return [...out];
  }

  function solve(steps) {
    if (!steps || steps.length < 3) return null;
    const seq = prep(steps), dl = deltas(seq);
    const bpC = bpCandidates(dl.map((x) => x.dp).filter((x) => x != null));
    const dq0 = (dl.map((x) => x.dq).filter((x) => x != null && x > 0))[0];
    const bqC = bqCandidates(dq0);
    if (!bpC.length) bpC.push(300);
    if (!bqC.length) bqC.push(300);
    // 1) 작업량만 보고 bp 후보 비교 → 2) 품질만 보고 bq 후보 비교 → 3) 각 상위 후보끼리 합쳐서 최종 선택
    const rank = (cands, f) => cands.map((c) => { const r = f(c); return r ? [r.cost, c] : null; }).filter(Boolean).sort((a, b) => a[0] - b[0]);
    const mid = bqC[Math.floor(bqC.length / 2)], midP = bpC[0];
    const rp = rank(bpC, (bp) => decode(seq, dl, bp, mid, 12, 'p'));
    const rq = rank(bqC, (bq) => decode(seq, dl, midP, bq, 12, 'q'));
    let best = null;
    const topP = rp.filter((x) => x[0] <= rp[0][0] + 0.5).slice(0, 4).map((x) => x[1]);
    const topQ = rq.filter((x) => x[0] <= rq[0][0] + 0.5).slice(0, 4).map((x) => x[1]);
    for (const bq of topQ) for (const bp of topP) {
      const r = decode(seq, dl, bp, bq, 60);
      if (r && (!best || r.cost < best.cost)) best = { bp, bq, r, cost: r.cost };
    }
    if (!best) return null;
    const { r } = best;
    const acts = r.path.map((p, i) => {
      // 같은 비용 근처의 다른 후보를 '구분 못 하는 스킬'로 모은다
      const alts = new Set([p.key]);
      for (const n of r.beam) if (n.cost <= r.cost + 0.02 && n.path[i]) alts.add(n.path[i].key);
      return { step: seq[i].step, key: p.key, alts: [...alts], dp: dl[i].dp, dq: dl[i].dq, cond: seq[i].cond };
    });
    return { bp: best.bp, bq: best.bq, cost: r.cost, acts, n: seq.length - 1 };
  }
  // 버프 줄로 스킬을 바로잡는다: 숫자가 안 변하는 스킬(버프·땜질)은 '다음 공정에 새로 생긴 버프'로 정체를 확정한다.
  const BUFF_KEY = { '확신': 'mm', '공경': 'ven', '혁신': 'inno', '장족의 발전': 'gs', '근검절약': 'wn', '장기 절약': 'wn2', '교묘한 손놀림': 'manip', '일심불란': 'hs', '장인의 초절 기술': 'tp' };
  function refine(res, rows) {
    if (!res || !rows) return res;
    const by = new Map(); rows.forEach((r) => by.set(r.step, r.buffs || null));
    res.acts.forEach((a) => {
      const cur = by.get(a.step), nxt = by.get(a.step + 1);
      if (cur && !cur.includes('최종 확인') && nxt && nxt.includes('최종 확인')) a.pre = ['fa'];   // 같은 공정 안에서 최종 확인(공정 번호가 안 올라감)
      if (!cur || !nxt) return;
      const nw = nxt.filter((n) => n !== '?' && n !== '정신 집중' && !cur.includes(n) && BUFF_KEY[n] && A[BUFF_KEY[n]]);
      if (a.key === NONE || (a.alts.includes(NONE) && nw.length)) {
        if (nw.length === 1) { a.key = BUFF_KEY[nw[0]]; a.alts = [a.key]; a.byBuff = true; }
      }
    });
    return res;
  }
  const ko = (k) => (k === NONE ? '버프·땜질 등(변화 없음)' : A[k] ? A[k].ko : k);
  return { solve, refine, decode, act, prep, deltas, bpCandidates, bqCandidates, ko, KEYS, NONE };
});
