// выполненный проект не показывается; отметки «Выполнено / Проект»; схема по этапам
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3], LANG = process.argv[4] || 'ru';
const Y = 44.5475, X = 8.9680;   // центр карты при открытии
const G = '#22c55e', R = '#ef4444';
const mk = (id, name, shape, lat, lng, plan) => ({ id, folderId: 'f1', name, shape, color: plan ? R : G, plan: !!plan, lat, lng, createdAt: 1 });
const cab = (id, name, fibers, pts, o) => Object.assign({ id, type: 'cable', name, fibers, color: G, points: pts }, o || {});
const state = {
  folders: [{ id: 'f1', name: 'Око', color: '#3b82f6' }],
  markers: [
    mk('m3', '3', 'fo', Y + 0.0005, X), mk('m2', '2', 'pozzetto120', Y + 0.00026, X, true), mk('m6', '6', 'muffolaSecondaria', Y, X),
    mk('m1', '1', 'pozzetto120', Y, X + 0.0003, true), mk('m4', '4', 'muroEsterno', Y, X + 0.0007, true), mk('m5', '5', 'muroEsterno', Y, X - 0.0004, true),
  ],
  lines: [
    { id: 'L1', folderId: 'f1', name: 'Линия 1', color: R, plan: true, createdAt: 1, points: [[Y + 0.0005, X], [Y, X]], layers: [
      cab('a1', 'Кабель', 48, [[Y + 0.0005, X], [Y, X]], { plan: true }),
      cab('a2', 'Кабель 2', 48, [[Y + 0.0005, X], [Y, X]], { slack: { m6: 20 }, fromPlan: 'a1' })] },
    { id: 'L2', folderId: 'f1', name: 'Линия 2', color: R, plan: true, createdAt: 2, points: [[Y, X], [Y, X + 0.0007]], layers: [
      cab('b1', 'Кабель', 24, [[Y, X], [Y, X + 0.0007]], { plan: true, color: R }),
      cab('b2', 'Кабель', 24, [[Y, X], [Y, X + 0.0003]], { fromPlan: 'b1' })] },
    { id: 'L3', folderId: 'f1', name: 'Линия 3', color: R, plan: true, createdAt: 3, points: [[Y, X], [Y, X - 0.0004]], layers: [
      cab('c1', 'Кабель', 12, [[Y, X], [Y, X - 0.0004]], { plan: true, color: R })] },
  ],
  reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true,
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  await p.evaluate(([KEY, st, L]) => { localStorage.setItem(KEY, JSON.stringify(st)); localStorage.setItem('fieldmap_lang', L); }, [KEY, state, LANG]);
  await p.reload(); await p.waitForTimeout(800);
  const panel = () => p.evaluate(() => {
    const e = document.getElementById('layerPanel');
    if (!e || e.hidden) return 'no panel';
    return [...e.querySelectorAll('.lp-row')].map((r) => r.querySelector('.lp-name').textContent + ' | ' + r.querySelector('.lp-sub').textContent + (r.querySelector('.lp-prog') ? ' | bar ' + r.querySelector('.lp-prog i').style.width : '')).join('  ||  ');
  });
  const tap = async (x, y) => { await p.touchscreen.tap(x, y); await p.waitForTimeout(500); };
  // Линия 1: между 3 и 2 (вертикально над центром)
  await tap(200, 400 - 95);
  console.log('L1 panel:', await panel());
  await p.screenshot({ path: out + '/st-l1.png' });
  // Линия 2: справа от муфты 6, между 6 и колодцем 1
  await tap(200 + 30, 400);
  console.log('L2 panel:', await panel());
  await p.screenshot({ path: out + '/st-l2.png' });
  // лист слоя (нажатие на проект в панели)
  await p.evaluate(() => { const r = [...document.querySelectorAll('#layerPanel .lp-row')].find((x) => x.classList.contains('is-plan')); if (r) r.click(); });
  await p.waitForTimeout(400);
  console.log('plan sheet:', await p.evaluate(() => { const s = document.querySelector('.sheet:not(.hidden), #sheet:not(.hidden)'); return s ? s.textContent.replace(/\s+/g, ' ').slice(0, 200) : 'no sheet'; }));
  await p.screenshot({ path: out + '/st-sheet.png' });
  await p.evaluate(() => { const bd = document.querySelector('.backdrop:not(.hidden)'); if (bd) bd.click(); });
  await p.waitForTimeout(300);
  // карточка муфты 6
  await tap(200, 400);
  console.log('marker 6 cables:', await p.evaluate(() => [...document.querySelectorAll('#mSheet .tb-cable')].map((r) => r.textContent).join(' || ')));
  await p.screenshot({ path: out + '/st-m6.png' });
  // режим «Проект»: закрытый проект всё равно не показываем
  await p.evaluate(() => { const x = document.querySelector('#mSheet [data-ru-aria="Закрыть"]') || document.querySelector('#mSheet [aria-label="Закрыть"]'); if (x) x.click(); });
  await p.evaluate(() => { const b = [...document.querySelectorAll('#workMode .wm-btn')].find((x) => x.classList.contains('wm-plan')); if (b) b.click(); });
  await p.waitForTimeout(300);
  await tap(200, 400 - 95);
  console.log('L1 panel in plan mode:', await panel());
  await p.evaluate(() => { const b = [...document.querySelectorAll('#workMode .wm-btn')].find((x) => x.classList.contains('wm-done')); if (b) b.click(); });
  await p.waitForTimeout(300);
  // схема (ждём, пока уйдёт подсказка режима)
  await p.waitForTimeout(3500);
  await p.evaluate(() => document.getElementById('btnMenu').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#drawer .fschema').click()); await p.waitForTimeout(700);
  console.log('schema:', JSON.stringify(await p.evaluate(() => {
    const el = document.getElementById('schema');
    return { leg: el.querySelector('.sch-leg') ? el.querySelector('.sch-leg').textContent : null,
      texts: [...el.querySelectorAll('.schema-body svg > text')].map((t) => t.textContent).join(' | '),
      strokes: [...el.querySelectorAll('.schema-body svg > path')].map((x) => x.getAttribute('stroke') + '/' + x.getAttribute('stroke-width')).join(' '),
      badges: el.querySelectorAll('.schema-body circle').length, faded: el.querySelectorAll('.schema-body use[opacity]').length };
  })));
  await p.screenshot({ path: out + '/st-schema.png' });
  await b.close();
})();
