// Изменение точек линии: тянуть точку, добавить на середине, убрать, «Назад», развилка не двигается;
// слои (свои, кусок кабеля через развилку, cut.s0), маркеры на линии — едут вместе с линией; до сохранения данные не меняются.
// Плюс «продолжить линию»: убрали кнопкой ↶ старые точки — слои пересчитаны.
const H = require('./harness.cjs');
let bad = 0;
const ok = (l, c, x) => { if (!c) bad++; console.log((c ? '  ок     ' : '  ОШИБКА ') + l + (x !== undefined ? ' — ' + JSON.stringify(x) : '')); };
const Z = 18, LAT0 = 44.5487, LNG0 = 8.9675;
const wx = (lng) => (lng + 180) / 360 * 256 * 2 ** Z;
const wy = (lat) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** Z; };
const scr = (lat, lng) => [206 + wx(lng) - wx(LNG0), 430 + wy(lat) - wy(LAT0)];
const hav = (a, b) => { const R = 6371000, r = Math.PI / 180; const d1 = (b[0] - a[0]) * r, d2 = (b[1] - a[1]) * r; const x = Math.sin(d1 / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(d2 / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const plen = (p) => p.slice(1).reduce((t, q, i) => t + hav(p[i], q), 0);
(async () => {
  const url = H.prepareWeb();
  const browser = await H.launch();
  const { page } = await H.phone(browser, H.makeRelay(), { init: "localStorage.setItem('fieldmap_login_later', new Date().toDateString());" });
  await page.goto(url); await H.sleep(1000);
  const A = [LAT0, 8.9665], B = [LAT0, LNG0], C = [LAT0, 8.9685], N = [44.5497, 8.9685];
  await page.evaluate(({ A, B, C, N }) => {
    const S = Store.data;
    S.folders.push({ id: 'F', name: 'Объект', color: '#22c55e' });
    const L1 = { id: 'L1', folderId: 'F', name: 'Линия 1', color: '#22c55e', points: [A, B, C] };
    const L2 = { id: 'L2', folderId: 'F', name: 'Линия 2', color: '#22c55e', points: [C, N] };
    S.lines.push(L1, L2);
    L1.layers = [{ id: 'ly1', type: 'cable', name: 'Кабель 1', color: '#22c55e', style: 'solid', s: [20, 130], points: [], cut: { s0: 60, base: 10, total: 100 } }];
    L2.layers = [{ id: 'ly2', type: 'tube', name: 'Трубка 2', color: '#f97316', style: 'solid', s: [100, 0], via: [{ line: 'L1', s: [158.96, 120] }], points: [] }];
    S.markers.push({ id: 'Mmid', folderId: 'F', name: 'Колодец', color: '#22c55e', lat: A[0], lng: (A[1] + B[1]) / 2 + 0.0002, photos: [] });
    S.markers.push({ id: 'Mj', folderId: 'F', name: 'Развилка', shape: 'junction', color: '#22c55e', lat: C[0], lng: C[1], photos: [] });
    S.activeFolderId = 'F';
    localStorage.setItem('fieldmap_view', JSON.stringify({ lat: 44.5487, lng: 8.9675, z: 18 }));
    Store.save();
  }, { A, B, C, N });
  await page.reload(); await H.sleep(1200);
  // правильные «точки» путей слоёв после загрузки (как их делает приложение)
  const data = () => page.evaluate(() => JSON.parse(JSON.stringify({ lines: Store.data.lines, markers: Store.data.markers })));
  const d0 = await data();
  const L1len0 = plen(d0.lines[0].points);
  ok('исходная длина линии 1 ~159 м', Math.abs(L1len0 - 158.96) < 1, L1len0);
  // открыть линию: нажать на неё между B и C
  const [tx, ty] = scr(LAT0, 8.9680);
  await page.mouse.click(tx, ty); await H.sleep(700);
  await page.click('#mSheet .tb-item:has-text("Точки")'); await H.sleep(900);
  ok('режим изменения открыт', await page.evaluate(() => !document.getElementById('leBar').hidden && /тяните точки/.test(document.getElementById('modeTopText').textContent)));
  await page.screenshot({ path: H.SP + '/tests/shots/t15_start.png' });
  // карта могла подвинуться (fitPoints): берём экранные места точек из отрисовки — по ручкам ищем через центр масс
  const where = async (lat, lng) => page.evaluate(([la, ln]) => window.__scr ? window.__scr(la, ln) : null, [lat, lng]);
  const s0 = await where(...B);
  ok('нашли точку B на экране', !!s0, s0);
  // тянем B вниз на 80 px
  await page.mouse.move(s0[0], s0[1]); await page.mouse.down();
  await page.mouse.move(s0[0], s0[1] + 40, { steps: 4 }); await page.mouse.move(s0[0], s0[1] + 80, { steps: 4 }); await page.mouse.up(); await H.sleep(300);
  let d1 = await data();
  ok('пока не сохранили — данные линии не изменились', JSON.stringify(d1.lines[0].points) === JSON.stringify(d0.lines[0].points));
  ok('и слой тоже', JSON.stringify(d1.lines[0].layers) === JSON.stringify(d0.lines[0].layers));
  ok('длина в плашке «было»', /было/.test(await page.evaluate(() => document.getElementById('modeTopSub').textContent)), await page.evaluate(() => document.getElementById('modeTopSub').textContent));
  await page.screenshot({ path: H.SP + '/tests/shots/t15_drag.png' });
  // точка на развилке не двигается
  const sc = await where(...C);
  await page.mouse.move(sc[0], sc[1]); await page.mouse.down(); await page.mouse.move(sc[0] + 60, sc[1] + 60, { steps: 5 }); await page.mouse.up(); await H.sleep(300);
  ok('развилка не сдвинулась (подсказка)', /развилке/.test(await H.toastText(page)), await H.toastText(page));
  // «＋» между A и B — новая точка
  const sa = await where(...A), sb = await page.evaluate(() => window.__scrPt(1));
  await page.mouse.click((sa[0] + sb[0]) / 2, (sa[1] + sb[1]) / 2); await H.sleep(300);
  ok('добавилась точка (4)', (await page.evaluate(() => window.__lePts().length)) === 4, await page.evaluate(() => window.__lePts().length));
  await page.click('.le-btn:has-text("Назад")'); await H.sleep(200);
  ok('«Назад» — снова 3 точки', (await page.evaluate(() => window.__lePts().length)) === 3);
  await page.click('.le-btn:has-text("Назад")'); await H.sleep(200);
  ok('ещё «Назад» — B на старом месте', JSON.stringify(await page.evaluate(() => window.__lePts()[1])) === JSON.stringify(B));
  // снова тянем B и сохраняем
  const s1 = await where(...B);
  await page.mouse.move(s1[0], s1[1]); await page.mouse.down(); await page.mouse.move(s1[0], s1[1] + 80, { steps: 6 }); await page.mouse.up(); await H.sleep(300);
  await page.click('.le-btn:has-text("Сохранить")'); await H.sleep(400);
  const sheet = await page.evaluate(() => document.getElementById('sheet').classList.contains('hidden') ? '' : document.getElementById('sheetBox').innerText);
  ok('спрашивает про длину слоёв (было 110 м)', /Длина слоёв изменится/.test(sheet) && /Кабель 1: 110 м →/.test(sheet), sheet);
  await page.screenshot({ path: H.SP + '/tests/shots/t15_confirm.png' });
  await page.click('#sheetBox .btn.primary'); await H.sleep(500);
  const d2 = await data();
  const L1 = d2.lines.find((l) => l.id === 'L1'), L2 = d2.lines.find((l) => l.id === 'L2');
  const nb = L1.points[1], NT = plen(L1.points);
  ok('B сдвинулась вниз (южнее)', nb[0] < B[0] - 0.0001 && Math.abs(nb[1] - B[1]) < 0.00005, nb);
  ok('A и C на месте', JSON.stringify(L1.points[0]) === JSON.stringify(A) && JSON.stringify(L1.points[2]) === JSON.stringify(C));
  const ab0 = hav(A, B), ab1 = hav(A, nb), bc0 = hav(B, C), bc1 = hav(nb, C);
  const ly = L1.layers[0];
  ok('кабель: начало 20 м растянулось с куском A–B', Math.abs(ly.s[0] - 20 * ab1 / ab0) < 0.05, [ly.s[0], 20 * ab1 / ab0]);
  ok('кабель: конец 130 м — на куске B–C', Math.abs(ly.s[1] - (ab1 + (130 - ab0) * bc1 / bc0)) < 0.05, [ly.s[1], ab1 + (130 - ab0) * bc1 / bc0]);
  const mp = (x) => (x <= ab0 ? x * ab1 / ab0 : ab1 + (x - ab0) * bc1 / bc0);
  ok('cut.s0 тоже пересчитан', Math.abs(ly.cut.s0 - mp(60)) < 0.05, [ly.cut.s0, mp(60)]);
  ok('путь кабеля проходит через новую точку B', ly.points.some((p) => hav(p, nb) < 0.01), ly.points.length);
  ok('длина кабеля = по его положениям', Math.abs(plen(ly.points) - (ly.s[1] - ly.s[0])) < 0.1, [plen(ly.points), ly.s[1] - ly.s[0]]);
  const v = L2.layers[0].via[0];
  ok('трубка через развилку: начало куска на линии 1 = новый конец (C)', Math.abs(v.s[0] - NT) < 0.05, [v.s[0], NT]);
  const tl = plen(L2.layers[0].points), want = 100 + (NT - mp(120 - 0)) ;
  ok('трубка: длина = 100 м по линии 2 + кусок по линии 1 до нового места', Math.abs(tl - (100 + v.s[0] - v.s[1])) < 0.2 && Math.abs(v.s[1] - mp(120)) < 0.05, [tl, 100 + v.s[0] - v.s[1], v.s[1], mp(120)]);
  const mm = d2.markers.find((m) => m.id === 'Mmid'), mj = d2.markers.find((m) => m.id === 'Mj');
  ok('маркер на линии уехал вместе с ней (южнее)', mm.lat < A[0] - 0.00001, [mm.lat, mm.lng]);
  ok('развилка на месте', mj.lat === C[0] && mj.lng === C[1]);
  ok('режим закрыт', await page.evaluate(() => document.getElementById('leBar').hidden));
  await page.screenshot({ path: H.SP + '/tests/shots/t15_saved.png' });
  // «Отмена» без изменений и с изменениями
  await page.evaluate(() => window.__leStart('L1')); await H.sleep(500);
  const s2 = await page.evaluate(() => window.__scrPt(1));
  await page.mouse.move(s2[0], s2[1]); await page.mouse.down(); await page.mouse.move(s2[0] + 50, s2[1], { steps: 5 }); await page.mouse.up(); await H.sleep(200);
  await page.click('.le-btn:has-text("Отмена")'); await H.sleep(300);
  await page.click('#sheetBox .btn.danger'); await H.sleep(300);
  ok('отмена: линия как была', JSON.stringify((await data()).lines[0].points) === JSON.stringify(L1.points));
  // «продолжить линию» от начала (A) и убрать кнопкой ↶ две старые точки: слои пересчитываются, а не теряются
  const before = await data();
  const L1b = before.lines.find((l) => l.id === 'L1'), OT = plen(L1b.points), lyb = L1b.layers[0], vb = before.lines.find((l) => l.id === 'L2').layers[0].via[0];
  await page.evaluate((a) => localStorage.setItem('fieldmap_view', JSON.stringify({ lat: a[0], lng: a[1], z: 18 })), A);
  await page.reload(); await H.sleep(1200);
  await page.click('text=Проект'); await H.sleep(300);
  await page.click('#fabLine'); await H.sleep(400);
  await page.click('#linePlus'); await H.sleep(300);
  ok('продолжаем линию 1 от A', /Продолжаем/.test(await H.toastText(page)), await H.toastText(page));
  await page.click('#lineUndo'); await H.sleep(150); await page.click('#lineUndo'); await H.sleep(150);
  await page.mouse.move(206, 300); await page.mouse.down(); await page.mouse.move(206, 420, { steps: 8 }); await page.mouse.up(); await H.sleep(300);
  await page.click('#linePlus'); await H.sleep(200);
  await page.click('#lineSave'); await H.sleep(600);
  const after = await data();
  const L1c = after.lines.find((l) => l.id === 'L1'), NT2 = plen(L1c.points);
  ok('у линии 2 точки: C и новая', L1c.points.length === 2 && JSON.stringify(L1c.points[0]) === JSON.stringify(C), L1c.points);
  const mr = (x) => NT2 * (1 - x / OT);
  ok('кабель пересчитан (линия теперь от C)', Math.abs(L1c.layers[0].s[0] - mr(lyb.s[0])) < 0.05 && Math.abs(L1c.layers[0].s[1] - mr(lyb.s[1])) < 0.05, [L1c.layers[0].s, lyb.s.map(mr)]);
  ok('кабель лежит в пределах линии', L1c.layers[0].s.every((x) => x >= -0.01 && x <= NT2 + 0.01));
  const vc = after.lines.find((l) => l.id === 'L2').layers[0].via[0];
  ok('трубка через развилку: начинается у C (0 м)', Math.abs(vc.s[0]) < 0.05 && Math.abs(vc.s[1] - mr(vb.s[1])) < 0.05, [vc.s, vb.s.map(mr)]);
  await page.screenshot({ path: H.SP + '/tests/shots/t15_extend.png' });
  ok('ошибок нет', !page.errors.length, page.errors);
  console.log(bad ? `\nОШИБОК: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
