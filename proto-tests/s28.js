// фото с камеры: маркер и линия, подпись на снимке, места фото на линии по кнопке, поделиться, после перезагрузки
const { chromium } = require('playwright');
const fs = require('fs');
const Y = 44.5475, X = 8.9680;
const page = process.argv[2], out = process.argv[3], img = process.argv[4];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.addInitScript(() => { window.claude = { use: async (n) => (n === 'downloads' ? { save: async ({ filename, data }) => { window.__saved = { filename, size: data.size }; return { status: 'saved' }; } } : null) }; });
  await p.goto('file://' + page);
  const pts = [[Y + 0.0006, X], [Y - 0.0006, X]];
  await p.evaluate((s) => localStorage.setItem('fieldmap_proto_v1', JSON.stringify(s)), { folders: [{ id: 'f1', name: 'Око', color: '#3b82f6' }],
    markers: [{ id: 'm6', folderId: 'f1', name: '6', shape: 'muffolaSecondaria', color: '#22c55e', lat: Y + 0.0006, lng: X + 0.0004, createdAt: 1 }],
    lines: [{ id: 'L1', folderId: 'f1', name: 'Линия 1', color: '#ef4444', plan: true, createdAt: 1, points: pts, layers: [] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true });
  await p.reload(); await p.waitForTimeout(3000);
  const shoot = async () => {
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.querySelector('#mSheet .tb-cam').click())]);
    await fc.setFiles(img);
    await p.waitForTimeout(1500);
  };
  // маркер 6: карточка, кнопка фотоаппарата
  const mx = 200 + 0.0004 * 111320 * Math.cos(Y * Math.PI / 180) / 0.427 * 0 ;
  await p.evaluate(() => {});
  const markerPt = await p.evaluate(([Y, X]) => null, [Y, X]);
  // ищем маркер касанием по его экранной точке: центр карты = (Y, X), z=18
  const mpp = 40075016.686 * Math.cos(Y * Math.PI / 180) / (256 * Math.pow(2, 18));
  const sx = 200 + (0.0004 * 111320 * Math.cos(Y * Math.PI / 180)) / mpp, sy = 400 - (0.0006 * 110574) / mpp;
  await p.touchscreen.tap(sx, sy); await p.waitForTimeout(600);
  console.log('marker sheet:', await p.evaluate(() => document.querySelector('#mSheet .tb-ttl') && document.querySelector('#mSheet .tb-ttl').textContent), '| camera btn:', await p.evaluate(() => !!document.querySelector('#mSheet .tb-cam')));
  await p.screenshot({ path: out + '/ph-sheet.png' });
  await shoot();
  console.log('viewer open:', await p.evaluate(() => !document.getElementById('viewer').classList.contains('hidden')), '| bar:', await p.evaluate(() => [...document.querySelectorAll('.v-act')].filter((x) => !x.hidden).map((x) => x.textContent).join(' / ')));
  const src = await p.evaluate(() => document.getElementById('vImg').src);
  fs.writeFileSync(out + '/stamped.jpg', Buffer.from(src.split(',')[1], 'base64'));
  await p.screenshot({ path: out + '/ph-viewer.png' });
  await p.evaluate(() => document.getElementById('vShare').click()); await p.waitForTimeout(600);
  console.log('share -> saved:', JSON.stringify(await p.evaluate(() => window.__saved)), '| toast:', await p.textContent('#toast'));
  await p.evaluate(() => document.getElementById('vClose').click()); await p.waitForTimeout(300);
  // линия: нажали у нижнего края, сняли фото — место = точка нажатия на линии
  await p.touchscreen.tap(200, 400 + 80); await p.waitForTimeout(700);
  await shoot();
  await p.evaluate(() => document.getElementById('vClose').click()); await p.waitForTimeout(300);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('fieldmap_proto_v1')));
  const lp = st.lines[0].photos[0], mp = st.markers[0].photos[0];
  console.log('line photo:', JSON.stringify(lp), '| marker photo has src inline:', !!mp.src);
  // карточка линии: кнопка «Где сняты фото»
  await p.touchscreen.tap(200, 400 - 60); await p.waitForTimeout(700);
  console.log('line sheet btn:', await p.evaluate(() => { const b = document.querySelector('#mSheet .ph-pins'); return b ? b.textContent : 'none'; }));
  await p.evaluate(() => document.querySelector('#mSheet .ph-pins').click()); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/ph-pins.png' });
  // нажатие на место фото — фото открывается
  await p.touchscreen.tap(200, 400 + 80 - 25); await p.waitForTimeout(600);
  console.log('pin tap -> viewer:', await p.evaluate(() => !document.getElementById('viewer').classList.contains('hidden')));
  await p.evaluate(() => document.getElementById('vWhere').click()); await p.waitForTimeout(600);
  console.log('where -> viewer closed:', await p.evaluate(() => document.getElementById('viewer').classList.contains('hidden')));
  // после перезагрузки фото на месте (из хранилища фото)
  await p.reload(); await p.waitForTimeout(2500);
  await p.touchscreen.tap(sx, sy); await p.waitForTimeout(600);
  console.log('thumb after reload:', await p.evaluate(async () => { const i = document.querySelector('#mSheet .tb-ph img'); await new Promise((r) => setTimeout(r, 300)); return i ? (i.src || '').slice(0, 30) : 'none'; }));
  await b.close();
})();
