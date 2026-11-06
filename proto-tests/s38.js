// авто-цвет по режиму: в «Проекте» новое красное, в «Выполнении» — зелёное; отмеченное выполненным — зелёное;
// смена этапа в настройках маркера/линии/слоя меняет красный ↔ зелёный; выполненное по проекту — зелёное;
// выключатель в настройках: без него цвета как раньше
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const Y = 44.5475, X = 8.9680;
const RED = '#ef4444', GREEN = '#22c55e';
const hav = (a, b) => { const R = 6371008.8, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t; const q = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };
const base = (extra) => Object.assign({ folders: [{ id: 'f1', name: 'Оу', color: '#3b82f6' }], markers: [], lines: [],
  reels: [], activeFolderId: 'f1', view: {}, workMode: 'plan', planRedV1: true, planRedV2: true, stageV1: true, viaV1: true }, extra || {});
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
  const click = (sel) => p.evaluate((s) => document.querySelector(s).click(), sel);
  const btn = (text, scope = 'body') => p.evaluate(([t, s]) => { const x = [...document.querySelectorAll(s + ' button')].find((q) => q.textContent.trim() === t); if (!x) return false; x.click(); return true; }, [text, scope]);
  const placeMarker = async () => { await click('#fabAdd'); await p.waitForTimeout(400); await click('#markOk'); await p.waitForTimeout(400); };
  const sheetColor = () => p.evaluate(() => { const s = document.querySelector('#sheet .lt-dots .mk-dot.sel'); return s ? s.style.background : '-'; });
  const newLayerColor = async () => {
    await click('#fabReels'); await p.waitForTimeout(400);
    const c = await sheetColor();
    await p.evaluate(() => document.getElementById('sheet').click()); await p.waitForTimeout(300);
    return c;
  };
  const name = (c) => ({ [RED]: 'красный', [GREEN]: 'зелёный', '#3b82f6': 'синий', '#f97316': 'оранжевый' }[c] || c || 'без цвета (красный)');
  const rgb = (s) => ({ 'rgb(239, 68, 68)': 'красный', 'rgb(34, 197, 94)': 'зелёный', 'rgb(249, 115, 22)': 'оранжевый' }[s] || s);

  // 1) «Проект»: новый маркер, линия, слой — красные
  await load(base());
  await placeMarker();
  await click('#fabLine'); await p.waitForTimeout(400);
  await drag(-60, 0); await p.evaluate(() => document.getElementById('linePlus').click()); await p.waitForTimeout(200);
  await drag(0, 60); await p.evaluate(() => document.getElementById('linePlus').click()); await p.waitForTimeout(200);
  await click('#lineSave'); await p.waitForTimeout(500);
  let s = await data();
  console.log('1 Проект: маркер', name(s.markers[0].color), s.markers[0].plan ? '(проект)' : '', '| линия', name(s.lines[0].color), s.lines[0].plan ? '(проект)' : '', '| новый слой', rgb(await newLayerColor()));
  // 2) переключили на «Выполнение»: новый маркер и слой — зелёные
  await p.evaluate(() => document.querySelector('.wm-btn.wm-done').click()); await p.waitForTimeout(400);
  await drag(-80, -80);
  await placeMarker();
  s = await data();
  console.log('2 Выполнение: маркер', name(s.markers[1].color), s.markers[1].plan ? '(проект)' : '(выполнено)', '| новый слой', rgb(await newLayerColor()));
  // 3) проектный маркер «✓ Отметить выполненным» — становится зелёным
  await load(base({ workMode: 'done', markers: [{ id: 'm1', folderId: 'f1', name: '1', shape: 'muffolaLinea', color: RED, plan: true, lat: Y, lng: X, createdAt: 1 }] }));
  await p.touchscreen.tap(200, 400); await p.waitForTimeout(600);
  await btn('✓ Отметить выполненным'); await p.waitForTimeout(500);
  s = await data();
  console.log('3 Отметили выполненным:', name(s.markers[0].color), s.markers[0].plan ? '(проект)' : '(выполнено)');
  // 4) настройки маркера: Выполнено → цвет на странице сам зелёный, сохранили — зелёный; обратно в Проект — красный
  await load(base({ markers: [{ id: 'm1', folderId: 'f1', name: '1', shape: 'muffolaLinea', color: RED, plan: true, lat: Y, lng: X, createdAt: 1 }] }));
  const openMarkerSettings = async () => { await p.touchscreen.tap(200, 400); await p.waitForTimeout(600); await p.evaluate(() => document.querySelector('#mSheet .tb-item[aria-label="Настройки"]').click()); await p.waitForTimeout(500); };
  const pageSw = () => p.evaluate(() => { const x = document.querySelector('#page .sw.sel'); return x ? x.dataset.c : '-'; });
  await openMarkerSettings();
  await btn('Выполнено', '#page'); await p.waitForTimeout(200);
  const sw1 = await pageSw();
  await p.evaluate(() => document.querySelector('#pageHead [aria-label="Сохранить"]').click()); await p.waitForTimeout(400);
  s = await data();
  console.log('4 Маркер → Выполнено: на странице', name(sw1), '| сохранён', name(s.markers[0].color), s.markers[0].plan ? '(проект)' : '(выполнено)');
  await openMarkerSettings();
  await btn('Проект', '#page'); await p.waitForTimeout(200);
  const sw2 = await pageSw();
  await p.evaluate(() => document.querySelector('#pageHead [aria-label="Сохранить"]').click()); await p.waitForTimeout(400);
  s = await data();
  console.log('  Маркер → Проект: на странице', name(sw2), '| сохранён', name(s.markers[0].color), s.markers[0].plan ? '(проект)' : '(выполнено)');
  // 5) настройки слоя: проектный красный кабель → Выполнено — зелёный
  const L = [[Y - 0.0006, X], [Y + 0.0006, X]];
  await load(base({ lines: [{ id: 'L1', folderId: 'f1', name: 'Линия 1', color: RED, plan: true, createdAt: 1, points: L,
    layers: [{ id: 'c1', type: 'cable', name: 'Кабель', fibers: 24, color: RED, plan: true, s: [0, hav(L[0], L[1])], points: L, createdAt: 1 }] }] }));
  await p.touchscreen.tap(200, 340); await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('lpTab').click()); await p.waitForTimeout(500);
  const rb = await p.evaluate(() => { const q = document.querySelector('#layerPanel .lp-row').getBoundingClientRect(); return [q.x + 40, q.y + q.height / 2]; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rb[0], y: rb[1], id: 0 }] }); await p.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500);
  await btn('Настройки', '#sheet'); await p.waitForTimeout(500);
  await btn('Выполнено', '#page'); await p.waitForTimeout(200);
  const lc = await p.evaluate(() => { const x = document.querySelector('#page .lt-dots .mk-dot.sel'); return x ? x.style.background : '-'; });
  await p.evaluate(() => document.querySelector('#pageHead [aria-label="Сохранить"]').click()); await p.waitForTimeout(400);
  s = await data();
  console.log('5 Слой → Выполнено: на странице', rgb(lc), '| сохранён', name(s.lines[0].layers[0].color), s.lines[0].layers[0].plan ? '(проект)' : '(выполнено)');
  // 6) «Выполнено целиком» у красного проектного кабеля — выполненный зелёный
  await load(base({ workMode: 'done', lines: [{ id: 'L1', folderId: 'f1', name: 'Линия 1', color: RED, plan: true, createdAt: 1, points: L,
    layers: [{ id: 'c1', type: 'cable', name: 'Кабель', fibers: 24, color: RED, plan: true, s: [0, hav(L[0], L[1])], points: L, createdAt: 1 }] }] }));
  await p.touchscreen.tap(200, 340); await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('lpTab').click()); await p.waitForTimeout(500);
  const rb2 = await p.evaluate(() => { const q = document.querySelector('#layerPanel .lp-row').getBoundingClientRect(); return [q.x + 40, q.y + q.height / 2]; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rb2[0], y: rb2[1], id: 0 }] }); await p.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500);
  await btn('Выполнено целиком', '#sheet'); await p.waitForTimeout(500);
  s = await data();
  console.log('6 Выполнено целиком:', s.lines[0].layers.map((x) => `${x.plan ? 'проект' : 'выполнено'} ${name(x.color)}`).join(', '));
  // 7) выключили в настройках: переключение режима цвет не меняет, отмеченный выполненным остаётся красным, слой — цвет по виду
  await load(base({ markers: [{ id: 'm1', folderId: 'f1', name: '1', shape: 'muffolaLinea', color: RED, plan: true, lat: Y, lng: X, createdAt: 1 }] }));
  await click('#btnMenu'); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('#drawer *')].find((x) => x.textContent.trim().startsWith('Настройки') && x.onclick !== undefined && x.closest('button, [role=button], .row, div')).click());
  await p.waitForTimeout(500);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#page .lang-row')].map((r) => (r.classList.contains('sel') ? '[вкл] ' : '[выкл] ') + r.textContent).join(' | '));
  console.log('7 настройки:', rows);
  await p.screenshot({ path: out + '/settings.png' });
  await p.evaluate(() => [...document.querySelectorAll('#page .lang-row')].find((r) => r.textContent.startsWith('Цвет по режиму')).click()); await p.waitForTimeout(300);
  console.log('  после нажатия:', await p.evaluate(() => [...document.querySelectorAll('#page .lang-row')].filter((r) => r.textContent.startsWith('Цвет по режиму')).map((r) => (r.classList.contains('sel') ? '[вкл]' : '[выкл]')).join('')));
  await p.evaluate(() => document.querySelector('#pageHead [aria-label="Сохранить"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { const d = document.getElementById('backdrop'); if (d) d.click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.wm-btn.wm-done').click()); await p.waitForTimeout(400);
  s = await data();
  console.log('  режим Выполнение: цвет нового маркера', name(s.placeColor), '| новый слой', rgb(await newLayerColor()));
  await p.touchscreen.tap(200, 400); await p.waitForTimeout(600);
  await btn('✓ Отметить выполненным'); await p.waitForTimeout(500);
  s = await data();
  console.log('  отмеченный выполненным:', name(s.markers[0].color), s.markers[0].plan ? '(проект)' : '(выполнено)', '| autoColor =', s.autoColor);
  await b.close();
})();
