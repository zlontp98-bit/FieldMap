// PDF участка карты: рамка, сохранение (заглушка downloads), проверка файла
const { chromium } = require('playwright');
const fs = require('fs');
const Y = 44.5475, X = 8.9680;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.addInitScript(() => { window.claude = { use: async (n) => (n === 'downloads' ? { save: async ({ filename, data }) => { window.__pdf = { filename, buf: Array.from(new Uint8Array(await data.arrayBuffer())) }; return { status: 'saved' }; } } : null) }; });
  await p.goto('file://' + process.argv[2]);
  const st = { folders: [{ id: 'f1', name: 'Око', color: '#3b82f6' }],
    markers: [{ id: 'a', folderId: 'f1', name: '3', shape: 'fo', color: '#3b82f6', lat: Y + 0.0004, lng: X, createdAt: 1 },
      { id: 'b', folderId: 'f1', name: '6', shape: 'muffolaSecondaria', color: '#22c55e', lat: Y, lng: X, createdAt: 1 }],
    lines: [{ id: 'L', folderId: 'f1', name: 'Л', color: '#ef4444', plan: true, createdAt: 1, points: [[Y + 0.0004, X], [Y, X], [Y, X + 0.0006]],
      layers: [{ id: 'c', type: 'cable', name: 'Кабель', fibers: 48, color: '#22c55e', points: [[Y + 0.0004, X], [Y, X]] }] }],
    reels: [], activeFolderId: 'f1', view: {}, workMode: 'done', planRedV1: true, planRedV2: true, stageV1: true };
  await p.evaluate((s) => localStorage.setItem('fieldmap_proto_v1', JSON.stringify(s)), st);
  await p.reload(); await p.waitForTimeout(3000);
  await p.evaluate(() => document.getElementById('btnMenu').click()); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('#drawer .row')].find((r) => r.textContent.includes('PDF')).click()); await p.waitForTimeout(500);
  await p.screenshot({ path: process.argv[3] + '/area.png' });
  await p.evaluate(() => [...document.querySelectorAll('.area-btn')].find((x) => x.textContent.includes('Книжная')).click());
  await p.evaluate(() => [...document.querySelectorAll('.area-btn')].find((x) => x.textContent.includes('Альбомная')).click());
  await p.evaluate(() => [...document.querySelectorAll('.area-btn')].find((x) => x.textContent.includes('Сохранить')).click());
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => window.__pdf && { filename: window.__pdf.filename, n: window.__pdf.buf.length });
  console.log('saved:', JSON.stringify(r), '| toast:', await p.textContent('#toast'), '| frame gone:', await p.evaluate(() => !document.getElementById('areaBox')));
  const buf = await p.evaluate(() => window.__pdf.buf);
  fs.writeFileSync(process.argv[3] + '/area.pdf', Buffer.from(buf));
  // «Поделиться» без системного меню — сохраняет файл
  await p.evaluate(() => { window.__pdf = null; });
  await p.evaluate(() => document.getElementById('btnMenu').click()); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('#drawer .row')].find((r) => r.textContent.includes('PDF')).click()); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('.area-btn')].find((x) => x.textContent.includes('Поделиться')).click());
  await p.waitForTimeout(1500);
  console.log('share fallback saved:', await p.evaluate(() => !!window.__pdf));
  await b.close();
})();
