// кабель через развилку: запас у колодца на развилке остаётся, отмена ✕✕ сматывает кабель через развилку к бобине,
// «Тянуть по проекту» с линии B у проекта через развилку
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const Y = 44.5475, X = 8.9680;
const J = [Y + 0.0006, X], Pp = [J[0], X + 0.0006];
const hav = (a, b) => { const R = 6371008.8, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t; const q = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };
const plen = (P) => P.reduce((t, p, i) => t + (i ? hav(P[i - 1], p) : 0), 0);
const st = (layersA, extra) => Object.assign({
  folders: [{ id: 'f1', name: 'Сеть', color: '#3b82f6' }],
  markers: [
    { id: 'M', folderId: 'f1', name: 'M', shape: 'muffolaLinea', color: '#22c55e', lat: Y, lng: X, createdAt: 1 },
    { id: 'K', folderId: 'f1', name: 'K', shape: 'pozzetto60', color: '#22c55e', lat: J[0], lng: J[1], createdAt: 1 },
    { id: 'P', folderId: 'f1', name: 'P', shape: 'interno', color: '#22c55e', lat: Pp[0], lng: Pp[1], createdAt: 1 },
  ],
  lines: [
    { id: 'A', folderId: 'f1', name: 'Линия A', color: '#ef4444', createdAt: 1, points: [[Y, X], J], layers: layersA || [] },
    { id: 'B', folderId: 'f1', name: 'Линия B', color: '#ef4444', createdAt: 2, points: [J, Pp], layers: [] },
  ],
  reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true, viaV1: true,
}, extra || {});
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
  const move = async (dx, dy) => { const d = Math.hypot(dx, dy) || 1; await drag(dx + dx / d * 9.8, dy + dy / d * 9.8); };
  const load = async (s) => { await p.evaluate(([K, v]) => localStorage.setItem(K, JSON.stringify(v)), [KEY, s]); await p.reload(); await p.waitForTimeout(2200); };
  const data = () => p.evaluate((K) => JSON.parse(localStorage.getItem(K)), KEY);
  const startCable = async () => {
    await p.evaluate(() => document.getElementById('fabReels').click()); await p.waitForTimeout(400);
    await p.evaluate(() => { const c = [...document.querySelectorAll('.sheet .lt-chip')].find((x) => x.textContent.trim() === '24'); if (c) c.click(); });
    await p.evaluate(() => [...document.querySelectorAll('.sheet button')].find((x) => x.textContent.includes('Начать')).click()); await p.waitForTimeout(500);
    await p.evaluate(() => document.getElementById('linePlus').click()); await p.waitForTimeout(300);
  };

  // 1) запас у колодца K (на развилке), потом дальше по B — запас остаётся
  await load(st());
  await startCable();
  await move(0, up / 2); await move(0, up / 2);
  console.log('1 slack btn:', await p.evaluate(() => { const b = document.getElementById('lineSlack'); return b.hidden ? '-' : b.textContent; }));
  await p.evaluate(() => document.getElementById('lineSlack').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const c = [...document.querySelectorAll('#sheet button')].find((x) => x.textContent.trim().startsWith('20')); if (c) c.click(); }); await p.waitForTimeout(400);
  console.log('1 top:', await p.textContent('#modeTopText'));
  await move(-east / 2, 0); await move(-east / 2, 0);
  console.log('1 on B:', await p.textContent('#modeTopText'));
  await p.screenshot({ path: out + '/slackK.png' });
  await p.evaluate(() => document.getElementById('lineDone').click()); await p.waitForTimeout(900);
  const s1 = await data();
  console.log('1 saved:', JSON.stringify(s1.lines[0].layers.map((x) => ({ via: (x.via || []).map((v) => v.line), slack: x.slack, len: +plen(x.points).toFixed(1) }))));

  // 2) отмена ✕✕: кабель через развилку сматывается обратно к бобине, ничего не сохраняется
  await load(st());
  await startCable();
  await move(0, up / 2); await move(0, up / 2);
  await move(-east / 2, 0); await move(-east / 2, 0);
  await p.evaluate(() => { document.getElementById('lineCancel').click(); document.getElementById('lineCancel').click(); });
  await p.waitForTimeout(240);
  await p.screenshot({ path: out + '/cancel.png' });
  await p.waitForTimeout(900);
  console.log('2 after cancel:', JSON.stringify((await data()).lines.map((l) => (l.layers || []).length)));

  // 3) проект через развилку: «Тянуть по проекту» с линии B
  const LA = hav([Y, X], J), LB = hav(J, Pp);
  await load(st([{ id: 'pv', type: 'cable', name: 'Кабель', fibers: 24, color: '#ef4444', plan: true, s: [0, LA], via: [{ line: 'B', s: [0, LB] }], points: [[Y, X], J, Pp], createdAt: 5 }]));
  const [bx, by] = [200 + 0.0003 * kx, 400 - 0.0006 * ky];
  await p.touchscreen.tap(bx, by); await p.waitForTimeout(600);
  await p.evaluate(() => { const t = document.getElementById('lpTab'); if (t && !t.hidden) t.click(); }); await p.waitForTimeout(500);
  const rb = await p.evaluate(() => { const r = document.querySelector('#layerPanel .lp-row'); if (!r) return null; const q = r.getBoundingClientRect(); return [q.x + 40, q.y + q.height / 2]; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rb[0], y: rb[1], id: 0 }] });
  await p.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(500);
  await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((x) => x.textContent === 'Тянуть по проекту').click()); await p.waitForTimeout(600);
  console.log('3 sheet:', await p.evaluate(() => { const h3 = document.querySelector('#sheet h3'); return h3 ? h3.textContent : '-'; }));
  await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((x) => x.textContent.includes('Начать')).click()); await p.waitForTimeout(900);
  console.log('3 top:', await p.textContent('#modeTopText'));
  await p.screenshot({ path: out + '/pullplan.png' });
  await b.close();
})();
