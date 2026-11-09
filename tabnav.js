/* tabnav.js · 탭을 큰 묶음(배우기 / 도구 / 자료)으로 나누는 내비게이션
 *  - 모바일(≤640px): 아래쪽 탭 바(홈·배우기·도구·금단표) + 위쪽 작은 탭 줄
 *  - 데스크톱: 왼쪽 사이드바에 묶음 구분선만 추가 (탭 자체는 그대로)
 * switchTab 을 감싸서 쓰기 때문에 기존 탭 전환 코드는 건드리지 않는다. */
(function () {
  'use strict';
  const GROUPS = [
    { id: 'home', label: '홈', icon: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>', tabs: [['home', '메인']] },
    { id: 'learn', label: '배우기', icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
      tabs: [['start', '시작가이드'], ['skill', '스킬'], ['status', '상태'], ['summary', '요약'], ['example', '예시']] },
    { id: 'tools', label: '도구', icon: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"/>',
      tabs: [['calc', '계산기'], ['advisor', '추천'], ['macro', '매크로']] },
    { id: 'data', label: '금단표', icon: '<path d="M4 4h16v16H4z"/><path d="M4 10h16M10 4v16"/>', tabs: [['gear', '금단표']] },
  ];
  const $ = (id) => document.getElementById(id);
  const groupOf = (tab) => GROUPS.find((g) => g.tabs.some((t) => t[0] === tab)) || GROUPS[0];
  const LAST = {};
  function curTab() { const p = document.querySelector('.tab-panel.active'); return p ? p.id.replace('tab-', '') : 'home'; }

  function build() {
    // 아래 탭 바
    const bar = document.createElement('nav');
    bar.className = 'bottom-bar'; bar.id = 'bottom-bar'; bar.setAttribute('aria-label', '주요 메뉴');
    bar.innerHTML = GROUPS.map((g) => `<button type="button" data-g="${g.id}"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${g.icon}</svg><span>${g.label}</span></button>`).join('');
    document.body.appendChild(bar);
    bar.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const g = GROUPS.find((x) => x.id === b.dataset.g);
      window.switchTab(LAST[g.id] || g.tabs[0][0]);
    }));
    // 위쪽 작은 탭 줄
    const sub = document.createElement('div');
    sub.className = 'subtabs'; sub.id = 'subtabs';
    const main = document.querySelector('.main-wrap');
    const first = main.querySelector('.tab-panel');
    main.insertBefore(sub, first);
    // 계산기 버튼을 추천 앞으로 옮겨 '도구' 묶음에 모은다
    const nav = document.querySelector('.sidebar-nav');
    const calcBtn = nav.querySelector('.tab-btn[data-tab="calc"]');
    const advBtn = nav.querySelector('.tab-btn[data-tab="advisor"]');
    if (calcBtn && advBtn) nav.insertBefore(calcBtn, advBtn);
    // 사이드바 묶음 구분선 (배우기 앞, 도구 앞, 금단표 앞)
    [['start', '배우기'], ['calc', '도구'], ['gear', '자료']].forEach(([tab, label]) => {
      const btn = document.querySelector(`.sidebar-nav .tab-btn[data-tab="${tab}"]`);
      if (!btn) return;
      const sep = document.createElement('div');
      sep.className = 'nav-sep'; sep.innerHTML = `<span>${label}</span>`;
      btn.parentNode.insertBefore(sep, btn);
    });
  }
  function sync(tab) {
    const g = groupOf(tab); LAST[g.id] = tab;
    document.querySelectorAll('#bottom-bar button').forEach((b) => b.classList.toggle('active', b.dataset.g === g.id));
    const sub = $('subtabs');
    if (g.tabs.length > 1) {
      sub.innerHTML = g.tabs.map(([id, label]) => `<button type="button" data-t="${id}" class="${id === tab ? 'active' : ''}">${label}</button>`).join('');
      sub.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => window.switchTab(b.dataset.t)));
      sub.style.display = '';
      const on = sub.querySelector('.active'); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} }
    } else { sub.innerHTML = ''; sub.style.display = 'none'; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    build();
    const orig = window.switchTab;
    window.switchTab = function (id) {
      const r = orig.apply(this, arguments);
      sync(id === 'qualcalc' ? 'calc' : id);
      return r;
    };
    setTimeout(() => sync(curTab()), 0);
  });
})();
