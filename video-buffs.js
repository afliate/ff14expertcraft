/* video-buffs.js · 제작 창 가운데 '버프 줄'(3칸×2줄)의 아이콘을 읽는다.
 * 칸 위치는 제작 창 기준 좌표(기준 단위)이고, 영상마다 1~3 단위 어긋날 수 있어 칸마다 위치를 보정해 가장 닮은 아이콘을 고른다.
 * 정신 집중 스택 숫자가 아이콘 오른쪽 위를 가려서 그 부분은 비교에서 뺀다. */
(function (root) {
  'use strict';
  const D = root.VLBUFF_DATA; if (!D) return;
  const GW = D.GW, GH = D.GH, Z = 4;
  const cv = document.createElement('canvas'); cv.width = GW * Z; cv.height = GH * Z;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const MASK = []; for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) MASK.push(!(j < GH * 0.5 && i >= GW * 0.45));
  const T = D.T;
  function vec(src, x0, y0, w, h) {          // 영상 한 부분을 GW×GH 칸으로 평균내어 [r,g,b…]
    cx.drawImage(src, x0, y0, w, h, 0, 0, GW * Z, GH * Z);
    const d = cx.getImageData(0, 0, GW * Z, GH * Z).data, v = new Float32Array(GW * GH * 3);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      let r = 0, g = 0, b = 0;
      for (let y = 0; y < Z; y++) for (let x = 0; x < Z; x++) { const o = ((j * Z + y) * GW * Z + i * Z + x) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; }
      const o2 = (j * GW + i) * 3; v[o2] = r / (Z * Z); v[o2 + 1] = g / (Z * Z); v[o2 + 2] = b / (Z * Z);
    }
    return v;
  }
  function bgDiff(v) {                                        // 칸 안 밝기 흩어짐(빈 칸은 회색 한 가지라 거의 0)
    let m = 0, n = GW * GH; const L = new Float32Array(n);
    for (let p = 0; p < n; p++) { L[p] = (v[p * 3] + v[p * 3 + 1] + v[p * 3 + 2]) / 3; m += L[p]; } m /= n;
    let s = 0; for (let p = 0; p < n; p++) s += (L[p] - m) * (L[p] - m); return Math.sqrt(s / n);
  }
  function dist(a, t) { let s = 0, n = 0; for (let p = 0; p < MASK.length; p++) if (MASK[p]) { for (let c = 0; c < 3; c++) s += Math.abs(a[p * 3 + c] - t[p * 3 + c]); n += 3; } return s / n; }
  // g = {x,y,sc} · 반환: [{c, r, name, d}]  (빈 칸은 안 담고, name 이 '?' 이면 처음 보는 아이콘)
  function read(src, g, opt) {
    const lim = (opt && opt.lim) || 24, out = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const v0 = vec(src, g.x + D.COLX[c] * g.sc, g.y + D.ROWY[r] * g.sc, D.W * g.sc, D.H * g.sc);
      if (bgDiff(v0) < 14) continue;                         // 빈 칸 (배경 회색)
      let bestD = 1e9, bestN = null;
      for (let dx = -3; dx <= 3; dx += 1) for (let dy = -1.5; dy <= 1.5; dy += 0.75) {
        const v = vec(src, g.x + (D.COLX[c] + dx) * g.sc, g.y + (D.ROWY[r] + dy) * g.sc, D.W * g.sc, D.H * g.sc);
        for (const t of T) { const d = dist(v, t.v); if (d < bestD) { bestD = d; bestN = t.n; } }
      }
      out.push({ c, r, name: bestD <= lim ? bestN : '?', d: +bestD.toFixed(1) });
    }
    return out;
  }
  root.VLBUFF = { read };
})(typeof self !== 'undefined' ? self : this);
