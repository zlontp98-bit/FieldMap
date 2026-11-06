const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(700);
  await p.click('#fabAdd'); await p.waitForTimeout(300); await p.click('#markOk'); await p.waitForTimeout(600);
  await p.mouse.click(200, 386); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#mSheet [aria-label="Настройки"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('#pageBody button')].find((x) => x.textContent.includes('Снять фото')).click()); await p.waitForTimeout(200);
  console.log('toast:', await p.textContent('#toast'));
  await p.evaluate(() => [...document.querySelectorAll('#pageBody .pg-row')].find((x) => x.textContent.includes('Снять фото')).scrollIntoView());
  await p.screenshot({ path: process.argv[3] + '/cam.png' });
  await b.close();
})();
