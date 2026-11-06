const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
const page = process.argv[2], out = process.argv[3];
const A = [44.5488, 8.9660], B = [44.5488, 8.9700];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + page);
  await p.evaluate(({ KEY, A, B }) => {
    const now = Date.now();
    localStorage.setItem(KEY, JSON.stringify({
      folders: [{ id: 'F', name: 'Трасса', color: '#22c55e' }], reels: [],
      markers: [{ id: 'pm', folderId: 'F', name: 'Колодец (проект)', shape: 'pozzetto40', color: '#f59e0b', lat: 44.54895, lng: 8.9676, createdAt: now, plan: true },
                { id: 'dm', folderId: 'F', name: 'Колодец (готов)', shape: 'pozzetto40', color: '#22c55e', lat: 44.54895, lng: 8.9666, createdAt: now }],
      lines: [{ id: 'L1', folderId: 'F', name: 'Трасса А', color: '#ef4444', createdAt: now, points: [A, B], plan: true, layers: [
        { id: 'P1', type: 'cable', name: 'Кабель', color: '#a855f7', points: [A, B], s: [0, 317.9], createdAt: now, plan: true },
        { id: 'P2', type: 'tube', name: 'Трубка', color: '#f97316', points: [A, B], s: [0, 317.9], createdAt: now, plan: true },
        { id: 'E1', type: 'tube', name: 'Трубка', color: '#f97316', points: [A, [44.5488, 8.9675]], s: [0, 119.2], createdAt: now }] }],
      activeFolderId: 'F', view: {}, planRedV1: true, planRedV2: true, stageV1: true, journalGreenV1: true, journalStageV1: true, log: [], logSnap: {} }));
  }, { KEY, A, B });
  await p.reload(); await p.waitForTimeout(700);
  await p.click('#tbSearch'); await p.fill('#sInput', 'Трасса А'); await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('#sList .row')].find((r) => r.textContent.includes('Линия')).click()); await p.waitForTimeout(1100);
  await p.mouse.move(200, 400); await p.mouse.wheel(0, -300); await p.waitForTimeout(700);
  const clip = { x: 0, y: 300, width: 400, height: 170 };
  await p.screenshot({ path: out + '/v1.png', clip });
  await p.evaluate(() => [...document.querySelectorAll('#workMode button')].find((b) => b.textContent === 'Проект').click()); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/v2.png', clip });
  await p.evaluate(() => [...document.querySelectorAll('#workMode button')].find((b) => b.textContent === 'Выполнение').click()); await p.waitForTimeout(300);
  await p.click('#fabLayers'); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('#mapPop .mp-row')].find((r) => r.textContent.includes('Проект')).click()); await p.waitForTimeout(300);
  await p.click('#fabLayers'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/v3.png', clip });
  await b.close();
})();
