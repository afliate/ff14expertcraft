# ff14expertcraft
파이널판타지14 고난도 제작 가이드

https://ff14expertcraft.pages.dev/#home 


https://afliate.github.io/ff14expertcraft

## 엔진 / 테스트
- `engine.js` : UI 없는 계산 엔진(작업량·품질 증가량, 버프/IQ 추적). v1은 CP·내구도·성공 확률은 다루지 않음.
- `node --test tests/engine.test.js` : Teamcraft 기준값(`tests/golden.json`)과 숫자 대조.
- 기준값 재생성: `TEAMCRAFT_SRC=<teamcraft simulator 경로> node tools/gen-golden.cjs` (esbuild 필요)
- 출처/라이선스: `THIRD_PARTY_NOTICES.md`
