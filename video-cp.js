/* video-cp.js · 화면 아래 HP/CP 칸의 'CP' 숫자를 읽는다.
 *  이 칸은 화면에 고정돼 있어 영상 크기에 대한 비율로 위치를 잡고, 숫자는 오른쪽 끝을 기준으로 일정한 간격으로 한 칸씩 자른다.
 *  (숫자끼리 붙어 보여 틈으로는 못 자른다) 칸마다 8×12로 줄여 이름 붙인 숫자 모양과 견준다. */
(function (root) {
  'use strict';
  const E = 0.5422, PITCH = 0.00720, Y0 = 0.690, Y1 = 0.718, MAXD = 3, GW = 8, GH = 12, TH = 140;
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  // i 번째 칸(오른쪽부터 0) 을 GW×GH 로 줄인 모양과 켜진 비율. sx = 가로 어긋남 보정(영상 가로 폭 비율)
  function cell(src, vw, vh, i, sx, sy) {
    const x1 = (E - i * PITCH + (sx || 0)) * vw, x0 = x1 - PITCH * vw, y0 = (Y0 + (sy || 0)) * vh, h = (Y1 - Y0) * vh, w = PITCH * vw;
    const Z = 4; cv.width = Math.round(w * Z); cv.height = Math.round(h * Z);
    cx.drawImage(src, x0, y0, w, h, 0, 0, cv.width, cv.height);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height, v = new Float32Array(GW * GH);
    let on = 0;
    for (let j = 0; j < GH; j++) for (let k = 0; k < GW; k++) {
      let s = 0, n = 0;
      for (let y = Math.floor(j * H / GH); y < Math.floor((j + 1) * H / GH); y++) for (let x = Math.floor(k * W / GW); x < Math.floor((k + 1) * W / GW); x++) { const o = (y * W + x) * 4; s += Math.min(d[o], d[o + 1], d[o + 2]) > TH ? 1 : 0; n++; }
      v[j * GW + k] = n ? s / n : 0; on += v[j * GW + k];
    }
    return { v, on: on / (GW * GH) };
  }
  function cells(src, vw, vh, sx, sy) { const o = []; for (let i = 0; i < MAXD; i++) o.push(cell(src, vw, vh, i, sx, sy)); return o; }
  function read(src, vw, vh) {
    const D = root.VLCP_DATA; if (!D) return null;
    vw = vw || src.videoWidth; vh = vh || src.videoHeight;
    let best = null;
    for (const sy of [-0.004, 0, 0.004]) for (const sx of [-0.0015, 0, 0.0015]) {
      const cs = cells(src, vw, vh, sx, sy); let n = 0;
      while (n < MAXD && cs[n].on > 0.04) n++;
      if (n < 2) continue;
      let txt = '', tot = 0;
      for (let i = n - 1; i >= 0; i--) {
        let bd = 1e9, bn = '?';
        for (const t of D.T) { let d = 0; for (let k = 0; k < GW * GH; k++) d += Math.abs(cs[i].v[k] - t.v[k]); d /= GW * GH; if (d < bd) { bd = d; bn = t.n; } }
        txt += bn; tot += bd;
      }
      const sc = tot / n;
      if (!best || sc < best.d) best = { v: +txt, d: sc, s: txt };
    }
    return best && best.d < 0.06 && !/\?/.test(best.s) ? best : null;
  }
  root.VLCP = { read, cells, GW, GH };
})(typeof self !== 'undefined' ? self : this);
