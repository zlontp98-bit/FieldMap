const { chromium } = require('playwright');
const KEY = 'fieldmap_proto_v1';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  await p.evaluate((KEY) => localStorage.setItem(KEY, JSON.stringify({ folders: [], markers: [], lines: [], reels: [], activeFolderId: null, view: {}, planRedV1: true, planRedV2: true, stageV1: true })), KEY);
  await p.reload(); await p.waitForTimeout(600);
  const st = () => p.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
  await p.click('#fabAdd'); await p.waitForTimeout(400);
  console.log('page open:', await p.evaluate(() => !document.getElementById('page').classList.contains('hidden')), await p.textContent('#pageHead .title'), '| toast:', await p.textContent('#toast'));
  console.log('markers:', (await st()).markers.length, 'folders:', (await st()).folders.length);
  // назад без сохранения — маркера нет, объекта нет
  await p.click('#pageHead [aria-label="Назад"]'); await p.waitForTimeout(300);
  console.log('after back: mode banner hidden', await p.evaluate(() => document.getElementById('modeTop').hidden), 'folders', (await st()).folders.length);
  // снова, теперь создаём
  await p.click('#fabAdd'); await p.waitForTimeout(400);
  await p.fill('#pageBody input.field', 'Генуя FTTH'); await p.click('#pageHead [aria-label="Сохранить"]'); await p.waitForTimeout(500);
  console.log('mark mode now:', await p.evaluate(() => !document.getElementById('markRow').hidden));
  await p.click('#markOk'); await p.waitForTimeout(500);
  const s = await st();
  console.log('folders:', s.folders.map((f) => f.name), '| marker in it:', s.markers.length && s.markers[0].folderId === s.folders[0].id);
  // линия в режиме «Проект» без объекта
  await p.evaluate((KEY) => { const S = JSON.parse(localStorage.getItem(KEY)); S.folders = []; S.markers = []; S.workMode = 'plan'; localStorage.setItem(KEY, JSON.stringify(S)); }, KEY);
  await p.reload(); await p.waitForTimeout(600);
  await p.click('#fabLine'); await p.waitForTimeout(400);
  console.log('line without object -> page:', await p.textContent('#pageHead .title'));
  await b.close();
})();
