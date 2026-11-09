// Teamcraft 시뮬레이터(MIT)를 기준값으로 삼아 tests/golden.json 을 생성한다.
// 사용: TEAMCRAFT_SRC=/path/to/teamcraft-simulator node tools/gen-golden.cjs
// 준비: git clone https://github.com/ffxiv-teamcraft/simulator  && npm i --no-save esbuild
const fs = require('fs'), path = require('path');
const SRC = path.resolve(process.env.TEAMCRAFT_SRC || '../teamcraft-simulator') + '/src';
const OUT = path.join(__dirname, '..', 'tests', 'golden.json');
const table = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'recipe-level-table.json'), 'utf8'));

const entry = `
import { Simulation } from '${SRC}/simulation/simulation';
import { CrafterStats } from '${SRC}/model/crafter-stats';
import { StepState } from '${SRC}/model/step-state';
import { BasicSynthesis } from '${SRC}/model/actions/progression/basic-synthesis';
import { CarefulSynthesis } from '${SRC}/model/actions/progression/careful-synthesis';
import { Groundwork } from '${SRC}/model/actions/progression/groundwork';
import { IntensiveSynthesis } from '${SRC}/model/actions/progression/intensive-synthesis';
import { RapidSynthesis } from '${SRC}/model/actions/progression/rapid-synthesis';
import { MuscleMemory } from '${SRC}/model/actions/progression/muscle-memory';
import { BasicTouch } from '${SRC}/model/actions/quality/basic-touch';
import { StandardTouch } from '${SRC}/model/actions/quality/standard-touch';
import { AdvancedTouch } from '${SRC}/model/actions/quality/advanced-touch';
import { HastyTouch } from '${SRC}/model/actions/quality/hasty-touch';
import { PreparatoryTouch } from '${SRC}/model/actions/quality/preparatory-touch';
import { PreciseTouch } from '${SRC}/model/actions/quality/precise-touch';
import { Reflect as ReflectA } from '${SRC}/model/actions/quality/reflect';
import { RefinedTouch } from '${SRC}/model/actions/quality/refined-touch';
import { ByregotsBlessing } from '${SRC}/model/actions/quality/byregots-blessing';
import { Veneration } from '${SRC}/model/actions/buff/veneration';
import { Innovation } from '${SRC}/model/actions/buff/innovation';
import { GreatStrides } from '${SRC}/model/actions/buff/great-strides';
const CLS: any = { basicS: BasicSynthesis, careful: CarefulSynthesis, groundwork: Groundwork, intensive: IntensiveSynthesis,
  rapid: RapidSynthesis, mm: MuscleMemory, basicT: BasicTouch, standard: StandardTouch, advanced: AdvancedTouch, hasty: HastyTouch,
  prep: PreparatoryTouch, precise: PreciseTouch, reflect: ReflectA, refined: RefinedTouch, byregot: ByregotsBlessing,
  ven: Veneration, inno: Innovation, gs: GreatStrides };
const ST: any = { normal: StepState.NORMAL, good: StepState.GOOD, excellent: StepState.EXCELLENT, poor: StepState.POOR, malleable: StepState.MALLEABLE, primed: StepState.PRIMED, centered: StepState.CENTERED };
export function runCase(c: any) {
  const stats = new CrafterStats(14, c.craftsmanship, c.control, 99999, true, c.relic, 100, [100,100,100,100,100,100,100,100] as any);
  const rec: any = { id: 'x', job: 14, rlvl: c.rp.rlvl, durability: 99999, quality: 999999, progress: 999999, lvl: 100, hq: 1, quickSynth: 0,
    ingredients: [], expert: true, conditionsFlag: 1523, progressDivider: c.rp.pd, qualityDivider: c.rp.qd, progressModifier: c.rp.pm, qualityModifier: c.rp.qm };
  const actions = c.seq.map((s: any) => new CLS[s.t]());
  const states: any = {}; c.seq.forEach((s: any, i: number) => { states[i] = ST[s.cond]; });
  const sim = new Simulation(rec, actions, stats, [], states);
  const res = sim.run(true);
  return res.steps.map((s: any) => [s.addedProgression, s.addedQuality]);
}`;
fs.writeFileSync(path.join(__dirname, '.entry.ts'), entry);
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '.entry.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(__dirname, '.entry.cjs'), logLevel: 'error' });
const { runCase } = require('./.entry.cjs');

// 재현 가능한 난수
let seed = 20261109; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const rlvls = Object.keys(table).map(Number).filter(r => r >= 500 && r <= 800);
const CONDS = [['normal', 60], ['good', 10], ['malleable', 8], ['primed', 8], ['poor', 4], ['excellent', 4], ['centered', 6]];
const weighted = () => { let r = rnd() * 100; for (const [c, w] of CONDS) { if ((r -= w) <= 0) return c; } return 'normal'; };
// 키는 engine.js 의 스킬 키와 동일 (basicS=작업, basicT=가공)
const PROG = ['basicS', 'careful', 'groundwork', 'rapid', 'ven'];
const QUAL = ['basicT', 'standard', 'advanced', 'hasty', 'prep', 'refined', 'inno', 'gs'];

const cases = [];
for (let n = 0; n < 400; n++) {
  const rlvl = pick(rlvls), e = table[rlvl];
  const rp = { rlvl, pd: e.progressDivider, pm: e.progressModifier, qd: e.qualityDivider, qm: e.qualityModifier };
  const len = 3 + Math.floor(rnd() * 12);
  const seq = []; let iq = 0, lastQ = null;
  for (let i = 0; i < len; i++) {
    const cond = weighted();
    let t;
    if (i === 0 && rnd() < 0.5) t = pick(['mm', 'reflect']);
    else {
      const pool = [...PROG, ...QUAL];
      if (iq > 0) pool.push('byregot', 'byregot');
      if (cond === 'good') pool.push('intensive', 'precise');
      t = pick(pool);
    }
    seq.push({ t, cond });
    // IQ 추적(엔진 규칙과 같은 가정, 생성 제약용일 뿐 기준값에는 영향 없음)
    const gain = { basicT: 1, standard: 1, advanced: 1, hasty: 1, prep: 2, precise: 2, reflect: 2, refined: 1 }[t];
    if (t === 'byregot') iq = 0; else if (gain) iq = Math.min(10, iq + gain);
  }
  cases.push({ rp, craftsmanship: 3000 + Math.floor(rnd() * 4500), control: 3000 + Math.floor(rnd() * 4500), relic: rnd() < 0.5, seq });
}
for (const c of cases) c.expect = runCase(c);
fs.writeFileSync(OUT, JSON.stringify({ source: 'ffxiv-teamcraft/simulator (MIT)', generated: new Date().toISOString().slice(0, 10), cases }));
fs.unlinkSync(path.join(__dirname, '.entry.ts')); fs.unlinkSync(path.join(__dirname, '.entry.cjs'));
console.log('golden cases:', cases.length, '->', OUT);
