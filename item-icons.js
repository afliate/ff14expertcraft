/* item-icons.js · 음식/도핑 버튼에 아이템 아이콘을 붙인다.
 * 아이콘 번호는 XIVAPI Item 시트 기준 (글로벌/한국 공통). 이름·수치는 ItemFood 와 대조해 확인했다. */
(function () {
  'use strict';
  const ICON = {
    '알이페브레': 24107, // 알 이 페브레 (CP+26% 최대100, 가공 정밀도+5% 최대115)
    '세비체': 24337,     // 세비체 (CP 96, 작업 숙련도 150)
    '로네크': 24360,     // 로네크 스테이크 (CP 92, 가공 정밀도 97)
    '명인약액': 20712,   // 명인의 약액 (CP 27)
    '명인약주': 20712,   // 명인의 약주 (CP 21) — 약액과 같은 아이콘
    '장인약액': 20716,   // 장인의 약액 (작업 숙련도 63)
    '거장약액': 20713,   // 거장의 약액 (가공 정밀도 63)
  };
  const url = (id, hr) => { const s = String(id).padStart(6, '0'); return `https://xivapi.com/i/${s.slice(0, 3)}000/${s}${hr ? '_hr1' : ''}.png`; };
  function decorate() {
    document.querySelectorAll('.preset-btn').forEach((b) => {
      if (b.querySelector('.pi-ico')) return;
      const key = b.textContent.replace(/\s+/g, '');
      const id = ICON[key]; if (!id) return;
      const img = document.createElement('img');
      img.className = 'pi-ico'; img.alt = ''; img.loading = 'lazy'; img.src = url(id, true);
      img.onerror = function () { this.onerror = function () { this.style.display = 'none'; }; this.src = url(id, false); };
      b.insertBefore(img, b.firstChild);
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    decorate();
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(decorate, 50); }).observe(document.body, { childList: true, subtree: true });
  });
})();
