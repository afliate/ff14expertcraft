// qualcalc.js 의 계산 함수가 게임 실측값과 맞는지 검사한다.
// 실측: 대장장이, "EX: 우주 라이너 부재 제작 지원"(탐색 거점용 정밀 렌즈, rlvl 724, 목표 작업 9700/품질 11600/내구 55)
//       작업 숙련도 5933, 가공 숙련도 5470 → 제작창 "예상 효율"
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'qualcalc.js'), 'utf8');
const from = src.indexOf('function getRlvlParams');
const to = src.indexOf('// ── 확신 오프너 조합 데이터');
const ctx = { FFEngine: require('../engine.js') };
vm.createContext(ctx);
vm.runInContext('let RLVL_TABLE = ' + fs.readFileSync(path.join(root, 'recipe-level-table.json'), 'utf8') + ';\n' +
  src.slice(from, to) + '\nthis.calcS0 = calcS0; this.calcWork = calcWork; this.calcC0 = calcC0; this.calcQuality = calcQuality;', ctx);

test('작업량: 게임 "예상 효율"과 일치 (rlvl 724, 작업 숙련도 5933)', () => {
  const s0 = ctx.calcS0(5933, 724);
  const g = (eff) => ctx.calcWork(s0, eff, 1);
  assert.strictEqual(g(120), 378);
  assert.strictEqual(g(300), 945);
  assert.strictEqual(g(180), 567);
  assert.strictEqual(g(360), 1134);
  assert.strictEqual(g(500), 1575);
  assert.strictEqual(g(150), 472);
});

test('품질: 가공(100%) = 299 (가공 숙련도 5470, rlvl 724)', () => {
  assert.strictEqual(ctx.calcQuality(5470, 724, 0, 100, 0), 299);
});
