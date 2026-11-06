// ряды цветов и значков не налезают на плашку режима (узкий экран, плашка в две строки с выбором объекта)
const { chromium } = require('playwright');
const page = process.argv[2], out = process.argv[3], w = Number(process.argv[4] || 360);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: 760 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page); await p.waitForTimeout(700);
  const rects = () => p.evaluate(() => ['modeTop', 'mkColors', 'mkShapes', 'lnColors', 'lnStyles'].map((id) => {
    const e = document.getElementById(id); if (!e || e.hidden) return id + ': -';
    const r = e.getBoundingClientRect(); return `${id}: ${Math.round(r.top)}–${Math.round(r.bottom)}`;
  }).join(' | '));
  const hold = async () => { const r = await p.evaluate(() => { const e = document.getElementById('mkHold').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
    await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(400); };
  // маркер
  await p.click('#fabAdd'); await p.waitForTimeout(400); await hold();
  console.log('marker mode:', await rects());
  await p.screenshot({ path: out + '/r1.png', clip: { x: 0, y: 0, width: w, height: 260 } });
  // смена цвета — ряды перестраиваются
  await p.evaluate(() => document.querySelectorAll('#mkColors .mk-dot')[3].click()); await p.waitForTimeout(300);
  console.log('after color:', await rects());
  await p.click('#markCancel').catch(() => {}); await p.evaluate(() => { const b = document.querySelector('.mode-bottom .pill'); if (b) b.click(); }); await p.waitForTimeout(300);
  // линия
  await p.reload(); await p.waitForTimeout(600);
  await p.click('#fabLine'); await p.waitForTimeout(400); await hold();
  console.log('line mode:', await rects());
  await p.screenshot({ path: out + '/r2.png', clip: { x: 0, y: 0, width: w, height: 260 } });
  await b.close();
})();
