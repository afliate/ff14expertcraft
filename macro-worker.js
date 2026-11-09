/* macro-worker.js · 매크로 탐색을 화면과 분리해서 돌린다 */
importScripts('engine.js?v=20261110-5', 'advisor.js?v=20261110-5', 'macro.js?v=20261110-5');
self.onmessage = function (e) {
  const m = e.data;
  try {
    const res = self.FFMacro.searchVariant(m.ctx, m.opts || {}, m.variant);
    self.postMessage({ id: m.id, res });
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err && err.message || err) });
  }
};
