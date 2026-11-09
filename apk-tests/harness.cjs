// Общая обвязка проверок страницы приложения FieldMap в Chromium (Playwright).
// Firestore заменён ретранслятором в Node (FIELDMAP_BACKEND_FACTORY), вход Google — заглушкой (FIELDMAP_AUTH_FACTORY),
// AndroidBridge — заглушкой, которая записывает вызовы в window.__bridgeCalls.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// FM_WEB — папка web распакованного проекта (fieldmap2/app/src/main/assets/web); снимки и файлы — в FM_OUT
const WEB_SRC = process.env.FM_WEB || path.resolve(__dirname, '../work/fieldmap2/app/src/main/assets/web');
const SP = process.env.FM_OUT || path.join(require('os').tmpdir(), 'fieldmap-tests');
fs.mkdirSync(path.join(SP, 'tests/shots'), { recursive: true });

// копия страницы с заполненным Web client ID (в репозитории он пустой, пока пользователь не пришлёт)
function prepareWeb() {
  const dst = path.join(SP, 'testweb');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(WEB_SRC, dst, { recursive: true });
  const cfg = path.join(dst, 'js/firebase-config.js');
  fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace('window.GOOGLE_WEB_CLIENT_ID = "";', 'window.GOOGLE_WEB_CLIENT_ID = "test-client.apps.googleusercontent.com";'));
  return 'file://' + path.join(dst, 'index.html');
}

// маленький PNG (сплошной цвет) для тайлов карты
function png(w, h, rgb) {
  const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = png(256, 256, [200, 220, 200]);

// ---- ретранслятор вместо Firestore ----
function makeRelay() {
  const maps = new Map();      // mapId -> Map(docId -> data)
  const members = new Map();   // mapId -> Map(uid -> doc)
  const subs = [];             // { page, mapId, id }
  const stats = { photoPuts: 0, photoGets: 0, pushes: 0 };
  let subSeq = 0;
  const docs = (m) => { if (!maps.has(m)) maps.set(m, new Map()); return maps.get(m); };
  const deliver = (s, changes) => s.page.evaluate(({ id, changes }) => {
    const h = window.__relayH && window.__relayH[id];
    if (h) { h.onChanges(changes, { fromCache: false }); h.onState(true, ''); }
  }, { id: s.id, changes }).catch(() => {});
  return {
    maps, members, stats,
    async attach(page) {
      await page.exposeFunction('__relaySub', (mapId) => {
        const s = { page, mapId, id: ++subSeq };
        subs.push(s);
        setTimeout(() => {
          const changes = [...docs(mapId).entries()].filter(([, d]) => d.kind !== 'photos').map(([, d]) => ({ kind: d.kind, id: d.id, data: d }));
          deliver(s, changes);
        }, 30);
        return s.id;
      });
      await page.exposeFunction('__relayUnsub', (id) => { const i = subs.findIndex((s) => s.id === id); if (i >= 0) subs.splice(i, 1); });
      await page.exposeFunction('__relayPush', (mapId, docId, data) => {
        docs(mapId).set(docId, data);
        if (data.kind === 'photos') { stats.photoPuts++; return true; }
        stats.pushes++;
        subs.filter((s) => s.mapId === mapId).forEach((s) => deliver(s, [{ kind: data.kind, id: data.id, data }]));
        return true;
      });
      await page.exposeFunction('__relayGet', (mapId, docId) => { stats.photoGets++; return docs(mapId).get(docId) || null; });
      await page.exposeFunction('__relayMember', (mapId, me) => {
        if (!members.has(mapId)) members.set(mapId, new Map());
        const ms = members.get(mapId);
        const was = ms.get(me.uid);
        const role = was ? was.role : (ms.size ? 'editor' : 'owner');
        ms.set(me.uid, { uid: me.uid, name: me.name, role, joinedAt: was ? was.joinedAt : Date.now() });
        return role;
      });
      await page.exposeFunction('__relayMembers', (mapId) => [...((members.get(mapId) || new Map()).values())]);
    },
  };
}

const INIT = () => {
  // ---- заглушки: Firestore, вход Google, AndroidBridge ----
  window.FIELDMAP_BACKEND_FACTORY = async () => ({
    async subscribe(mapId, h) {
      const id = await window.__relaySub(mapId);
      window.__relayH = window.__relayH || {};
      window.__relayH[id] = h;
      return { push: (kind, docId, data) => window.__relayPush(mapId, kind + '_' + docId, data), close() { delete window.__relayH[id]; window.__relayUnsub(id); } };
    },
    async getPhoto(mapId, id) { const d = await window.__relayGet(mapId, 'photos_' + id); return d ? d.data : null; },
    putPhoto: (mapId, id, data) => window.__relayPush(mapId, 'photos_' + id, { kind: 'photos', id, data, updatedAt: 1 }),
    joinMember: (mapId, me) => window.__relayMember(mapId, me),
    members: (mapId) => window.__relayMembers(mapId),
  });
  window.FIELDMAP_AUTH_FACTORY = async () => {
    let cb = null;
    let user = null;
    try { user = JSON.parse(localStorage.getItem('__stubAuth')); } catch (e) { user = null; }
    return {
      onChange(f) { cb = f; setTimeout(() => f(user), 0); },
      async google(token) {
        const t = JSON.parse(token);
        user = { uid: t.uid, google: true, name: t.name, email: t.email };
        localStorage.setItem('__stubAuth', JSON.stringify(user));
        setTimeout(() => cb && cb(user), 0);
        return user;
      },
      async signOut() { user = null; localStorage.removeItem('__stubAuth'); setTimeout(() => cb && cb(null), 0); },
      async setName() {},
    };
  };
  window.__bridgeCalls = [];
  const log = (name, args) => window.__bridgeCalls.push({ name, args });
  window.AndroidBridge = {
    shareText: (t) => log('shareText', [t]),
    shareFile: (n, m, t) => log('shareFile', [n, m, t.length, t.slice(0, 200)]),
    shareBinary: (n, m, b) => log('shareBinary', [n, m, b.length, b.slice(0, 40)]),
    saveBinary: (n, m, b) => { log('saveBinary', [n, m, b.length, b.slice(0, 40)]); window.__lastSaved = b; setTimeout(() => window.__onFileSaved(true), 10); },
    openMap: (a, b, n) => log('openMap', [a, b, n]),
    takeShared: () => window.__pendingShare || null,
    requestLocationPermission: () => log('requestLocationPermission', []),
    googleSignIn: (cid) => {
      log('googleSignIn', [cid]);
      const who = window.__signInAs || { uid: 'uidA', name: 'Мария Иванова', email: 'maria@example.com' };
      setTimeout(() => window.__onGoogleSignIn(JSON.stringify({ idToken: JSON.stringify(who), name: who.name, email: who.email })), 30);
    },
  };
};

async function launch() {
  return chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--allow-file-access-from-files'] });
}

async function phone(browser, relay, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
    geolocation: { latitude: 44.5487, longitude: 8.9675, accuracy: 12 }, permissions: ['geolocation'],
  });
  await ctx.route(/https:\/\/mt\d\.google\.com\/.*/, (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: TILE }));
  await ctx.route(/https:\/\/basemaps\.cartocdn\.com\/.*/, (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: TILE }));
  await ctx.route(/https:\/\/www\.gstatic\.com\/.*/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  if (relay) await relay.attach(page);
  await page.addInitScript(INIT);
  if (opts.init) await page.addInitScript(opts.init);
  return { ctx, page };
}

const toastText = (page) => page.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { prepareWeb, makeRelay, launch, phone, toastText, sleep, SP };
