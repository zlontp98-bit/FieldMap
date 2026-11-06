// кабель подключает узел только с запасом (скортой) или своим концом; PTE с запасом — цепочкой
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const RED = '#ef4444', GREEN = '#22c55e';
const markers = [], lines = [];
let n = 0;
const mk = (fid, id, name, shape, lat, lng, plan) => markers.push({ id, folderId: fid, name, shape, color: plan ? RED : GREEN, plan: !!plan, lat, lng, createdAt: 1 });
const ln = (fid, name, pts, layers) => lines.push({ id: 'l' + (++n), folderId: fid, name, color: RED, plan: true, createdAt: n, points: pts, layers });
const cab = (fibers, pts, o) => Object.assign({ id: 'c' + (++n), type: 'cable', name: 'Кабель', fibers, color: GREEN, points: pts }, o || {});
// вариант: f — объект, cables — функция, дающая кабели линии 4 (2 → 8 → 9)
const variant = (f, Y, cables, trunk) => {
  const X = 8.960;
  const P = { fo: [Y, X], m2: [Y, X + 0.0012], p8: [Y + 0.0004, X + 0.0021], p9: [Y + 0.0004, X + 0.0028], m1: [Y - 0.0006, X + 0.0022], m4: [Y - 0.0006, X + 0.0034] };
  mk(f, f + 'fo', 'FO', 'fo', ...P.fo); mk(f, f + 'm2', '2', 'muffolaSecondaria', ...P.m2, true);
  mk(f, f + 'p8', '8', 'muroEsterno', ...P.p8, true); mk(f, f + 'p9', '9', 'muroEsterno', ...P.p9, true);
  mk(f, f + 'm1', '1', 'muffolaLinea', ...P.m1, true); mk(f, f + 'm4', '4', 'muffolaLinea', ...P.m4, true);
  ln(f, 'Линия 1', [P.fo, P.m2], []);   // шкаф — муфта 2: трасса без кабеля
  const l4 = [P.m2, P.p8, P.p9];
  ln(f, 'Линия 4', l4, cables(l4, f));
  // магистраль 48: муфта 2 → муфта 1 → муфта 4 (запас у 1 — по trunk)
  const lt = [P.m2, [Y - 0.0006, X + 0.0012], P.m1, P.m4];
  ln(f, 'Линия 5', lt, [cab(48, lt, { slack: Object.assign({ [f + 'm2']: 20 }, trunk ? { [f + 'm1']: 15 } : {}) })]);
};
const Y0 = 44.548;
// A: проект — два кабеля: 2→9 (запас у 2 и 9) и 2→8 (запас у 2 и 8)
variant('A', Y0, (l4, f) => [cab(24, l4, { plan: true, slack: { [f + 'm2']: 20, [f + 'p9']: 5 } }), cab(24, l4.slice(0, 2), { plan: true, color: '#8b5cf6', slack: { [f + 'm2']: 20, [f + 'p8']: 5 } })], true);
// B: выполнено одним кабелем 2→8→9 с запасом у 8 и 9 — 8 и 9 цепочкой
variant('B', Y0 + 0.01, (l4, f) => [cab(24, l4, { slack: { [f + 'm2']: 20, [f + 'p8']: 5, [f + 'p9']: 5 } })], true);
// C: тот же кабель без запаса у 8 — 8 не подключён; магистраль без запаса у муфты 1 — муфта 1 не подключена
variant('C', Y0 + 0.02, (l4, f) => [cab(24, l4, { slack: { [f + 'm2']: 20, [f + 'p9']: 5 } })], false);
// D: кабель через стык двух линий у колодца (те же 12 волокон) — PTE подключён через стык
{
  const f = 'D', Y = Y0 + 0.03, X = 8.960;
  mk(f, 'Dm', 'M', 'muffolaLinea', Y, X); mk(f, 'Dk', 'K', 'pozzetto60', Y, X + 0.0008, true); mk(f, 'Dp', 'P', 'interno', Y + 0.0006, X + 0.0008, true);
  ln(f, 'a', [[Y, X], [Y, X + 0.0008]], [cab(12, [[Y, X], [Y, X + 0.0008]])]);
  ln(f, 'b', [[Y, X + 0.0008], [Y + 0.0006, X + 0.0008]], [cab(12, [[Y, X + 0.0008], [Y + 0.0006, X + 0.0008]])]);
}
const state = { folders: ['A', 'B', 'C', 'D'].map((id) => ({ id, name: 'RL ' + id, color: '#3b82f6' })), markers, lines,
  reels: [], activeFolderId: 'A', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  await p.evaluate(([K, st]) => localStorage.setItem(K, JSON.stringify(st)), [KEY, state]);
  await p.reload(); await p.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) {
    await p.evaluate(() => document.getElementById('btnMenu').click()); await p.waitForTimeout(400);
    await p.evaluate((i) => [...document.querySelectorAll('#drawer .fschema')][i].click(), i); await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const L = window.__dbgLayout;
      const el = document.getElementById('schema');
      return { nodes: [...el.querySelectorAll('[data-mid]')].map((g) => g.textContent).join(','),
        labels: [...el.querySelectorAll('.schema-body svg > text')].map((t) => t.textContent).join(' | ') };
    });
    console.log('ABCD'[i], JSON.stringify(r));
    await p.screenshot({ path: out + '/slack' + 'ABCD'[i] + '.png' });
    await p.evaluate(() => document.querySelector('#schema .schema-head button').click()); await p.waitForTimeout(300);
  }
  await b.close();
})();
