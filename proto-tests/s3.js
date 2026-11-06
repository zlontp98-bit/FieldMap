// проверка старого: объекты, роли, перенос маркера, рапорт бригадира, итальянский язык, рисование линии и слоя
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message); });
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page); await p.waitForTimeout(600);
  // новый пользователь: пример данных
  await p.evaluate(() => document.querySelector('.top-bar .tb-btn').click()); await p.waitForTimeout(250);
  console.log('drawer:', await p.evaluate(() => [...document.querySelectorAll('#dTop .row .ttl, #dBottom')].map((e) => e.textContent).join(' | ')));
  await p.evaluate(() => document.getElementById('backdrop').click()); await p.waitForTimeout(200);
  let s = await p.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
  console.log('seed stage:', JSON.stringify(s.lines.map((l) => [l.name, l.plan ? 'plan' : 'done'])), JSON.stringify(s.markers.map((m) => [m.name, m.plan ? 'plan' : 'done'])));
  // рисуем линию в «Выполнении» — линия выполненная
  await p.click('#fabLine'); await p.waitForTimeout(300);
  await p.click('#linePlus'); await p.waitForTimeout(200);
  await p.mouse.move(200, 400); await p.mouse.down(); await p.mouse.move(110, 300, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  await p.click('#linePlus'); await p.waitForTimeout(200);
  await p.click('#lineSave'); await p.waitForTimeout(600);
  s = await p.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
  const nl = s.lines[s.lines.length - 1];
  console.log('new line in done mode: plan=', !!nl.plan, 'color', nl.color);
  // маркер: перенос в объект, кнопки карточки
  await p.click('#fabAdd'); await p.waitForTimeout(300); await p.click('#markOk'); await p.waitForTimeout(600);
  for (const dy of [-12, -20, -5, -28]) { await p.mouse.click(200, 400 + dy); await p.waitForTimeout(350); if (await p.isVisible('#mSheet .tb-bar')) break; }
  console.log('marker bar:', await p.isVisible('#mSheet .tb-bar') ? await p.textContent('#mSheet .tb-bar') : 'none');
  // итальянский
  await p.evaluate(() => document.querySelector('#mSheet [aria-label="Закрыть"]') && document.querySelector('#mSheet [aria-label="Закрыть"]').click());
  await p.evaluate(() => document.querySelector('.top-bar .tb-btn').click()); await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll('#dTop .row')].find((r) => r.textContent.includes('Настройки')).click()); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('#pageBody .lang-row')].find((r) => r.textContent.includes('Italiano')).click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#pageHead .ibtn').click()); await p.waitForTimeout(300);
  console.log('IT drawer:', await p.evaluate(() => [...document.querySelectorAll('#dTop .row .ttl, #dBottom .sec, #dBottom button')].map((e) => e.textContent).join(' | ')));
  await p.evaluate(() => document.getElementById('backdrop').click()); await p.waitForTimeout(200);
  console.log('IT toggle:', await p.textContent('#workMode'));
  await p.screenshot({ path: out + '/c1.png' });
  console.log('errors:', errs.length);
  await b.close();
})();
