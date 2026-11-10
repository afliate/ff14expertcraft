# 예시기록고(시트예시)의 아욱세시아 명인 2 기록 → 예시 탭 HTML. python3 tools/gen-auxesia.py
import re,html
CLS={'보통':'st-normal','고품질':'st-high','길조':'st-good','빠른 진행':'st-fast','고효율':'st-efficient','견고':'st-solid','안정':'st-stable','장기 지속':'st-long','완강':'st-low'}
P=[
('① 오프너 + 10스택','── 목표: 정신집중 10스택을 최대한 빨리',[
('보통','진가','','오프너.'),
('보통','교묘한 손놀림','','내구도 관리 위해 바로 사용.'),
('보통','절약 가공','',''),
('고품질','집중 가공','','정신집중 +2'),
('길조','근검절약','','CP 절약'),
('고품질','집중 가공','','스택 +2'),
('빠른 진행','강행 작업','✔','작업량 확보'),
('고효율','밑가공','','+2스택 위해 사용. 고효율이라 CP 20으로 무난'),
('빠른 진행','강행 작업','✔',''),
('길조','성급한 손길','✔','다음이 어차피 고품질이라, 실패하면 집중 가공 / 성공하면 CP 회복용으로 쓸 예정'),
('고품질','비결','','손길이 성공 — 10스택 달성'),
],'정신집중 10스택 · 내구 25/45 · 작업량 4,740 · 품질 5,156 · 남은 CP 212',
['① 10스택을 빨리 쌓는 게 목적이라 상태 상관없이 교묘한 손놀림을 우선. 내구 45라서 근검절약은 취향 차이 — 작성자는 성급한 손길까지 써서 올릴 생각으로 근검을 썼어요.',
 '② 10스택을 절대 우선순위로 두고, 근검절약 1스택이 남은 상태에서 고효율이 떠서 CP -20으로 +2스택을 챙겼어요.']),
('② 품질 콤보','── 10스택 완료 후, 마무리 로테이션 전까지 (CP 소모 212)',[
('빠른 진행','교묘한 손놀림','','내구도 확보'),
('길조','장족의 발전','','품질 콤보 시작 — 다음이 고품질이라 [장족+고품질+밑가공]이 [장족+혁신+밑가공]보다 높아요'),
('고품질','밑가공','','품질 상승 + CP 절약'),
('견고','절약 가공','','CP 절약'),
('보통','장족의 발전','','콤보 연계'),
('고효율','혁신','','내구도 + 작업량 + 확신'),
('고효율','밑가공','','품질 상승'),
('견고','장족의 발전','','콤보 연계'),
('길조','경과 관찰','','초절기술로 상태를 띄우거나 부족한 내구도를 한 번 회복 (교묘가 켜진 상태에서만)'),
('고품질','밑가공','',''),
],'정신집중 10스택 · 내구 2/45 · 작업량 4,740 · 품질 18,456',
['TIP) 기본 품질 로테이션: 장족 → 혁신 → 밑가공 → 장족 → 경과 관찰 → 상급 가공. 상태를 안 보겠다면 장족 → 혁신 → 밑가공만 반복해도 돼요.',
 '상태를 띄워 보겠다면: 장족 + 혁신 + 밑가공 + 장족 + 초절기술 + 밑가공 / 장족 + 혁신 + 초절기술 + 밑가공 + 장족 + 밑가공',
 '① 길조 타이밍에 장족 시작 — [장족+고품질+밑가공]이 [장족+혁신+밑가공]보다 품질 수치가 높아요.',
 '② 내구도가 5/0으로 갈라지지 않아 절약 가공으로 끊었어요 — 가공 버프가 없는 상태이므로. (가공 버프가 없으니 내구도가 확보되면 절약 가공으로 자름)',
 '※ 다른 명인 레시피보다 품질 수치가 낮은 편이라 품질 콤보는 가장 높은 밑가공으로 빠르게 가요. 마무리 콤보(장족+혁신+비레고)가 약 4천 품질이라, 여기서 올려야 할 수치는 약 18,000이에요.']),
('③ 품질 마무리','── 기본 마무리 로테이션 (장족 + 혁신 + 비레고) / CP 소모 74',[
('견고','장인의 초절 기술','','내구도가 없어 초절 기술로 마무리 진입'),
('길조','장족의 발전','','길조라 장족 사용 — 장족+고품질+비레고가 기본 콤보보다 수치가 커서 혁신 생략'),
('고품질','비레고의 축복','','고품질 비레고는 최고의 선택 — 품질 극대화'),
],'내구 2/45 · 작업량 4,740 · 품질 22,100 · 남은 CP 0~20',
['① 내구도가 없어 초절 기술로 마무리 진입.','② 길조라 장족 사용. 고품질+비레고가 최고 선택이므로 혁신 생략.']),
('④ 작업량 마무리','── CP 100 이상 남겨 두기',[
('장기 지속','공경','','버프 +2 리필'),
('고효율','능숙한 땜질','','완땜(112) 대신 35만 채우는 능숙한 땜질 사용 (3번째라서)'),
('견고','우주 안정된 솜씨','','안정적인 작업량 확보'),
('보통','강행 작업','','잔량 마무리 — 작업량 2,370, 완성'),
],'내구 2→0 · 작업량 2,370 · 품질 유지 — 완성!',
['① 3번째 땜질이라 완땜(112) 대신 35만 채우는 능숙한 땜질을 썼어요.']),
]
def esc(s): return html.escape(s,quote=False)
def tabs():
    return '\n'.join(f'            <button class="ptab{" pon" if i==0 else ""}" onclick="switchPhase(\'ax1-p{i+1}\',this,\'ax1\')">{n}</button>' for i,(n,*_) in enumerate(P))
