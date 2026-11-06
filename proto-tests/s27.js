// панель не мелькает: сразу после нажатия на линию она уже закрыта и не видна
const { chromium } = require('playwright');
const Y = 44.5475, X = 8.9680;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true })).newPage();
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  const pts = [[Y + 0.0006, X], [Y - 0.0006, X]];
  await p.evaluate((s) => localStorage.setItem('fieldmap_proto_v1', JSON.stringify(s)), { folders: [{ id: 'f1', name: 'Т', color: '#3b82f6' }], markers: [],
    lines: [{ id: 'L1', folderId: 'f1', name: 'Л', color: '#ef4444', plan: true, createdAt: 1, points: pts, layers: [{ id: 'A', type: 'custom', name: 'Траншея', color: '#06b6d4', points: pts }] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true });
  await p.reload(); await p.waitForTimeout(3000);
  await p.evaluate(() => { window.__vis = []; const t0 = performance.now(); const f = () => { const e = document.getElementById('layerPanel'); if (e && !e.hidden) { const r = e.getBoundingClientRect(); window.__vis.push(Math.round(r.x) + '/' + getComputedStyle(e).opacity); } if (performance.now() - t0 < 1500) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await p.touchscreen.tap(200, 400); await p.waitForTimeout(1600);
  const v = await p.evaluate(() => window.__vis);
  console.log('frames:', v.length, 'any on screen:', v.some((x) => +x.split('/')[0] < 400 && +x.split('/')[1] > 0.05), v.slice(0, 4).join(' '));
  await b.close();
})();
