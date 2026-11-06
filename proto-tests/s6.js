const { chromium } = require('playwright');
const page = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page); await p.waitForTimeout(700);
  await p.evaluate(() => [...document.querySelectorAll('#workMode button')].find((b) => b.textContent === 'Проект').click()); await p.waitForTimeout(2600);
  await p.screenshot({ path: out + '/f1.png' });
  await b.close();
})();
