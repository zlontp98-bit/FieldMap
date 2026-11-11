// Фото линии видны в карточке (как у маркера); «Где снято» — место съёмки, а у фото без места — маркер или линия
const H = require('./harness.cjs');
let bad = 0;
const ok = (l, c, x) => { if (!c) bad++; console.log((c ? '  ок     ' : '  ОШИБКА ') + l + (x !== undefined ? ' — ' + JSON.stringify(x) : '')); };
(async () => {
  const url = H.prepareWeb();
  const browser = await H.launch();
  const { page } = await H.phone(browser, H.makeRelay(), { init: "localStorage.setItem('fieldmap_login_later', new Date().toDateString());" });
  await page.goto(url); await H.sleep(1000);
  await page.evaluate(async () => {
    const mk = (c) => { const v = document.createElement('canvas'); v.width = 800; v.height = 600; const g = v.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 800, 600); return v.toDataURL('image/jpeg'); };
    await Store.photoPut('lp1', mk('#a33')); await Store.photoPut('lp2', mk('#35a')); await Store.photoPut('mp1', mk('#3a5'));
    const S = Store.data;
    S.folders.push({ id: 'F', name: 'Объект', color: '#22c55e' });
    S.lines.push({ id: 'L', folderId: 'F', name: 'Линия 1', color: '#22c55e', points: [[44.5487, 8.9660], [44.5487, 8.9690]], layers: [],
      photos: [{ id: 'lp1', lat: 44.5495, lng: 8.9700, t: Date.now() }, 'photo:lp2'] });
    S.markers.push({ id: 'M', folderId: 'F', name: 'Колодец', color: '#22c55e', lat: 44.5480, lng: 8.9675, photos: ['photo:mp1'] });
    S.activeFolderId = 'F';
    localStorage.setItem('fieldmap_view', JSON.stringify({ lat: 44.5487, lng: 8.9675, z: 18 }));
    Store.save();
  });
  await page.reload(); await H.sleep(1200);
  // нажать на линию (идёт через середину экрана)
  await page.mouse.click(150, 430); await H.sleep(700);
  const n = await page.evaluate(() => document.querySelectorAll('#mSheet:not(.hidden) .tb-ph').length);
  ok('в карточке линии видны 2 фото', n === 2, n);
  ok('кнопка «Где сняты фото» осталась', await page.evaluate(() => !!document.querySelector('#mSheet .ph-pins')));
  await page.screenshot({ path: H.SP + '/tests/shots/t12_card.png' });
  const view = () => page.evaluate(() => JSON.parse(localStorage.getItem('fieldmap_view') || 'null'));
  // фото с местом съёмки → карта едет туда
  await page.click('#mSheet .tb-ph >> nth=0'); await H.sleep(600);
  ok('«Где снято» видно', await page.evaluate(() => !document.getElementById('vWhere').hidden));
  await page.click('#vWhere'); await H.sleep(1500);
  let v = await view();
  ok('карта у места съёмки', v && Math.abs(v.lat - 44.5495) < 2e-4 && Math.abs(v.lng - 8.9700) < 2e-4, v);
  ok('просмотр и карточка закрыты', await page.evaluate(() => document.getElementById('viewer').classList.contains('hidden') && document.getElementById('mSheet').classList.contains('hidden')));
  await page.screenshot({ path: H.SP + '/tests/shots/t12_where.png' });
  // фото без места → показана линия
  await page.evaluate(() => { localStorage.setItem('fieldmap_view', JSON.stringify({ lat: 44.5487, lng: 8.9675, z: 18 })); });
  await page.reload(); await H.sleep(1200);
  await page.mouse.click(150, 430); await H.sleep(700);
  await page.click('#mSheet .tb-ph >> nth=1'); await H.sleep(600);
  ok('«Где снято» видно и у фото без места', await page.evaluate(() => !document.getElementById('vWhere').hidden));
  await page.click('#vWhere'); await H.sleep(300);
  ok('подсказка «показана линия»', /показана линия/.test(await H.toastText(page)), await H.toastText(page));
  // фото маркера без места → показан маркер
  await page.evaluate(() => { localStorage.setItem('fieldmap_view', JSON.stringify({ lat: 44.5480, lng: 8.9675, z: 16 })); });
  await page.reload(); await H.sleep(1200);
  await page.mouse.click(206, 430 - 22); await H.sleep(700);
  await page.click('#mSheet .tb-ph >> nth=0'); await H.sleep(600);
  await page.click('#vWhere'); await H.sleep(1500);
  ok('подсказка «показан маркер»', /показан маркер/.test(await H.toastText(page)), await H.toastText(page));
  v = await view();
  ok('карта у маркера, крупнее', v && v.z >= 18 && Math.abs(v.lat - 44.5480) < 2e-4 && Math.abs(v.lng - 8.9675) < 2e-4, v);
  await page.screenshot({ path: H.SP + '/tests/shots/t12_marker.png' });
  ok('ошибок нет', !page.errors.length, page.errors);
  console.log(bad ? `\nОШИБОК: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
