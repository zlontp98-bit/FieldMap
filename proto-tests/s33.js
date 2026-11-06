// кабель через развилку: передумал у развилки (другая ветка), вернулся назад, «Отменить» через развилку,
// продолжение кабеля через вторую развилку — всё время один слой, бобина у начала
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const Y = 44.5475, X = 8.9680;
const J = [Y + 0.0006, X];
const st = {
  folders: [{ id: 'f1', name: 'Сеть', color: '#3b82f6' }],
  markers: [
    { id: 'M', folderId: 'f1', name: 'M', shape: 'muffolaLinea', color: '#22c55e', lat: Y, lng: X, createdAt: 1 },
    { id: 'K', folderId: 'f1', name: 'K', shape: 'pozzetto60', color: '#22c55e', lat: J[0], lng: J[1], createdAt: 1 },
    { id: 'P', folderId: 'f1', name: 'P', shape: 'pozzetto60', color: '#22c55e', lat: J[0], lng: X + 0.0006, createdAt: 1 },
    { id: 'Q', folderId: 'f1', name: 'Q', shape: 'interno', color: '#22c55e', lat: J[0] + 0.0006, lng: X, createdAt: 1 },
    { id: 'R', folderId: 'f1', name: 'R', shape: 'interno', color: '#22c55e', lat: J[0], lng: X + 0.0012, createdAt: 1 },
  ],
  lines: [
    { id: 'A', folderId: 'f1', name: 'Линия A', color: '#ef4444', createdAt: 1, points: [[Y, X], J], layers: [] },
    { id: 'B', folderId: 'f1', name: 'Линия B', color: '#ef4444', createdAt: 2, points: [J, [J[0], X + 0.0006]], layers: [] },
    { id: 'C', folderId: 'f1', name: 'Линия C', color: '#ef4444', createdAt: 3, points: [J, [J[0] + 0.0006, X]], layers: [] },
    { id: 'D', folderId: 'f1', name: 'Линия D', color: '#ef4444', createdAt: 4, points: [[J[0], X + 0.0006], [J[0], X + 0.0012]], layers: [] },
  ],
  reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true,
};
const hav = (a, b) => { const R = 6371008.8, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t; const q = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };
const plen = (P) => P.reduce((t, p, i) => t + (i ? hav(P[i - 1], p) : 0), 0);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  const cdp = await ctx.newCDPSession(p);
  const mpp = 40075016.686 * Math.cos(Y * Math.PI / 180) / (256 * Math.pow(2, 18));
  const kx = 111320 * Math.cos(Y * Math.PI / 180) / mpp, ky = 110574 / mpp;
  const up = 0.0006 * ky, east = 0.0006 * kx;
  const drag = async (dx, dy, x0 = 120, y0 = 600) => {
    const n = 24;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 0 }] });
    for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / n, y: y0 + dy * i / n, id: 0 }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(250);
  };
  // палец двигает карту только после 8 px — добавляем их, чтобы прицел ушёл ровно на dx, dy
  const move = async (dx, dy) => { const d = Math.hypot(dx, dy) || 1; await drag(dx + dx / d * 9.8, dy + dy / d * 9.8); };
  const hold = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
    await p.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(500);
  };
  const dump = async (tag) => {
    const s2 = await p.evaluate((K) => JSON.parse(localStorage.getItem(K)), KEY);
    console.log(tag, s2.lines.filter((l) => (l.layers || []).length).map((l) => `${l.id}[${(l.layers || []).map((x) => `s=${(x.s || []).map((v) => v.toFixed(1)).join('→')} via=${JSON.stringify((x.via || []).map((v) => [v.line, v.s.map((q) => +q.toFixed(1))]))} len=${plen(x.points).toFixed(1)} done=${x.done}`).join(' ; ')}]`).join('  ') || '(пусто)');
    return s2;
  };
  const top = () => p.textContent('#modeTopText');
  const reset = async () => {
    await p.evaluate(([K, s]) => localStorage.setItem(K, JSON.stringify(s)), [KEY, st]);
    await p.reload(); await p.waitForTimeout(2200);
    await p.evaluate(() => document.getElementById('fabReels').click()); await p.waitForTimeout(400);
    await p.evaluate(() => { const c = [...document.querySelectorAll('.sheet .lt-chip')].find((x) => x.textContent.trim() === '24'); if (c) c.click(); });
    await p.evaluate(() => [...document.querySelectorAll('.sheet button')].find((x) => x.textContent.includes('Начать')).click()); await p.waitForTimeout(500);
    await p.evaluate(() => document.getElementById('linePlus').click()); await p.waitForTimeout(300);   // бобина у M
  };
  const toastNow = () => p.evaluate(() => { const t = document.getElementById('toast'); return t.hidden ? '' : t.textContent; });

  // 1) передумал у развилки: на B, сразу же — на C (кусок по B не остаётся)
  await reset();
  await move(0, up / 2); await move(0, up / 2);
  await move(-12, 0);                       // прицел чуть вправо — на линию B
  console.log('1 on B:', await top(), '|', await toastNow());
  await move(12, 0); await move(0, 30);     // назад к колодцу и вверх — на линию C
  console.log('1 on C:', await top(), '|', await toastNow());
  await move(0, 40);
  await p.evaluate(() => document.getElementById('lineDone').click()); await p.waitForTimeout(900);
  await dump('1 saved:');

  // 2) вернулся назад: на B, потом прицел обратно вниз по A
  await reset();
  await move(0, up / 2); await move(0, up / 2);
  await move(-20, 0);
  console.log('2 on B:', await top(), '|', await toastNow());
  await move(20, 0); await move(0, -60);    // к колодцу и вниз по A
  console.log('2 back:', await top(), '|', await toastNow());
  await p.evaluate(() => document.getElementById('lineDone').click()); await p.waitForTimeout(900);
  await dump('2 saved:');

  // 3) «Отменить» сразу после развилки: снова на A, прицел ещё на B — назад на B не прыгает
  await reset();
  await move(0, up / 2); await move(0, up / 2);
  await move(-30, 0);
  console.log('3 on B:', await top());
  await p.evaluate(() => document.getElementById('lineUndo').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById('lineUndo').click()); await p.waitForTimeout(300);   // первое — точка ＋ на B? нет: на B только начало
  console.log('3 after undo:', await top());
  await move(-20, 0);                       // прицел дальше по B — не перескакивает
  console.log('3 still:', await top());
  await p.screenshot({ path: out + '/undo.png' });
  await p.evaluate(() => document.getElementById('lineDone').click()); await p.waitForTimeout(900);
  await dump('3 saved:');

  // 4) сохранить без «Завершить» (бобина стоит у M), потом «Продолжить слой» — дальше через вторую развилку P на D
  await reset();
  await move(0, up / 2); await move(0, up / 2);
  await move(-east / 2, 0); await move(-east / 2 - 4, 0);   // по B до P
  console.log('4 at P:', await top());
  await p.evaluate(() => document.getElementById('lineSave').click()); await p.waitForTimeout(900);
  await dump('4 saved:');
  await p.screenshot({ path: out + '/parked.png' });
  await p.evaluate(() => document.getElementById('lpTab').click()); await p.waitForTimeout(500);
  const rb = await p.evaluate(() => { const r = document.querySelector('#layerPanel .lp-row'); if (!r) return null; const q = r.getBoundingClientRect(); return [q.x + 40, q.y + q.height / 2]; });
  await hold(rb[0], rb[1]);
  await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((x) => x.textContent === 'Продолжить слой').click()); await p.waitForTimeout(900);
  console.log('4 continue:', await top());
  await move(-east / 2, 0);
  console.log('4 on D:', await top(), '|', await toastNow());
  await p.screenshot({ path: out + '/cont.png' });
  await p.evaluate(() => document.getElementById('lineDone').click()); await p.waitForTimeout(900);
  await dump('4 saved:');
  await b.close();
})();
