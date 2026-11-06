// режимы, миграция, призрак, автоматическое закрытие проекта, отчёт
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message); });
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  // старые данные: красная линия с красным (план) и зелёным кабелем, красный маркер, синий маркер
  await p.evaluate((KEY) => {
    const now = Date.now(), A = [44.5488, 8.9660], B = [44.5488, 8.9700];
    localStorage.setItem(KEY, JSON.stringify({
      folders: [{ id: 'F', name: 'Трасса', color: '#22c55e' }], reels: [],
      markers: [{ id: 'm1', folderId: 'F', name: 'Колодец Рома', shape: 'pozzetto60', color: '#ef4444', lat: 44.5488, lng: 8.9665, createdAt: now },
                { id: 'm2', folderId: 'F', name: 'Старый шкаф', shape: 'armadioEs', color: '#3b82f6', lat: 44.5490, lng: 8.9668, createdAt: now }],
      lines: [{ id: 'L1', folderId: 'F', name: 'Линия 1', color: '#ef4444', createdAt: now, points: [A, B], layers: [
        { id: 'P1', type: 'cable', name: 'Кабель', fibers: 48, color: '#ef4444', points: [A, [44.5488, 8.9690]], s: [0, 238.5], createdAt: now },
        { id: 'G1', type: 'tube', name: 'Трубка', color: '#22c55e', points: [A, [44.5488, 8.9670]], s: [0, 79.5], createdAt: now }] }],
      activeFolderId: 'F', view: {}, planRedV1: true, planRedV2: true, journalGreenV1: true,
      log: [], logSnap: { G1: { len: 79.5, slack: 0, type: 'tube' } } }));
  }, KEY);
  await p.reload(); await p.waitForTimeout(700);
  const st = () => p.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
  let s = await st();
  console.log('migration: line plan', s.lines[0].plan, '| P1 plan', s.lines[0].layers[0].plan, '| G1 plan', s.lines[0].layers[1].plan,
    '| m1 plan', s.markers[0].plan, '| m2 plan', s.markers[1].plan, '| log', JSON.stringify(s.log), '| snap', Object.keys(s.logSnap).join(','));
  console.log('mode toggle:', await p.evaluate(() => { const e = document.getElementById('workMode'); return e.hidden ? 'hidden' : e.textContent; }));
  // протянули выполненный кабель по проекту на той же линии: 100 м (через данные)
  await p.evaluate((KEY) => { const S = JSON.parse(localStorage.getItem(KEY)); S.lines[0].layers.push({ id: 'E1', type: 'cable', fibers: 48, name: 'Кабель 2', color: '#a855f7', points: [[44.5488, 8.9660], [44.5488, 8.96726]], s: [0, 100], createdAt: Date.now() }); localStorage.setItem(KEY, JSON.stringify(S)); }, KEY);
  await p.reload(); await p.waitForTimeout(600);
  s = await st(); console.log('log after exec cable:', JSON.stringify(s.log.map((e) => [e.type || e.kind, e.len !== undefined ? e.len : e.cnt])));
  // открыть линию и карточку проектного кабеля
  await p.click('#tbSearch'); await p.fill('#sInput', 'Линия 1'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#sList .row').click()); await p.waitForTimeout(1200);
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/a1.png', clip: { x: 0, y: 340, width: 400, height: 120 } });
  for (let i = 0; i < 2; i++) { await p.mouse.move(200, 400); await p.mouse.wheel(0, -300); await p.waitForTimeout(150); }
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/a1b.png', clip: { x: 0, y: 340, width: 400, height: 120 } });
  await p.mouse.click(200, 400); await p.waitForTimeout(500);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#layerPanel .lp-row')].map((r) => r.textContent));
  console.log('panel rows:', rows);
  const pi = rows.findIndex((r) => r.includes('проект'));
  if (pi >= 0) {
    await p.evaluate((i) => document.querySelectorAll('#layerPanel .lp-row')[i].click(), pi); await p.waitForTimeout(300);
    console.log('plan card:', await p.textContent('#sheetBox'));
    await p.screenshot({ path: out + '/a2.png' });
    // выполнено целиком
    await p.evaluate(() => [...document.querySelectorAll('#sheetBox button')].find((b) => b.textContent.includes('Выполнено целиком')).click()); await p.waitForTimeout(500);
    s = await st();
    console.log('after finish: layers', JSON.stringify(s.lines[0].layers.map((x) => [x.id.slice(0, 4), x.type, x.plan ? 'plan' : 'done', Math.round((x.s || [0, 0])[1] - (x.s || [0, 0])[0])])));
    console.log('log:', JSON.stringify(s.log.map((e) => [e.type || e.kind, e.len !== undefined ? e.len : e.cnt])));
  }
  // маркер: отметить выполненным (карточка проектного маркера)
  await p.reload(); await p.waitForTimeout(600);
  await p.click('#tbSearch'); await p.fill('#sInput', 'Колодец'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#sList .row').click()); await p.waitForTimeout(900);
  for (const dy of [0, -6, -12, 6]) { await p.mouse.click(200, 400 + dy); await p.waitForTimeout(350); if (await p.isVisible('#mSheet .tb-bar')) break; }
  console.log('marker sheet:', await p.isVisible('#mSheet .tb-head') ? await p.textContent('#mSheet .tb-head') : 'none');
  await p.screenshot({ path: out + '/a3.png' });
  const doneBtn = await p.$('#mSheet .pp-done');
  if (doneBtn) { await doneBtn.click(); await p.waitForTimeout(400); }
  s = await st(); console.log('m1 plan after:', s.markers[0].plan, 'doneAt', !!s.markers[0].doneAt, '| log:', JSON.stringify(s.log.map((e) => [e.type || e.kind, e.len !== undefined ? e.len : e.cnt])));
  // отчёт
  await p.evaluate(() => document.querySelector('.top-bar .tb-btn').click()); await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll('#dTop .row')].find((r) => r.textContent.includes('Отчёт')).click()); await p.waitForTimeout(400);
  console.log('REPORT:\n' + await p.inputValue('#rpText'));
  await p.screenshot({ path: out + '/a4.png' });
  console.log('errors:', errs.length);
  await b.close();
})();
