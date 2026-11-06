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
      layers: [{ id: 'A', type: 'custom', name: 'Траншея', color: C, style: 'dashdot', points: pts },
        { id: 'B', type: 'custom', name: 'Тоннель', color: C, points: [pts[0], pts[1]] }] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true };
  await p.evaluate((s) => localStorage.setItem('fieldmap_proto_v1', JSON.stringify(s)), st);
  await p.reload(); await p.waitForTimeout(3000);
  await p.touchscreen.tap(200, 400); await p.waitForTimeout(1200);
  for (const i of [0, 1]) {
    const bx = await p.evaluate((i) => { const r = document.querySelectorAll('#layerPanel .lp-row')[i].getBoundingClientRect(); return [r.x + 50, r.y + r.height / 2]; }, i); await p.touchscreen.tap(bx[0], bx[1]); await p.waitForTimeout(600);
    await p.screenshot({ path: process.argv[3] + '/top' + i + '.png', clip: { x: 60, y: 200, width: 280, height: 420 } });
  }
  await b.close();
})();
