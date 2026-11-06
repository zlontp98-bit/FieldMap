// синий маркер в режиме «Проект» — существующий; старые синие проектные исправляются при запуске
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const Y = 44.5475, X = 8.9680;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  const st = { folders: [{ id: 'f1', name: 'Око', color: '#3b82f6' }],
    markers: [{ id: 'old', folderId: 'f1', name: '3', shape: 'fo', color: '#3b82f6', plan: true, lat: Y + 0.0004, lng: X, createdAt: 1 },
      { id: 'r', folderId: 'f1', name: '7', shape: 'business', color: '#ef4444', plan: true, lat: Y + 0.0002, lng: X, createdAt: 1 }],
    lines: [{ id: 'L', folderId: 'f1', name: 'Линия 1', color: '#ef4444', plan: true, createdAt: 1, points: [[Y + 0.0004, X], [Y - 0.0002, X]],
      layers: [{ id: 'c', type: 'cable', name: 'Кабель', fibers: 48, color: '#22c55e', points: [[Y + 0.0004, X], [Y - 0.0002, X]] }] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'plan', placeColor: '#3b82f6', planRedV1: true, planRedV2: true, stageV1: true };
  await p.evaluate(([K, s]) => localStorage.setItem(K, JSON.stringify(s)), [KEY, st]);
  await p.reload(); await p.waitForTimeout(800);
  const S = () => p.evaluate((K) => JSON.parse(localStorage.getItem(K)), KEY);
  console.log('old blue plan after start:', (await S()).markers.find((m) => m.id === 'old').plan);
  // новый маркер синим в «Проекте»: кнопка добавления и OK
  await p.click('#fabAdd'); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('markOk').click()); await p.waitForTimeout(500);
  const nm = (await S()).markers.filter((m) => !['old', 'r'].includes(m.id));
  console.log('new marker:', nm.map((m) => m.color + ' plan=' + !!m.plan).join(', '));
  await p.evaluate(() => { const b = [...document.querySelectorAll('#workMode .wm-btn')].find((x) => x.classList.contains('wm-done')); if (b) b.click(); });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: process.argv[3] + '/blue.png' });
  await b.close();
})();
