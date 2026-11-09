/* advisor-worker.js · 추천 계산을 화면과 분리해서 돌린다 */
importScripts('engine.js?v=20261109-39', 'advisor.js?v=20261109-39');
self.onmessage = function (e) {
  const m = e.data;
  try {
    // FFAdvisor 는 UMD 라 worker 에서는 self.FFAdvisor 로 노출된다
    const res = self.FFAdvisor.recommendPolicy(m.state, m.ctx, m.cond, Object.assign({}, m.opts, { odds: m.odds }));
    self.postMessage({ id: m.id, res });
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err && err.message || err) });
  }
};
