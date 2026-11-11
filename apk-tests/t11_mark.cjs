// Фото: отметки (стрелка, круг, надпись), сохранение новой картинкой; удаление корзиной в просмотре
const H = require('./harness.cjs');
let bad = 0;
const ok = (l, c, x) => { if (!c) bad++; console.log((c ? '  ок     ' : '  ОШИБКА ') + l + (x !== undefined ? ' — ' + JSON.stringify(x) : '')); };
(async () => {
  const url = H.prepareWeb();
  const browser = await H.launch();
  const { page } = await H.phone(browser, H.makeRelay(), { init: "localStorage.setItem('fieldmap_login_later', new Date().toDateString());" });
  await page.goto(url); await H.sleep(1000);
  await page.evaluate(async () => {
    const mk = (c) => { const v = document.createElement('canvas'); v.width = 1200; v.height = 900; const g = v.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 1200, 900); return v.toDataURL('image/jpeg'); };
    await Store.photoPut('ph1', mk('#777')); await Store.photoPut('ph2', mk('#558'));
    const S = Store.data;
    S.folders.push({ id: 'F', name: 'Объект', color: '#22c55e' });
    S.markers.push({ id: 'M', folderId: 'F', name: 'Колодец', color: '#22c55e', lat: 44.5487, lng: 8.9675, photos: [{ id: 'ph1', lat: 44.5487, lng: 8.9675, t: Date.now() }, 'photo:ph2'] });
    S.activeFolderId = 'F';
    localStorage.setItem('fieldmap_view', JSON.stringify({ lat: 44.5487, lng: 8.9675, z: 18 }));
    Store.save();
  });
  await page.reload(); await H.sleep(1200);
  await page.mouse.click(206, 430 - 22); await H.sleep(600);
  await page.click('#mSheet .tb-ph'); await H.sleep(800);
  ok('в просмотре видны корзина и «Отметить»', await page.evaluate(() => !document.getElementById('vDel').hidden && !document.getElementById('vMark').hidden));
  await page.click('#vMark'); await H.sleep(800);
  await page.click('.mk-btn:has-text("Стрелка")'); await H.sleep(200);
  // перетащить стрелку пальцем
  const r = await page.evaluate(() => { const b = document.getElementById('mkCanvas').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.mouse.move(r.x - 80, r.y - 60, { steps: 5 }); await page.mouse.up();
  await page.click('.mk-btn:has-text("Больше")'); await page.click('.mk-btn:has-text("Повернуть")'); await page.click('.mk-btn:has-text("Повернуть")');
  await page.click('.mk-btn:has-text("Круг")'); await H.sleep(100);
  await page.click('.mk-btn:has-text("Надпись")'); await H.sleep(200);
  await page.fill('#mkTextIn', 'Колодец 12'); await page.click('#mkTextOk'); await H.sleep(200);
  await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.mouse.move(r.x + 40, r.y + 140, { steps: 5 }); await page.mouse.up();
  await page.screenshot({ path: H.SP + '/tests/shots/t11_editor.png' });
  await page.click('.mk-save:has-text("Сохранить")'); await H.sleep(1200);
  const ph = await page.evaluate(() => Store.data.markers[0].photos);
  ok('первое фото заменено новым (новый id, место и время те же)', ph.length === 2 && ph[0].id !== 'ph1' && ph[0].lat === 44.5487 && typeof ph[0].t === 'number', ph);
  const px = await page.evaluate(async (id) => { const d = await Store.photoGet(id); const im = new Image(); im.src = d; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); let red = 0; const a = g.getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < a.length; i += 16) if (a[i] > 180 && a[i + 1] < 60 && a[i + 2] < 60) red++; return red; }, ph[0].id);
  ok('на новой картинке есть красные отметки', px > 500, px);
  await page.screenshot({ path: H.SP + '/tests/shots/t11_viewer.png' });
  // удалить второе фото
  await page.click('#vNext'); await H.sleep(500);
  await page.click('#vDel'); await H.sleep(300);
  await page.click('#sheetBox .btn.danger'); await H.sleep(600);
  const ph2 = await page.evaluate(() => Store.data.markers[0].photos.map((p) => (typeof p === 'string' ? p : p.id)));
  ok('второе фото удалено, первое осталось', ph2.length === 1 && ph2[0] === ph[0].id, ph2);
  ok('просмотр остался на оставшемся фото', await page.evaluate(() => !document.getElementById('viewer').classList.contains('hidden') && document.getElementById('vCount').textContent.startsWith('1 / 1')));
  await page.click('#vDel'); await H.sleep(300); await page.click('#sheetBox .btn.danger'); await H.sleep(600);
  ok('последнее фото удалено, просмотр закрыт', await page.evaluate(() => Store.data.markers[0].photos.length === 0 && document.getElementById('viewer').classList.contains('hidden')));
  ok('ошибок нет', !page.errors.length, page.errors);
  console.log(bad ? `\nОШИБОК: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
