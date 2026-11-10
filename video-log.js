/* video-log.js · 영상에서 제작 창을 읽어 공정별 상태를 뽑는다 (브라우저 안에서만 동작)
 * 기준 좌표는 1280x620 영상 기준 (tools/craftlog/extract.py 와 같은 값). 영상 크기에 비례해 자동 계산. */
(function () {
  'use strict';
  const D = window.VL_DATA;
  const $ = (id) => document.getElementById(id);
  const WIN = { x: 150, y: 10, w: 316 };               // 1280 기준 제작 창
  const STEP = [272, 46, 34, 20], ICON = [18, 128, 20, 18];   // 창 기준 (x,y,w,h)
  const KO = { normal: '보통', good: '고품질', excellent: '최고품질', poor: '저품질', centered: '안정', sturdy: '견고', pliant: '고효율', malleable: '빠른 진행', primed: '장기 지속', goodOmen: '길조', robust: '완강' };
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
  let auto = null;                                   // 자동으로 찾은 창 위치 {x,y,sc} (영상 픽셀)
  function geom() {
    const k = video.videoWidth / 1280, s = $('os').value / 100;
    const b = auto || { x: WIN.x * k, y: WIN.y * k, sc: k };
    return { x: b.x + +$('ox').value * b.sc, y: b.y + +$('oy').value * b.sc, sc: b.sc * s };
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
  // src 의 (x,y,k) 위치에 제작 창이 있다고 보고 공정 번호를 읽는다. d 가 작을수록 확실.
  function stepAt(src, x, y, k) {
    const a = rect({ x, y, sc: k }, STEP);
    if (a[0] < 0 || a[1] < 0 || a[2] < 8) return null;
    sx.drawImage(src, a[0], a[1], a[2], a[3], 0, 0, STEP[2], STEP[3]);
    const m = stepMask(); let best = null;
    for (const n of [1, 2]) {
      let d = 0, str = '';
      for (let i = 0; i < n; i++) {
        const v = cell(m, CX + (i - (n - 1) / 2) * P); let bk = null, bd = 1e18;
        for (const t of DIG) { const e = dist2(t.v, v); if (e < bd) { bd = e; bk = t.k; } }
        d += bd; str += bk;
      }
      // 숫자 칸 바깥에 먹이 남아 있으면(한 글자만 읽은 경우 등) 벌점
      const lo = Math.round(CX - n * P / 2), hi = Math.round(CX + n * P / 2); let out = 0;
      for (let y = 3; y < 18; y++) for (let x = 0; x < STEP[2]; x++) if (x < lo || x >= hi) out += m[y * STEP[2] + x];
      d += 2 * out / 10;
      if (!best || d < best.d) best = { d, str };
    }
    const v = parseInt(best.str, 10);
    return (v >= 1 && v <= 99) ? { v, d: best.d } : null;
  }
  function readStep() {
    const g = geom(), r = stepAt(video, g.x, g.y, g.sc);
    if (!r || r.d > 18) return null;
    readStep.lastD = r.d; return r.v;
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
    return { t, step, cond: c.cond, p: readNum('prog'), q: readNum('qual') };
  }
  // 작업량/품질 숫자 (현재/최대). 못 읽거나 앞뒤가 안 맞으면 null
  function readNum(f) {
    if (!window.VLNUM) return null;
    const g = geom(), r = VLNUM.read(video, g.x, g.y, g.sc, f);
    return r && r.cur <= r.max && r.d < 6 ? { c: r.cur, m: r.max } : null;
  }


  /* ── 제작 창 자동 찾기 ──
   * 1) 작업량·품질 막대(어두운 테두리가 있는 긴 막대 두 줄)로 창 위치/크기 후보를 잡고
   * 2) 후보 주변을 조금씩 움직여 공정 번호가 가장 또렷하게 읽히는 자리를 고른다. */
  const fc = document.createElement('canvas'), fcx = fc.getContext('2d', { willReadFrequently: true });
  function candidates() {
    fc.width = video.videoWidth; fc.height = video.videoHeight; fcx.drawImage(video, 0, 0);
    const W = 1280, s = W / fc.width, H = Math.round(fc.height * s);
    const sm = document.createElement('canvas'); sm.width = W; sm.height = H;
    const smx = sm.getContext('2d', { willReadFrequently: true }); smx.imageSmoothingQuality = 'high'; smx.drawImage(fc, 0, 0, W, H);
    const px = smx.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    // 41x41 평균(적분영상)보다 35 이상 어두운 점 = 테두리 후보
    const iw = W + 1, I = new Float64Array(iw * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += g[y * W + x]; I[(y + 1) * iw + x + 1] = I[y * iw + x + 1] + row; } }
    const R = 20, runs = [];
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1); let x = 0;
      const dark = (xx) => { const x0 = Math.max(0, xx - R), x1 = Math.min(W, xx + R + 1); const a = (I[y1 * iw + x1] - I[y0 * iw + x1] - I[y1 * iw + x0] + I[y0 * iw + x0]) / ((x1 - x0) * (y1 - y0)); return g[y * W + xx] < a - 35; };
      while (x < W) {
        if (dark(x)) { let z = x; while (z < W && dark(z)) z++; if (z - x >= 70 && z - x <= 300) runs.push([y, x, z]); x = z; } else x++;
      }
    }
    const cl = [];
    for (const [y, x0, x1] of runs) {
      let c = cl.find((c) => Math.abs(c.x0 - x0) <= 4 && Math.abs(c.x1 - x1) <= 4 && y - c.y1 <= 1);
      if (c) c.y1 = y; else cl.push({ x0, x1, y0: y, y1: y });
    }
    const bars = cl.filter((c) => c.y1 - c.y0 <= 6), out = [];
    for (const a of bars) for (const b of bars) {
      const w = a.x1 - a.x0;
      if (b.y0 > a.y0 && Math.abs(a.x0 - b.x0) <= 4 && Math.abs(a.x1 - b.x1) <= 4) {
        const gap = (b.y0 - a.y0) / w;
        if (gap >= 0.14 && gap <= 0.22) { const k = w / s / 151; out.push({ e: Math.abs(gap - 0.179), x: a.x0 / s - 99 * k, y: a.y0 / s - 79 * k, k }); }
      }
    }
    out.sort((p, q) => p.e - q.e);
    return out.slice(0, 6);
  }
  function iconDistAt(src, x, y, k) {
    const b = rect({ x, y, sc: k }, ICON);
    if (b[0] < 0 || b[1] < 0) return 1e9;
    ix.drawImage(src, b[0], b[1], b[2], b[3], 0, 0, ICON[2], ICON[3]);
    const v = iconVec(); let bd = 1e18;
    for (const t of TPL) { const e = Math.sqrt(dist2(t.t, v) / v.length); if (e < bd) bd = e; }
    return bd;
  }
  function tuneCand(c) {
    let best = { d: 1e9 };
    const tryAt = (x, y, k) => { const r = stepAt(fc, x, y, k); if (r && r.d < best.d) best = { d: r.d, v: r.v, x, y, sc: k }; };
    for (let ks = 0.94; ks <= 1.061; ks += 0.02) { const k = c.k * ks;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) tryAt(c.x + dx * k, c.y + dy * k, k); }
    if (best.d > 1e8) return best;
    // 아이콘은 위치에 더 예민하다: 공정 번호가 충분히 잘 읽히는 자리 중 아이콘이 가장 잘 맞는 자리를 고른다
    const b0 = best; let b1 = { s: 1e9 };
    for (let ks = 0.97; ks <= 1.031; ks += 0.015) { const k = b0.sc * ks;
      for (let dy = -3; dy <= 3.01; dy += 0.5) for (let dx = -4; dx <= 4.01; dx += 0.5) {
        const x = b0.x + dx * k, y = b0.y + dy * k, r = stepAt(fc, x, y, k);
        if (!r || r.d > 18) continue;
        const s = iconDistAt(fc, x, y, k) + r.d; if (s < b1.s) b1 = { s, x, y, sc: k, d: r.d, v: r.v };
      } }
    return b1.s < 1e8 ? b1 : best;
  }
  function findWindow() {                      // 지금 화면에서 창 찾기 → {x,y,sc,d,v} 또는 null
    let best = null;
    for (const c of candidates()) { const r = tuneCand(c); if (r.d < 1e8 && (!best || r.d < best.d)) best = r; }
    // 상태 아이콘도 어느 정도 맞아야 진짜 제작 창으로 본다 (엉뚱한 곳에서 1공정처럼 읽히는 오탐 방지)
    return best && best.d < 18 && iconDistAt(fc, best.x, best.y, best.sc) <= 50 ? best : null;
  }
  async function autoFind(quiet) {
    if (!video.videoWidth || running) return false;
    $('findMsg').textContent = '제작 창을 찾는 중…';
    const spots = [video.currentTime]; for (let i = 1; i <= 20; i++) spots.push(duration * i / 21);
    for (const t of spots) {
      await seekTo(t); await new Promise((r) => setTimeout(r, 30));
      const r = findWindow();
      if (r) {
        auto = { x: r.x, y: r.y, sc: r.sc }; $('ox').value = $('oy').value = 0; $('os').value = 100;
        $('seek').value = Math.round(t / duration * 1000); $('seekT').textContent = fmt(t);
        $('findMsg').textContent = `제작 창을 찾았어요 (${fmt(t)} 장면, ${r.v}공정으로 확인). 상자가 맞는지 보고, 틀리면 슬라이더로 고쳐 주세요.`;
        drawPreview(); return true;
      }
    }
    if (!quiet) $('findMsg').textContent = '제작 창을 못 찾았어요. 제작 중인 장면으로 옮긴 뒤 다시 눌러 보거나, 슬라이더로 직접 맞춰 주세요.';
    else $('findMsg').textContent = '제작 창을 자동으로 못 찾았어요. 제작 중인 장면으로 옮긴 뒤 "창 자동 찾기"를 누르거나, 슬라이더로 직접 맞춰 주세요.';
    return false;
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
    const nm = (x) => (x ? `${x.c}/${x.m}` : '못 읽음');
    $('pvRead').innerHTML = s ? `지금 장면에서 읽은 값: <b>${s.step}공정</b>, 상태 <b>${KO[s.cond] || '모르는 아이콘'}</b>, 작업량 <b>${nm(s.p)}</b>, 품질 <b>${nm(s.q)}</b>` : '이 장면에서는 제작 창을 못 찾았어요 (제작 중인 장면으로 옮기거나 상자 위치를 맞춰 주세요).';
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
      auto = null; seekTo(Math.min(60, duration / 2)).then(() => { drawPreview(); autoFind(true); });
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
  $('reset').onclick = () => { auto = null; $('ox').value = 0; $('oy').value = 0; $('os').value = 100; drawPreview(); };
  $('find').onclick = () => { autoFind(false); };

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
    const mode = (arr) => { const c = new Map(); arr.forEach((v) => c.set(v, (c.get(v) || 0) + 1)); let b = null, bn = 0; for (const [v, n] of c) if (n > bn) { b = v; bn = n; } return b; };
    return runs.filter((r) => r.length >= 6).map((run) => {
      const by = new Map();
      for (const r of run) { if (!by.has(r.step)) by.set(r.step, []); by.get(r.step).push(r); }
      // 최대값은 제작 내내 같으니 제작 단위 다수결, 현재값은 그 최대값과 같게 읽힌 장면들 중 공정별 다수결
      const mx = { p: mode(run.filter((r) => r.p).map((r) => r.p.m)), q: mode(run.filter((r) => r.q).map((r) => r.q.m)) };
      const keys = [...by.keys()].sort((a, b) => a - b);
      // 공정별로 읽힌 값 후보(개수 포함) 중 '줄어들지 않는' 흐름에서 가장 많이 읽힌 조합을 고른다 (작업량·품질은 줄지 않는다)
      const chain = (f) => {
        const cand = keys.map((k) => { const m = new Map(); by.get(k).forEach((r) => { if (r[f] && r[f].m === mx[f]) m.set(r[f].c, (m.get(r[f].c) || 0) + 1); }); return [...m.entries()]; });
        // 앞 공정 어느 것에서든 이어질 수 있다(못 읽은 공정은 건너뜀). 값이 줄어드는 연결만 막는다.
        const nodes = [];
        cand.forEach((cs, i) => cs.forEach(([v, n]) => {
          let best = 0, from = null;
          for (const o of nodes) if (o.i < i && o.v <= v && o.sc > best) { best = o.sc; from = o; }
          nodes.push({ i, v, sc: n + best, from });
        }));
        const out = keys.map(() => null);
        let end = null; for (const o of nodes) if (!end || o.sc > end.sc) end = o;
        for (let o = end; o; o = o.from) out[o.i] = o.v;
        return out;
      };
      const P = chain('p'), Q = chain('q');
      const steps = keys.map((s, i) => {
        const rs = by.get(s), cnt = {}; rs.forEach((r) => { cnt[r.cond] = (cnt[r.cond] || 0) + 1; });
        const c = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
        return { step: s, cond: c, n: rs.length, t: rs[0].t, p: P[i], q: Q[i] };
      });
      steps.max = mx;
      return steps;
    });
  }
  // 한 제작의 스킬 추정 (작업량/품질 숫자가 충분히 읽혔을 때만)
  function skillsOf(c) {
    if (!window.VLSkills || c.filter((r) => r.p != null && r.q != null).length < Math.max(4, c.length * 0.6)) return null;
    try { return VLSkills.solve(c.map((r) => ({ step: r.step, cond: r.cond === '?' ? 'normal' : r.cond, p: r.step === 1 ? 0 : r.p, q: r.q }))); } catch (e) { return null; }   // 1공정의 작업량은 항상 0
  }
  function skName(a) { const n = (k) => VLSkills.ko(k); return a.alts.length > 1 ? `${n(a.key)} <span class="alt">(또는 ${a.alts.filter((k) => k !== a.key).map(n).join(', ')})</span>` : n(a.key); }
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
    crafts.forEach((c) => { c.sk = skillsOf(c); });
    $('crafts').innerHTML = crafts.map((c, i) => {
      const mx = c.max, sk = c.sk, act = (r) => (sk && sk.acts.find((a) => a.step === r.step)) || null;
      const info = mx && (mx.p || mx.q) ? ` · 작업량 최대 ${mx.p || '?'} · 품질 최대 ${mx.q || '?'}` : '';
      const tbl = sk ? `<table class="sk"><tr><th>공정</th><th>상태</th><th>작업량</th><th>품질</th><th>스킬(추정)</th></tr>${c.map((r) => { const a = act(r); return `<tr><td>${r.step}</td><td class="c-${r.cond === '?' ? 'unk' : r.cond}">${KO[r.cond] || '?'}</td><td>${r.p ?? '?'}</td><td>${r.q ?? '?'}</td><td>${a ? skName(a) : '<span class="alt">-</span>'}</td></tr>`; }).join('')}</table>
        <div class="note">기본 작업량 ${sk.bp} · 기본 품질 ${sk.bq} 로 맞춰 본 결과예요 (어긋난 정도 ${sk.cost.toFixed(1)}, 0에 가까울수록 확실). 같은 수치를 내는 스킬은 구분이 안 돼서 '또는'으로 같이 적어요.</div>`
        : `<div class="chips">${c.map((r) => `<span class="chip c-${r.cond === '?' ? 'unk' : r.cond}">${r.step} ${KO[r.cond] || '?'}</span>`).join('')}</div>`;
      return `<details${i < 3 ? ' open' : ''}><summary>제작 ${i + 1} · ${c.length}공정 · ${fmt(c[0].t)} 부근${info} <input type="text" class="rn" data-i="${i}" placeholder="레시피 이름(메모)" onclick="event.stopPropagation()"></summary>${tbl}</details>`;
    }).join('');
  }
  function rows() {
    const names = [...document.querySelectorAll('.rn')].map((e) => e.value.trim());
    const out = [['파일', '제작', '레시피(메모)', '공정', '상태', '상태(영문)', '표본수', '시작(초)', '작업량', '품질', '작업량 최대', '품질 최대', '스킬(추정)', '스킬 후보']];
    const nm = (k) => VLSkills.ko(k);
    (lastResult || []).forEach((c, i) => c.forEach((r) => {
      const a = c.sk && c.sk.acts.find((x) => x.step === r.step);
      out.push([fileName, i + 1, names[i] || '', r.step, KO[r.cond] || '?', r.cond, r.n, r.t.toFixed(1), r.p ?? '', r.q ?? '', c.max && c.max.p || '', c.max && c.max.q || '', a ? nm(a.key) : '', a ? a.alts.map(nm).join(' / ') : '']);
    }));
    return out;
  }
  $('csv').onclick = () => {
    const txt = rows().map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv' }));
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'craftlog') + '_기록.csv'; a.click();
  };
  $('copy').onclick = () => { navigator.clipboard.writeText(rows().map((r) => r.join('\t')).join('\n')).then(() => { $('copy').textContent = '복사됨'; setTimeout(() => { $('copy').textContent = '표 복사'; }, 1200); }); };
  window.__vl = { dbg: (x, y, k) => { fcx.drawImage(video,0,0); const b = rect({ x, y, sc: k }, ICON); ix.drawImage(fc, b[0], b[1], b[2], b[3], 0, 0, ICON[2], ICON[3]); const v = iconVec(); return TPL.map((t) => [t.n, +Math.sqrt(dist2(t.t, v) / v.length).toFixed(1)]).sort((a, b) => a[1] - b[1]).slice(0, 4); }, candidates, tuneCand, sample, summarize, readStep, findWindow, autoFind, obsRef: () => obs, getAuto: () => auto };   // 테스트용
})();
