// «Слои карты»: цифры только по активному объекту
const H = require('./harness.cjs');
(async () => {
  const url = H.prepareWeb();
  const browser = await H.launch();
  const { page } = await H.phone(browser, H.makeRelay(), { init: "localStorage.setItem('fieldmap_login_later', new Date().toDateString());" });
  await page.goto(url); await H.sleep(1000);
  await page.evaluate(() => {
    const S = Store.data, p1 = [[44.5, 8.9], [44.501, 8.9]], p2 = [[44.6, 8.9], [44.603, 8.9]];
    S.folders.push({ id: 'A', name: 'Объект А', color: '#22c55e' }, { id: 'B', name: 'Объект Б', color: '#3b82f6' }, { id: 'A1', name: 'линия', color: '#22c55e', parentId: 'A' });
    S.markers.push({ id: 'm1', folderId: 'A', name: '1', color: '#22c55e', lat: 44.5, lng: 8.9 }, { id: 'm2', folderId: 'A1', name: '2', color: '#22c55e', lat: 44.501, lng: 8.9 },
      { id: 'm3', folderId: 'B', name: '3', color: '#22c55e', lat: 44.6, lng: 8.9 }, { id: 'm4', folderId: 'B', name: '4', color: '#22c55e', lat: 44.601, lng: 8.9 }, { id: 'm5', folderId: 'B', name: '5', color: '#22c55e', lat: 44.602, lng: 8.9 });
    S.lines.push({ id: 'la', folderId: 'A', name: 'a', color: '#22c55e', points: p1, layers: [{ id: 'x', type: 'tube', name: 'Трубка', color: '#f97316', points: p1, s: [0, 111] }] },
      { id: 'lb', folderId: 'B', name: 'b', color: '#22c55e', points: p2, layers: [{ id: 'y', type: 'cable', name: 'Кабель', color: '#22c55e', points: p2, s: [0, 333] }, { id: 'z', type: 'custom', name: 'Scavato mano', color: '#16a34a', points: p2, s: [0, 333] }] });
    S.activeFolderId = 'A';
    Store.save();
  });
  await page.reload(); await H.sleep(1200);
  const pop = async () => { await page.click('#fabLayers'); await H.sleep(400); const t = (await page.evaluate(() => document.getElementById('mapPop').innerText)).replace(/\n+/g, ' | '); await page.click('#fabLayers'); await H.sleep(200); return t; };
  const a = await pop();
  console.log('А:', a.slice(0, 160));
  await page.evaluate(() => { Store.data.activeFolderId = 'B'; Store.save(); });
  await page.reload(); await H.sleep(1200);
  const b = await pop();
  console.log('Б:', b.slice(0, 190));
  const okA = /Объект: Объект А \| Маркеры \| 2 \| Линии \| 111 м \| Трубки \| 111 м \| Кабели \| 0 м/.test(a) && !/Scavato/.test(a);
  const okB = /Объект: Объект Б \| Маркеры \| 3 \| Линии \| 334 м \| Трубки \| 0 м \| Кабели \| 334 м/.test(b) && /Scavato mano/.test(b);
  console.log(okA && okB && !page.errors.length ? 'ВСЕ ПРОВЕРКИ ПРОШЛИ' : 'ОШИБКА ' + JSON.stringify(page.errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
