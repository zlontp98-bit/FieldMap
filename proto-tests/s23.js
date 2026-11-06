// выбранный слой подсвечивается; соединение двух кусков; продолжение на соседнюю линию; общая длина
const { chromium } = require('playwright');
const Y = 44.5475, X = 8.9680, C = '#06b6d4';
const tr = (id, pts) => ({ id, type: 'custom', name: 'Траншея открытая', color: C, style: 'dashdot', points: pts });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  const st = { folders: [{ id: 'f1', name: 'Т', color: '#3b82f6' }], markers: [],
    lines: [
      { id: 'L1', folderId: 'f1', name: 'Линия 1', color: '#ef4444', plan: true, createdAt: 1, points: [[Y + 0.0006, X], [Y - 0.0006, X]],
        layers: [tr('A', [[Y + 0.0006, X], [Y + 0.0002, X]]), tr('B', [[Y - 0.0001, X], [Y - 0.0006, X]])] },
      { id: 'L2', folderId: 'f1', name: 'Линия 2', color: '#ef4444', plan: true, createdAt: 2, points: [[Y - 0.0006, X], [Y - 0.0006, X + 0.0008]],
        layers: [tr('C', [[Y - 0.0006, X], [Y - 0.0006, X + 0.0004]])] },
      { id: 'L3', folderId: 'f1', name: 'Линия 3', color: '#ef4444', plan: true, createdAt: 3, points: [[Y + 0.0006, X], [Y + 0.0006, X - 0.0008]], layers: [] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'plan', planRedV1: true, planRedV2: true, stageV1: true };
  await p.evaluate((s) => localStorage.setItem('fieldmap_proto_v1', JSON.stringify(s)), st);
  await p.reload(); await p.waitForTimeout(3000);
  await p.touchscreen.tap(200, 400 - 120); await p.waitForTimeout(500);   // Линия 1 у куска A
  await p.evaluate(() => { const t = document.getElementById('lpTab'); if (t && !t.hidden) t.click(); }); await p.waitForTimeout(500);
  const rows = () => p.evaluate(() => [...document.querySelectorAll('#layerPanel .lp-row')].map((r) => (r.classList.contains('sel') ? '[SEL] ' : '') + r.textContent).join(' || '));
  console.log('panel:', await rows());
  await p.evaluate(() => [...document.querySelectorAll('#layerPanel .lp-row')][1].click()); await p.waitForTimeout(500);
  console.log('panel after tap B:', await rows());
  console.log('actions:', await p.evaluate(() => [...document.querySelectorAll('.sheet button, #sheet button')].map((x) => x.textContent).join(' / ')));
  await p.evaluate(() => { const bd = document.querySelector('.backdrop:not(.hidden)'); if (bd) bd.click(); }); await p.waitForTimeout(300);
  await p.screenshot({ path: process.argv[3] + '/hl.png' });
  // зажатие строки — меню настроек слоя (нажатие только подсвечивает)
  const cdp = await p.context().newCDPSession(p);
  const rb = await p.evaluate(() => { const q = document.querySelectorAll('#layerPanel .lp-row')[0].getBoundingClientRect(); return [q.x + 40, q.y + q.height / 2]; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rb[0], y: rb[1], id: 0 }] });
  await p.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(500);
  console.log('hold actions:', await p.evaluate(() => [...document.querySelectorAll('#sheet button')].map((x) => x.textContent).join(' / ')));
  await p.evaluate(() => [...document.querySelectorAll('.sheet button, #sheet button')].find((x) => x.textContent.startsWith('Соединить')).click()); await p.waitForTimeout(800);
  console.log('after merge:', await rows(), '| toast:', await p.textContent('#toast'));
  const L1 = await p.evaluate(() => JSON.parse(localStorage.getItem('fieldmap_proto_v1')).lines[0].layers.map((x) => x.id + ':' + x.s));
  console.log('L1 layers:', L1.join(' '));
  await p.screenshot({ path: process.argv[3] + '/hl2.png' });
  await b.close();
})();
