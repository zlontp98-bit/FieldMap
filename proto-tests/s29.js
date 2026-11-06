const { chromium } = require('playwright');
const Y = 44.5475, X = 8.9680;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  const pts = [[Y + 0.0006, X], [Y - 0.0006, X]];
  await p.evaluate((s) => localStorage.setItem('fieldmap_proto_v1', JSON.stringify(s)), { folders: [{ id: 'f1', name: 'Око', color: '#3b82f6' }],
    markers: [{ id: 'm7', folderId: 'f1', name: '7', shape: 'colonnina', color: '#ef4444', plan: true, lat: Y, lng: X, createdAt: 1 }],
    lines: [{ id: 'L1', folderId: 'f1', name: 'Линия 1', color: '#ef4444', plan: true, createdAt: 1, points: pts, layers: [
      { id: 'a', type: 'tube', name: 'Трубка', color: '#22c55e', points: pts },
      { id: 'b', type: 'custom', name: 'Трубы в грунте', color: '#ef4444', plan: true, points: pts },
      { id: 'c', type: 'cable', name: 'Кабель', fibers: 24, color: '#22c55e', points: pts }] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true });
  await p.reload(); await p.waitForTimeout(3000);
  await p.touchscreen.tap(200, 400); await p.waitForTimeout(700);
  console.log('rows:', await p.evaluate(() => [...document.querySelectorAll('#mSheet .tb-cable')].map((r) => r.textContent).join(' || ')));
  await p.screenshot({ path: process.argv[3] + '/m7.png', clip: { x: 0, y: 520, width: 400, height: 280 } });
  await b.close();
})();
