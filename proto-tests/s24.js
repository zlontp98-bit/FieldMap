const { chromium } = require('playwright');
const Y = 44.5475, X = 8.9680, C = '#06b6d4';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  const st = { folders: [{ id: 'f1', name: 'Т', color: '#3b82f6' }], markers: [],
    lines: [{ id: 'L1', folderId: 'f1', name: 'Линия 1', color: '#ef4444', plan: true, createdAt: 1, points: [[Y + 0.0006, X], [Y - 0.0006, X]],
      layers: [{ id: 'A', type: 'custom', name: 'Траншея', color: C, points: [[Y + 0.0006, X], [Y - 0.0006, X]] },
        { id: 'B', type: 'cable', name: 'Кабель', fibers: 48, color: '#22c55e', points: [[Y + 0.0006, X], [Y, X]] }] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true };
  await p.evaluate((s) => localStorage.setItem('fieldmap_proto_v1', JSON.stringify(s)), st);
  await p.reload(); await p.waitForTimeout(3000);
  await p.touchscreen.tap(200, 400 - 60); await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('lpTab').click()); await p.waitForTimeout(600);
  const state = () => p.evaluate(() => ({ sel: [...document.querySelectorAll('#layerPanel .lp-row')].map((r) => r.classList.contains('sel')).join(','), sheet: !document.getElementById('sheet').classList.contains('hidden') }));
  const box = async (i) => p.evaluate((i) => { const r = document.querySelectorAll('#layerPanel .lp-row')[i].getBoundingClientRect(); return [r.x + 40, r.y + r.height / 2]; }, i);
  const [x, y] = await box(1);
  await p.touchscreen.tap(x, y); await p.waitForTimeout(400);
  console.log('tap row 2:', JSON.stringify(await state()));
  const [x2, y2] = await box(1);
  await p.touchscreen.tap(x2, y2); await p.waitForTimeout(400);
  console.log('tap again:', JSON.stringify(await state()));
  await p.evaluate(() => { window.__tv = []; const r = document.querySelectorAll('#layerPanel .lp-row')[0]; ['pointerdown','pointerup','pointercancel','pointerleave','pointermove','click','contextmenu','touchstart','touchend'].forEach((t) => r.addEventListener(t, () => window.__tv.push(t))); });
  const cdp = await ctx.newCDPSession(p);
  const [x3, y3] = await box(0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x3, y: y3, id: 0 }] });
  await p.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(500);
  console.log('hold row 1:', JSON.stringify(await state()), await p.evaluate(() => window.__tv.join(',')));
  await p.evaluate(() => { window.__ev = []; const r = document.querySelectorAll('#layerPanel .lp-row')[1]; ['pointerdown','pointerup','pointercancel','pointerleave','click'].forEach((t) => r.addEventListener(t, () => window.__ev.push(t))); });
  const [x4, y4] = await box(1);
  await p.mouse.move(x4, y4); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(400);
  console.log('mouse hold row 2:', JSON.stringify(await state()), await p.evaluate(() => window.__ev.join(',')));
  await p.screenshot({ path: process.argv[3] + '/hold.png' });
  await b.close();
})();
