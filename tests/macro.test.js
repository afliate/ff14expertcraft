const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../engine.js'), M = require('../macro.js'), Adv = require('../advisor.js');
const rt = require('../recipe-level-table.json'), odds = require('../data/condition-odds.json');
const rec = require('../data/expert-recipes.json').recipes;

function ctxOf(r, craft, ctrl, cp) {
  return { craftsmanship: craft, control: ctrl, rp: E.paramsFromTable(r.rlvl, rt[String(r.rlvl)]), relic: false, cosmic: false, specialist: false,
    target: r.work, targetQuality: r.quality, maxDur: r.durability, maxCP: cp };
}
test('매크로: 오래된 레시피는 확정 성공 스킬만으로 목표 달성', () => {
  const r = rec.find((x) => x.rlvl === 481 && x.job === 'CRP');
  const ctx = ctxOf(r, 5933, 5470, 649);
  const res = M.solve(ctx, odds, { samples: 100 });
  assert.ok(res.ok);
  const p = res.plans[0];
  assert.ok(p.path.every((k) => Adv.ACTIONS[k].rate === undefined)); // 확률 스킬 없음
  // 상태 보통으로 그대로 재생하면 목표 달성
  let s = Adv.newState({ cp: ctx.maxCP, dur: ctx.maxDur, steps: 0 });
  for (const k of p.path) { assert.ok(Adv.canUse(k, s, ctx, 'normal')); s = Adv.apply(s, k, ctx, 'normal'); }
  assert.ok(s.done && s.quality >= ctx.targetQuality);
});
test('매크로: 스펙이 모자라면 ok=false', () => {
  const r = rec.find((x) => x.rlvl === 724 && x.job === 'CRP');
  assert.equal(M.solve(ctxOf(r, 5933, 5470, 649), odds, { samples: 50 }).ok, false);
});
test('매크로 텍스트: 15줄 이내로 나눈다', () => {
  const path = Array(30).fill('basicS');
  const t = M.toText(path);
  assert.equal(t.length, 3);
  t.forEach((x) => assert.ok(x.split('\n').length <= 15));
  assert.ok(t[0].includes('/ac "작업" <wait.3>'));
});
