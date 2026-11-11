// Закрепление объектов: зажать объект в меню → «Закрепить наверху»; порядок сохраняется после перезапуска
const H = require('./harness.cjs');
let bad = 0;
const ok = (l, c, x) => { if (!c) bad++; console.log((c ? '  ок     ' : '  ОШИБКА ') + l + (x !== undefined ? ' — ' + JSON.stringify(x) : '')); };
(async () => {
  const url = H.prepareWeb();
  const browser = await H.launch();
  const { page } = await H.phone(browser, H.makeRelay(), { init: "localStorage.setItem('fieldmap_login_later', new Date().toDateString());" });
  await page.goto(url); await H.sleep(1000);
  await page.evaluate(() => {
    const S = Store.data;
    ['Cliente Sestri', 'Via Pillea', 'Borzoli 116'].forEach((n, i) => S.folders.push({ id: 'F' + i, name: n, color: ['#22c55e', '#3b82f6', '#ef4444'][i] }));
    S.activeFolderId = 'F0';
    Store.save();
  });
  await page.reload(); await H.sleep(1200);
  const names = () => page.evaluate(() => [...document.querySelectorAll('#dList .row .ttl')].map((e) => e.textContent));
  const hold = async (name) => {
    const loc = page.locator('#dList .row', { hasText: name });
    await loc.scrollIntoViewIfNeeded(); await H.sleep(200);
    const b = await loc.boundingBox();
        await page.mouse.move(b.x + 60, b.y + b.height / 2); await page.mouse.down(); await H.sleep(1100); await page.mouse.up(); await H.sleep(400);
  };
  await page.click('#btnMenu'); await H.sleep(400);
  ok('сначала обычный порядок', JSON.stringify(await names()) === JSON.stringify(['Cliente Sestri', 'Via Pillea', 'Borzoli 116']), await names());
  await hold('Borzoli 116');
  ok('после удержания — окно с «Закрепить наверху»', await page.evaluate(() => !document.getElementById('sheet').classList.contains('hidden') && /Закрепить наверху/.test(document.getElementById('sheetBox').innerText)));
  await page.screenshot({ path: H.SP + '/tests/shots/t14_menu.png' });
  await page.click('#sheetBox .st-row:has-text("Закрепить наверху")'); await H.sleep(400);
  ok('Borzoli 116 — первым', (await names())[0] === 'Borzoli 116', await names());
  ok('меню не закрылось, видна булавка', await page.evaluate(() => document.getElementById('drawer').classList.contains('open') && !!document.querySelector('#dList .row.pinned .pin-ic')));
  ok('подсказка «Объект закреплён»', /закреплён/.test(await H.toastText(page)), await H.toastText(page));
  await hold('Via Pillea');
  await page.click('#sheetBox .st-row:has-text("Закрепить наверху")'); await H.sleep(400);
  ok('последний закреплённый — первым', JSON.stringify(await names()) === JSON.stringify(['Via Pillea', 'Borzoli 116', 'Cliente Sestri']), await names());
  await page.screenshot({ path: H.SP + '/tests/shots/t14_pinned.png' });
  // после перезапуска
  await page.reload(); await H.sleep(1200);
  await page.click('#btnMenu'); await H.sleep(400);
  ok('после перезапуска порядок тот же', JSON.stringify(await names()) === JSON.stringify(['Via Pillea', 'Borzoli 116', 'Cliente Sestri']), await names());
  ok('закрепление не попало в данные карты', await page.evaluate(() => !JSON.stringify(Store.data.folders).includes('pin')));
  await hold('Via Pillea');
  ok('у закреплённого — «Открепить»', await page.evaluate(() => /Открепить/.test(document.getElementById('sheetBox').innerText)));
  await page.click('#sheetBox .st-row:has-text("Открепить")'); await H.sleep(400);
  ok('открепили — вернулся на место', JSON.stringify(await names()) === JSON.stringify(['Borzoli 116', 'Cliente Sestri', 'Via Pillea']), await names());
  // переименовать прямо из окна удержания
  await hold('Cliente Sestri');
  await page.screenshot({ path: H.SP + '/tests/shots/t14_menu2.png' });
  ok('в окне: Закрепить, Переименовать, Удалить объект', await page.evaluate(() => ['Закрепить наверху', 'Переименовать', 'Удалить объект'].every((t) => document.getElementById('sheetBox').innerText.includes(t))));
  await page.click('#sheetBox .st-row:has-text("Переименовать")'); await H.sleep(300);
  await page.fill('#sheetBox input.field', 'Cliente Sestri Ponente');
  await page.screenshot({ path: H.SP + '/tests/shots/t14_rename.png' });
  await page.click('#sheetBox .btn.primary'); await H.sleep(400);
  ok('имя изменилось в данных и в списке', await page.evaluate(() => Store.data.folders.find((f) => f.id === 'F0').name) === 'Cliente Sestri Ponente' && (await names()).includes('Cliente Sestri Ponente'), await names());
  // удалить
  await page.evaluate(() => { Store.data.markers.push({ id: 'M1', folderId: 'F1', name: 'm', lat: 44.5, lng: 8.9, photos: [] }); });
  await hold('Via Pillea');
  await page.click('#sheetBox .st-row:has-text("Удалить объект")'); await H.sleep(300);
  ok('спрашивает подтверждение с числом', /Удалить объект и всё внутри \(1\)/.test(await page.evaluate(() => document.getElementById('sheetBox').innerText)), await page.evaluate(() => document.getElementById('sheetBox').innerText));
  await page.click('#sheetBox .btn.danger'); await H.sleep(500);
  ok('объект и его маркер удалены', await page.evaluate(() => !Store.data.folders.some((f) => f.id === 'F1') && !Store.data.markers.some((m) => m.id === 'M1')));
  ok('в списке его нет', !(await names()).includes('Via Pillea'), await names());
  ok('подсказка про корзину', /Корзин/.test(await H.toastText(page)), await H.toastText(page));
  ok('ошибок нет', !page.errors.length, page.errors);
  console.log(bad ? `\nОШИБОК: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