def panel(i,p):
    n,sub,rows,stat,notes=p
    out=[f'          <div id="ax1-p{i+1}" class="phase-panel{" pon" if i==0 else ""}"><div style="overflow-x:auto"><table class="tbl">','<tr><th>상태</th><th>시전 스킬</th><th>결과</th><th>코멘트</th></tr>',f'<tr class="phase-row"><td colspan="4">{esc(sub)}</td></tr>']
    for st,sk,res,cm in rows:
        r='<td class="ok">성공</td>' if res=='✔' else '<td class="fail">실패</td>' if res=='✘' else '<td></td>'
        out.append(f'<tr><td class="{CLS[st]}">{st}</td><td class="sk-used">{esc(sk)}</td>{r}<td class="cmt">{esc(cm)}</td></tr>')
    out.append(f'<tr><td colspan="4" class="stat-line">📊 {stat}</td></tr>')
    out.append('</table></div>')
    out.append('<div class="mx-box" style="margin-top:10px">'+'<br>'.join(esc(x) for x in notes)+'</div></div>')
    return '\n'.join(out)
H=f'''<!--AX-START-->
      <div class="accordion open" id="ac-auxesia-1">
        <button class="accordion-btn" onclick="toggleAc('ac-auxesia-1')">
          <div class="ac-left">
            <div class="ac-label">아욱세시아 · 명인 2</div>
            <div class="ac-title">MASTER: 특제 연금 구체 개발</div>
            <div class="ac-meta">
              <span class="ac-pill">작업량 6,900</span>
              <span class="ac-pill">품질 22,100</span>
              <span class="ac-pill">내구 45</span>
              <span class="ac-pill">작업 5933 / 가공 5585 / CP 764</span>
              <span class="ac-pill">엔드 + 우주 + 알이페브레 + 명인 + 전문</span>
              <span class="ac-pill">손제작 약 1분 10초~30초</span>
            </div>
          </div>
          <svg class="ac-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="accordion-body">
          <div class="accordion-desc">다른 두 명인 레시피보다 품질이 낮고, 상태에 <strong>길조</strong>가 나와 고품질이 잘 떠서 빠르게 제작하기 좋은 레시피예요. (매크로 가능)</div>
          <div class="phase-tabs">
{tabs()}
          </div>
{chr(10).join(panel(i,p) for i,p in enumerate(P))}
        </div>
      </div>
      <!--AX-END-->'''
f='index.html'; t=open(f,encoding='utf-8').read()
old='<div class="guide-note tip">아욱세시아 예시는 업데이트 예정이에요.</div>'
if old in t: t=t.replace(old,H)
else: t=re.sub(r'<!--AX-START-->[\s\S]*<!--AX-END-->',lambda m:H,t)
open(f,'w',encoding='utf-8').write(t); print('ok')
