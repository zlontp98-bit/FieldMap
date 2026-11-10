// Загрузчик (assets/web/index.html → app.html) и обновление без APK. Оболочка (MainActivity) заменена заглушкой:
// appHtml отдаёт встроенную страницу или «скачанное обновление», fetchText — описание обновления.
const H = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
const ASSETS = path.resolve(process.env.FM_WEB, '../app/src/main/assets/web');
let bad = 0;
const ok = (label, cond, extra) => { if (!cond) bad++; console.log((cond ? '  ок     ' : '  ОШИБКА ') + label + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')); };
const sheet = (p) => p.evaluate(() => { const s = document.getElementById('sheet'); return s && !s.classList.contains('hidden') ? document.getElementById('sheetBox').innerText.replace(/\n+/g, ' | ') : ''; });
(async () => {
  const appHtml = fs.readFileSync(path.join(ASSETS, 'app.html'), 'utf8');
  const ver = JSON.parse(fs.readFileSync(path.join(ASSETS, 'version.json'), 'utf8'));
  const url = 'file://' + path.join(ASSETS, 'index.html');
  const browser = await H.launch();
  const shell = (manifest) => `
    window.__APP = ${JSON.stringify(appHtml)};
    window.__MANIFEST = ${JSON.stringify(manifest)};
    localStorage.setItem('fieldmap_login_later', new Date().toDateString());
    (function () {
      const B = window.AndroidBridge, calls = window.__bridgeCalls;
      const cur = () => Number(localStorage.getItem('__stubWeb')) || ${ver.web};
      B.appHtml = () => { calls.push({ name: 'appHtml', args: [cur()] });
        return cur() > ${ver.web} ? window.__APP.replace(/window\.FM_WEB = \{[^}]*\};/, 'window.FM_WEB = {"v": ' + cur() + ', "name": "' + localStorage.getItem('__stubWebName') + '"};') : window.__APP; };
      B.bootOk = (v) => calls.push({ name: 'bootOk', args: [v] });
      B.updateState = () => JSON.stringify({ apk: 8, apkName: '4.1', builtinWeb: ${ver.web}, web: cur(), bad: 0 });
      B.fetchText = (u, id) => { calls.push({ name: 'fetchText', args: [u] }); setTimeout(() => window.__onFetchText(id, window.__MANIFEST ? JSON.stringify(window.__MANIFEST) : null), 50); };
      B.downloadWebUpdate = (u, sha, v) => { calls.push({ name: 'downloadWebUpdate', args: [u, sha, v] }); localStorage.setItem('__stubWeb', v); localStorage.setItem('__stubWebName', window.__MANIFEST.web.name); setTimeout(() => window.__onWebUpdate(JSON.stringify({ ok: true, version: v })), 1500); };
      B.downloadApk = (u, sha) => { calls.push({ name: 'downloadApk', args: [u, sha] }); setTimeout(() => window.__onApkUpdate(JSON.stringify({ state: 'progress', pct: 40 })), 30); setTimeout(() => window.__onApkUpdate(JSON.stringify({ state: 'install' })), 120); };
    })();`;
  const man = (o) => Object.assign({ format: 1, web: { version: ver.web, name: ver.name, url: 'https://github.com/zlontp98-bit/FieldMap/releases/download/stable/web.html', sha256: 'a'.repeat(64), minApk: 8 },
    apk: { versionCode: 8, versionName: '4.1', url: 'https://github.com/zlontp98-bit/FieldMap/releases/download/stable/FieldMap.apk', sha256: 'b'.repeat(64), push: false }, minWeb: 0,
    notes: { ru: 'Проверка обновления', it: 'Prova', en: 'Test' } }, o);
  const calls = (p, n) => p.evaluate((n) => window.__bridgeCalls.filter((c) => c.name === n).map((c) => c.args), n);

  console.log('=== загрузчик: встроенная страница через оболочку ===');
  let { page } = await H.phone(browser, H.makeRelay(), { init: shell(man({})) });
  await page.goto(url); await H.sleep(1500);
  ok('адрес страницы не изменился', page.url().endsWith('/assets/web/index.html'), page.url());
  ok('приложение запустилось (версия страницы)', JSON.stringify(await page.evaluate(() => window.FM_WEB)) === JSON.stringify({ v: ver.web, name: ver.name }), await page.evaluate(() => window.FM_WEB));
  ok('оболочке сообщили: страница запустилась', JSON.stringify(await calls(page, 'bootOk')) === `[[${ver.web}]]`, await calls(page, 'bootOk'));
  ok('проверка обновления идёт в релиз stable', (await calls(page, 'fetchText'))[0][0].endsWith('/download/stable/update.json'), await calls(page, 'fetchText'));
  ok('обновления нет — окно не показано', (await sheet(page)) === '', await sheet(page));
  await page.evaluate(() => { Store.data.folders.push({ id: 'F1', name: 'Проверка', color: '#22c55e' }); Store.save(); });
  await page.reload(); await H.sleep(1200);
  ok('данные на месте после перезапуска', await page.evaluate(() => Store.data.folders.map((f) => f.name).join()) === 'Проверка');
  await page.screenshot({ path: H.SP + '/tests/shots/t8_loader.png' });
  ok('ошибок нет', !page.errors.length, page.errors);
  await page.context().close();

  console.log('=== загрузчик без оболочки (запасной путь) ===');
  ({ page } = await H.phone(browser, H.makeRelay(), { init: 'delete window.AndroidBridge.appHtml;' }));
  await page.goto(url); await H.sleep(1500);
  ok('приложение запустилось', (await page.evaluate(() => window.FM_WEB && window.FM_WEB.v)) === ver.web);
  ok('адрес страницы не изменился', page.url().endsWith('/assets/web/index.html'), page.url());
  await page.context().close();

  console.log('=== обновление страницы без APK ===');
  ({ page } = await H.phone(browser, H.makeRelay(), { init: shell(man({ web: { version: ver.web + 1, name: '4.1.1', url: 'https://github.com/zlontp98-bit/FieldMap/releases/download/stable/web.html', sha256: 'c'.repeat(64), minApk: 8 } })) }));
  await page.goto(url); await H.sleep(1500);
  await page.evaluate(() => { Store.data.folders.push({ id: 'F1', name: 'Проверка', color: '#22c55e' }); Store.save(); });
  ok('показано «Доступно обновление 4.1.1»', /Доступно обновление 4\.1\.1.*Проверка обновления.*Обновить.*Позже/.test(await sheet(page)), await sheet(page));
  await page.screenshot({ path: H.SP + '/tests/shots/t8_offer.png' });
  await page.click('#sheetBox .btn.primary'); await H.sleep(900);
  const boxTxt = await page.evaluate(() => { const e = document.getElementById('updBox'); return e ? e.innerText.replace(/\n+/g, ' | ') : ''; });
  ok('во время загрузки видно окно с процентами', /Скачиваю обновление….*\d+%.*Не закрывайте приложение/.test(boxTxt), boxTxt);
  await page.screenshot({ path: H.SP + '/tests/shots/t8_progress.png' });
  await H.sleep(3200);
  ok('после перезапуска работает новая версия', JSON.stringify(await page.evaluate(() => window.FM_WEB)) === JSON.stringify({ v: ver.web + 1, name: '4.1.1' }), await page.evaluate(() => window.FM_WEB));
  ok('данные на месте', await page.evaluate(() => Store.data.folders.map((f) => f.name).join()) === 'Проверка');
  ok('сообщение «Приложение обновлено»', /Приложение обновлено: версия 4\.1\.1/.test(await H.toastText(page)), await H.toastText(page));
  ok('окно обновления больше не показано', (await sheet(page)) === '', await sheet(page));
  await page.click('#btnMenu'); await H.sleep(300); await page.click('text=Настройки'); await H.sleep(300);
  const set = (await page.evaluate(() => document.getElementById('pageBody').innerText)).replace(/\n+/g, ' | ');
  ok('в настройках: Версия 4.1.1 (9)', set.includes(`Версия 4.1.1 (${ver.web + 1})`), set.slice(-220));
  await page.screenshot({ path: H.SP + '/tests/shots/t8_settings.png' });
  await page.click('text=Пробные версии'); await H.sleep(500);
  ok('пробные версии: проверка идёт в релиз latest', (await calls(page, 'fetchText')).some((a) => a[0].endsWith('/download/latest/update.json')), await calls(page, 'fetchText'));
  ok('ошибок нет', !page.errors.length, page.errors);
  await page.context().close();

  console.log('=== обязательное обновление: старая версия не подключается к общей карте ===');
  const signed = `localStorage.setItem('__stubAuth', JSON.stringify({ uid: 'uidA', google: true, name: 'Мария', email: 'a@x.com' }));
    localStorage.setItem('fieldmap_account', JSON.stringify({ uid: 'uidA', google: true, name: 'Мария', email: 'a@x.com', named: true }));`;
  const relay = H.makeRelay();
  relay.maps.set('ABCDE12345', new Map([['folders_F9', { kind: 'folders', id: 'F9', updatedAt: 5, deleted: false, json: JSON.stringify({ id: 'F9', name: 'С сервера', color: '#22c55e' }) }]]));
  ({ page } = await H.phone(browser, relay, { init: shell(man({ minWeb: ver.web + 1, web: { version: ver.web + 1, name: '4.2', url: 'https://github.com/zlontp98-bit/FieldMap/releases/download/stable/web.html', sha256: 'd'.repeat(64), minApk: 8 } })) +
    `if (!localStorage.getItem('fieldmap_sync_v1')) { ${signed} localStorage.setItem('fieldmap_sync_v1', JSON.stringify({ mapId: 'ABCDE12345', stamps: { folders: {}, markers: {}, lines: {}, reels: {} }, tombs: { folders: {}, markers: {}, lines: {}, reels: {} }, v4: true })); }` }));
  await page.goto(url); await H.sleep(2000);
  ok('общая карта закрыта для старой версии', await page.evaluate(() => Sync.status().state + '|' + Sync.connected() + '|' + Store.data.folders.length) === 'off|false|0', await page.evaluate(() => [Sync.status(), Sync.connected(), Store.data.folders.length]));
  ok('показано «Нужно обновить приложение»', /Нужно обновить приложение/.test(await sheet(page)), await sheet(page));
  await page.screenshot({ path: H.SP + '/tests/shots/t8_must.png' });
  await page.click('#sheetBox .btn.primary'); await H.sleep(4500);
  ok('после обновления общая карта подключилась', await page.evaluate(() => Sync.status().state + '|' + Store.data.folders.map((f) => f.name).join()) === 'online|С сервера', await page.evaluate(() => [Sync.status(), Store.data.folders]));
  ok('ошибок нет', !page.errors.length, page.errors);
  await page.context().close();

  console.log('=== нужна новая оболочка: предлагается APK ===');
  ({ page } = await H.phone(browser, H.makeRelay(), { init: shell(man({ web: { version: ver.web + 2, name: '4.2', url: 'https://github.com/zlontp98-bit/FieldMap/releases/download/stable/web.html', sha256: 'e'.repeat(64), minApk: 9 },
    apk: { versionCode: 9, versionName: '4.2', url: 'https://github.com/zlontp98-bit/FieldMap/releases/download/stable/FieldMap.apk', sha256: 'f'.repeat(64), push: false } })) }));
  await page.goto(url); await H.sleep(1500);
  ok('показано обновление с установкой файла', /Доступно обновление 4\.2.*Скачается новый файл приложения/.test(await sheet(page)), await sheet(page));
  await page.click('#sheetBox .btn.primary'); await H.sleep(600);
  ok('оболочку попросили скачать APK', JSON.stringify(await calls(page, 'downloadApk')) === JSON.stringify([['https://github.com/zlontp98-bit/FieldMap/releases/download/stable/FieldMap.apk', 'f'.repeat(64)]]), await calls(page, 'downloadApk'));
  ok('сообщение «Нажмите Установить»', /Установить/.test(await H.toastText(page)), await H.toastText(page));
  ok('страница при этом не скачивалась', (await calls(page, 'downloadWebUpdate')).length === 0);
  await page.context().close();

  console.log(bad ? `\nОШИБОК: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
