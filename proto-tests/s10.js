const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  await p.evaluate(() => localStorage.setItem('fieldmap_lang', 'it'));
  await p.reload(); await p.waitForTimeout(700);
  await p.click('#fabAdd'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const e = document.getElementById('mkHold').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(400);
  console.log('IT picker:', await p.evaluate(() => [...document.querySelectorAll('#mkShapes .mk-shape small')].slice(0, 8).map((x) => x.textContent).join(' | ')));
  console.log('IT banner:', await p.textContent('#modeTopSub'));
  await b.close();
})();
