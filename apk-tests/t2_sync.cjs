const H = require('./harness.cjs');
const fs = require('fs');
const signedIn = (who) => `localStorage.setItem('__stubAuth', JSON.stringify(${JSON.stringify(Object.assign({ google: true }, who))}));
  localStorage.setItem('fieldmap_account', JSON.stringify(${JSON.stringify(Object.assign({ google: true, named: true }, who))}));`;
(async () => {
  const url = H.prepareWeb();
  const browser = await H.launch();
  const relay = H.makeRelay();
  const A = (await H.phone(browser, relay, { init: `if (!sessionStorage.x) { sessionStorage.x = 1; ${signedIn({ uid: 'uidA', name: 'Мария', email: 'maria@example.com' })} }` })).page;
  await A.goto(url);
  await H.sleep(1200);
  // фото-файл для камеры
  const jpg = await A.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#3a7'; g.fillRect(0, 0, 800, 600); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText('TEST', 250, 330); return c.toDataURL('image/jpeg', 0.9); });
  fs.writeFileSync(H.SP + '/tests/shot.jpg', Buffer.from(jpg.split(',')[1], 'base64'));

  // A: новый объект
  await A.click('#btnMenu'); await H.sleep(400);
  await A.click('.btn.add-folder'); await H.sleep(400);
  await A.fill('#pageBody input.field', 'Бузалла 1');
  await A.click('#pageHead button[aria-label="Сохранить"]'); await H.sleep(400);
  // A: общая карта
  await A.click('#btnMenu'); await H.sleep(400);
  await A.click('text=Общая карта'); await H.sleep(400);
  await A.click('text=Создать общую карту из моих данных'); await H.sleep(1200);
  const code = await A.evaluate(() => Store.mapId);
  console.log('code', code, 'status', JSON.stringify(await A.evaluate(() => Sync.status())), 'role', await A.evaluate(() => Sync.role()));
  await A.screenshot({ path: H.SP + '/tests/shots/t2_sync_page.png' });
  await A.click('#pageHead button[aria-label="Назад"]'); await H.sleep(300);
  await A.evaluate(() => document.getElementById('backdrop').click()); await H.sleep(300);
  // A: маркер в центре
  await A.click('#fabAdd'); await H.sleep(500);
  await A.click('#markOk'); await H.sleep(900);
  const m = await A.evaluate(() => Store.data.markers.map((x) => ({ id: x.id, name: x.name, color: x.color, plan: x.plan, createdBy: x.createdBy, updatedBy: x.updatedBy })));
  console.log('A markers', JSON.stringify(m));
  // A: нажать на маркер → карточка → камера
  await A.mouse.click(206, 430 - 22); await H.sleep(600);
  const camBtn = await A.$('.tb-cam, [aria-label="Снять фото"], .tb-head button.cam');
  console.log('sheet text:', (await A.evaluate(() => document.getElementById('mSheet').innerText)).replace(/\n+/g, ' | ').slice(0, 200));
  const btns = await A.evaluate(() => [...document.querySelectorAll('#mSheet button')].map((b) => (b.getAttribute('aria-label') || b.innerText || '').trim()).filter(Boolean));
  console.log('sheet buttons', JSON.stringify(btns));
  const [chooser] = await Promise.all([A.waitForEvent('filechooser', { timeout: 5000 }), A.click('#mSheet button[aria-label="Снять фото"], #mSheet button[aria-label="Фото"], #mSheet .tb-camera')]);
  console.log('chooser capture?', await chooser.element().evaluate((e) => [e.accept, e.getAttribute('capture')]));
  await chooser.setFiles(H.SP + '/tests/shot.jpg');
  await H.sleep(2500);
  const ph = await A.evaluate(() => Store.data.markers[0].photos);
  console.log('A photos', JSON.stringify(ph));
  await A.screenshot({ path: H.SP + '/tests/shots/t2_viewer.png' });
  console.log('relay after A:', JSON.stringify(relay.stats), [...(relay.maps.get(code) || new Map()).keys()]);

  // B: другой человек, входит по коду
  const B = (await H.phone(browser, relay, { init: `if (!sessionStorage.x) { sessionStorage.x = 1; ${signedIn({ uid: 'uidB', name: 'Олег', email: 'oleg@example.com' })} }` })).page;
  await B.goto(url);
  await H.sleep(1200);
  await B.click('#btnMenu'); await H.sleep(400);
  await B.click('text=Общая карта'); await H.sleep(400);
  await B.fill('#pageBody input.field', code);
  await B.click('text=Подключиться по коду'); await H.sleep(300);
  await B.click('text=Объединить с общей картой'); await H.sleep(1500);
  const bm = await B.evaluate(() => Store.data.markers.map((x) => ({ name: x.name, photos: x.photos, createdBy: x.createdBy })));
  console.log('B markers', JSON.stringify(bm));
  console.log('relay after B joined (photoGets must be 0):', JSON.stringify(relay.stats));
  const got = await B.evaluate(async () => { const p = Store.data.markers[0].photos[0]; const d = await Store.photoGet(p.id); return d ? d.slice(0, 30) + '… ' + d.length : null; });
  console.log('B opened photo:', got, JSON.stringify(relay.stats));
  const again = await B.evaluate(async () => { const p = Store.data.markers[0].photos[0]; const d = await Store.photoGet(p.id); return !!d; });
  console.log('B second open (no new download):', again, JSON.stringify(relay.stats));
  // участники
  await B.click('text=Участники карты'); await H.sleep(800);
  console.log('B members page:', (await B.evaluate(() => document.getElementById('pageBody').innerText)).replace(/\n+/g, ' | '));
  await B.screenshot({ path: H.SP + '/tests/shots/t2_members.png' });
  // правка на B доходит до A
  await B.evaluate(() => { Store.data.markers[0].name = 'Колодец 7'; Store.save(); });
  await H.sleep(800);
  console.log('A sees name:', await A.evaluate(() => Store.data.markers[0].name), 'updatedBy', await A.evaluate(() => Store.data.markers[0].updatedBy));
  console.log('errors A', A.errors, 'B', B.errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
