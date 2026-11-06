// подписи значков при постановке, легенда, типы линий из легенды, отчёт с новыми названиями
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page); await p.waitForTimeout(700);
  await p.click('#fabAdd'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const e = document.getElementById('mkHold').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(400);
  console.log('banner:', await p.textContent('#modeTop'));
  await p.screenshot({ path: out + '/l1.png', clip: { x: 0, y: 0, width: 400, height: 330 } });
  // выбрать колодец 47×47 и поставить
  await p.evaluate(() => [...document.querySelectorAll('#mkShapes .mk-shape')].find((b) => b.textContent.includes('47×47')).click()); await p.waitForTimeout(300);
  console.log('banner after pick:', await p.textContent('#modeTop'));
  await p.click('#markOk'); await p.waitForTimeout(600);
  await p.mouse.click(200, 400); await p.waitForTimeout(500);
  console.log('marker sheet head:', await p.isVisible('#mSheet .tb-head') ? await p.textContent('#mSheet .tb-head') : 'none');
  await p.evaluate(() => { const x = document.querySelector('#mSheet [aria-label="Закрыть"]'); if (x) x.click(); });
  // легенда из «Слоёв карты»
  await p.click('#fabLayers'); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('#mapPop .mp-row')].find((x) => x.textContent.includes('Легенда')).click()); await p.waitForTimeout(400);
  console.log('legend title:', await p.textContent('#pageHead .title'), '| rows:', await p.evaluate(() => document.querySelectorAll('#pageBody .lg-row').length));
  await p.screenshot({ path: out + '/l2.png' });
  await p.evaluate(() => { document.getElementById('pageBody').scrollTop = 1700; }); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l3.png' });
  await p.evaluate(() => { document.getElementById('pageBody').scrollTop = 99999; }); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l4.png' });
  await b.close();
})();
