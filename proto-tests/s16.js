// схема объекта: только шкаф, муфты и PTE; связи — только кабели (через колодцы и стыки линий); масштаб пальцами
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3], LANG = process.argv[4] || 'ru';
const Y = 44.548;
const mk = (id, name, shape, lat, lng, extra) => Object.assign({ id, folderId: 'f1', name, shape, color: '#22c55e', lat, lng, createdAt: 1 }, extra || {});
const cab = (id, fibers, pts, extra) => Object.assign({ id, type: 'cable', name: 'Кабель', fibers, color: '#22c55e', points: pts }, extra || {});
const line = (id, name, pts, layers) => ({ id, folderId: 'f1', name, color: null, plan: true, createdAt: 1, points: pts, layers });
const state = {
  folders: [{ id: 'f1', name: 'Буззалла FTTH', color: '#3b82f6' }, { id: 'f2', name: 'Пусто', color: '#a855f7' }],
  markers: [
    mk('A', 'Armadio 1', 'fo', Y, 8.9600),
    mk('K1', 'Колодец 1', 'pozzetto60', Y, 8.9620),
    mk('M1', 'Муфта 1', 'muffolaLinea', Y, 8.9640),
    mk('P1', 'PTE 1', 'colonnina', Y, 8.9655),
    mk('K2', 'Колодец 2', 'pozzetto47', Y, 8.9668),
    mk('M2', 'Муфта 2', 'muffolaSecondaria', Y, 8.9680),
    mk('P2', 'PTE 2', 'muroEsterno', Y + 0.0010, 8.9640),
    mk('P4', 'PTE 4', 'interno', Y - 0.0005, 8.9680),
    mk('P3', 'PTE 3', 'sotterraneo', Y - 0.0010, 8.9680),
    mk('K3', 'Колодец 3', 'pozzetto120', Y, 8.9700),
    mk('P5', 'PTE 5 (только трубка)', 'business', Y, 8.9720),
    mk('M3', 'Муфта 3', 'muffolaAerea', Y - 0.0020, 8.9640),
    mk('K4', 'Колодец 4', 'pozzetto40', Y - 0.0020, 8.9660),
    mk('P6', 'PTE 6', 'passed', Y - 0.0020, 8.9680),
    mk('M4', 'Муфта 4 (без кабеля)', 'muffolaLinea', Y + 0.0020, 8.9700),
    mk('X', 'Просто точка', 'pin', Y + 0.0005, 8.9610),
  ],
  lines: [
    // шкаф → колодец → муфта 1: кабель 144 и трубка (трубка не в счёт)
    line('L1', 'Линия 1', [[Y, 8.9600], [Y, 8.9640]], [cab('c1', 144, [[Y, 8.9600], [Y, 8.9640]]),
      { id: 't1', type: 'tube', name: 'Трубка', tubes: 2, color: '#f97316', points: [[Y, 8.9600], [Y, 8.9640]] }]),
    // муфта 1 → PTE 1 → колодец → муфта 2: проект 24 на всю линию, выполнено 24 до PTE 1
    line('L2', 'Линия 2', [[Y, 8.9640], [Y, 8.9680]], [
      cab('c2p', 24, [[Y, 8.9640], [Y, 8.9680]], { plan: true, color: '#ef4444' }),
      cab('c2d', 24, [[Y, 8.9640], [Y, 8.9655]])]),
    // ответвление от муфты 1 к PTE 2 (12 волокон)
    line('L3', 'Линия 3', [[Y, 8.9640], [Y + 0.0010, 8.9640]], [cab('c3', 12, [[Y, 8.9640], [Y + 0.0010, 8.9640]])]),
    // муфта 2 → PTE 4 → PTE 3: один кабель 12 мимо PTE 4
    line('L4', 'Линия 4', [[Y, 8.9680], [Y - 0.0010, 8.9680]], [cab('c4', 12, [[Y, 8.9680], [Y - 0.0010, 8.9680]])]),
    // муфта 2 → колодец 3: кабель 48 обрывается в колодце (дальше только трубка до PTE 5)
    line('L5', 'Линия 5', [[Y, 8.9680], [Y, 8.9700]], [cab('c5', 48, [[Y, 8.9680], [Y, 8.9700]])]),
    line('L6', 'Линия 6', [[Y, 8.9700], [Y, 8.9720]], [{ id: 't6', type: 'tube', name: 'Трубка', tubes: 1, color: '#f97316', points: [[Y, 8.9700], [Y, 8.9720]] }]),
    // кабель 12 от колодца 1 в сторону — от колодца, не от муфты: на схему не попадает
    line('L7', 'Линия 7', [[Y, 8.9620], [Y + 0.0015, 8.9620]], [cab('c7', 12, [[Y, 8.9620], [Y + 0.0015, 8.9620]])]),
    // шкаф → стык линий без маркера → муфта 3: кабель 48 на двух линиях
    line('L8', 'Линия 8', [[Y, 8.9600], [Y - 0.0020, 8.9600]], [cab('c8', 48, [[Y, 8.9600], [Y - 0.0020, 8.9600]])]),
    line('L9', 'Линия 9', [[Y - 0.0020, 8.9600], [Y - 0.0020, 8.9640]], [cab('c9', 48, [[Y - 0.0020, 8.9600], [Y - 0.0020, 8.9640]])]),
    // муфта 3 → колодец 4 (стык двух линий в колодце) → PTE 6: кабель 12 на двух линиях
    line('L10', 'Линия 10', [[Y - 0.0020, 8.9640], [Y - 0.0020, 8.9660]], [cab('c10', 12, [[Y - 0.0020, 8.9640], [Y - 0.0020, 8.9660]])]),
    line('L11', 'Линия 11', [[Y - 0.0020, 8.9660], [Y - 0.0020, 8.9680]], [cab('c11', 12, [[Y - 0.0020, 8.9660], [Y - 0.0020, 8.9680]])]),
    // линия без слоёв между муфтой 4 и колодцем 3 — не связь
    line('L12', 'Линия 12', [[Y + 0.0020, 8.9700], [Y, 8.9700]], []),
  ],
  reels: [], activeFolderId: 'f1', view: {}, lang: LANG, planRedV1: true, planRedV2: true, stageV1: true,
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  await p.evaluate(([KEY, st, L]) => { localStorage.setItem(KEY, JSON.stringify(st)); localStorage.setItem('fieldmap_lang', L); }, [KEY, state, LANG]);
  await p.reload(); await p.waitForTimeout(700);
  await p.click('#btnMenu'); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('#drawer .fschema')][0].click());
  await p.waitForTimeout(500);
  const info = await p.evaluate(() => {
    const el = document.getElementById('schema');
    const ids = [...el.querySelectorAll('[data-mid]')].map((g) => g.getAttribute('data-mid'));
    const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
    return { title: el.querySelector('.schema-head .ttl').textContent, ids, texts, vb: el.querySelector('.schema-body svg').getAttribute('viewBox') };
  });
  console.log('title:', info.title);
  console.log('nodes:', info.ids.join(','));
  console.log('texts:', info.texts.join(' | '));
  console.log('viewBox:', info.vb);
  await p.screenshot({ path: out + '/sch1.png' });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  // щипок: пальцы расходятся вокруг (200, 300)
  await touch('touchStart', [[170, 300], [230, 300]]);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', [[170 - i * 8, 300], [230 + i * 8, 300]]); await p.waitForTimeout(16); }
  await touch('touchEnd', []); await p.waitForTimeout(300);
  console.log('after pinch viewBox:', await p.evaluate(() => document.querySelector('#schema .schema-body svg').getAttribute('viewBox')));
  await p.screenshot({ path: out + '/sch2.png' });
  // перетаскивание одним пальцем влево
  await touch('touchStart', [[300, 500]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[300 - i * 15, 500]]); await p.waitForTimeout(16); }
  await touch('touchEnd', []); await p.waitForTimeout(300);
  console.log('after pan viewBox:', await p.evaluate(() => document.querySelector('#schema .schema-body svg').getAttribute('viewBox')));
  // «вся схема»
  await p.click('.schema-zoom [aria-label="Вся схема"]'); await p.waitForTimeout(300);
  console.log('fit viewBox:', await p.evaluate(() => document.querySelector('#schema .schema-body svg').getAttribute('viewBox')));
  await p.screenshot({ path: out + '/sch3.png' });
  // нажатие на муфту 2 — действия
  const box = await p.evaluate(() => { const r = document.querySelector('#schema [data-mid="M2"] use').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await touch('touchStart', [box]); await touch('touchEnd', []); await p.waitForTimeout(400);
  console.log('actions:', await p.evaluate(() => { const a = document.getElementById('schemaActs'); return a ? [...a.querySelectorAll('.ttl,button')].map((x) => x.textContent).join(' / ') : 'none'; }));
  await p.screenshot({ path: out + '/sch4.png' });
  await p.evaluate(() => document.querySelector('#schemaActs .cancel').click());
  // ветки в одну сторону от одного узла: «Выше»/«Ниже» меняют их местами
  const pair = await p.evaluate(() => {
    const ids = [...document.querySelectorAll('#schema [data-mid]')].map((g) => g.getAttribute('data-mid'));
    return ids;
  });
  console.log('nodes now:', pair.join(','));
  const tapId = async (id) => { const bp = await p.evaluate((id) => { const r = document.querySelector(`#schema [data-mid="${id}"] use`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, id); await touch('touchStart', [bp]); await touch('touchEnd', []); await p.waitForTimeout(300); };
  const yOf = (id) => p.evaluate((id) => document.querySelector(`#schema [data-mid="${id}"] use`).getBoundingClientRect().y, id);
  for (const id of pair) {
    await tapId(id);
    const acts = await p.evaluate(() => [...document.querySelectorAll('#schemaActs button')].map((x) => x.textContent));
    if (acts.includes('Выше') || acts.includes('Ниже')) {
      const up = acts.includes('Выше');
      const before = await yOf(id);
      console.log('reorder', id, up ? 'Выше' : 'Ниже', '| acts:', acts.join(' / '));
      await p.evaluate((t) => [...document.querySelectorAll('#schemaActs button')].find((x) => x.textContent === t).click(), up ? 'Выше' : 'Ниже'); await p.waitForTimeout(400);
      const after = await yOf(id);
      console.log('moved', up ? 'up' : 'down', up ? after < before : after > before, '| viewBox kept:', await p.evaluate(() => document.querySelector('#schema .schema-body svg').getAttribute('viewBox')));
      break;
    }
    await p.evaluate(() => document.querySelector('#schemaActs .cancel').click());
  }
  // муфта 3 — сделать главным
  const b3 = await p.evaluate(() => { const r = document.querySelector('#schema [data-mid="M3"] use').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await touch('touchStart', [b3]); await touch('touchEnd', []); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('#schemaActs button')].find((x) => x.textContent.includes('главным')).click()); await p.waitForTimeout(400);
  console.log('after make main, first node:', await p.evaluate(() => document.querySelector('#schema [data-mid]').getAttribute('data-mid')));
  await p.click('.schema-zoom [aria-label="Вся схема"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/sch5.png' });
  // пустой объект
  await p.click('#schema .schema-head button'); await p.waitForTimeout(200);
  await p.click('#btnMenu'); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('#drawer .fschema')][1].click()); await p.waitForTimeout(400);
  console.log('empty:', await p.evaluate(() => document.querySelector('#schema .schema-body').textContent));
  await p.screenshot({ path: out + '/sch6.png' });
  await b.close();
})();
