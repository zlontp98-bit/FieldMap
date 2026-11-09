// Настоящий Firebase (проект пользователя), тестовая карта: проверка вызовов Firestore — подписка без фото, фото по запросу.
const { chromium } = require('playwright');
const H = require('./harness.cjs');
const AUTH = () => {
  window.FIELDMAP_AUTH_FACTORY = async () => {
    const fb = await loadFirebase(window.FIREBASE_CONFIG);
    const A = fb.authM, auth = A.getAuth(fb.app);
    await A.signInAnonymously(auth);
    return { onChange(cb) { A.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, google: true, name: 'Проверка', email: '' } : null)); },
      google: async () => null, signOut: async () => {}, setName: async () => {} };
  };
  localStorage.setItem('fieldmap_account', JSON.stringify({ uid: 'x', google: true, name: 'Проверка', named: true }));
};
(async () => {
  const url = H.prepareWeb();
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY }, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const mk = async () => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 412, height: 860 } });
    await ctx.route(/https:\/\/(mt\d\.google|basemaps\.cartocdn)\.com\/.*/, (r) => r.abort());
    const p = await ctx.newPage();
    p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errors.push(m.text()); });
    p.reads = []; p.on('request', (r) => { if (/firestore/.test(r.url())) p.reads.push(r.url().slice(0, 90)); });
    await p.addInitScript(AUTH);
    await p.goto(url);
    await H.sleep(2500);
    return p;
  };
  const A = await mk();
  await A.evaluate(() => Sync.create());
  const code = await A.evaluate(() => Store.mapId);
  console.log('test map code:', code, JSON.stringify(await A.evaluate(() => Sync.status())));
  const jpg = await A.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#48c'; g.fillRect(0, 0, 300, 200); return c.toDataURL('image/jpeg'); });
  await A.evaluate(async (jpg) => {
    Store.data.folders.push({ id: 'ftest', name: 'Тест APK 4.0', color: '#22c55e' });
    await Store.photoPut('phtest1', jpg);
    Store.data.markers.push({ id: 'mtest', folderId: 'ftest', name: 'Проверка', color: '#22c55e', lat: 44.5, lng: 8.9, createdAt: Date.now(),
      photos: [{ id: 'phtest1', lat: 44.5, lng: 8.9, t: Date.now(), by: 'x', gps: true }] });
    Store.save();
  }, jpg);
  await H.sleep(5000);
  console.log('A status', JSON.stringify(await A.evaluate(() => Sync.status())), 'sent?', await A.evaluate(() => Store.isSent('phtest1')));
  const B = await mk();
  await B.evaluate((c) => Sync.join(c, 'merge'), code);
  await H.sleep(4000);
  console.log('B markers:', JSON.stringify(await B.evaluate(() => Store.data.markers.map((m) => [m.name, m.photos]))));
  console.log('B has photo locally before opening:', await B.evaluate(() => Store.photoLocal('phtest1').then((d) => !!d)));
  const got = await B.evaluate(() => Store.photoGet('phtest1').then((d) => d ? d.length : null));
  console.log('B opened photo, length:', got, 'same as sent:', got === jpg.length);
  console.log('errors A', A.errors.filter((e) => !/Участники/.test(e)), 'B', B.errors.filter((e) => !/Участники/.test(e)));
  console.log('members errors (expected with old rules):', A.errors.filter((e) => /Участники/.test(e)).slice(0, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
