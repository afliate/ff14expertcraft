// 실행: node --test tests/
// tests/golden.json 은 Teamcraft 시뮬레이터(MIT) 출력이다. 엔진이 같은 숫자를 내는지 검사한다.
const test = require('node:test');
const assert = require('node:assert');
const E = require('../engine.js');
const G = require('./golden.json');

test('engine matches Teamcraft golden cases step by step', () => {
  let bad = 0; const msgs = [];
  for (const [ci, c] of G.cases.entries()) {
    let s = E.newState();
    const ctx = { craftsmanship: c.craftsmanship, control: c.control, rp: c.rp, relic: c.relic };
    for (let i = 0; i < c.seq.length; i++) {
      const p0 = s.progress, q0 = s.quality;
      s = E.step(s, c.seq[i].t, ctx, c.seq[i].cond);
      const got = [s.progress - p0, s.quality - q0];
      const exp = c.expect[i];
      if (got[0] !== exp[0] || got[1] !== exp[1]) {
        bad++; if (msgs.length < 5) msgs.push(`case ${ci} step ${i} ${c.seq[i].t}/${c.seq[i].cond} got ${got} exp ${exp} (rlvl ${c.rp.rlvl})`);
        break;
      }
    }
  }
  assert.strictEqual(bad, 0, `${bad}/${G.cases.length} cases differ\n` + msgs.join('\n'));
});

test('pm=90 recipe: base progress follows Teamcraft (modifier applied)', () => {
  const rp = { rlvl: 701, pd: 170, pm: 90, qd: 150, qm: 75 };
  assert.strictEqual(E.progressGain(E.baseProgress(5800, rp), 120), 369);
});
