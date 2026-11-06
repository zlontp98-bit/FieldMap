const { chromium } = require('playwright');
const Y = 44.5475, X = 8.9680;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  const mk = (id, shape, d) => ({ id, folderId: 'f1', name: id, shape, color: '#06b6d4', lat: Y + d, lng: X, createdAt: 1 });
  const st = { folders: [{ id: 'f1', name: 'Т', color: '#3b82f6' }],
    markers: [mk('1', 'cameretta', 0.0003), mk('2', 'colonninaEs', 0.00015), mk('3', 'distFO', 0), mk('4', 'palo', -0.00015), mk('5', 'armadietto', -0.0003)],
    lines: [{ id: 'L', folderId: 'f1', name: 'Л', color: '#ef4444', plan: true, createdAt: 1, points: [[Y + 0.0005, X], [Y - 0.0005, X]], layers: [] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'plan', planRedV1: true, planRedV2: true, stageV1: true };
  await p.evaluate((s) => localStorage.setItem('fieldmap_proto_v1', JSON.stringify(s)), st);
  await p.reload(); await p.waitForTimeout(3500);
  await p.screenshot({ path: process.argv[3] + '/circ.png', clip: { x: 120, y: 250, width: 160, height: 300 } });
  await b.close();
})();
