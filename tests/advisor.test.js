const test = require('node:test');
const assert = require('node:assert');
const E = require('../engine.js');
const Adv = require('../advisor.js');
const table = require('../recipe-level-table.json');

const rp = E.paramsFromTable(724, table['724']);
const ctx = { craftsmanship: 5933, control: 5470, rp, target: 9700, targetQuality: 11600, maxDur: 55, maxCP: 649, relic: true };

test('advisor.apply 가 engine.run 과 작업량/품질/IQ 가 일치 (비확률 스킬)', () => {
  const seq = ['mm', 'ven', 'careful', 'careful', 'inno', 'basicT', 'standard', 'advanced', 'gs', 'byregot'];
  const eng = E.run(seq.map((a) => ({ a })), ctx);
  let s = Adv.newState({ cp: 9999, dur: 9999 });
  const c2 = Object.assign({}, ctx, { target: 1e9, maxDur: 9999, maxCP: 9999 });
  for (const k of seq) s = Adv.apply(s, k, c2, 'normal');
  assert.strictEqual(s.progress, eng.progress);
  assert.strictEqual(s.quality, eng.quality);
  assert.strictEqual(s.iq, eng.iq);
});

test('CP/내구 비용과 콤보', () => {
  let s = Adv.newState({ cp: 649, dur: 55 });
  s = Adv.apply(s, 'basicT', ctx, 'normal');
  assert.strictEqual(s.cp, 649 - 18);
  assert.strictEqual(s.dur, 45);
  s = Adv.apply(s, 'standard', ctx, 'normal');
  assert.strictEqual(s.cp, 649 - 18 - 18); // 가공→중급 콤보
  s = Adv.apply(s, 'advanced', ctx, 'normal');
  assert.strictEqual(s.cp, 649 - 18 - 18 - 18); // 중급→상급 콤보
});

test('사용 조건: 집중 가공은 good 에서만, 확신은 첫 공정만, 비레고는 정신집중 필요', () => {
  const s0 = Adv.newState({ cp: 649, dur: 55 });
  assert.ok(!Adv.canUse('precise', s0, ctx, 'normal'));
  assert.ok(Adv.canUse('precise', s0, ctx, 'good'));
  assert.ok(Adv.canUse('mm', s0, ctx, 'normal'));
  assert.ok(!Adv.canUse('byregot', s0, ctx, 'normal'));
  const s1 = Adv.apply(s0, 'basicS', ctx, 'normal');
  assert.ok(!Adv.canUse('mm', s1, ctx, 'normal'));
});

test('상태 효과: pliant CP 절반, sturdy 내구 절반', () => {
  const s0 = Adv.newState({ cp: 649, dur: 55 });
  assert.strictEqual(Adv.apply(s0, 'basicT', ctx, 'pliant').cp, 649 - 9);
  assert.strictEqual(Adv.apply(s0, 'prep', ctx, 'sturdy').dur, 55 - 10);
});

test('최종 확인은 작업량을 target-1 로 막는다', () => {
  let s = Adv.newState({ cp: 649, dur: 55, progress: 9000 });
  s = Adv.apply(s, 'fa', ctx, 'normal');
  s = Adv.apply(s, 'mm', Object.assign({}, ctx), 'normal'); // 첫 공정 아님 → 직접 호출만 확인
  assert.ok(s.progress <= ctx.target - 1 || s.done === false);
});

test('recommend: 시작 상태에서 완료 가능한 계획을 찾는다', () => {
  const s0 = Adv.newState({ cp: 649, dur: 55 });
  const r = Adv.recommend(s0, ctx, 'normal', { width: 120, depth: 24 });
  assert.ok(r.length > 0);
  assert.ok(r[0].ok, '완료 가능한 계획이 있어야 함');
  assert.ok(r[0].quality > 0);
});

const odds = require('../data/condition-odds.json');
function lcg(seed) { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); }

test('조건 표: 724 는 보통/양호/호조의 징조만(플래그 515), 확률 합 1', () => {
  const t = Adv.conditionTable(odds, 724);
  assert.deepStrictEqual(t.rows.map((r) => r[0]).sort(), ['good', 'goodOmen']);
  const sum = t.rows.reduce((a, r) => a + r[1], 0) + t.normal;
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('조건 전이: 호조의 징조 → 양호, 강건 → 견고, 극상 → 불량', () => {
  const t = Adv.conditionTable(odds, 772);
  assert.strictEqual(Adv.drawCondition(t, 'goodOmen', () => 0.5), 'good');
  assert.strictEqual(Adv.drawCondition(t, 'robust', () => 0.5), 'sturdy');
  assert.strictEqual(Adv.drawCondition(t, 'excellent', () => 0.5), 'poor');
});

test('overrides 가 있으면 기본 확률 대신 쓴다', () => {
  const o = JSON.parse(JSON.stringify(odds));
  o.overrides['515'] = { goodOmen: 0.3 };
  const pick = (t) => t.rows.find((r) => r[0] === 'goodOmen')[1];
  assert.strictEqual(pick(Adv.conditionTable(o, 724)), 0.3);
  assert.strictEqual(pick(Adv.conditionTable(odds, 724)), 0.12);
  const good = (t) => t.rows.find((r) => r[0] === 'good')[1];
  assert.strictEqual(good(Adv.conditionTable(odds, 724)), 0.05); // 호조의 징조 플래그가 있으면 양호 낮춤
});

test('simulate: 시드 고정 시 재현되고 확률이 0~1', () => {
  const s0 = Adv.newState({ cp: 649, dur: 55 });
  const r = Adv.recommend(s0, ctx, 'normal', { width: 60, depth: 24, odds, samples: 200, rnd: lcg(7) });
  assert.ok(r[0].risk);
  assert.ok(r[0].risk.pDone >= 0 && r[0].risk.pDone <= 1);
  const st = Adv.apply(s0, r[0].plan[0], ctx, 'normal');
  const a = Adv.simulate(r[0].plan, st, ctx, odds, 200, lcg(11));
  const b = Adv.simulate(r[0].plan, st, ctx, odds, 200, lcg(11));
  assert.deepStrictEqual(a, b);
});
