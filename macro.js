/* ============================================================
 *  macro.js · 매크로(고정 순서) 로테이션 탐색 (UI 의존 없음)
 *
 *  상태를 '보통'으로 가정하고, 성공률 100%인 스킬만 써서
 *  작업량·목표 품질을 채우는 가장 짧은 순서를 빔 서치로 찾는다.
 *  찾은 후보는 실제 상태 확률(data/condition-odds.json)로 시뮬레이션해
 *  "상태가 어떻게 나와도 이 매크로로 되는지"를 함께 돌려준다.
 *  브라우저: window.FFMacro / Node: require('./macro.js')
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./advisor.js'));
  else root.FFMacro = factory(root.FFAdvisor);
})(typeof self !== 'undefined' ? self : this, function (Adv) {
  'use strict';
  const A = Adv.ACTIONS;
  // 매크로에 쓰지 않는 스킬: 기록 전용/보조(설계 변경·기적의 물질), 비결
  const SKIP = new Set(['dc', 'mmr', 'tricks']);
  const KEYS = Object.keys(A).filter((k) => !SKIP.has(k));

  // 성공률 100% 스킬만. 우주 안정된 솜씨가 켜져 있으면 확률 스킬도 확정 성공
  function usable(k, s, ctx) {
    if (A[k].rate !== undefined && !(s.ssh > 0)) return false;
    return Adv.canUse(k, s, ctx, 'normal');
  }

  function keyOf(s) {
    return [Math.round(s.progress), Math.round(s.quality), s.cp, s.dur, s.iq, s.ven, s.inno, s.gs, s.mm, s.wn, s.manip, s.fa, s.exp, s.ssh,
      s.hs, s.hsUsed, s.qiUsed, s.tp, s.tpUsed,
      s.lastAction === 'basicT' || s.lastAction === 'standard' || s.lastAction === 'observe' ? s.lastAction : '-'].join(',');
  }
  function heur(s, ctx, late) {
    const pr = Math.min(1, s.progress / ctx.target) * (late ? 0.05 : 1);
    const qr = Math.min(1, s.quality / ctx.targetQuality);
    return pr * 60 + qr * 100 + s.cp * 0.02 + s.dur * 0.05 + s.iq * 0.5;
  }

  /**
   * search(ctx, opts) → { plans: [{ path, quality, cp, steps, ok }], reachedQuality }
   *  ctx : advisor.js 와 같은 ctx (craftsmanship, control, rp, relic, target, targetQuality, maxDur, maxCP, specialist, cosmic)
   */
  function search(ctx, opts) {
    opts = opts || {};
    const width = opts.width || 400, maxDepth = opts.depth || 34, keep = opts.keep || 24;
    const keys = opts.ban ? KEYS.filter((k) => !opts.ban.includes(k)) : KEYS;
    const start = Adv.newState({ cp: ctx.maxCP, dur: ctx.maxDur, steps: 0 });
    let beam = [{ s: start, sm: start, path: [] }]; // sm: 모든 공정이 '빠른 진행'이었을 때의 상태 (작업량이 가장 빨리 차는 경우)
    const found = []; // 목표 품질까지 채운 완성 후보
    let best = null;  // 목표에 못 닿았을 때 가장 좋은 완성 후보
    let extra = 0;
    for (let d = 0; d < maxDepth && beam.length; d++) {
      const next = new Map();
      for (const node of beam) {
        for (const k of (d === 0 && opts.first ? [opts.first] : keys)) {
          if (!usable(k, node.s, ctx)) continue;
          if (opts.late && (A[k].kind === 'prog' || A[k].kind === 'both') && node.s.quality < ctx.targetQuality) continue; // 작업량은 품질을 다 채운 뒤에
          const ns = Adv.apply(node.s, k, ctx, 'normal');
          if (ns.dead) continue;
          const nm = Adv.apply(node.sm, k, ctx, 'malleable');
          // 빠른 진행이 뜨면 작업량이 먼저 차서 제작이 일찍 끝날 수 있다. 그때까지 품질을 못 채웠다면 위험하니 그 순서는 버린다
          // (품질을 이미 채운 뒤에 끝나는 건 괜찮다)
          if (!ns.done && nm.done && ns.quality < ctx.targetQuality) continue;
          const path = node.path.concat(k);
          if (ns.done) {
            const rec = { path, quality: ns.quality, cp: ns.cp, steps: path.length, ok: ns.quality >= ctx.targetQuality };
            if (rec.ok) found.push(rec);
            else if (!best || rec.quality > best.quality) best = rec;
            continue;
          }
          const kk = keyOf(ns) + '|' + Math.round(nm.progress), h = heur(ns, ctx, opts.late), ex = next.get(kk);
          if (!ex || ex.h < h) next.set(kk, { s: ns, sm: nm, path, h });
        }
      }
      beam = [...next.values()].sort((a, b) => b.h - a.h).slice(0, width);
      if (found.length) { if (++extra > 3) break; } // 가장 짧은 해가 나온 뒤 몇 공정까지만 더 본다
    }
    found.sort((a, b) => a.steps - b.steps || b.cp - a.cp);
    // 같은 순서 중복 제거
    const seen = new Set(), plans = [];
    for (const f of found) { const k = f.path.join(','); if (!seen.has(k)) { seen.add(k); plans.push(f); } if (plans.length >= keep) break; }
    return { plans, best, reachedQuality: plans.length > 0 };
  }

  // 작업량을 나중에 채우는 순서를 층(공정 수)별로 빠짐없이 찾는다.
  // 같은 버프·정신집중 상태에서 CP·내구·품질·작업량이 모두 더 나쁜 것은 버리는 방식(파레토)이라, 빔 서치와 달리 짧은 순서를 놓치지 않는다.
  function searchExact(ctx, opts) {
    opts = opts || {};
    const maxDepth = opts.depth || 26, keep = opts.keep || 24, perKey = opts.perKey || 12, cap = opts.cap || 3500;
    const ban = opts.ban || ['basicT', 'refined', 'mend', 'observe']; // 거의 안 쓰이는 스킬은 빼서 탐색을 줄인다
    const keys = KEYS.filter((k) => !ban.includes(k));
    const tq = ctx.targetQuality;
    const start = Adv.newState({ cp: ctx.maxCP, dur: ctx.maxDur, steps: 0 });
    const fkey = (s) => [s.iq, s.ven, s.inno, s.gs, s.mm, s.wn, s.manip, s.fa, s.exp, s.ssh, s.hs, s.hsUsed, s.qiUsed, s.tp, s.tpUsed, s.steps === 0 ? 0 : 1,
      s.lastAction === 'basicT' || s.lastAction === 'standard' || s.lastAction === 'observe' ? s.lastAction : '-'].join(',');
    const dom = (a, b) => a.cp >= b.cp && a.dur >= b.dur && Math.min(a.quality, tq) >= Math.min(b.quality, tq) && a.progress >= b.progress;
    let layer = [{ s: start, prev: null, k: null }];
    const found = []; let extra = 0;
    const build = (n, k) => { const p = [k]; for (; n && n.k; n = n.prev) p.unshift(n.k); return p; };
    for (let d = 0; d < maxDepth && layer.length; d++) {
      const map = new Map();
      for (const node of layer) {
        for (const k of (d === 0 && opts.first ? [opts.first] : keys)) {
          if (!usable(k, node.s, ctx)) continue;
          if (opts.late && (A[k].kind === 'prog' || A[k].kind === 'both') && node.s.quality < tq) continue;
          const ns = Adv.apply(node.s, k, ctx, 'normal');
          if (ns.dead) continue;
          if (ns.done) {
            if (ns.quality >= tq) found.push({ path: build(node, k), quality: ns.quality, cp: ns.cp, steps: d + 1, ok: true });
            continue;
          }
          const kk = fkey(ns); let arr = map.get(kk);
          if (!arr) { arr = []; map.set(kk, arr); }
          if (arr.some((o) => dom(o.s, ns))) continue;
          for (let i = arr.length - 1; i >= 0; i--) if (dom(ns, arr[i].s)) arr.splice(i, 1);
          arr.push({ s: ns, prev: node, k });
          if (arr.length > perKey) { arr.sort((a, b) => heur(b.s, ctx, true) - heur(a.s, ctx, true)); arr.length = perKey; }
        }
      }
      layer = [].concat(...map.values());
      if (layer.length > cap) { layer.sort((a, b) => heur(b.s, ctx, true) - heur(a.s, ctx, true)); layer.length = cap; }
      if (found.length) { if (++extra > 1) break; }
    }
    found.sort((a, b) => a.steps - b.steps || b.cp - a.cp);
    const seen = new Set(), plans = [];
    for (const f of found) { const k = f.path.join(','); if (!seen.has(k)) { seen.add(k); plans.push(f); } if (plans.length >= keep) break; }
    return { plans, best: null, reachedQuality: plans.length > 0 };
  }

  /** 정해진 순서를 상태 확률대로 n 번 돌린다. 못 쓰는 스킬이 나오면 매크로가 멈춘 것으로 본다. */
  function simulate(path, ctx, odds, n, rnd) {
    rnd = rnd || Math.random;
    const table = Adv.conditionTable(odds, ctx.rp.rlvl);
    const N = n || 400;
    let done = 0, hit = 0, qSum = 0;
    for (let i = 0; i < N; i++) {
      let s = Adv.newState({ cp: ctx.maxCP, dur: ctx.maxDur, steps: 0 }), cond = 'normal';
      for (let j = 0; j < path.length; j++) {
        if (s.done || s.dead) break;
        cond = j === 0 ? 'normal' : Adv.drawCondition(table, cond, rnd);
        const k = path[j];
        if (!Adv.canUse(k, s, ctx, cond)) break; // 매크로 중단
        s = Adv.apply(s, k, ctx, cond, rnd() < (A[k].rate === undefined ? 1 : A[k].rate));
      }
      if (s.done) { done++; qSum += s.quality; if (s.quality >= ctx.targetQuality) hit++; }
    }
    return { pDone: done / N, pQuality: hit / N, avgQuality: done ? qSum / done : 0 };
  }

  // 시작 스킬(확신 / 진가 / 그 밖)마다 따로 찾아 합친다. 한 번에 찾으면 빔이 한쪽으로 쏠려 다른 시작이 더 좋은 경우를 놓친다
  const VARIANTS = [{ first: 'reflect', late: true, exact: true }, { first: 'reflect' }, { first: 'mm' }, { ban: ['mm', 'reflect'] }]; // 진가+작업량 나중에(빠짐없이 탐색) / 진가 / 확신 / 시작 스킬 없이(빔)
  const sctxOf = (ctx, opts) => (opts && opts.margin ? Object.assign({}, ctx, { targetQuality: Math.ceil(ctx.targetQuality * (1 + opts.margin)) }) : ctx);
  function searchVariant(ctx, opts, v) { opts = opts || {}; const o = Object.assign({}, opts, VARIANTS[v]); return (o.exact ? searchExact : search)(sctxOf(ctx, opts), o); }
  function merge(parts) {
    const seen = new Set(), plans = [];
    for (const p of parts) for (const q of p.plans) { const k = q.path.join(','); if (!seen.has(k)) { seen.add(k); plans.push(q); } }
    plans.sort((a, b) => a.steps - b.steps || b.cp - a.cp);
    let best = null; for (const p of parts) if (p.best && (!best || p.best.quality > best.quality)) best = p.best;
    return { plans, best };
  }
  /** 후보들을 시뮬레이션해 가장 안정적인 순서를 고른다 (성공률 우선, 같으면 짧은 쪽). parts: searchVariant 결과들 */
  function rank(ctx, odds, parts, opts) {
    opts = opts || {};
    const r = merge(parts);
    const OPEN = ['reflect', 'mm']; // 시작 스킬(진가·확신)을 쓴 순서가 있으면 그것만 쓴다. 없을 때만 시작 스킬 없는 순서
    if (r.plans.some((q) => OPEN.includes(q.path[0]))) r.plans = r.plans.filter((q) => OPEN.includes(q.path[0]));
    if (!r.plans.length) return { ok: false, best: r.best, plans: [] };
    const ranked = r.plans.slice(0, opts.simTop || 30).map((p) => Object.assign({ risk: simulate(p.path, ctx, odds, opts.samples || 400, opts.rnd) }, p));
    const pen = (p) => (p.path[0] === 'reflect' ? 0 : 1); // 달성 확률이 같으면 진가 시작을 먼저
    ranked.sort((a, b) => b.risk.pQuality - a.risk.pQuality || pen(a) - pen(b) || a.steps - b.steps || b.cp - a.cp);
    return { ok: true, plans: ranked, best: r.best };
  }
  function solve(ctx, odds, opts) {
    opts = opts || {};
    let res = rank(ctx, odds, VARIANTS.map((_, i) => searchVariant(ctx, opts, i)), opts);
    if (!res.ok && opts.margin) { res = rank(ctx, odds, VARIANTS.map((_, i) => searchVariant(ctx, Object.assign({}, opts, { margin: 0 }), i)), opts); res.marginFailed = true; }
    return res;
  }

  /** 상태 '보통'으로 한 공정씩 돌린 결과 (화면의 공정별 표용) */
  function trace(path, ctx) {
    let s = Adv.newState({ cp: ctx.maxCP, dur: ctx.maxDur, steps: 0 });
    const rows = [];
    for (const k of path) {
      s = Adv.apply(s, k, ctx, 'normal');
      rows.push({ key: k, progress: Math.min(Math.floor(s.progress), ctx.target), quality: Math.floor(s.quality), cp: s.cp, dur: Math.max(0, s.dur), iq: Math.floor(s.iq) });
    }
    return rows;
  }

  /** 인게임 매크로 텍스트. 15줄 제한 때문에 14공정마다 끊고 마지막 줄에 완료 알림을 붙인다. */
  function toText(path, per) {
    per = per || 14;
    const waitOf = (k) => (A[k].kind === 'buff' || k === 'observe' ? 2 : 3);
    const lines = path.map((k) => `/ac "${A[k].ko}" <wait.${waitOf(k)}>`);
    if (lines.length <= 15) return [lines.join('\n')]; // 한 번에 들어가면 완료 알림 줄을 붙이지 않는다
    const out = [];
    for (let i = 0; i < lines.length; i += per) {
      const chunk = lines.slice(i, i + per);
      const n = out.length + 1, total = Math.ceil(lines.length / per);
      if (total > 1) chunk.push(`/echo 매크로 #${n} 완료 <se.1>`); else chunk.push('/echo 매크로 완료 <se.1>');
      out.push(chunk.join('\n'));
    }
    return out;
  }

  return { search, searchVariant, rank, solve, simulate, trace, toText, KEYS, VARIANTS };
});
