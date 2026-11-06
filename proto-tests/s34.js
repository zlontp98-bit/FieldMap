// кабель через развилку: проект через развилку («Выполнено целиком», закрытие), старые куски с cableId склеиваются,
// удаление линии обрезает кабель, продление линии от начала не сдвигает слои, схема с муфтой на развилке (запас / транзит)
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const Y = 44.5475, X = 8.9680;
const J = [Y + 0.0006, X], Pp = [J[0], X + 0.0006];
const base = { reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true, viaV1: true };
const fold = [{ id: 'f1', name: 'Сеть', color: '#3b82f6' }];
const mk = (id, shape, lat, lng, o) => Object.assign({ id, folderId: 'f1', name: id, shape, color: '#22c55e', lat, lng, createdAt: 1 }, o || {});
const ln = (id, pts, layers) => ({ id, folderId: 'f1', name: 'Линия ' + id, color: '#ef4444', plan: true, createdAt: 1, points: pts, layers: layers || [] });
const hav = (a, b) => { const R = 6371008.8, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t; const q = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };
const plen = (P) => P.reduce((t, p, i) => t + (i ? hav(P[i - 1], p) : 0), 0);
const LA = hav([Y, X], J), LB = hav(J, Pp);
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
  const scr = (lat, lng) => [200 + (lng - X) * kx, 400 - (lat - Y) * ky];   // карта не двигалась: центр — Y, X
  const load = async (st) => { await p.evaluate(([K, s]) => localStorage.setItem(K, JSON.stringify(s)), [KEY, st]); await p.reload(); await p.waitForTimeout(2200); };
  const data = () => p.evaluate((K) => JSON.parse(localStorage.getItem(K)), KEY);
  const show = (s2) => s2.lines.filter((l) => (l.layers || []).length).map((l) => `${l.id}[${l.layers.map((x) => `${x.plan ? 'план' : 'вып'} s=${(x.s || []).map((v) => v.toFixed(1)).join('→')} via=${JSON.stringify((x.via || []).map((v) => [v.line, v.s.map((q) => +q.toFixed(1))]))} len=${plen(x.points).toFixed(1)}${x.cableId ? ' cid' : ''}`).join(' ; ')}]`).join('  ') || '(пусто)';
  const hold = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
    await p.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(500);
  };
  const panelOf = async (lat, lng) => {
    const [x, y] = scr(lat, lng);
    await p.touchscreen.tap(x, y); await p.waitForTimeout(600);
    await p.evaluate(() => { const t = document.getElementById('lpTab'); if (t && !t.hidden) t.click(); }); await p.waitForTimeout(500);
    return p.evaluate(() => [...document.querySelectorAll('#layerPanel .lp-row')].map((r) => r.textContent).join(' || '));
  };
  const rowAction = async (i, label) => {
    const rb = await p.evaluate((i) => { const r = document.querySelectorAll('#layerPanel .lp-row')[i]; if (!r) return null; const q = r.getBoundingClientRect(); return [q.x + 40, q.y + q.height / 2]; }, i);
    await hold(rb[0], rb[1]);
    const btns = await p.evaluate(() => [...document.querySelectorAll('#sheet button')].map((x) => x.textContent).join(' | '));
    if (label) await p.evaluate((t) => [...document.querySelectorAll('#sheet button')].find((x) => x.textContent === t).click(), label);
    await p.waitForTimeout(600);
    return btns;
  };
  const viaCab = (o) => Object.assign({ id: 'cv', type: 'cable', name: 'Кабель', fibers: 24, color: '#22c55e', s: [0, LA], via: [{ line: 'B', s: [0, LB] }], points: [[Y, X], J, Pp], createdAt: 5 }, o || {});
  const net = (layersA, markersExtra) => Object.assign({}, base, { folders: fold,
    markers: [mk('M', 'muffolaLinea', Y, X), mk('K', 'pozzetto60', J[0], J[1]), mk('P', 'interno', Pp[0], Pp[1])].concat(markersExtra || []),
    lines: [ln('A', [[Y, X], J], layersA), ln('B', [J, Pp])] });

  // 1) проект через развилку: на линии B он в списке; «Выполнено целиком» — один выполненный кабель через развилку, проект закрыт
  await load(net([viaCab({ id: 'pv', plan: true, color: '#ef4444' })]));
  console.log('1 panel B:', await panelOf(J[0], X + 0.0003));
  console.log('1 actions:', await rowAction(0, 'Выполнено целиком'));
  console.log('1 data:', show(await data()));
  console.log('1 panel B after:', await panelOf(J[0], X + 0.0003));

  // 2) проект через развилку, выполнено только по A: осталось — кусок по B
  await load(net([viaCab({ id: 'pv', plan: true, color: '#ef4444' }), { id: 'dA', type: 'cable', name: 'Кабель', fibers: 24, color: '#22c55e', s: [0, LA], points: [[Y, X], J], createdAt: 6, done: true }]));
  console.log('2 panel A:', await panelOf(Y + 0.0003, X));

  // 3) старые куски с общим cableId — склеиваются в один слой
  await load(Object.assign(net([{ id: 'p1', type: 'cable', name: 'Кабель', fibers: 24, color: '#22c55e', s: [0, LA], points: [[Y, X], J], cableId: 'c1', createdAt: 10, done: true, slack: { M: 20 } }]), { viaV1: false }));
  await p.evaluate((K) => { const s = JSON.parse(localStorage.getItem(K)); return s; }, KEY);
  {
    const st = net([{ id: 'p1', type: 'cable', name: 'Кабель', fibers: 24, color: '#22c55e', s: [0, LA], points: [[Y, X], J], cableId: 'c1', createdAt: 10, done: true, slack: { M: 20 } }]);
    st.viaV1 = false;
    st.lines[1].layers = [{ id: 'p2', type: 'cable', name: 'Кабель', fibers: 24, color: '#22c55e', s: [0, LB], points: [J, Pp], cableId: 'c1', createdAt: 20, done: false, slack: { P: 5 } }];
    await load(st);
    const s2 = await data();
    console.log('3 merged:', show(s2), '| slack', JSON.stringify(s2.lines[0].layers[0] && s2.lines[0].layers[0].slack), 'done', s2.lines[0].layers[0] && s2.lines[0].layers[0].done);
  }

  // 4) удалили линию B — кабель кончается у развилки
  await load(net([viaCab()]));
  {
    const [x, y] = scr(J[0], X + 0.0003);
    await p.touchscreen.tap(x, y); await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelector('#mSheet .tb-item[aria-label="Удалить"]').click()); await p.waitForTimeout(400);
    await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((x) => x.textContent === 'Удалить').click()); await p.waitForTimeout(400);
    console.log('4 after deleting B:', show(await data()), '| lines', (await data()).lines.map((l) => l.id).join(','));
  }

  // 5) схема: муфта на развилке. Без запаса — транзит (M–P), с запасом у муфты — M–K и K–P
  for (const slack of [null, { K: 15 }]) {
    const st = net([viaCab(slack ? { slack } : {})]);
    st.markers[1] = mk('K', 'muffolaLinea', J[0], J[1]);
    await load(st);
    await p.evaluate(() => document.getElementById('btnMenu').click()); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('#drawer .fschema').click()); await p.waitForTimeout(700);
    console.log('5 schema', slack ? 'с запасом у K:' : 'без запаса:', await p.evaluate(() => [...document.querySelectorAll('#schema .schema-body svg > text')].map((t) => t.textContent).join(' | ')),
      '| nodes:', await p.evaluate(() => [...document.querySelectorAll('#schema [data-mid]')].map((g) => g.textContent).join(',')));
    // карточка муфты K
    await p.evaluate(() => document.querySelector('#schema .schema-head button').click()); await p.waitForTimeout(300);
    const [x, y] = scr(J[0], J[1]);
    await p.touchscreen.tap(x, y); await p.waitForTimeout(600);
    console.log('5 card K:', await p.evaluate(() => [...document.querySelectorAll('#mSheet .tb-cable')].map((r) => r.textContent).join(' || ')));
    await p.evaluate(() => { const x = document.querySelector('#mSheet [aria-label="Закрыть"]'); if (x) x.click(); }); await p.waitForTimeout(300);
  }

  // 6) продлили линию от её начала (линия без маркеров на концах): слой на ней остаётся на месте
  {
    const Z1 = [Y - 0.0006, X], Z2 = [Y - 0.0006, X + 0.0010];
    const LE = hav(Z1, Z2), cum = (q) => q;   // E идёт с запада на восток
    const st = Object.assign({}, base, { workMode: 'plan', folders: fold, markers: [],
      lines: [ln('E', [Z1, Z2], [{ id: 'e1', type: 'cable', name: 'Кабель', fibers: 12, color: '#22c55e', s: [10, 40], points: [[Z1[0], X + 10 / LE * 0.0010], [Z1[0], X + 40 / LE * 0.0010]], createdAt: 1 }])] });
    await load(st);
    // прицел на западный конец E (на 0,0006° южнее центра)
    const dy = 0.0006 * ky;
    const n = 24, x0 = 200, y0 = 500;
    const drag = async (dx, dy2) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 0 }] });
      for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / n, y: y0 + dy2 * i / n, id: 0 }] }); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await p.waitForTimeout(250);
    };
    await drag(0, -(dy + 9.8));
    await p.evaluate(() => document.getElementById('fabLine').click()); await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('linePlus').click()); await p.waitForTimeout(300);
    await drag(20 / mpp + 9.8, 0);   // прицел на 20 м западнее
    await p.evaluate(() => document.getElementById('linePlus').click()); await p.waitForTimeout(300);
    await p.evaluate(() => document.getElementById('lineSave').click()); await p.waitForTimeout(600);
    const s2 = await data(), E = s2.lines.find((l) => l.id === 'E'), ly = E.layers[0];
    // где слой на линии по своим s — должен совпасть с его точками
    const cumE = [0]; for (let i = 1; i < E.points.length; i++) cumE.push(cumE[i - 1] + hav(E.points[i - 1], E.points[i]));
    const at = (s) => { for (let i = 0; i < E.points.length - 1; i++) if (s <= cumE[i + 1] || i === E.points.length - 2) { const t = (s - cumE[i]) / (cumE[i + 1] - cumE[i]); return [E.points[i][0] + (E.points[i + 1][0] - E.points[i][0]) * t, E.points[i][1] + (E.points[i + 1][1] - E.points[i][1]) * t]; } };
    console.log('6 line E:', E.points.length, 'pts, len', cumE[cumE.length - 1].toFixed(1), '| s', ly.s.map((v) => v.toFixed(1)).join('→'),
      '| shift', hav(at(ly.s[0]), ly.points[0]).toFixed(2), hav(at(ly.s[1]), ly.points[ly.points.length - 1]).toFixed(2), 'm');
  }
  await b.close();
})();
