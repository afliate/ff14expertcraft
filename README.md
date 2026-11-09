# ff14expertcraft
파이널판타지14 고난도 제작 가이드

https://ff14expertcraft.pages.dev/#home 


https://afliate.github.io/ff14expertcraft

## 엔진 / 테스트
- `engine.js` : UI 없는 계산 엔진(작업량·품질 증가량, 버프/IQ 추적). v1은 CP·내구도·성공 확률은 다루지 않음.
- `node --test tests/engine.test.js` : Teamcraft 기준값(`tests/golden.json`)과 숫자 대조.
- 기준값 재생성: `TEAMCRAFT_SRC=<teamcraft simulator 경로> node tools/gen-golden.cjs` (esbuild 필요)
- 출처/라이선스: `THIRD_PARTY_NOTICES.md`
- `advisor.js` : 다음 스킬 추천(추천 탭). CP·내구도·사용 조건·성공률·상태 효과를 얹은 모델 (`tests/advisor.test.js`).
- `macro.js` : 매크로 탭. 상태 '보통' 가정 + 성공률 100% 스킬만으로 가장 짧은 고정 순서를 찾고, 상태 확률로 달성률을 시뮬레이션 (`tests/macro.test.js`). 탐색 코드는 직접 작성했고 Raphael 코드는 쓰지 않았다(결과 비교만 참고).
- `data/condition-odds.json` : 상태 확률. 현재 값은 임시 기본값이고, 추천 탭의 "조건 기록"으로 실측을 모아 갱신할 예정.
- `shared-stats.js` : 계산기·추천·매크로 탭이 내 능력치를 같이 쓰게 함 (localStorage).
