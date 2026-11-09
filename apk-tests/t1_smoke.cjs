const H = require('./harness.cjs');
(async () => {
  const url = H.prepareWeb();
  const browser = await H.launch();
  const relay = H.makeRelay();
  const { page } = await H.phone(browser, relay);
  await page.goto(url);
  await H.sleep(1500);
  const sheet = await page.evaluate(() => { const s = document.getElementById('sheet'); return s.classList.contains('hidden') ? '' : s.innerText; });
  console.log('sheet:', JSON.stringify(sheet));
  await page.screenshot({ path: H.SP + '/tests/shots/t1_start.png' });
  // вход
  await page.click('#sheetBox .btn.primary');
  await H.sleep(800);
  console.log('after sign-in sheet:', JSON.stringify(await page.evaluate(() => document.getElementById('sheet').classList.contains('hidden') ? '' : document.getElementById('sheetBox').innerText)));
  await page.fill('#sheetBox input', 'Мария');
  await page.click('#sheetBox .btn.primary');
  await H.sleep(300);
  console.log('auth:', JSON.stringify(await page.evaluate(() => Auth.user)));
  await page.click('#btnMenu');
  await H.sleep(500);
  console.log('drawer:', (await page.evaluate(() => document.getElementById('dTop').innerText)).replace(/\n+/g, ' | '));
  await page.screenshot({ path: H.SP + '/tests/shots/t1_drawer.png' });
  console.log('errors:', page.errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
