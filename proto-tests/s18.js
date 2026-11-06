// схема в стиле Open Fiber: объект «Око» (линии без кабелей, как у пользователя) и сеть как на присланной картинке
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3], LANG = process.argv[4] || 'ru';
const markers = [], lines = [];
let n = 0;
const RED = '#ef4444', GREEN = '#22c55e';
const mk = (fid, name, shape, lat, lng, color) => { const id = 'm' + (++n); markers.push({ id, folderId: fid, name, shape, color: color || RED, plan: (color || RED) === RED, lat, lng, createdAt: n }); return id; };
const ln = (fid, name, pts, layers) => { lines.push({ id: 'l' + (++n), folderId: fid, name, color: RED, plan: true, createdAt: n, points: pts, layers: layers || [] }); };
const cab = (fibers, pts, done) => ({ id: 'y' + (++n), type: 'cable', name: 'Кабель', fibers, color: done ? GREEN : RED, plan: !done, points: pts });
const tube = (pts) => ({ id: 'y' + (++n), type: 'tube', name: 'Трубка', color: '#f97316', plan: true, points: pts });
// ---- «Око»: шкаф 3 — колодец 2 — муфта 6; муфта 6 — колодец 1 — PTE 4; муфта 6 — PTE 5 (только линии)
{
  const Y = 44.5440, X = 8.9500;
  mk('f1', '3', 'fo', Y, X); mk('f1', '2', 'pozzetto120', Y, X + 0.00036); mk('f1', '6', 'muffolaSecondaria', Y, X + 0.0007);
  mk('f1', '1', 'pozzetto120', Y, X + 0.0010); mk('f1', '4', 'muroEsterno', Y, X + 0.0014); mk('f1', '5', 'muroEsterno', Y - 0.0003, X + 0.0007);
  ln('f1', 'Линия 1', [[Y, X], [Y, X + 0.0007]]);
  ln('f1', 'Линия 2', [[Y, X + 0.0007], [Y, X + 0.0014]]);
  ln('f1', 'Линия 3', [[Y, X + 0.0007], [Y - 0.0003, X + 0.0007]], [tube([[Y, X + 0.0007], [Y - 0.0003, X + 0.0007]])]);
}
// ---- сеть как на картинке: шкаф, нижняя магистраль 144 на восток, верхняя 72 — на север и на восток
{
  const Y = 44.548, X = 8.960, F = 'f2';
  mk(F, 'FO', 'fo', Y, X, GREEN);
  const mf = [['24:24', 0.003], ['21:23', 0.006], ['18:20', 0.009], ['15:17', 0.012]];
  [0.0015, 0.0045, 0.0075, 0.0105].forEach((d, i) => mk(F, 'Pozzetto ' + (i + 1), 'pozzetto60', Y, X + d));
  mf.forEach(([nm, d]) => mk(F, nm, 'muffolaLinea', Y, X + d));
  ln(F, 'Линия 1', [[Y, X], [Y, X + 0.012]], [cab(144, [[Y, X], [Y, X + 0.006]], true), cab(144, [[Y, X + 0.006], [Y, X + 0.012]])]);
  const drop = (from, to, name, fibers, shape) => {
    mk(F, name, shape || 'muroEsterno', to[0], to[1]);
    const pts = [from, [to[0], from[1]], to];
    ln(F, 'к ' + name, pts, fibers === 0 ? [] : [cab(fibers || null, pts)]);
  };
  drop([Y, X + 0.003], [Y - 0.0008, X + 0.0040], '24', 24);
  drop([Y, X + 0.006], [Y + 0.0004, X + 0.0070], '23', 24, 'colonnina');
  drop([Y, X + 0.006], [Y + 0.0008, X + 0.0070], '22', 24, 'colonnina');
  drop([Y, X + 0.006], [Y + 0.0012, X + 0.0070], '21', null, 'colonnina');
  drop([Y, X + 0.009], [Y - 0.0004, X + 0.0100], '20', 24);
  drop([Y, X + 0.009], [Y - 0.0008, X + 0.0100], '19', 0);
  // от середины магистрали без маркера (стык линий) — к PTE 17
  mk(F, '17', 'interno', Y - 0.0008, X + 0.011);
  ln(F, 'к 17', [[Y, X + 0.011], [Y - 0.0008, X + 0.011]], [cab(12, [[Y, X + 0.011], [Y - 0.0008, X + 0.011]])]);
  // верхняя магистраль
  const T = Y + 0.003;
  mk(F, 'Pozzetto N', 'pozzetto47', Y + 0.0015, X);
  mk(F, '32:37', 'muffolaLinea', T, X + 0.003); mk(F, '26:30', 'muffolaSecondaria', T, X + 0.006);
  ln(F, 'Линия 2', [[Y, X], [T, X], [T, X + 0.006]], [cab(72, [[Y, X], [T, X], [T, X + 0.006]])]);
  drop([T, X + 0.003], [T + 0.0004, X + 0.0040], '35:37', 24);
  drop([T, X + 0.003], [T + 0.0008, X + 0.0040], '34', 24);
  drop([T, X + 0.003], [T + 0.0012, X + 0.0040], '33', 24, 'colonnina');
  drop([T, X + 0.003], [T + 0.0016, X + 0.0040], '32', 24);
  drop([T, X + 0.006], [T + 0.0005, X + 0.0072], '26', 24);
  drop([T, X + 0.006], [T, X + 0.0075], '27:29', 24, 'interno');
  drop([T, X + 0.006], [T - 0.0005, X + 0.0072], '30', 24);
}
const state = { folders: [{ id: 'f1', name: 'Око', color: '#3b82f6' }, { id: 'f2', name: 'Busalla FTTH', color: '#a855f7' }],
  markers, lines, reels: [], activeFolderId: 'f1', view: {}, planRedV1: true, planRedV2: true, stageV1: true };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  await p.evaluate(([KEY, st, L]) => { localStorage.setItem(KEY, JSON.stringify(st)); localStorage.setItem('fieldmap_lang', L); }, [KEY, state, LANG]);
  await p.reload(); await p.waitForTimeout(700);
  const open = async (i, shot) => {
    await p.evaluate(() => document.getElementById('btnMenu').click()); await p.waitForTimeout(400);
    await p.evaluate((i) => [...document.querySelectorAll('#drawer .fschema')][i].click(), i);
    await p.waitForTimeout(600);
    const info = await p.evaluate(() => {
      const el = document.getElementById('schema');
      return { head: el.querySelector('.schema-head small').textContent, ids: [...el.querySelectorAll('[data-mid]')].map((g) => g.textContent).join(','),
        texts: [...el.querySelectorAll('.schema-body svg > text')].map((t) => t.textContent).join(' | '), vb: el.querySelector('.schema-body svg').getAttribute('viewBox') };
    });
    console.log(JSON.stringify(info));
    await p.screenshot({ path: out + '/' + shot + '.png' });
  };
  await open(0, 'oko');
  await p.evaluate(() => document.querySelector('#schema .schema-head button').click()); await p.waitForTimeout(300);
  await open(1, 'ofib');
  await p.click('.schema-zoom [aria-label="' + (LANG === 'it' ? 'Tutto lo schema' : 'Вся схема') + '"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/ofib-all.png' });
  await b.close();
})();
