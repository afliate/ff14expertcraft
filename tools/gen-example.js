/* 매크로 해법으로 '단계별 해설 예시' HTML 을 만들어 index.html 의 마커 사이에 끼워 넣는다.
 *  node tools/gen-example.js           → index.html 갱신
 * 상태는 전부 '보통' (매크로 = 확정 성공 스킬만 사용) */
const fs = require('fs');
const E = require('../engine.js'), M = require('../macro.js'), Adv = require('../advisor.js');
const rt = require('../recipe-level-table.json'), odds = require('../data/condition-odds.json');
const rec = require('../data/expert-recipes.json').recipes;

const CASES = [
  { rlvl: 481, job: 'CRP', craft: 5933, ctrl: 5470, cp: 649, tag: '쉬움', note: '스펙이 충분한 과거 레시피 — 그냥 매크로 한 번이면 끝' },
  { rlvl: 513, job: 'CRP', craft: 5933, ctrl: 5470, cp: 649, tag: '보통', note: '빠른 진행(작업량 대박)이 떠도 안 끝나게 진가로 품질부터' },
  { rlvl: 516, job: 'CRP', craft: 5933, ctrl: 5585, cp: 776, tag: '어려움', note: '15공정 원버튼 — 품질 먼저, 작업량은 마지막' },
];
const N = (x) => Math.round(x).toLocaleString('en-US');

