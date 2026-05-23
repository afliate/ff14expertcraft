// 각 지역 파일을 불러온 후 하나로 합치는 파일이에요.
// HTML에서 이 파일보다 먼저 지역 파일들을 로드해야 해요.
//
// <script src="recipes-sinus-ardorum.js"></script>
// <script src="recipes-phaenna.js"></script>
// <script src="recipes-oizys.js"></script>
// <script src="recipes-auxesia.js"></script>
// <script src="recipes.js"></script>
 
const HARD_RECIPES = [
  ...RECIPES_SINUS_ARDORUM,
  ...RECIPES_PHAENNA,
  ...RECIPES_OIZYS,
  ...RECIPES_AUXESIA,
];
