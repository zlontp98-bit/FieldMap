const { chromium } = require('playwright');
const Y = 44.5475, X = 8.9680, C = '#06b6d4';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  const pts = [[Y + 0.0006, X - 0.0003], [Y, X], [Y - 0.0006, X + 0.0003]];
  const st = { folders: [{ id: 'f1', name: 'Т', color: '#3b82f6' }], markers: [],
    lines: [{ id: 'L1', folderId: 'f1', name: 'Линия 1', color: '#ef4444', plan: true, createdAt: 1, points: pts,
      layers: [{ id: 'A', type: 'custom', name: 'Траншея', color: C, style: 'dashdot', points: pts }, { id: 'B', type: 'custom', name: 'Тоннель', color: C, points: [pts[0], pts[1]] }] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true };
  await p.evaluate((s) => localStorage.setItem('fieldmap_proto_v1', JSON.stringify(s)), st);
  await p.reload(); await p.waitForTimeout(3000);
  await p.touchscreen.tap(200, 400); await p.waitForTimeout(800);
  const st2 = () => p.evaluate(() => ({ panelClosed: document.getElementById('layerPanel').classList.contains('lp-closed'), tab: document.getElementById('lpTab') && !document.getElementById('lpTab').hidden && !document.getElementById('lpTab').classList.contains('lp-tab-off') }));
  console.log('after line tap:', JSON.stringify(await st2()));
  await p.screenshot({ path: process.argv[3] + '/tab1.png' });
  const t = await p.evaluate(() => { const r = document.getElementById('lpTab').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.touchscreen.tap(t[0], t[1]); await p.waitForTimeout(600);
  console.log('after tab tap:', JSON.stringify(await st2()));
  await p.screenshot({ path: process.argv[3] + '/tab2.png' });
  const c = await p.evaluate(() => { const r = document.querySelector('#layerPanel .lp-shut').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.touchscreen.tap(c[0], c[1]); await p.waitForTimeout(600);
  console.log('after shut:', JSON.stringify(await st2()));
  await b.close();
})();
