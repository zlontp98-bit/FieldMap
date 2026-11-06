// рисование линии: первая точка ＋ на маркере, где кончается Линия 1, — Линия 1 продолжается (не новая линия);
// от начала линии — кабель на ней остаётся на месте; у маркера кончаются две линии — как раньше, новая линия;
// маркер в середине линии — как раньше, новая линия; в карточке маркера кнопки «Продолжить» нет
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const Y = 44.5475, X = 8.9680, S1 = [Y - 0.0006, X], S2 = [Y, X];
const hav = (a, b) => { const R = 6371008.8, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t; const q = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };
const mk = (id, p) => ({ id, folderId: 'f1', name: id, shape: 'muffolaLinea', color: '#ef4444', plan: true, lat: p[0], lng: p[1], createdAt: 1 });
const at = (pts, s) => { let acc = 0; for (let i = 0; i < pts.length - 1; i++) { const d = hav(pts[i], pts[i + 1]); if (s <= acc + d || i === pts.length - 2) { const t = (s - acc) / d; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; } acc += d; } };
const line = (id, name, pts, layers) => ({ id, folderId: 'f1', name, color: '#ef4444', plan: true, createdAt: 1, points: pts, layers: layers || [] });
const cab = (pts) => [{ id: 'c', type: 'cable', name: 'Кабель', fibers: 24, color: '#22c55e', s: [10, 40], points: [at(pts, 10), at(pts, 40)], createdAt: 2 }];
const state = (lines) => ({ folders: [{ id: 'f1', name: 'Оу', color: '#3b82f6' }], markers: [mk('1', S1), mk('2', S2)], lines,
  reels: [], activeFolderId: 'f1', view: {}, workMode: 'plan', planRedV1: true, planRedV2: true, stageV1: true, viaV1: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  const cdp = await ctx.newCDPSession(p);
  const mpp = 40075016.686 * Math.cos(Y * Math.PI / 180) / (256 * Math.pow(2, 18));
  const drag = async (dx, dy, x0 = 200, y0 = 500) => {
    const n = 24;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 0 }] });
    for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / n, y: y0 + dy * i / n, id: 0 }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(250);
  };
  const load = async (st) => { await p.evaluate(([K, s]) => localStorage.setItem(K, JSON.stringify(s)), [KEY, st]); await p.reload(); await p.waitForTimeout(2200); };
  const data = () => p.evaluate((K) => JSON.parse(localStorage.getItem(K)), KEY);
  const toastNow = () => p.evaluate(() => { const t = document.getElementById('toast'); return t.hidden ? '' : t.textContent; });
  // режим линии: прицел на маркере 2 (центр экрана) — ＋, потом на 30 м севернее — ＋, сохранить
  const draw = async (shot) => {
    await p.evaluate(() => document.getElementById('fabLine').click()); await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('linePlus').click()); await p.waitForTimeout(300);
    console.log('  ＋ на маркере 2:', await p.textContent('#modeTopText'), '| toast:', await toastNow());
    await drag(0, 30 / mpp + 9.8);
    await p.evaluate(() => document.getElementById('linePlus').click()); await p.waitForTimeout(300);
    console.log('  ещё ＋:', await p.textContent('#modeTopText'));
    if (shot) await p.screenshot({ path: out + '/' + shot });
    await p.evaluate(() => document.getElementById('lineSave').click()); await p.waitForTimeout(700);
    const s2 = await data();
    s2.lines.forEach((l) => {
      let len = 0; for (let i = 1; i < l.points.length; i++) len += hav(l.points[i - 1], l.points[i]);
      const ly = (l.layers || [])[0];
      console.log(`  ${l.name}: точек ${l.points.length}, ${len.toFixed(1)} м` + (ly ? ` | кабель s ${ly.s.map((v) => v.toFixed(1)).join('→')}, сдвиг ${hav(at(l.points, ly.s[0]), ly.points[0]).toFixed(2)} и ${hav(at(l.points, ly.s[1]), ly.points[1]).toFixed(2)} м` : ''));
    });
  };
  console.log('A) маркер 2 — конец Линии 1:');
  await load(state([line('L1', 'Линия 1', [S1, S2], cab([S1, S2]))]));
  await draw('extendA.png');
  console.log('B) маркер 2 — начало Линии 1:');
  await load(state([line('L1', 'Линия 1', [S2, S1], cab([S2, S1]))]));
  await draw();
  console.log('C) у маркера 2 кончаются две линии — как раньше, новая линия:');
  await load(state([line('L1', 'Линия 1', [S1, S2]), line('L2', 'Линия 2', [S2, [Y, X + 0.0006]])]));
  await draw();
  console.log('D) маркер 2 в середине линии — как раньше, новая линия:');
  await load(state([line('L1', 'Линия 1', [S1, [Y + 0.0006, X]])]));
  await draw();
  console.log('E) карточка маркера 2 (конец Линии 1):');
  await load(state([line('L1', 'Линия 1', [S1, S2])]));
  await p.touchscreen.tap(200, 400); await p.waitForTimeout(600);
  console.log('  кнопки в карточке:', await p.evaluate(() => [...document.querySelectorAll('#mSheet .tb-head button')].map((x) => x.textContent || '(камера)').join(' | ')));
  await b.close();
})();