// 스킬별 이유 (버프·스택·직전 스킬에 따라 달라지는 건 함수)
function why(k, ctx, s0, s1, i, path) {
  const prev = path[i - 1];
  const iq = Math.floor(s0.iq || 0);
  const R = {
    reflect: '오프너. 첫 턴 한정 품질 +, 쌓이는 정신집중 2스택부터 시작',
    mm: '오프너. 이어지는 작업 스킬의 효율을 크게 올려줌',
    ven: '공경 — 작업량 +50%, 일찍 켤수록 많은 작업 스킬에 적용',
    wn: '근검절약 — 이후 내구 소모 절반, 내구 걱정 없이 품질 가공',
    wn2: '장기 절약 — 내구 소모 절반이 오래 감 (CP 98)',
    manip: '교묘한 손놀림 — 매 턴 내구 +5',
    inno: '혁신 — 품질 증가 +50% (4턴), 이 사이에 가공을 몰아 넣기',
    gs: '장족의 발전 — 다음 품질 스킬 효율 2배, 비레고 직전에 사용',
    byregot: `비레고의 축복 — 정신집중 ${iq}스택이라 효율 +${iq * 20}%, 품질 마무리`,
    prep: '밑가공 — 효율 200% + 정신집중 2스택 (내구 20 소모 주의)',
    precise: '집중 가공 — 정신집중 스택 쌓기',
    delicate: '정밀 작업 — 작업량과 품질을 동시에 올림',
    finesse: '장인의 황금손 — 내구 소모 없이 품질 + 정신집중 소모',
    tp: '초절 기술 — 다음 스킬 내구 소모 0',
    mend: '능숙한 땜질 — 내구 대량 회복',
    immac: '완벽한 땜질 — 내구 회복',
    observe: '경과 관찰 — 다음 상급 가공을 싸게 쓰기 위한 준비',
    fa: '최종 확인 — 작업량이 가득 차기 전에 멈추게 보호',
    basicS: '작업 — 작업량 기본', careful: '모범 작업 — 작업량 (CP 7)', prudentS: '절약 작업 — 내구 5만 소모하는 작업량',
    groundwork: '밑작업 — 작업량 360%, 내구 20 소모', intensive: '집중 작업 — 작업량 400%',
    rapid: '강행 작업 — 작업량 500%', basicT: '가공 — 품질 기본',
    refined: '세련 가공 — 정신집중 +1', prudentT: '절약 가공 — 내구 5만 소모하는 품질',
  };
  if (k === 'standard') return prev === 'basicT' ? '중급 가공 — 가공 직후라 CP 18 (연계)' : '중급 가공 — 품질 125%';
  if (k === 'advanced') return (prev === 'standard' || prev === 'observe') ? '상급 가공 — 연계로 CP 절약' : '상급 가공 — 품질 150%';
  if (k === 'precise') return s0.iq >= 10 ? '집중 가공 — 이미 10스택이라 효율만' : R.precise;
  return R[k] || '';
}
function row(k, ctx, s0, s1, i, path) {
  const a = Adv.ACTIONS[k];
  const t = why(k, ctx, s0, s1, i, path);
  return `<tr><td class="st-normal">보통</td><td class="sk-used"><span class="mx-ico" data-sk="${k}"></span>${a.ko}</td><td></td><td class="cmt">${t}</td></tr>`;
}
function build(c) {
  const r = rec.find((x) => x.rlvl === c.rlvl && x.job === c.job);
  const ctx = { craftsmanship: c.craft, control: c.ctrl, rp: E.paramsFromTable(r.rlvl, rt[String(r.rlvl)]), relic: false, cosmic: false, specialist: false,
    target: r.work, targetQuality: r.quality, maxDur: r.durability, maxCP: c.cp };
  const res = M.solve(ctx, odds, { samples: 300 });
  if (!res.ok) throw new Error('해법 없음 ' + c.rlvl);
  const p = res.plans[0];
  let s = Adv.newState({ cp: ctx.maxCP, dur: ctx.maxDur, steps: 0 });
  const rows = [];
  p.path.forEach((k, i) => {
    const s0 = s; s = Adv.apply(s, k, ctx, 'normal');
    rows.push(row(k, ctx, s0, s, i, p.path));
    // 5공정마다 중간 기록
    if ((i + 1) % 5 === 0 && i + 1 < p.path.length)
      rows.push(`<tr><td colspan="4" class="stat-line">📊 작업량 ${N(Math.min(s.progress, ctx.target))} / ${N(ctx.target)} · 품질 ${N(s.quality)} / ${N(ctx.targetQuality)} · 내구 ${Math.max(0, s.dur)}/${ctx.maxDur} · 남은 CP ${s.cp}</td></tr>`);
  });
  const last = p.path.length - 1;
  rows.push(`<tr><td colspan="4" class="stat-line">📊 작업량 ${N(Math.min(s.progress, ctx.target))} / ${N(ctx.target)} · 품질 ${N(s.quality)} / ${N(ctx.targetQuality)} · 남은 CP ${s.cp}</td></tr>`);
  return { r, ctx, p, rows, pq: res.plans[0].risk && res.plans[0].risk.pQuality };
}
const OPENER = {
  reflect: '오프너는 <b>진가</b>. 첫 턴에만 쓸 수 있고, 품질을 크게 올리면서 정신집중 2스택을 깔아줘요. 작업량은 뒤로 미뤄요 — 중간에 빠른 진행 같은 게 떠도 작업량이 먼저 차서 끝나버리는 사고를 막아요.',
  mm: '오프너는 <b>확신</b>. 첫 턴에만 쓸 수 있고, 바로 다음 작업 스킬의 효율을 크게 올려줘요.',
};
const NAME = (k) => Adv.ACTIONS[k].ko;
function accordion(c, i) {
  const b = build(c);
  const id = 'ac-macro-' + (i + 1);
  const path = b.p.path;
  const macros = M.toText(path);
  const end = M.trace(path, b.ctx).pop();
  const buffs = [...new Set(path.filter((k) => Adv.ACTIONS[k].kind === 'buff'))].map(NAME).join(', ');
  const img = fs.existsSync(require('path').join(__dirname, `../img/examples/${c.rlvl}.png`))
    ? `<img class="mx-shot" src="img/examples/${c.rlvl}.png" alt="${b.r.name} 제작 화면" loading="lazy">` : '';
  const rot = path.map((k, j) => `<span class="mx-step" title="${NAME(k)}"><span class="mx-ico" data-sk="${k}"></span><i>${j + 1}</i></span>`).join('<span class="mx-arr">›</span>');
  const total = `총 <b>${b.p.steps}공정</b>, 완성 후 CP <b>${end.cp}</b> 남음. 품질은 목표 ${N(b.r.quality)}에 ${N(end.quality)}까지 올라가요. 쓴 버프: ${buffs || '없음'}. 상태(보통/고품질 등)에 따라 바뀌는 스킬은 쓰지 않아서 <b>매크로 그대로 눌러도 같은 결과</b>가 나와요.`;
  const mtext = macros.map((x, j) => `<div class="mx-mac"><div class="mx-mac-h">매크로 ${macros.length > 1 ? j + 1 : ''}<button type="button" class="mx-copy">복사</button></div><pre>${x.replace(/</g, '&lt;')}</pre></div>`).join('');
  return `
      <div class="accordion" id="${id}">
        <button class="accordion-btn" onclick="toggleAc('${id}')">
          <div class="ac-left">
            <div class="ac-label">매크로 예시 · ${c.tag}</div>
            <div class="ac-title">${b.r.name}</div>
            <div class="ac-meta">
              <span class="ac-pill">작업량 ${N(b.r.work)}</span>
              <span class="ac-pill">품질 ${N(b.r.quality)}</span>
              <span class="ac-pill">내구 ${b.r.durability}</span>
              <span class="ac-pill">${b.p.steps}공정</span>
              <span class="ac-pill">제작 ${c.craft} / 가공 ${c.ctrl} / CP ${c.cp}</span>
            </div>
          </div>
          <svg class="ac-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="accordion-body">
          <div class="accordion-desc">${c.note}.</div>
          <div class="mx-grid">
            <div class="mx-side">
              ${img}
              <div class="mx-h">로테이션</div>
              <div class="mx-rot">${rot}</div>
              <div class="mx-h">오프너</div>
              <div class="mx-box">${OPENER[path[0]] || ''}</div>
              <div class="mx-h">총평</div>
              <div class="mx-box">${total}</div>
              <details class="mx-det"><summary>매크로 텍스트 (복사해서 쓰기)</summary>${mtext}</details>
            </div>
            <div class="mx-main">
              <div style="overflow-x:auto"><table class="tbl">
<tr><th>상태</th><th>시전 스킬</th><th>결과</th><th>코멘트</th></tr>
${b.rows.join('\n')}
</table></div>
            </div>
          </div>
        </div>
      </div>`;
}
const html = '<!--MACRO-EX-START-->\n' + CASES.map(accordion).join('\n') + '\n      <!--MACRO-EX-END-->';
if (process.argv[2] === '--print') { console.log(html); process.exit(0); }
const f = require('path').join(__dirname, '../index.html');
let t = fs.readFileSync(f, 'utf8');
if (!t.includes('<!--MACRO-EX-START-->')) throw new Error('마커 없음');
t = t.replace(/<!--MACRO-EX-START-->[\s\S]*<!--MACRO-EX-END-->/, () => html);
fs.writeFileSync(f, t);
console.log('ok');
