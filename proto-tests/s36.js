// кабель через развилку с PTE на ответвлении (с запасом и без): видит ли схема PTE
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const Y = 44.5475, X = 8.9680, J = [Y + 0.0006, X], P = [J[0], X + 0.0006], Xm = [J[0], X + 0.0003];
const hav = (a, b) => { const R = 6371008.8, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t; const q = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };
const mk = (id, shape, p) => ({ id, folderId: 'f1', name: id, shape, color: '#22c55e', lat: p[0], lng: p[1], createdAt: 1 });
const st = (slack) => ({ folders: [{ id: 'f1', name: 'Сеть', color: '#3b82f6' }],
  markers: [mk('FO', 'fo', [Y - 0.0006, X]), mk('M', 'muffolaLinea', [Y, X]), mk('K', 'pozzetto60', J), mk('X', 'interno', Xm), mk('P', 'interno', P)],
  lines: [
    { id: 'T', folderId: 'f1', name: 'Линия T', color: '#ef4444', createdAt: 0, points: [[Y - 0.0006, X], [Y, X]], layers: [{ id: 't1', type: 'cable', name: 'Кабель', fibers: 48, color: '#22c55e', s: [0, hav([Y - 0.0006, X], [Y, X])], points: [[Y - 0.0006, X], [Y, X]], slack: { M: 20 } }] },
    { id: 'A', folderId: 'f1', name: 'Линия A', color: '#ef4444', createdAt: 1, points: [[Y, X], J],
      layers: [{ id: 'c', type: 'cable', name: 'Кабель', fibers: 24, color: '#22c55e', s: [0, hav([Y, X], J)], via: [{ line: 'B', s: [0, hav(J, P)] }], points: [[Y, X], J, P], slack }] },
    { id: 'B', folderId: 'f1', name: 'Линия B', color: '#ef4444', createdAt: 2, points: [J, P], layers: [] }],
  reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true, viaV1: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  for (const [tag, slack] of [['запас у M, X и P', { M: 20, X: 5, P: 5 }], ['запас у M и P (X без запаса)', { M: 20, P: 5 }], ['запас только у M', { M: 20 }]]) {
    await p.evaluate(([K, s]) => localStorage.setItem(K, JSON.stringify(s)), [KEY, st(slack)]);
    await p.reload(); await p.waitForTimeout(2000);
    await p.evaluate(() => document.getElementById('btnMenu').click()); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('#drawer .fschema').click()); await p.waitForTimeout(700);
    console.log(tag + ':', await p.evaluate(() => [...document.querySelectorAll('#schema .schema-body svg > text')].map((t) => t.textContent).join(' | ')),
      '| nodes:', await p.evaluate(() => [...document.querySelectorAll('#schema [data-mid]')].map((g) => g.textContent).join(',')));
    await p.screenshot({ path: process.argv[3] + '/schq_' + Object.keys(slack).join('') + '.png' });
  }
  await b.close();
})();
