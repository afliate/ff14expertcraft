/* video-nums.js · 제작 창의 '작업량 현재/최대', '품질 현재/최대' 숫자를 읽는다 (브라우저 안에서만 동작)
 * 숫자는 오른쪽 정렬·고정 폭 글꼴이라, 오른쪽 끝에서부터 칸(cell)을 나눠 글자 모양 기준과 비교한다.
 * 기준 글자(window.VL_NUMS)는 tools/craftlog/calib-nums.js 로 만든다. */
(function () {
  'use strict';
  const CAP = 7, Z = 4, TW = 6, TH = 14, Y0 = 2, Y1 = 16, NC = 11;           // 확대 배수, 글자 칸 크기, 쓰는 세로 범위, 최대 글자 수
  const FIELDS = { prog: { r: [248, 74, 70, 17] }, qual: { r: [248, 100, 70, 17] } };   // 창 기준 (x,y,w,h)
  const cv = document.createElement('canvas'); cv.width = 70 * Z; cv.height = 17 * Z;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingQuality = 'high';
  const W = cv.width, H = cv.height;
  let TPL = null, CFG = null;                                       // {글자: Float32Array}, {P, R:{prog,qual}}

  function setTemplates(t, cfg) { TPL = {}; for (const k in t) TPL[k] = Float32Array.from(t[k]); CFG = cfg; }
  function mask(src, x, y, k, f) {
    const r = FIELDS[f].r;
    if (x + r[0] * k < 0 || y + r[1] * k < 0) return null;
    cx.drawImage(src, x + r[0] * k, y + r[1] * k, r[2] * k, r[3] * k, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data, n = W * H, g = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const s = Array.from(g).sort((a, b) => a - b), med = (s[n >> 1] + s[(n >> 1) - 1]) / 2, m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = Math.min(1, Math.max(0, (med - g[i]) / 40));
    return m;
  }
  function resizeArea(src, sw, sh, dw, dh) {
    const out = new Float32Array(dw * dh);
    for (let y = 0; y < dh; y++) {
      const y0 = y * sh / dh, y1 = (y + 1) * sh / dh;
      for (let x = 0; x < dw; x++) {
        const x0 = x * sw / dw, x1 = (x + 1) * sw / dw; let s = 0, ws = 0;
        for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const w = (Math.min(yy + 1, y1) - Math.max(yy, y0)) * (Math.min(xx + 1, x1) - Math.max(xx, x0));
          if (w > 0) { s += src[yy * sw + xx] * w; ws += w; }
        }
        out[y * dw + x] = ws ? s / ws : 0;
      }
    }
    return out;
  }
  // 오른쪽 끝 R(필드 픽셀)에서 k번째 칸 (k=0 이 맨 오른쪽 글자)
  function cell(m, R, P, k, sh) {
    sh = sh || 0;
    const xa = Math.round((R - (k + 1) * P + sh) * Z), xb = Math.round((R - k * P + sh) * Z), ya = Y0 * Z, yb = Y1 * Z;
    if (xa < 0) return null;
    const w = xb - xa, h = yb - ya, sub = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sub[y * w + x] = m[(ya + y) * W + xa + x];
    const o = resizeArea(sub, w, h, TW, TH);
    // 막대 끝 모양이 닿는 왼쪽 칸은 비교에서 뺀다 (필드 x < CAP 인 열)
    o.wt = []; for (let c = 0; c < TW; c++) o.wt.push((xa / Z + (c + 0.5) * (w / Z / TW)) < CAP ? 0 : 1);
    return o;
  }
  const SHIFTS = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75];
  function cells(m, R, P) { const c = []; for (let k = 0; k < NC; k++) c.push(cell(m, R, P, k)); return c; }
  // 칸마다 가로 위치를 조금씩 움직여 가장 잘 맞는 글자를 고른다
  function bestShift(m, R, P, k, keys) {
    let b = null;
    for (const sh of SHIFTS) {
      const v = cell(m, R, P, k, sh); if (!v) continue;
      for (const c of keys) { const e = dist2(TPL[c], v); if (!b || e < b.e) b = { e, ch: c, sh, v }; }
    }
    return b;
  }
  const dist2 = (a, b) => { let s = 0; const wt = b.wt || a.wt; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += (wt ? wt[i % TW] : 1) * d * d; } return s; };
  const DIGS = '0123456789';
  function best(v, keys) { let bk = null, bd = 1e18; for (const k of keys) { const e = dist2(TPL[k], v); if (e < bd) { bd = e; bk = k; } } return [bk, bd]; }

  // 칸 목록 → 'cur/max' 글자열. 현재값 1~5자리, 최대값 4~5자리를 모두 시도해서 가장 맞는 것을 고른다.
  function parse(cl, m, R, P) {
    let bestR = null; const memo = {};
    const at = (k, slash) => { const key = k + (slash ? 's' : 'd'); return memo[key] || (memo[key] = bestShift(m, R, P, k, slash ? '/' : DIGS)); };
    for (let lm = 4; lm <= 5; lm++) for (let lc = 1; lc <= 5; lc++) {
      const n = lc + 1 + lm; let d = 0, str = '', ok = true;
      for (let k = 0; k < n; k++) {
        const b = at(k, k === lm); if (!b) { ok = false; break; }
        d += b.e; str = b.ch + str;
      }
      if (!ok) continue;
      // 글자 칸 왼쪽에 먹이 남으면(글자 수를 적게 본 경우) 벌점
      const left = Math.round((R - n * P) * Z); let out = 0;
      for (let y = Y0 * Z; y < Y1 * Z; y++) for (let x = CAP * Z; x < left; x++) out += m[y * W + x];
      d += 0.5 * out / Z / Z;
      d /= n;
      if (!bestR || d < bestR.d) bestR = { d, str, n };
    }
    return bestR;
  }
  // src 의 (x,y,k) 위치에 제작 창이 있다고 보고 field('prog'|'qual')를 읽는다 → {cur, max, d} | null
  function read(src, x, y, k, f, opt) {
    if (!TPL) return null;
    const m = mask(src, x, y, k, f); if (!m) return null;
    const P = CFG.P; let bR = null;
    for (const sh of (opt && opt.shifts) || [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]) {
      const R = CFG.R[f] + sh, r = parse(cells(m, R, P), m, R, P);
      if (r && (!bR || r.d < bR.d)) bR = r;
    }
    if (!bR) return null;
    const [a, b] = bR.str.split('/'), cur = parseInt(a, 10), max = parseInt(b, 10);
    return { cur, max, d: bR.d, str: bR.str };
  }
  window.VLNUM = { CAP, FIELDS, Z, TW, TH, NC, SHIFTS, mask, cells, cell, setTemplates, read, parse, resizeArea, bestShift };
  if (window.VL_NUMS) setTemplates(window.VL_NUMS.t, window.VL_NUMS.cfg);
})();
