/* video-log.js · 영상에서 제작 창을 읽어 공정별 상태를 뽑는다 (브라우저 안에서만 동작)
 * 기준 좌표는 1280x620 영상 기준 (tools/craftlog/extract.py 와 같은 값). 영상 크기에 비례해 자동 계산. */
(function () {
  'use strict';
  const D = window.VL_DATA;
  const $ = (id) => document.getElementById(id);
  const WIN = { x: 150, y: 10, w: 316 };               // 1280 기준 제작 창
  const STEP = [272, 46, 34, 20], ICON = [18, 128, 20, 18];   // 창 기준 (x,y,w,h)
  const KO = { normal: '보통', good: '고품질', excellent: '최고품질', poor: '최악', centered: '안정', sturdy: '견고', pliant: '고효율', malleable: '빠른 진행', primed: '장기 지속', goodOmen: '길조', robust: '완강' };
  const TPL = D.cond.map((c) => ({ n: c.n, t: Float32Array.from(c.t) }));
  const LS = 'vl_learned_v1';
  function loadLearned() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } }
  function applyLearned() {
    for (let i = TPL.length - 1; i >= 0; i--) if (TPL[i].learned) TPL.splice(i, 1);
    const L = loadLearned(); L.forEach((c) => TPL.push({ n: c.n, t: Float32Array.from(c.t), learned: true }));
    const el = document.getElementById('learnN'); if (el) el.textContent = L.length ? `기억한 아이콘 ${L.length}개` : '';
  }
  applyLearned();
  const DIG = Object.keys(D.digits).map((k) => ({ k, v: Float32Array.from(D.digits[k]) }));
  const TW = 10, TH = 14, P = 11, CX = 16.5;

  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  const pv = $('pv'), pctx = pv.getContext('2d');
  const cStep = document.createElement('canvas'); cStep.width = STEP[2]; cStep.height = STEP[3];
  const cIcon = document.createElement('canvas'); cIcon.width = ICON[2]; cIcon.height = ICON[3];
  const sx = cStep.getContext('2d', { willReadFrequently: true }), ix = cIcon.getContext('2d', { willReadFrequently: true });
  sx.imageSmoothingQuality = ix.imageSmoothingQuality = 'high';

  let fileName = '', duration = 0, running = false, obs = [], lastResult = null;

  /* ── 창 위치: 영상 크기 비례 + 사용자가 조정한 값 ── */
  function geom() {
    const W = video.videoWidth, k = W / 1280;
    const s = $('os').value / 100;
    const w = WIN.w * k * s;
    return { x: WIN.x * k + +$('ox').value * k, y: WIN.y * k + +$('oy').value * k, sc: w / 316 };
  }
  function rect(g, r) { return [g.x + r[0] * g.sc, g.y + r[1] * g.sc, r[2] * g.sc, r[3] * g.sc]; }

  /* ── 인식 ── */
  function resizeArea(src, sw, sh, dw, dh) {
    const out = new Float32Array(dw * dh);
    for (let y = 0; y < dh; y++) {
      const y0 = y * sh / dh, y1 = (y + 1) * sh / dh;
      for (let x = 0; x < dw; x++) {
        const x0 = x * sw / dw, x1 = (x + 1) * sw / dw; let s = 0, wsum = 0;
        for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const w = (Math.min(yy + 1, y1) - Math.max(yy, y0)) * (Math.min(xx + 1, x1) - Math.max(xx, x0));
          if (w > 0) { s += src[yy * sw + xx] * w; wsum += w; }
        }
        out[y * dw + x] = wsum ? s / wsum : 0;
      }
    }
    return out;
  }
  function stepMask() {
    const d = sx.getImageData(0, 0, STEP[2], STEP[3]).data, n = STEP[2] * STEP[3], g = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const s = Array.from(g).sort((a, b) => a - b), med = (s[n / 2 - 1] + s[n / 2]) / 2;
    const m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = Math.min(1, Math.max(0, (med - g[i]) / 40));
    return m;
  }
  function cell(m, cx) {
    const x0 = Math.max(0, Math.round(cx - P / 2)), x1 = Math.min(STEP[2], Math.round(cx + P / 2)), y0 = 3, y1 = 18;
    const w = x1 - x0, h = y1 - y0, sub = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sub[y * w + x] = m[(y0 + y) * STEP[2] + x0 + x];
    return resizeArea(sub, w, h, TW, TH);
  }
  const dist2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return s; };
  function readStep() {
    const m = stepMask(); let best = null;
    for (const n of [1, 2]) {
      let d = 0, str = '';
      for (let i = 0; i < n; i++) {
        const v = cell(m, CX + (i - (n - 1) / 2) * P); let bk = null, bd = 1e18;
        for (const t of DIG) { const e = dist2(t.v, v); if (e < bd) { bd = e; bk = t.k; } }
        d += bd; str += bk;
      }
      if (!best || d < best.d) best = { d, str };
    }
    readStep.lastD = best.d;
    const v = parseInt(best.str, 10);
    // 제작 창이 없는 화면은 번호 모양과 너무 다르다 → 버림
    if (!(v >= 1 && v <= 99) || best.d > 14) return null;
    return v;
  }
  function iconVec() {
    const d = ix.getImageData(0, 0, ICON[2], ICON[3]).data, n = ICON[2] * ICON[3], v = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v[i * 3] = d[i * 4]; v[i * 3 + 1] = d[i * 4 + 1]; v[i * 3 + 2] = d[i * 4 + 2]; }
    return v;
  }
  function readCond() {
    const v = iconVec();
    let bn = '?', bd = 1e18;
    for (const t of TPL) { const e = Math.sqrt(dist2(t.t, v) / v.length); if (e < bd) { bd = e; bn = t.n; } }
    return { cond: bd <= 38 ? bn : '?', d: bd };
  }
  function sample(t) {
    const g = geom(), a = rect(g, STEP), b = rect(g, ICON);
    sx.drawImage(video, a[0], a[1], a[2], a[3], 0, 0, STEP[2], STEP[3]);
    ix.drawImage(video, b[0], b[1], b[2], b[3], 0, 0, ICON[2], ICON[3]);
    const step = readStep(); if (step == null) return null;
    const c = readCond(); if (c.cond === '?' && c.d > 70) return null;
    return { t, step, cond: c.cond };
  }

  /* ── 미리보기 ── */
  function drawPreview() {
    if (!video.videoWidth) return;
    pv.width = video.videoWidth; pv.height = video.videoHeight;
    pctx.drawImage(video, 0, 0);
    const g = geom(); pctx.lineWidth = Math.max(2, video.videoWidth / 640);
    pctx.strokeStyle = '#3ecfaa'; for (const r of [STEP, ICON]) { const q = rect(g, r); pctx.strokeRect(q[0], q[1], q[2], q[3]); }
    pctx.strokeStyle = 'rgba(62,207,170,.4)'; const w = rect(g, [0, 0, 316, 260]); pctx.strokeRect(w[0], w[1], w[2], w[3]);
    const s = sample(video.currentTime);
    $('pvRead').innerHTML = s ? `지금 장면에서 읽은 값: <b>${s.step}공정</b>, 상태 <b>${KO[s.cond] || '모르는 아이콘'}</b>` : '이 장면에서는 제작 창을 못 찾았어요 (제작 중인 장면으로 옮기거나 상자 위치를 맞춰 주세요).';
  }
  function seekTo(t) { return new Promise((res) => { const f = () => { video.removeEventListener('seeked', f); res(); }; video.addEventListener('seeked', f); video.currentTime = Math.max(0, Math.min(duration - 0.1, t)); }); }
  const fmt = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + '시간 ' : '') + m + '분 ' + (s % 60) + '초'; };

  /* ── 파일 선택 ── */
  function load(f) {
    if (!f) return;
    fileName = f.name; video.src = URL.createObjectURL(f);
    video.onloadedmetadata = () => {
      duration = video.duration;
      $('info').textContent = `${f.name} · ${video.videoWidth}x${video.videoHeight} · 길이 ${fmt(duration)}`;
      $('pvCard').hidden = $('runCard').hidden = false; $('t1').value = 0;
      seekTo(Math.min(60, duration / 2)).then(drawPreview);
      $('seek').value = Math.round(Math.min(60, duration / 2) / duration * 1000);
    };
    video.onerror = () => { $('info').textContent = '이 영상은 브라우저에서 열 수 없어요. (mp4/H.264 가 가장 잘 열려요)'; };
  }
  $('drop').onclick = () => $('file').click();
  $('file').onchange = (e) => load(e.target.files[0]);
  ['dragover', 'dragenter'].forEach((ev) => $('drop').addEventListener(ev, (e) => { e.preventDefault(); $('drop').classList.add('on'); }));
  ['dragleave', 'drop'].forEach((ev) => $('drop').addEventListener(ev, (e) => { e.preventDefault(); $('drop').classList.remove('on'); }));
  $('drop').addEventListener('drop', (e) => load(e.dataTransfer.files[0]));
  $('seek').oninput = () => { if (running) return; const t = $('seek').value / 1000 * duration; $('seekT').textContent = fmt(t); seekTo(t).then(drawPreview); };
  ['ox', 'oy', 'os'].forEach((id) => { $(id).oninput = () => { if (!running) drawPreview(); }; });
  $('learn').onclick = () => {
    if (!video.videoWidth) return;
    const g = geom(), b = rect(g, ICON); ix.drawImage(video, b[0], b[1], b[2], b[3], 0, 0, ICON[2], ICON[3]);
    const L = loadLearned(); L.push({ n: $('learnSel').value, t: Array.from(iconVec()).map(Math.round) });
    try { localStorage.setItem(LS, JSON.stringify(L.slice(-60))); } catch (e) { alert('이 브라우저에서는 저장할 수 없어요.'); }
    applyLearned(); drawPreview();
  };
  $('unlearn').onclick = () => { try { localStorage.removeItem(LS); } catch (e) {} applyLearned(); drawPreview(); };
  $('reset').onclick = () => { $('ox').value = 0; $('oy').value = 0; $('os').value = 100; drawPreview(); };

  /* ── 분석 ── */
  async function run() {
    if (running) return; running = true; obs = [];
    $('go').disabled = true; $('stop').disabled = false;
    const t0 = +$('t0').value || 0, t1 = +$('t1').value || duration, iv = +$('iv').value || 1;
    video.playbackRate = Math.max(1, Math.min(16, +$('rate').value || 8));
    await seekTo(t0);
    let next = t0, started = performance.now(), done = false;
    const finish = () => { if (done) return; done = true; running = false; video.pause(); $('go').disabled = false; $('stop').disabled = true; $('pbar').style.width = '100%'; show(); };
    $('stop').onclick = finish;
    video.onended = finish;
    const tick = (now, meta) => {
      if (done) return;
      const t = meta ? meta.mediaTime : video.currentTime;
      if (t >= t1) return finish();
      if (t >= next) { const s = sample(t); if (s) obs.push(s); next = t + iv; }
      const p = (t - t0) / (t1 - t0), el = (performance.now() - started) / 1000;
      $('pbar').style.width = (p * 100).toFixed(1) + '%';
      $('prog').textContent = `${(p * 100).toFixed(0)}% · 읽은 장면 ${obs.length}개 · 남은 시간 약 ${p > 0.01 ? fmt(el / p * (1 - p)) : '계산 중'}`;
      video.requestVideoFrameCallback(tick);
    };
    video.requestVideoFrameCallback(tick);
    try { await video.play(); } catch (e) { $('prog').textContent = '재생을 시작하지 못했어요. 영상을 다시 골라 주세요.'; finish(); }
  }
  $('go').onclick = run;

  /* ── 정리: 공정 번호 튀는 값 제거 → 제작 단위로 묶기 → 공정별 다수결 ── */
  function summarize(list) {
    const o = list.map((x) => Object.assign({}, x)), st = o.map((x) => x.step);
    for (let k = 0; k < o.length; k++) { const w = st.slice(Math.max(0, k - 2), k + 3).sort((a, b) => a - b); o[k].step = w[Math.floor(w.length / 2)]; }
    const runs = []; let cur = [];
    for (const r of o) {
      if (cur.length && (r.step <= cur[cur.length - 1].step - 5 || r.t - cur[cur.length - 1].t > 20)) { runs.push(cur); cur = []; }
      cur.push(r);
    }
    if (cur.length) runs.push(cur);
    return runs.filter((r) => r.length >= 6).map((run) => {
      const by = new Map();
      for (const r of run) { if (!by.has(r.step)) by.set(r.step, []); by.get(r.step).push(r); }
      return [...by.keys()].sort((a, b) => a - b).map((s) => {
        const rs = by.get(s), cnt = {}; rs.forEach((r) => { cnt[r.cond] = (cnt[r.cond] || 0) + 1; });
        const c = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
        return { step: s, cond: c, n: rs.length, t: rs[0].t };
      });
    });
  }
  const FORCED = { goodOmen: 'good', excellent: 'poor' };      // 직전 상태가 이거면 다음 상태가 정해져 있어 확률 표본에서 뺀다
  function show() {
    const crafts = summarize(obs); lastResult = crafts;
    $('outCard').hidden = false;
    const all = crafts.flat(), cnt = {}; let free = 0; const fc = {};
    crafts.forEach((c) => c.forEach((r, i) => {
      cnt[r.cond] = (cnt[r.cond] || 0) + 1;
      const prev = c[i - 1], forced = prev && FORCED[prev.cond] && prev.step === r.step - 1;
      if (!forced && i > 0) { free++; fc[r.cond] = (fc[r.cond] || 0) + 1; }
    }));
    $('sum').textContent = `제작 ${crafts.length}회 · 읽은 공정 ${all.length}개`;
    const keys = Object.keys(KO).filter((k) => cnt[k]).concat(cnt['?'] ? ['?'] : []);
    $('stats').innerHTML = all.length ? `<table><tr><th>상태</th><th>횟수</th><th>비율</th><th>확률 표본(첫 공정·정해진 상태 제외)</th><th>비율</th></tr>${
      keys.map((k) => `<tr><td class="c-${k === '?' ? 'unk' : k}">${KO[k] || '모르는 아이콘'}</td><td>${cnt[k]}</td><td>${(cnt[k] / all.length * 100).toFixed(1)}%</td><td>${fc[k] || 0}</td><td>${free ? ((fc[k] || 0) / free * 100).toFixed(1) : '-'}%</td></tr>`).join('')
    }</table><div class="note" style="margin-top:6px">상태 확률은 <b>레시피마다 다르니</b> 같은 레시피끼리 모아서 봐야 해요. 아래 표에서 제작마다 레시피 이름을 적어 두면 CSV에 같이 들어가요.</div>` : '<div class="note">읽힌 제작이 없어요. 2단계에서 상자 위치를 다시 맞춰 보세요.</div>';
    $('crafts').innerHTML = crafts.map((c, i) => `<details${i < 3 ? ' open' : ''}><summary>제작 ${i + 1} · ${c.length}공정 · ${fmt(c[0].t)} 부근 <input type="text" class="rn" data-i="${i}" placeholder="레시피 이름(메모)" onclick="event.stopPropagation()"></summary>
      <div class="chips">${c.map((r) => `<span class="chip c-${r.cond === '?' ? 'unk' : r.cond}">${r.step} ${KO[r.cond] || '?'}</span>`).join('')}</div></details>`).join('');
  }
  function rows() {
    const names = [...document.querySelectorAll('.rn')].map((e) => e.value.trim());
    const out = [['파일', '제작', '레시피(메모)', '공정', '상태', '상태(영문)', '표본수', '시작(초)']];
    (lastResult || []).forEach((c, i) => c.forEach((r) => out.push([fileName, i + 1, names[i] || '', r.step, KO[r.cond] || '?', r.cond, r.n, r.t.toFixed(1)])));
    return out;
  }
  $('csv').onclick = () => {
    const txt = rows().map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv' }));
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'craftlog') + '_기록.csv'; a.click();
  };
  $('copy').onclick = () => { navigator.clipboard.writeText(rows().map((r) => r.join('\t')).join('\n')).then(() => { $('copy').textContent = '복사됨'; setTimeout(() => { $('copy').textContent = '표 복사'; }, 1200); }); };
  window.__vl = { sample, summarize, readStep, obsRef: () => obs };   // 테스트용
})();
