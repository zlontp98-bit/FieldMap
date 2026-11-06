// поворот карты двумя пальцами (настоящие касания через CDP), компас, перемещение и нажатие на маркер после поворота
const { chromium } = require('playwright');
const page = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page); await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  await p.screenshot({ path: out + '/rot0.png' });
  // два пальца вокруг центра (200, 400), поворот на 90° по часовой
  const R = 90, steps = 18;
  const at = (ang) => [[200 + R * Math.cos(ang), 400 + R * Math.sin(ang)], [200 - R * Math.cos(ang), 400 - R * Math.sin(ang)]];
  await touch('touchStart', at(0));
  for (let i = 1; i <= steps; i++) { await touch('touchMove', at((Math.PI / 2) * i / steps)); await p.waitForTimeout(16); }
  await touch('touchEnd', []);
  await p.waitForTimeout(400);
  console.log('compass visible:', await p.evaluate(() => !document.getElementById('fabCompass').hidden),
    '| needle:', await p.evaluate(() => document.querySelector('#fabCompass svg').style.transform));
  await p.screenshot({ path: out + '/rot90.png' });
  // перемещение одним пальцем вправо на 100 px: карта должна уехать вправо (как палец)
  await touch('touchStart', [[150, 600]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[150 + i * 10, 600]]); await p.waitForTimeout(16); }
  await touch('touchEnd', []); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/rot90pan.png' });
  // нажатие на маркер «Точка 1»: найдём через поиск — карта прилетит к нему, он будет в центре
  await p.click('#tbSearch'); await p.fill('#sInput', 'Точка'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#sList .row').click()); await p.waitForTimeout(1000);
  for (const dy of [-14, -20, -8, -26]) { await p.mouse.click(200, 400 + dy); await p.waitForTimeout(350); if (await p.isVisible('#mSheet .tb-bar')) break; }
  console.log('tap marker after rotation:', await p.isVisible('#mSheet .tb-head') ? await p.textContent('#mSheet .tb-ttl') : 'no sheet');
  await p.evaluate(() => { const x = document.querySelector('#mSheet [aria-label="Закрыть"]'); if (x) x.click(); });
  // компас — назад на север
  await p.click('#fabCompass'); await p.waitForTimeout(600);
  console.log('after compass: hidden', await p.evaluate(() => document.getElementById('fabCompass').hidden));
  await p.screenshot({ path: out + '/rotback.png' });
  await b.close();
})();
