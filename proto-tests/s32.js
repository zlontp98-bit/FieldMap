// кабель через развилку — ОДИН слой: тянем по линии A до колодца K, уводим прицел на линию B — кабель идёт дальше по ней,
// бобина остаётся у муфты M; в списке слоёв B — тот же кабель одной строкой; удаляется целиком
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const Y = 44.5475, X = 8.9680;   // центр карты при открытии
const J = [Y + 0.0006, X];        // развилка (колодец)
const st = {
  folders: [{ id: 'f1', name: 'Сеть', color: '#3b82f6' }],
  markers: [
    { id: 'M', folderId: 'f1', name: 'M', shape: 'muffolaLinea', color: '#22c55e', lat: Y, lng: X, createdAt: 1 },
    { id: 'K', folderId: 'f1', name: 'K', shape: 'pozzetto60', color: '#22c55e', lat: J[0], lng: J[1], createdAt: 1 },
    { id: 'P', folderId: 'f1', name: 'P', shape: 'interno', color: '#22c55e', lat: J[0], lng: X + 0.0006, createdAt: 1 },
    { id: 'Q', folderId: 'f1', name: 'Q', shape: 'interno', color: '#22c55e', lat: J[0] + 0.0006, lng: X, createdAt: 1 },
  ],
  lines: [
    { id: 'A', folderId: 'f1', name: 'Линия A', color: '#ef4444', createdAt: 1, points: [[Y, X], J], layers: [] },
    { id: 'B', folderId: 'f1', name: 'Линия B', color: '#ef4444', createdAt: 2, points: [J, [J[0], X + 0.0006]], layers: [] },
    { id: 'C', folderId: 'f1', name: 'Линия C', color: '#ef4444', createdAt: 3, points: [J, [J[0] + 0.0006, X]], layers: [] },
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
  await p.evaluate(([K, s]) => localStorage.setItem(K, JSON.stringify(s)), [KEY, st]);
  await p.reload(); await p.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(p);
  const mpp = 40075016.686 * Math.cos(Y * Math.PI / 180) / (256 * Math.pow(2, 18));
  const kx = 111320 * Math.cos(Y * Math.PI / 180) / mpp, ky = 110574 / mpp;
  const C = { lat: Y, lng: X };   // центр карты (следим сами: карта двигается ровно за пальцем)
  const scr = (lat, lng) => [200 + (lng - C.lng) * kx, 400 - (lat - C.lat) * ky];
  const drag = async (dx, dy, x0 = 120, y0 = 600) => {
    const n = 24;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 0 }] });
    for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / n, y: y0 + dy * i / n, id: 0 }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(250);
    // карта начинает двигаться, когда палец ушёл дальше 8 px: первые шаги пропадают
    const step = Math.hypot(dx, dy) / n;
    let i0 = 1; while (i0 <= n && i0 * step <= 8) i0++;
    const k = i0 > n ? 0 : (n - i0 + 1) / n;
    C.lng -= dx * k / kx; C.lat += dy * k / ky;
  };
  const hold = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
    await p.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(500);
  };
  const dump = async (tag) => {
    const s2 = await p.evaluate((K) => JSON.parse(localStorage.getItem(K)), KEY);
    console.log(tag, s2.lines.map((l) => `${l.id}[${(l.layers || []).map((x) => `${x.name} ${x.fibers || ''} s=${(x.s || []).map((v) => v.toFixed(1)).join('→')} via=${JSON.stringify((x.via || []).map((v) => [v.line, v.s.map((q) => +q.toFixed(1))]))} len=${plen(x.points).toFixed(1)} done=${x.done}`).join(' ; ')}]`).join('  '));
    return s2;
  };
  // новый кабель 24 волокна
  await p.evaluate(() => document.getElementById('fabReels').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const c = [...document.querySelectorAll('.sheet .lt-chip')].find((x) => x.textContent.trim() === '24'); if (c) c.click(); });
  await p.evaluate(() => [...document.querySelectorAll('.sheet button')].find((x) => x.textContent.includes('Начать')).click()); await p.waitForTimeout(500);
  // бобина у муфты M (центр экрана)
  await p.evaluate(() => document.getElementById('linePlus').click()); await p.waitForTimeout(300);
  const up = 0.0006 * 110574 / mpp;          // до развилки, px
  const east = 0.0006 * 111320 * Math.cos(Y * Math.PI / 180) / mpp;
  await drag(0, up / 2); await drag(0, up / 2 + 2);   // палец вниз — прицел вверх по линии A до колодца
  console.log('at junction:', await p.textContent('#modeTopText'));
  await drag(-east * 0.5, 0); await drag(-east * 0.75, 0);   // палец влево — прицел вправо по линии B до PTE
  console.log('after hop:', await p.textContent('#modeTopText'), '| toast:', await p.textContent('#toast'));
  console.log('M on screen at', scr(Y, X).map(Math.round).join(','), '| K at', scr(J[0], J[1]).map(Math.round).join(','));
  await p.screenshot({ path: out + '/hop.png' });
  await p.evaluate(() => document.getElementById('lineDone').click()); await p.waitForTimeout(1200);
  await dump('saved:');
  // панель линии B (её держим после сохранения): кабель там одной строкой
  console.log('tab:', await p.evaluate(() => { const t = document.getElementById('lpTab'); return t && !t.hidden ? t.textContent : '-'; }));
  await p.evaluate(() => document.getElementById('lpTab').click()); await p.waitForTimeout(500);
  console.log('panel B:', await p.evaluate(() => [...document.querySelectorAll('#layerPanel .lp-row')].map((r) => r.textContent).join(' || ')));
  await p.screenshot({ path: out + '/panelB.png' });
  // карточка колодца K: кабель одной строкой, транзитом
  const [kx0, ky0] = scr(J[0], J[1]);
  await p.touchscreen.tap(kx0, ky0); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/cardK.png' });
  console.log('K sheet:', await p.evaluate(() => { const t = document.querySelector('#mSheet .tb-ttl'); return !document.getElementById('mSheet').classList.contains('hidden') && t ? t.textContent : '-'; }));
  console.log('K card:', await p.evaluate(() => [...document.querySelectorAll('#mSheet .tb-cable')].map((r) => r.textContent).join(' || ')));
  await p.evaluate(() => { const x = document.querySelector('#mSheet [aria-label="Закрыть"]'); if (x) x.click(); }); await p.waitForTimeout(300);
  // схема: M и P соединены одним кабелем через колодец
  await p.evaluate(() => document.getElementById('btnMenu').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#drawer .fschema').click()); await p.waitForTimeout(700);
  console.log('schema:', await p.evaluate(() => [...document.querySelectorAll('#schema .schema-body svg > text')].map((t) => t.textContent).join(' | ')),
    '| nodes:', await p.evaluate(() => [...document.querySelectorAll('#schema [data-mid]')].map((g) => g.textContent).join(',')));
  await p.evaluate(() => document.querySelector('#schema .schema-head button').click()); await p.waitForTimeout(300);
  // нажали на линию B, зажали строку кабеля — «Удалить слой»: кабель удаляется целиком (и с линии A)
  const [bx, by] = scr(J[0], X + 0.0003);
  await p.touchscreen.tap(bx, by); await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('lpTab').click()); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/tapB.png' });
  const rb = await p.evaluate(() => { const r = document.querySelector('#layerPanel .lp-row'); if (!r) return null; const q = r.getBoundingClientRect(); return [q.x + 40, q.y + q.height / 2]; });
  if (rb) {
    await hold(rb[0], rb[1]);
    console.log('actions:', await p.evaluate(() => [...document.querySelectorAll('#sheet button')].map((x) => x.textContent).join(' | ')));
    await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((x) => x.textContent === 'Удалить слой').click()); await p.waitForTimeout(400);
    await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((x) => x.textContent === 'Удалить').click()); await p.waitForTimeout(400);
    await dump('after delete:');
  } else console.log('no row on B');
  await b.close();
})();
