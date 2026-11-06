const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  // объект удалён, а подпапка линии с маркером осталась и стоит активной
  await p.evaluate((KEY) => localStorage.setItem(KEY, JSON.stringify({ folders: [{ id: 'G', name: 'Линия 1', color: '#22c55e', parentId: 'GONE' }],
    markers: [{ id: 'm', folderId: 'G', name: '1', lat: 44.5475, lng: 8.968, createdAt: 1 }], lines: [], reels: [], activeFolderId: 'G', view: {}, planRedV1: true, planRedV2: true, stageV1: true })), KEY);
  await p.reload(); await p.waitForTimeout(1000);
  const st = () => p.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
  let s = await st();
  console.log('toast:', await p.textContent('#toast'));
  console.log('folders:', JSON.stringify(s.folders.map((f) => [f.name, f.parentId ? 'sub' : 'top'])), 'active top:', s.folders.find((f) => f.id === s.activeFolderId).name);
  await p.evaluate(() => document.querySelector('.top-bar .tb-btn').click()); await p.waitForTimeout(300);
  console.log('drawer objects:', await p.textContent('#dList'));
  // удалили «Восстановлено» — маркер ставить нельзя без объекта
  await p.evaluate((KEY) => { const S = JSON.parse(localStorage.getItem(KEY)); S.folders = [{ id: 'G2', name: 'Сирота', color: '#22c55e', parentId: 'X' }]; S.markers = []; S.activeFolderId = 'G2'; localStorage.setItem(KEY, JSON.stringify(S)); }, KEY);
  await p.reload(); await p.waitForTimeout(800);
  s = await st();
  console.log('after reload folders:', JSON.stringify(s.folders.map((f) => [f.name, f.parentId ? 'sub' : 'top'])));
  await b.close();
})();
