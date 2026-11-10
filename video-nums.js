/* video-nums.js · 제작 창의 '작업량 현재/최대', '품질 현재/최대' 숫자를 읽는다 (브라우저 안에서만 동작)
 * 숫자는 오른쪽 정렬·고정 폭 글꼴이라, 오른쪽 끝에서부터 칸(cell)을 나눠 글자 모양 기준과 비교한다.
 * 기준 글자(window.VL_NUMS)는 tools/craftlog/calib-nums.js 로 만든다. */
(function () {
  'use strict';
  const CAP = 7, Z = 4, TW = 6, TH = 14, Y0 = 2, Y1 = 16;           // 확대 배수, 글자 칸 크기, 쓰는 세로 범위, 최대 글자 수
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
  // 글자 한 칸: 왼쪽 끝 x0(필드 픽셀, 기본 폭 70), 칸 폭 P. sh 는 가로로 조금 움직여 보는 값
  function cell(m, x0, P, sh) {
    sh = sh || 0;
    const xa = Math.round((x0 + sh) * Z), xb = Math.round((x0 + P + sh) * Z), ya = Y0 * Z, yb = Y1 * Z;
    if (xa < 0 || xb > W) return null;
    const w = xb - xa, h = yb - ya, sub = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sub[y * w + x] = m[(ya + y) * W + xa + x];
    const o = resizeArea(sub, w, h, TW, TH);
    // 막대 끝 모양이 닿는 왼쪽 칸은 비교에서 뺀다 (필드 x < CAP 인 열)
    o.wt = []; for (let c = 0; c < TW; c++) o.wt.push((xa / Z + (c + 0.5) * (w / Z / TW)) < CAP ? 0 : 1);
    return o;
  }
  // '현재/최대' 글자열의 각 글자 위치. 슬래시는 늘 같은 자리(S0)에 있고, 현재값은 그 왼쪽, 최대값은 오른쪽으로 붙는다.
  function layout(str, S0, P) {
    const [a, b] = str.split('/'), out = [];
    for (let j = 0; j < a.length; j++) out.push({ ch: a[a.length - 1 - j], x0: S0 - (j + 1) * P });
    out.push({ ch: '/', x0: S0 });
    for (let i = 0; i < b.length; i++) out.push({ ch: b[i], x0: S0 + (i + 1) * P });
    return out;
  }
  const SHIFTS = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75];
  function bestShift(m, x0, P, keys) {
    let b = null;
    for (const sh of SHIFTS) {
      const v = cell(m, x0, P, sh); if (!v) continue;
      for (const c of keys) { const e = dist2(TPL[c], v); if (!b || e < b.e) b = { e, ch: c, sh, v }; }
    }
    return b;
  }
  const dist2 = (a, b) => { let s = 0; const wt = b.wt || a.wt; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += (wt ? wt[i % TW] : 1) * d * d; } return s; };
  const DIGS = '0123456789';

  // 슬래시 자리 S0 기준으로, 현재값 1~5자리·최대값 4~5자리를 모두 시도해 가장 맞는 글자열을 고른다.
  function parse(m, S0, P) {
    let bestR = null; const memo = {};
    const at = (key, x0, keys) => memo[key] || (memo[key] = bestShift(m, x0, P, keys));
    for (let lm = 4; lm <= 5; lm++) for (let lc = 1; lc <= 5; lc++) {
      let d = 0, str = '', ok = true;
      const sl = at('s', S0, '/'); if (!sl) continue; d += sl.e;
      let cur = '', max = '';
      for (let j = 0; j < lc && ok; j++) { const b = at('c' + j, S0 - (j + 1) * P, DIGS); if (!b) ok = false; else { d += b.e; cur = b.ch + cur; } }
      for (let i = 0; i < lm && ok; i++) { const b = at('m' + i, S0 + (i + 1) * P, DIGS); if (!b) ok = false; else { d += b.e; max += b.ch; } }
      if (!ok) continue;
      // 글자 칸 밖에 먹이 남으면(자릿수를 잘못 본 경우) 벌점
      const left = Math.round((S0 - lc * P) * Z), right = Math.round((S0 + (lm + 1) * P) * Z); let out = 0;
      for (let y = Y0 * Z; y < Y1 * Z; y++) { for (let x = CAP * Z; x < left; x++) out += m[y * W + x]; for (let x = right; x < Math.min(W, right + 3 * Z); x++) out += m[y * W + x]; }
      d += 0.5 * out / Z / Z;
      const n = lc + 1 + lm; d /= n;
      if (+max % 100) d += 0.6;                       // 최대값은 거의 항상 100의 배수 → 아니면 벌점(0↔8 혼동 보정)
      if (!bestR || d < bestR.d) bestR = { d, str: cur + '/' + max, n };
    }
    return bestR;
  }
  // src 의 (x,y,k) 위치에 제작 창이 있다고 보고 field('prog'|'qual')를 읽는다 → {cur, max, d, str} | null
  function read(src, x, y, k, f, opt) {
    if (!TPL) return null;
    const m = mask(src, x, y, k, f); if (!m) return null;
    let bR = null;
    for (const sh of (opt && opt.shifts) || [-2, -1, -0.5, 0, 0.5, 1, 2]) {
      const r = parse(m, CFG.S0[f] + sh, CFG.P);
      if (r && (!bR || r.d < bR.d)) bR = r;
    }
    if (!bR) return null;
    const [a, b] = bR.str.split('/'), cur = parseInt(a, 10), max = parseInt(b, 10);
    return { cur, max, d: bR.d, str: bR.str };
  }
  window.VLNUM = { CAP, FIELDS, Z, TW, TH, SHIFTS, mask, cell, layout, setTemplates, read, parse, resizeArea, bestShift };
  if (window.VL_NUMS) setTemplates(window.VL_NUMS.t, window.VL_NUMS.cfg);
})();
