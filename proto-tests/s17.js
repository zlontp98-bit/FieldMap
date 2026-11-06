// схема: большая сеть (скорость и вид), итальянский язык, колесо мыши, «Показать на карте»
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const Y = 44.548, X0 = 8.960;
const markers = [], lines = [];
let n = 0;
const mk = (name, shape, lat, lng, color) => { const id = 'm' + (++n); markers.push({ id, folderId: 'f1', name, shape, color: color || '#22c55e', lat, lng, createdAt: n }); return id; };
const ln = (pts, fibers, plan) => {
  const id = 'l' + (++n);
  const c = plan ? '#ef4444' : '#22c55e';
  lines.push({ id, folderId: 'f1', name: 'Линия ' + n, color: null, createdAt: n, points: pts,
    layers: [{ id: 'y' + n, type: 'cable', name: 'Кабель', fibers, color: c, plan: !!plan, points: pts }, { id: 't' + n, type: 'tube', name: 'Трубка', color: '#f97316', points: pts }] });
};
mk('Armadio Busalla', 'fo', Y, X0);
// магистраль: 8 муфт с колодцами между ними; от каждой муфты — по 12 PTE на отдельных линиях
let prev = [Y, X0];
for (let i = 1; i <= 8; i++) {
  const lng = X0 + i * 0.004;
  mk('Pozzetto ' + i, 'pozzetto60', Y, lng - 0.002);
  mk('Muffola ' + i, i % 2 ? 'muffolaLinea' : 'muffolaSecondaria', Y, lng, i > 5 ? '#ef4444' : null);
  ln([prev, [Y, lng]], i < 4 ? 144 : 96, i > 5);
  prev = [Y, lng];
  for (let k = 1; k <= 12; k++) {
    const lat = Y + (k % 2 ? 1 : -1) * 0.0004 * Math.ceil(k / 2);
    mk(`PTE ${i}.${k} via Roma ${k * 3}`, ['colonnina', 'muroEsterno', 'interno', 'business'][k % 4], lat, lng + 0.0004);
    ln([[Y, lng], [Y, lng + 0.0004], [lat, lng + 0.0004]], 12, i > 5);
  }
}
// и 200 колодцев без кабеля в стороне
for (let i = 0; i < 200; i++) mk('Колодец ' + i, 'pozzetto47', Y + 0.01 + (i % 20) * 0.0003, X0 + Math.floor(i / 20) * 0.0003);
const state = { folders: [{ id: 'f1', name: 'Busalla FTTH', color: '#3b82f6' }], markers, lines, reels: [], activeFolderId: 'f1', view: {}, planRedV1: true, planRedV2: true, stageV1: true };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  await p.evaluate(([KEY, st]) => { localStorage.setItem(KEY, JSON.stringify(st)); localStorage.setItem('fieldmap_lang', 'it'); }, [KEY, state]);
  await p.reload(); await p.waitForTimeout(800);
  await p.click('#btnMenu'); await p.waitForTimeout(400);
  const t0 = Date.now();
  await p.evaluate(() => document.querySelector('#drawer .fschema').click());
  await p.waitForSelector('#schema .schema-body svg');
  console.log('open ms:', Date.now() - t0);
  const info = await p.evaluate(() => {
    const el = document.getElementById('schema');
    return { head: el.querySelector('.schema-head').textContent, nodes: el.querySelectorAll('[data-mid]').length, vb: el.querySelector('.schema-body svg').getAttribute('viewBox'),
      labels: [...new Set([...el.querySelectorAll('.schema-body svg text')].map((t) => t.textContent).filter((t) => /fibre|m$/.test(t)))].slice(0, 8) };
  });
  console.log(JSON.stringify(info));
  await p.screenshot({ path: out + '/big1.png' });
  // «Показать на карте» у первой муфты
  await p.evaluate(() => { const g = document.querySelector('#schema [data-mid="m3"]'); const r = g.querySelector('use').getBoundingClientRect(); window.__pt = [r.x + r.width / 2, r.y + r.height / 2]; });
  const pt = await p.evaluate(() => window.__pt);
  await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(300);
  console.log('acts:', await p.evaluate(() => document.getElementById('schemaActs') && document.getElementById('schemaActs').textContent));
  await p.evaluate(() => document.querySelector('#schemaActs button').click()); await p.waitForTimeout(800);
  console.log('schema hidden:', await p.evaluate(() => document.getElementById('schema').classList.contains('hidden')), '| sheet:', await p.evaluate(() => { const t = document.querySelector('#mSheet .tb-ttl'); return t ? t.textContent : null; }));
  await p.screenshot({ path: out + '/big4.png' });
  await p.evaluate(() => { const x = document.querySelector('#mSheet [data-ru-aria="Закрыть"]') || document.querySelector('#mSheet [aria-label="Закрыть"]'); if (x) x.click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('btnMenu').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#drawer .fschema').click()); await p.waitForTimeout(400);
  await p.click('.schema-zoom [aria-label="Tutto lo schema"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/big2.png' });
  // колесо мыши — приблизить у шкафа
  await p.mouse.move(60, 160);
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(30); }
  await p.waitForTimeout(200);
  console.log('after wheel:', await p.evaluate(() => document.querySelector('#schema .schema-body svg').getAttribute('viewBox')));
  await p.screenshot({ path: out + '/big3.png' });
  await b.close();
})();
