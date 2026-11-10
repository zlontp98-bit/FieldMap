// Защита работы: слияние слоёв и фото при одновременной правке без сети, счётчик неотправленного, корзина, «кто добавил».
const H = require('./harness.cjs');
const signedIn = (who) => `localStorage.setItem('__stubAuth', JSON.stringify(${JSON.stringify(Object.assign({ google: true }, who))}));
  localStorage.setItem('fieldmap_account', JSON.stringify(${JSON.stringify(Object.assign({ google: true, named: true }, who))}));
  localStorage.setItem('fieldmap_login_later', new Date().toDateString());`;
let bad = 0;
const ok = (label, cond, extra) => { if (!cond) bad++; console.log((cond ? '  ок     ' : '  ОШИБКА ') + label + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')); };
const layers = (p) => p.evaluate(() => (Store.data.lines.find((l) => l.id === 'L1') || { layers: [] }).layers.map((x) => x.name + ':' + x.points.length).sort());
const photos = (p) => p.evaluate(() => Store.photoIds((Store.data.markers.find((m) => m.id === 'M1') || {}).photos).sort());
const chip = (p) => p.evaluate(() => { const b = document.getElementById('tbSync'); return b.hidden ? 'hidden' : b.className.replace('tb-btn tb-sync ', '') + ':' + document.getElementById('tbSyncN').textContent; });
(async () => {
  const url = H.prepareWeb();
  const browser = await H.launch();
  for (const [aFirst, remoteFirst] of [[true, false], [false, false], [true, true], [false, true]]) {
    console.log(`\n=== без сети правят оба; первым в сеть выходит ${aFirst ? 'A' : 'B'}; ${remoteFirst ? 'сначала приходят чужие правки' : 'сначала уходят свои'} ===`);
    const relay = H.makeRelay();
    const A = (await H.phone(browser, relay, { init: `if (!sessionStorage.x) { sessionStorage.x = 1; ${signedIn({ uid: 'uidA', name: 'Мария', email: 'a@x.com' })} }` })).page;
    const B = (await H.phone(browser, relay, { init: `if (!sessionStorage.x) { sessionStorage.x = 1; ${signedIn({ uid: 'uidB', name: 'Олег', email: 'b@x.com' })} }` })).page;
    await A.goto(url); await B.goto(url); await H.sleep(1000);
    const pts = [[44.5487, 8.9675], [44.5495, 8.969], [44.55, 8.97]];
    await A.evaluate((pts) => {
      const S = Store.data;
      S.folders.push({ id: 'F1', name: 'Бузалла', color: '#22c55e' });
      S.markers.push({ id: 'M1', folderId: 'F1', name: 'Муфта 1', color: '#22c55e', lat: 44.5487, lng: 8.9675, createdAt: Date.now() });
      S.lines.push({ id: 'L1', folderId: 'F1', name: 'Трасса 1', color: '#22c55e', createdAt: Date.now(), points: pts,
        layers: [{ id: 'ly0', type: 'tube', name: 'Старая трубка', color: '#f97316', points: pts.slice(0, 2), s: [0, 140], createdAt: 1 },
          { id: 'ly1', type: 'cable', name: 'Кабель', color: '#22c55e', points: pts.slice(0, 2), s: [0, 140], createdAt: 1 }] });
      S.activeFolderId = 'F1';
      Store.save();
      return Sync.create();
    }, pts);
    await H.sleep(600);
    const code = await A.evaluate(() => Store.mapId);
    await B.evaluate((c) => Sync.join(c, 'merge'), code);
    await H.sleep(900);
    ok('B получил линию с двумя слоями', (await layers(B)).length === 2, await layers(B));
    ok('значок у A: всё отправлено', (await chip(A)) === 'ok:', await chip(A));

    // оба без сети
    await A.evaluate(() => window.__setOnline(false)); await B.evaluate(() => window.__setOnline(false));
    const tiny = (c) => A.evaluate((c) => { const cv = document.createElement('canvas'); cv.width = 30; cv.height = 20; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 30, 20); return cv.toDataURL('image/jpeg'); }, c);
    const jA = await tiny('#c33'), jB = await tiny('#33c');
    // A: новый кабель, удаляет старую трубку, фото на муфту
    await A.evaluate(async ({ pts, jA }) => {
      const l = Store.data.lines.find((x) => x.id === 'L1');
      l.layers = l.layers.filter((x) => x.id !== 'ly0');
      l.layers.push({ id: 'lyA', type: 'cable', name: 'Кабель A', color: '#22c55e', points: pts, s: [0, 140, 230], createdAt: Date.now() });
      await Store.photoPut('phA', jA);
      const m = Store.data.markers.find((x) => x.id === 'M1');
      m.photos = (m.photos || []).concat([{ id: 'phA', lat: 44.5, lng: 8.9, t: Date.now(), by: 'uidA' }]);
      Store.save();
    }, { pts, jA });
    await H.sleep(30);
    // B: новая трубка, дотягивает общий кабель, своё фото на ту же муфту
    await B.evaluate(async ({ pts, jB }) => {
      const l = Store.data.lines.find((x) => x.id === 'L1');
      l.layers.push({ id: 'lyB', type: 'tube', name: 'Трубка B', color: '#f97316', points: pts, s: [0, 140, 230], createdAt: Date.now() });
      const c = l.layers.find((x) => x.id === 'ly1'); c.points = pts; c.s = [0, 140, 230];
      await Store.photoPut('phB', jB);
      const m = Store.data.markers.find((x) => x.id === 'M1');
      m.photos = (m.photos || []).concat([{ id: 'phB', lat: 44.5, lng: 8.9, t: Date.now(), by: 'uidB' }]);
      Store.save();
    }, { pts, jB });
    await H.sleep(200);
    ok('значок у A: ждут отправки 3 (линия, маркер, фото)', (await chip(A)) === 'pend:3', await chip(A));
    ok('значок у B: ждут отправки 3', (await chip(B)) === 'pend:3', await chip(B));
    // выходят в сеть по очереди
    const [P1, P2] = aFirst ? [A, B] : [B, A];
    await P1.evaluate((rf) => window.__setOnline(true, rf), remoteFirst); await H.sleep(700);
    await P2.evaluate((rf) => window.__setOnline(true, rf), remoteFirst); await H.sleep(1500);
    const want = ['Кабель A:3', 'Кабель:3', 'Трубка B:3'];
    const la = await layers(A), lb = await layers(B);
    ok('у A: кабель A + трубка B + дотянутый кабель, старой трубки нет', JSON.stringify(la) === JSON.stringify(want), la);
    ok('у B: то же самое', JSON.stringify(lb) === JSON.stringify(want), lb);
    ok('у A оба фото на муфте', JSON.stringify(await photos(A)) === '["phA","phB"]', await photos(A));
    ok('у B оба фото на муфте', JSON.stringify(await photos(B)) === '["phA","phB"]', await photos(B));
    ok('значок у A: всё отправлено', (await chip(A)) === 'ok:', await chip(A));
    ok('значок у B: всё отправлено', (await chip(B)) === 'ok:', await chip(B));
    ok('B открывает фото A (скачивается с общей карты)', await B.evaluate(() => Store.photoGet('phA').then((d) => !!d)));
    const srv = JSON.parse(relay.maps.get(code).get('lines_L1').json);
    ok('на сервере те же три слоя', srv.layers.length === 3 && !srv.layers.some((x) => x.id === 'ly0'), srv.layers.map((x) => x.name));

    if (aFirst && !remoteFirst) {
      console.log(' --- корзина и «кто добавил» ---');
      // имена участников пришли при подключении
      await B.mouse.click(206, 430 - 22); await H.sleep(500);
      const card = (await B.evaluate(() => document.getElementById('mSheet').innerText)).replace(/\n+/g, ' | ');
      ok('в карточке муфты у B: «Добавил: Мария · изменил: Олег»', /Добавил: Мария · изменил: Олег/.test(card), card.slice(0, 120));
      await B.screenshot({ path: H.SP + '/tests/shots/t7_card.png' });
      await B.evaluate(() => window.__onBack());
      // удалённая трубка — в корзине A (удалил сам) и B (удалил другой)
      const tr = (p) => p.evaluate(() => Store.trashList().then((l) => l.map((e) => [e.kind, e.obj.name, e.by])));
      ok('корзина A: только старая трубка (удалил сам)', JSON.stringify(await tr(A)) === '[["layers","Старая трубка","uidA"]]', await tr(A));
      ok('корзина B: старая трубка (удалил Мария)', JSON.stringify(await tr(B)) === '[["layers","Старая трубка","uidA"]]', await tr(B));
      // A удаляет объект целиком (с маркером и линией)
      await A.evaluate(() => { const S = Store.data; S.markers = S.markers.filter((m) => m.folderId !== 'F1'); S.lines = S.lines.filter((l) => l.folderId !== 'F1'); S.folders = S.folders.filter((f) => f.id !== 'F1'); S.activeFolderId = null; Store.save(); });
      await H.sleep(900);
      ok('у B объект пропал', await B.evaluate(() => Store.data.folders.length + Store.data.markers.length + Store.data.lines.length) === 0,
        [await B.evaluate(() => [Store.data.folders.length, Store.data.markers.length, Store.data.lines.length, JSON.parse(localStorage.getItem('fieldmap_sync_v1')).stamps]), await A.evaluate(() => JSON.parse(localStorage.getItem('fieldmap_sync_v1')).tombs), [...relay.maps.get(code).entries()].filter(([k]) => !k.startsWith('photos')).map(([k, v]) => [k, v.updatedAt, v.deleted])]);
      // B возвращает из корзины
      await B.click('#btnMenu'); await H.sleep(400);
      await B.click('text=Корзина'); await H.sleep(700);
      const page = (await B.evaluate(() => document.getElementById('pageBody').innerText)).replace(/\n+/g, ' | ');
      ok('в корзине B: объект «Бузалла», удалил Мария', /Объект «Бузалла»/.test(page) && /удалил: Мария/.test(page), page.slice(0, 260));
      await B.screenshot({ path: H.SP + '/tests/shots/t7_trash.png' });
      await B.click('.tr-row:has-text("Бузалла") .tr-btn'); await H.sleep(1200);
      const cnt = (p) => p.evaluate(() => [Store.data.folders.length, Store.data.markers.length, Store.data.lines.length, ((Store.data.lines[0] || {}).layers || []).length, Store.photoIds((Store.data.markers[0] || {}).photos).length]);
      ok('у B всё вернулось: объект, муфта с 2 фото, линия с 3 слоями', JSON.stringify(await cnt(B)) === '[1,1,1,3,2]', await cnt(B));
      ok('у A тоже вернулось', JSON.stringify(await cnt(A)) === '[1,1,1,3,2]', await cnt(A));
      ok('журнал B не записал чужую работу как свою', await B.evaluate(() => (Store.data.log || []).length) === 0, await B.evaluate(() => Store.data.log));
      // слой из корзины A возвращается на линию с новым id
      await A.click('#btnMenu'); await H.sleep(400);
      await A.click('text=Корзина'); await H.sleep(700);
      await A.click('.tr-row:has-text("Старая трубка") .tr-btn'); await H.sleep(1200);
      ok('старая трубка вернулась на линию у A и у B', (await layers(A)).length === 4 && (await layers(B)).length === 4, [await layers(A), await layers(B)]);
    }
    ok('ошибок на страницах нет', !A.errors.length && !B.errors.length, [A.errors, B.errors]);
    await A.context().close(); await B.context().close();
  }
  console.log(bad ? `\nОШИБОК: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
