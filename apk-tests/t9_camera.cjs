const { chromium } = require('playwright');
const H = require('./harness.cjs');
(async () => {
  const url = H.prepareWeb();
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY }, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 412, height: 860 }, geolocation: { latitude: 44.43265, longitude: 8.85499, accuracy: 7 }, permissions: ['geolocation', 'camera'] });
  await ctx.route(/gstatic|cartocdn/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  // геокодер телефона (как Android Geocoder: Google, с номером дома)
  await page.addInitScript(() => { window.AndroidBridge = { geocode(lat, lng, id) { setTimeout(() => window.__onGeocode(id, { road: 'Via Borzoli', house: '116', quarter: 'Sestri Ponente', city: 'Genova', postcode: '16153', line: 'Via Borzoli, 116, 16153 Genova GE, Italia', country: 'Italia' }), 300); } }; });
  // как в WebView без нажатия: первый play() отклоняется
  await page.addInitScript(() => { const orig = HTMLMediaElement.prototype.play; let n = 0; HTMLMediaElement.prototype.play = function () { if (n++ === 0) return Promise.reject(new DOMException('gesture', 'NotAllowedError')); return orig.call(this); }; });
  await page.addInitScript(() => { localStorage.setItem('fieldmap_login_later', new Date().toDateString()); localStorage.setItem('fieldmap_view', JSON.stringify({ lat: 44.43265, lng: 8.85499, z: 18 })); });
  await page.goto(url); await H.sleep(2500);
  await page.click('#btnMenu'); await H.sleep(300); await page.click('.btn.add-folder'); await H.sleep(300);
  await page.fill('#pageBody input.field', 'Cliente Sestri Ponente'); await page.click('#pageHead button[aria-label="Сохранить"]'); await H.sleep(400);
  await page.click('#fabAdd'); await H.sleep(400); await page.click('#markOk'); await H.sleep(800);
  await page.mouse.click(206, 430 - 22); await H.sleep(600);
  console.log('sheet buttons', await page.evaluate(() => [...document.querySelectorAll('#mSheet button')].map((b) => b.getAttribute('aria-label'))));
  await page.click('#mSheet button[aria-label="Снять фото"]'); await H.sleep(1200);
  console.log('after click: camBox', await page.evaluate(() => !!document.getElementById('camBox')), 'toast', await H.toastText(page), 'cam ok', await page.evaluate(() => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)), errs);
  console.log('кнопка «Включить камеру» видна:', await page.evaluate(() => !document.getElementById('camStart').hidden), 'видео на паузе:', await page.evaluate(() => document.getElementById('camVideo').paused));
  if (await page.evaluate(() => !document.getElementById('camStart').hidden)) { await page.click('#camStart'); await H.sleep(600); }
  console.log('после нажатия: кнопка скрыта:', await page.evaluate(() => document.getElementById('camStart').hidden), 'видео идёт:', await page.evaluate(() => !document.getElementById('camVideo').paused));
  // компас: телефон вертикально, камера смотрит на юго-запад
  await page.evaluate(() => { const e = new Event('deviceorientationabsolute'); Object.assign(e, { alpha: 135, beta: 90, gamma: 0, absolute: true }); for (let i = 0; i < 20; i++) window.dispatchEvent(e); });
  await H.sleep(5000);
  console.log('экран:', (await page.evaluate(() => document.getElementById('camBox').innerText)).replace(/\n+/g, ' | '));
  await page.screenshot({ path: H.SP + '/cam_live.png' });
  await page.click('#camShot'); await H.sleep(2500);
  console.log('камера закрыта:', await page.evaluate(() => !document.getElementById('camBox')), 'фото:', JSON.stringify(await page.evaluate(() => Store.data.markers[0].photos)));
  await page.screenshot({ path: H.SP + '/cam_photo.png' });
  console.log('errors', errs.filter((e) => !/ERR_FAILED/.test(e)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
