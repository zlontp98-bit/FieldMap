// образцы линий в легенде и выбор типа «Из легенды» у своего слоя
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page); await p.waitForTimeout(700);
  await p.click('#fabLayers'); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('#mapPop .mp-row')].find((x) => x.textContent.includes('Легенда')).click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const r = [...document.querySelectorAll('#pageBody .lg-row')].find((x) => x.textContent.includes('Кабель новой')); r.scrollIntoView(); }); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/m1.png' });
  await p.click('#pageHead [aria-label="Назад"]'); await p.waitForTimeout(300);
  // свой слой: лист нового слоя через бобину-кнопку
  await p.click('#fabReels'); await p.waitForTimeout(500);
  const sheet = await p.evaluate(() => !document.getElementById('sheet').classList.contains('hidden'));
  if (!sheet) { const lp = await p.$('#linePick .lp-row'); if (lp) { await lp.click(); await p.waitForTimeout(400); } }
  console.log('sheet open:', await p.evaluate(() => !document.getElementById('sheet').classList.contains('hidden')), await p.evaluate(() => (document.querySelector('#sheetBox h3') || {}).textContent));
  const tile = await p.evaluate(() => { const t = [...document.querySelectorAll('#sheetBox .lt-tile')].find((x) => x.textContent.includes('Свой')); if (t) { t.click(); return true; } return false; });
  await p.waitForTimeout(300);
  console.log('custom tile:', tile, '| presets:', await p.evaluate(() => document.querySelectorAll('#sheetBox .lg-opt').length));
  await p.evaluate(() => [...document.querySelectorAll('#sheetBox .lg-opt')].find((x) => x.textContent.includes('Минитраншея')).click()); await p.waitForTimeout(300);
  console.log('name:', await p.evaluate(() => (document.querySelector('#sheetBox .lt-input[placeholder*="Канализация"]') || document.querySelector('#sheetBox .lt-input') || {}).value));
  await p.screenshot({ path: out + '/m2.png' });
  await b.close();
})();
