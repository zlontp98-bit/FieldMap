const H = require('./harness.cjs');
(async () => {
  const url = H.prepareWeb();
  const browser = await H.launch();
  const relay = H.makeRelay();
  const CODE = 'OLDMAP2345';
  const { page: A } = await H.phone(browser, relay, { init: `if (!sessionStorage.x) { sessionStorage.x = 1;
    localStorage.setItem('__stubAuth', JSON.stringify({ uid: 'anonA', google: false })); }` });
  await A.goto(url);
  await H.sleep(800);
  // данные «старого приложения 3.2»: фото — в IndexedDB «fieldmap», в данных — ссылки photo:<id>
  const tinyJpg = await A.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 40, 30); return c.toDataURL('image/jpeg'); });
  const old = {
    folders: [{ id: 'f1', name: 'Синяя папка', color: '#3b82f6' }, { id: 'f2', name: 'Зелёная', color: '#22c55e' }],
    markers: [
      { id: 'm1', folderId: 'f2', name: 'Колодец', color: null, lat: 44.5487, lng: 8.9675, createdAt: 1, photos: ['photo:pold1'] },
      { id: 'm2', folderId: 'f2', name: 'Красный', color: '#ef4444', lat: 44.5490, lng: 8.9680, createdAt: 1 },
      { id: 'm3', folderId: 'f1', name: 'В синей', color: null, lat: 44.5480, lng: 8.9670, createdAt: 1 },
    ],
    lines: [{ id: 'l1', folderId: 'f2', name: 'Трасса', color: null, createdAt: 1, points: [[44.5487, 8.9675], [44.5495, 8.9690]],
      layers: [{ id: 'ly1', type: 'cable', name: 'Кабель', color: '#3b82f6', points: [[44.5487, 8.9675], [44.5495, 8.9690]], s: [0, 140], createdAt: 1 }] }],
    reels: [], activeFolderId: 'f2', view: {},
  };
  const meta = { mapId: CODE, stamps: { folders: { f1: 5, f2: 5 }, markers: { m1: 5, m2: 5, m3: 5 }, lines: { l1: 5 }, reels: {} }, tombs: { folders: {}, markers: {}, lines: {}, reels: {} } };
  await A.evaluate(async ({ old, meta, tinyJpg }) => {
    await new Promise((res) => { const rq = indexedDB.open('fieldmap', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const t = rq.result.transaction('photos', 'readwrite'); t.objectStore('photos').put(tinyJpg, 'pold1'); t.oncomplete = res; }; });
    localStorage.setItem('fieldmap_proto_v1', JSON.stringify(old));
    localStorage.setItem('fieldmap_sync_v1', JSON.stringify(meta));
    localStorage.setItem('fieldmap_account', JSON.stringify({ uid: 'anonA', google: false }));
    Storage.prototype.setItem = function () {};   // чтобы страница при перезагрузке не записала поверх
  }, { old, meta, tinyJpg });
  // общая карта «старой версии»: те же объекты и фото уже на сервере
  const docs = new Map();
  const wire = (kind, it) => { const b = Object.assign({}, it); if (b.photos) b.photos = b.photos.map((p) => p.slice(6)); return { kind, id: it.id, updatedAt: 5, deleted: false, json: JSON.stringify(b) }; };
  old.folders.forEach((f) => docs.set('folders_' + f.id, wire('folders', f)));
  old.markers.forEach((m) => docs.set('markers_' + m.id, wire('markers', m)));
  old.lines.forEach((l) => docs.set('lines_' + l.id, wire('lines', l)));
  docs.set('photos_pold1', { kind: 'photos', id: 'pold1', data: tinyJpg, updatedAt: 1 });
  relay.maps.set(CODE, docs);

  await A.reload();
  await H.sleep(1500);
  const st = await A.evaluate(() => ({ markers: Store.data.markers.map((m) => [m.id, m.color, !!m.plan, JSON.stringify(m.photos || [])]), lines: Store.data.lines.map((l) => [l.id, l.color, !!l.plan, l.layers.map((x) => [x.color, !!x.plan])]), apkV4: Store.data.apkV4, stageV1: Store.data.stageV1, status: Sync.status() }));
  console.log('after update:', JSON.stringify(st));
  await A.screenshot({ path: H.SP + '/tests/shots/t3_after_update.png' });
  console.log('sheet:', JSON.stringify(await A.evaluate(() => document.getElementById('sheet').classList.contains('hidden') ? '' : document.getElementById('sheetBox').innerText.slice(0, 40))));
  // старое фото открывается с телефона (без сети)
  console.log('old photo local:', await A.evaluate(async () => !!(await Store.photoGet('pold1'))));
  // вход через Google: анонимный uid становится аккаунтом, карта подключается, старые фото не отправляются заново
  await A.evaluate(() => { window.__signInAs = { uid: 'anonA', name: 'Мария', email: 'maria@example.com' }; });
  await A.click('#sheetBox .btn.primary'); await H.sleep(600);
  await A.fill('#sheetBox input', 'Мария'); await A.click('#sheetBox .btn.primary');
  await H.sleep(1500);
  console.log('status after sign-in:', JSON.stringify(await A.evaluate(() => Sync.status())), 'relay', JSON.stringify(relay.stats));
  const srv = relay.maps.get(CODE);
  console.log('server m1:', srv.get('markers_m1').json, '\nserver m3 color:', JSON.parse(srv.get('markers_m3').json).color);
  // журнал: чужая работа не записывается
  const logBefore = await A.evaluate(() => (Store.data.log || []).length);
  await A.evaluate(async () => {
    // как будто другой телефон протянул кабель по линии: приходит запись с сервера
    const l = JSON.parse(JSON.stringify(Store.data.lines[0]));
    l.layers.push({ id: 'ly2', type: 'cable', name: 'Кабель 2', color: '#22c55e', points: l.points, s: [0, 140], createdAt: Date.now() });
    const h = Object.values(window.__relayH)[0];
    h.onChanges([{ kind: 'lines', id: 'l1', data: { kind: 'lines', id: 'l1', updatedAt: Date.now() + 1000, deleted: false, json: JSON.stringify(l) } }], { fromCache: false });
  });
  await H.sleep(500);
  console.log('layers on A:', await A.evaluate(() => Store.data.lines[0].layers.length), 'log entries before/after remote:', logBefore, await A.evaluate(() => (Store.data.log || []).length));
  // присланная точка из Google Карт
  const ok = await A.evaluate(() => window.__onSharedLocation({ text: 'Bar Roma\nhttps://maps.app.goo.gl/xyz', urls: ['https://maps.app.goo.gl/xyz', 'https://www.google.com/maps/place/Bar+Roma/@44.55,8.96,17z/data=!3d44.5501!4d8.9612'] }));
  await H.sleep(400);
  console.log('shared ok', ok, JSON.stringify(await A.evaluate(() => Store.data.markers.slice(-1).map((m) => [m.name, m.lat, m.lng, m.color, m.createdBy]))));
  console.log('log after own marker:', JSON.stringify(await A.evaluate(() => (Store.data.log || []).map((e) => [e.kind || e.type, e.cnt || e.len, e.by]))));
  // «Назад»
  console.log('back (nothing open):', await A.evaluate(() => window.__onBack()));
  await A.click('#btnMenu'); await H.sleep(300);
  console.log('back (drawer):', await A.evaluate(() => window.__onBack()), await A.evaluate(() => document.getElementById('drawer').classList.contains('open')));
  // экспорт и импорт
  await A.click('#btnMenu'); await H.sleep(300);
  await A.click('text=Настройки'); await H.sleep(300);
  await A.screenshot({ path: H.SP + '/tests/shots/t3_settings.png' });
  await A.click('text=Экспорт данных (объекты, фото, кабели)'); await H.sleep(1200);
  await A.click('text=Экспорт KML'); await H.sleep(300);
  console.log('bridge:', JSON.stringify(await A.evaluate(() => window.__bridgeCalls.map((c) => [c.name, c.args[0], c.args[2]]))));
  const exp = await A.evaluate(() => window.__bridgeCalls.find((c) => c.name === 'shareFile' && /data/.test(c.args[0])).args[3]);
  console.log('export head:', exp.slice(0, 120));
  // PDF участка: «Сохранить PDF»
  await A.click('#pageHead button[aria-label="Назад"]'); await H.sleep(400);
  await A.click('text=PDF участка карты'); await H.sleep(500);
  await A.click('text=Сохранить PDF'); await H.sleep(4000);
  const pdf = await A.evaluate(() => window.__lastSaved ? atob(window.__lastSaved.slice(0, 40)).slice(0, 8) + ' ' + window.__lastSaved.length : null);
  console.log('pdf:', pdf, 'toast:', await H.toastText(A));
  await A.screenshot({ path: H.SP + '/tests/shots/t3_after_pdf.png' });
  require('fs').writeFileSync(H.SP + '/tests/area.pdf', Buffer.from(await A.evaluate(() => window.__lastSaved), 'base64'));
  // поделиться маркером: карточка маркера → «Поделиться» → «Отправить»
  await A.evaluate(() => window.__onBack());
  await A.evaluate(() => { const m = Store.data.markers[0]; });
  console.log('back in pdf mode closes it:', await A.evaluate(() => !document.getElementById('areaBox')));
  console.log('errors', A.errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
