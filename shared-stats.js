/* shared-stats.js · 계산기 / 추천 / 매크로 탭이 "내 능력치"를 같이 쓰게 한다.
 * 탭을 떠날 때 그 탭의 값을 저장하고, 들어올 때 저장된 값을 채운다. (localStorage, 실패해도 무시) */
(function () {
  'use strict';
  const KEY = 'ffec-stats-v1';
  const MAP = {
    calc: { craft: 'crafts-input', ctrl: 'q-cons', cp: 'q-cp' },
    advisor: { craft: 'adv-craft', ctrl: 'adv-ctrl', cp: 'adv-maxcp', spec: 'adv-spec' },
    macro: { craft: 'mc-craft', ctrl: 'mc-ctrl', cp: 'mc-maxcp', spec: 'mc-spec' },
  };
  const $ = (id) => document.getElementById(id);
  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function currentTab() { const p = document.querySelector('.tab-panel.active'); return p ? p.id.replace('tab-', '') : ''; }

  function save(tab) {
    const m = MAP[tab]; if (!m) return;
    const v = read() || {};
    const num = (id) => Number($(id) && $(id).value) || 0;
    const c = num(m.craft), k = num(m.ctrl), p = num(m.cp);
    if (c > 0 && k > 0 && p > 0) { v.craft = c; v.ctrl = k; v.cp = p; }
    if (m.spec && $(m.spec)) v.spec = $(m.spec).checked;
    write(v);
  }
  function load(tab) {
    const m = MAP[tab], v = read(); if (!m || !v || !v.craft) return;
    const set = (id, val) => { const e = $(id); if (e && String(e.value) !== String(val)) { e.value = val; return true; } return false; };
    const oldCp = $(m.cp) && $(m.cp).value;
    set(m.craft, v.craft); set(m.ctrl, v.ctrl); set(m.cp, v.cp);
    if (m.spec && $(m.spec) && typeof v.spec === 'boolean') $(m.spec).checked = v.spec;
    if (tab === 'advisor') {
      // 처음 상태(진행 기록 없음)면 현재 CP 도 같이 맞춘다
      const cur = $('adv-curcp'); if (cur && !document.querySelector('#adv-hist .adv-h')) cur.value = v.cp;
      document.querySelectorAll('#adv-gear-btns .preset-btn,#adv-food-btns .preset-btn,#adv-pot-btns .preset-btn').forEach((b) => b.classList.remove('active'));
    }
    if (tab === 'macro') document.querySelectorAll('#mc-gear-btns .preset-btn,#mc-food-btns .preset-btn,#mc-pot-btns .preset-btn').forEach((b) => b.classList.remove('active'));
    if (tab === 'calc' && typeof window.onStatsChange === 'function') { try { window.onStatsChange(); } catch (e) {} }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const orig = window.switchTab;
    if (typeof orig !== 'function') return;
    window.switchTab = function (id) {
      save(currentTab());
      const r = orig.apply(this, arguments);
      load(id === 'qualcalc' ? 'calc' : id);
      return r;
    };
    // 새로고침 후 처음 열린 탭에도 저장값 반영 (다른 스크립트가 값을 채운 뒤)
    setTimeout(() => load(currentTab()), 600);
    window.addEventListener('beforeunload', () => save(currentTab()));
  });
})();
