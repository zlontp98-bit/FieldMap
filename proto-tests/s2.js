// режим «Проект», протяжка по проекту, закрытие с соседней линии, синий, маркеры рядом, рабочий, галочка «Проект»
const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const A = [44.5488, 8.9660], B = [44.5488, 8.9700];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message); });
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  await p.evaluate(({ KEY, A, B }) => {
    const now = Date.now();
    localStorage.setItem(KEY, JSON.stringify({
      folders: [{ id: 'F', name: 'Трасса', color: '#22c55e', access: { 't:T': 'edit' } }], reels: [{ id: 'R', name: 'Бобина 1', type: 'cable', total: 1000, createdAt: now }],
      teams: [{ id: 'T', name: 'Иван' }],
      people: [{ id: 'me', name: 'Я', role: 'admin', status: 'active' }, { id: 'F1', name: 'Иван', role: 'foreman', team: 'T', status: 'active' },
               { id: 'W', name: 'Пётр', role: 'worker', team: 'T', status: 'active' }],
      meId: 'me',
      markers: [{ id: 'pm', folderId: 'F', name: 'Колодец план', shape: 'pozzetto40', color: '#f59e0b', lat: 44.54895, lng: 8.9684, createdAt: now, plan: true }],
      lines: [{ id: 'L1', folderId: 'F', name: 'Трасса А', color: '#94a3b8', createdAt: now, points: [A, B], plan: true, layers: [
        { id: 'P1', type: 'cable', name: 'Кабель', fibers: 96, color: '#a855f7', points: [A, B], s: [0, 317.9], createdAt: now, plan: true },
        { id: 'P2', type: 'tube', name: 'Трубка', color: '#f97316', points: [A, B], s: [0, 317.9], createdAt: now, plan: true }] },
        // соседняя линия в 4 м южнее: выполненная трубка на ней закроет проектную трубку
        { id: 'L2', folderId: 'F', name: 'Факт', color: '#94a3b8', createdAt: now, points: [[44.54876, 8.9660], [44.54876, 8.9680]], layers: [
        { id: 'E2', type: 'tube', name: 'Трубка', color: '#f97316', points: [[44.54876, 8.9660], [44.54876, 8.9680]], s: [0, 158.9], createdAt: now },
        { id: 'BL', type: 'cable', name: 'Чужой кабель', fibers: 96, color: '#3b82f6', points: [[44.54876, 8.9660], [44.54876, 8.9680]], s: [0, 158.9], createdAt: now }] }],
      activeFolderId: 'F', view: {}, planRedV1: true, planRedV2: true, stageV1: true, journalGreenV1: true, journalStageV1: true, log: [], logSnap: {} }));
  }, { KEY, A, B });
  await p.reload(); await p.waitForTimeout(700);
  const st = () => p.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
  const panel = async () => {
    await p.click('#tbSearch'); await p.fill('#sInput', 'Трасса А'); await p.waitForTimeout(200);
    await p.evaluate(() => [...document.querySelectorAll('#sList .row')].find((r) => r.textContent.includes('Линия')).click()); await p.waitForTimeout(1100);
    await p.mouse.click(200, 400); await p.waitForTimeout(500);
    return p.evaluate(() => [...document.querySelectorAll('#layerPanel .lp-row')].map((r) => r.textContent));
  };
  let s = await st();
  console.log('log at start (blue + tube on other line):', JSON.stringify(s.log.map((e) => [e.type || e.kind, e.len])));
  console.log('panel:', JSON.stringify(await panel()));
  await p.screenshot({ path: out + '/b1.png', clip: { x: 0, y: 330, width: 400, height: 140 } });
  // протяжка по проекту пальцем
  const rows = await p.evaluate(() => [...document.querySelectorAll('#layerPanel .lp-row')].map((r) => r.textContent));
  await p.evaluate((i) => document.querySelectorAll('#layerPanel .lp-row')[i].click(), rows.findIndex((r) => r.startsWith('Кабель')));
  await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('#sheetBox button')].find((b) => b.textContent.includes('Тянуть по проекту')).click()); await p.waitForTimeout(300);
  console.log('pull sheet title:', await p.textContent('#sheetBox h3'));
  await p.evaluate(() => [...document.querySelectorAll('#sheetBox .lt-chip, #sheetBox button')].find((b) => b.textContent.trim() === 'Бобина 1') && [...document.querySelectorAll('#sheetBox .lt-chip, #sheetBox button')].find((b) => b.textContent.trim() === 'Бобина 1').click());
  await p.evaluate(() => [...document.querySelectorAll('#sheetBox button')].find((b) => b.textContent.includes('Начать')).click()); await p.waitForTimeout(1500);
  console.log('toast:', await p.textContent('#toast'));
  await p.click('#linePlus'); await p.waitForTimeout(400);
  await p.mouse.move(250, 600); await p.mouse.down(); await p.mouse.move(110, 600, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/b2.png' });
  await p.click('#lineSave'); await p.waitForTimeout(800);
  s = await st();
  const L1 = s.lines.find((l) => l.id === 'L1');
  console.log('L1 layers:', JSON.stringify(L1.layers.map((x) => [x.id.slice(0, 3), x.type, x.plan ? 'plan' : 'done', x.fromPlan || '', x.reelId || '', Math.round(Math.abs((x.s || [0, 0])[x.s.length - 1] - x.s[0]))])));
  console.log('log:', JSON.stringify(s.log.map((e) => [e.type || e.kind, e.len, e.reel || ''])));
  // выполненный маркер рядом с проектным закрывает его
  await p.reload(); await p.waitForTimeout(600);
  await p.evaluate((KEY) => { const S = JSON.parse(localStorage.getItem(KEY)); S.markers.push({ id: 'dm', folderId: 'F', name: '', shape: 'pozzetto40', color: '#22c55e', lat: 44.54897, lng: 8.96842, createdAt: Date.now() }); localStorage.setItem(KEY, JSON.stringify(S)); }, KEY);
  await p.reload(); await p.waitForTimeout(600);
  await p.click('#tbSearch'); await p.fill('#sInput', 'Колодец план'); await p.waitForTimeout(200);
  console.log('search still finds plan marker:', await p.textContent('#sList'));
  await p.click('#sInput'); await p.keyboard.press('Escape');
  // режим «Проект»: новый маркер — проект; рамка
  await p.reload(); await p.waitForTimeout(600);
  await p.evaluate(() => [...document.querySelectorAll('#workMode button')].find((b) => b.textContent === 'Проект').click()); await p.waitForTimeout(300);
  console.log('plan mode: body class', await p.evaluate(() => document.body.className), '| toast:', await p.textContent('#toast'));
  await p.screenshot({ path: out + '/b3.png' });
  await p.click('#fabAdd'); await p.waitForTimeout(300); await p.click('#markOk'); await p.waitForTimeout(500);
  s = await st(); const nm = s.markers[s.markers.length - 1];
  console.log('new marker in plan mode: plan=', nm.plan, '| log unchanged:', s.log.filter((e) => e.kind === 'mk').length);
  // отчёт: «По проекту осталось»
  await p.evaluate(() => [...document.querySelectorAll('#workMode button')].find((b) => b.textContent === 'Выполнение').click()); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.top-bar .tb-btn').click()); await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll('#dTop .row')].find((r) => r.textContent.includes('Отчёт')).click()); await p.waitForTimeout(400);
  console.log('REPORT:\n' + await p.inputValue('#rpText'));
  await p.screenshot({ path: out + '/b4.png', fullPage: false });
  // рабочий: нет переключателя; может отметить проектный маркер
  await p.evaluate((KEY) => { const S = JSON.parse(localStorage.getItem(KEY)); S.meId = 'W'; localStorage.setItem(KEY, JSON.stringify(S)); }, KEY);
  await p.reload(); await p.waitForTimeout(600);
  console.log('worker toggle hidden:', await p.evaluate(() => document.getElementById('workMode').hidden), '| body:', await p.evaluate(() => document.body.className));
  // галочка «Проект» в «Слоях карты»
  await p.evaluate((KEY) => { const S = JSON.parse(localStorage.getItem(KEY)); S.meId = 'me'; localStorage.setItem(KEY, JSON.stringify(S)); }, KEY);
  await p.reload(); await p.waitForTimeout(600);
  await p.click('#fabLayers'); await p.waitForTimeout(300);
  console.log('map pop:', await p.textContent('#mapPop'));
  console.log('errors:', errs.length);
  await b.close();
})();
