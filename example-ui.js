/* 매크로 예시: 스킬 아이콘 채우기 + 매크로 복사 버튼 */
(function () {
  'use strict';
  function fill() {
    document.querySelectorAll('.mx-ico[data-sk]').forEach((el) => {
      if (el.firstChild || !window.ffSkillIcon) return;
      try {
        const img = new Image(); img.alt = ''; img.src = window.ffSkillIcon(el.dataset.sk);
        img.onerror = () => img.remove(); el.appendChild(img);
      } catch (e) {}
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.mx-copy'); if (!b) return;
    const txt = b.closest('.mx-mac').querySelector('pre').textContent;
    const done = () => { b.textContent = '복사됨'; setTimeout(() => { b.textContent = '복사'; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done);
    else { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (x) {} ta.remove(); done(); }
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(fill, 300));
  window.addEventListener('load', () => setTimeout(fill, 500));
})();
