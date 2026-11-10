#!/usr/bin/env python3
"""영상 → 제작 기록 추출: FFXIV 제작 창을 읽어 공정(턴)마다 '상태'와 수치를 CSV 로 만든다.

  python extract.py 영상.mp4 --out 기록.csv            # 공정번호 + 상태 (빠름)
  python extract.py 영상.mp4 --out 기록.csv --numbers  # + 작업량/품질/내구도 (느림, Tesseract 필요)

필요: pip install opencv-python numpy pytesseract   (--numbers 일 때만 Tesseract OCR 프로그램, 영어 팩이면 충분)
가정: 제작 창이 화면 왼쪽 위(1280x620 영상 기준 x150,y10)에 있다. 다르면 --roi x,y,w,h 로 창 전체를 지정.
상태는 아이콘 모양/색을 templates 와 비교해서 읽는다. 처음 보는 아이콘(길조 등)은 '?' 로 나오고
--dump-unknown 폴더에 그림이 저장되니, 이름을 붙여 cond_templates 에 추가하면 된다(README 참고)."""
import argparse, collections, csv, os, re
import cv2, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BASE_W = 316.0                      # 기준 창 폭(1280x620 영상)
DEFAULT_WIN = (150, 10, 316, 260)
FIELDS = {                          # 창 기준 상대 좌표 (x, y, w, h)
    'step': (272, 46, 34, 20), 'dur': (22, 82, 66, 16), 'prog': (254, 74, 62, 17), 'qual': (254, 100, 64, 17),
    'icon': (18, 128, 20, 18),      # 상태 아이콘
}
KO = {'normal': '보통', 'good': '고품질', 'excellent': '최고품질', 'poor': '최악', 'centered': '안정', 'sturdy': '견고',
      'pliant': '고효율', 'malleable': '빠른 진행', 'primed': '장기 지속', 'goodOmen': '길조', 'robust': '완강'}

def load_templates():
    z = np.load(os.path.join(HERE, 'cond_templates.npz'))
    return z['T'].astype(np.float32), [str(n) for n in z['N']]

def crop(frame, win, f):
    s = win[2] / BASE_W
    x, y, w, h = FIELDS[f]
    return frame[int(win[1] + y * s):int(win[1] + (y + h) * s), int(win[0] + x * s):int(win[0] + (x + w) * s)]

def prep(img, scale=4):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    g = cv2.GaussianBlur(cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC), (3, 3), 0)
    _, b = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if b.mean() < 127: b = 255 - b
    return cv2.copyMakeBorder(b, 8, 8, 8, 8, cv2.BORDER_CONSTANT, value=255)

def ocr(img, wl='0123456789/'):
    import pytesseract
    return pytesseract.image_to_string(prep(img), config=f'--psm 7 -c tessedit_char_whitelist={wl}').strip()

def classify(icon, T, N, thr):
    v = cv2.resize(icon, (20, 18)).astype(np.float32).ravel()
    d = np.sqrt(((T - v) ** 2).mean(1)); i = int(d.argmin())
    return (N[i] if d[i] <= thr else '?'), float(d[i])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('--out', default='craftlog.csv')
    ap.add_argument('--fps', type=float, default=2.0, help='초당 읽을 프레임 수 (기본 2)')
    ap.add_argument('--roi'); ap.add_argument('--numbers', action='store_true')
    ap.add_argument('--start', type=float, default=0); ap.add_argument('--end', type=float, default=0)
    ap.add_argument('--thr', type=float, default=38.0, help='상태 아이콘 판정 거리 한계')
    ap.add_argument('--unk-max', type=float, default=70.0, help='이 거리보다 멀면 제작 창이 아닌 화면으로 보고 버림')
    ap.add_argument('--dump-unknown', help='모르는 아이콘 그림을 저장할 폴더')
    a = ap.parse_args()
    win = tuple(int(v) for v in a.roi.split(',')) if a.roi else DEFAULT_WIN
    T, N = load_templates()
    if a.dump_unknown: os.makedirs(a.dump_unknown, exist_ok=True)
    cap = cv2.VideoCapture(a.video); vfps = cap.get(cv2.CAP_PROP_FPS) or 30
    every = max(1, int(round(vfps / a.fps)))
    if a.start: cap.set(cv2.CAP_PROP_POS_MSEC, a.start * 1000)
    obs = []; i = 0; unk = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        if a.end and t > a.end: break
        i += 1
        if i % every: continue
        import pytesseract  # noqa  (step 번호도 OCR)
        st = ocr(crop(fr, win, 'step'), '0123456789')
        if not (st.isdigit() and 1 <= int(st) <= 99): continue            # 제작 창이 없는 프레임
        cond, d = classify(crop(fr, win, 'icon'), T, N, a.thr)
        if cond == '?' and d > a.unk_max: continue                          # 제작 창이 아닌 화면
        if cond == '?' and a.dump_unknown:
            cv2.imwrite(os.path.join(a.dump_unknown, f'{t:08.1f}_{int(d)}.png'), cv2.resize(fr[int(win[1]+120):int(win[1]+150), int(win[0]+10):int(win[0]+110)], None, fx=4, fy=4)); unk += 1
        r = dict(t=round(t, 1), step=int(st), cond=cond)
        if a.numbers:
            for k in ('dur', 'prog', 'qual'):
                m = re.fullmatch(r'(\d+)/(\d+)', ocr(crop(fr, win, k)))
                r[k] = (int(m.group(1)), int(m.group(2))) if m else None
        obs.append(r)
    # 공정번호 오독(튀는 값)을 중앙값 필터로 걸러낸 뒤, 번호가 크게 되돌아가면 새 제작으로 본다
    st = [r['step'] for r in obs]
    for k in range(len(obs)):
        w = sorted(st[max(0, k - 2):k + 3]); obs[k]['step'] = w[len(w) // 2]
    runs = []; cur = []
    for r in obs:
        if cur and (r['step'] <= cur[-1]['step'] - 5 or r['t'] - cur[-1]['t'] > 20):
            runs.append(cur); cur = []
        cur.append(r)
    if cur: runs.append(cur)
    runs = [x for x in runs if len(x) >= 6]          # 너무 짧은 조각은 버림
    with open(a.out, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f); w.writerow(['제작', '공정', '상태', '상태(영문)', '표본수', '시작(초)', '내구도', '작업량', '품질'])
        for ci, run in enumerate(runs, 1):
            by = collections.defaultdict(list)
            for r in run: by[r['step']].append(r)
            for s in sorted(by):
                rs = by[s]; cnt = collections.Counter(r['cond'] for r in rs); c = cnt.most_common(1)[0][0]
                def mode(k):
                    v = [r[k] for r in rs if r.get(k)] if a.numbers else []
                    return '/'.join(map(str, collections.Counter(v).most_common(1)[0][0])) if v else ''
                w.writerow([ci, s, KO.get(c, '?'), c, len(rs), rs[0]['t'], mode('dur'), mode('prog'), mode('qual')])
    print(f'프레임 {len(obs)} / 제작 {len(runs)}회 / 모르는 아이콘 {unk} → {a.out}')

if __name__ == '__main__':
    main()
