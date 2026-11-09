  // ===================== ТОЛЬКО В ПРИЛОЖЕНИИ (вставлено apk-port/port.py) =====================

  // ---------- файлы: отдать телефону (AndroidBridge) — «Поделиться» или «Сохранить» ----------
  const hasFileBridge = () => !!(window.AndroidBridge && window.AndroidBridge.shareBinary);
  function blobB64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || '');
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  // «Сохранить» открывает системный выбор места; ответ приходит в __onFileSaved
  let fileSaved = null;
  window.__onFileSaved = (ok) => { const f = fileSaved; fileSaved = null; if (f) f(!!ok); };
  async function giveBlob(name, mime, blob, share) {
    const B = window.AndroidBridge;
    let b64;
    try { b64 = await blobB64(blob); } catch (e) { toast('Не удалось сохранить файл'); return false; }
    if (share) { B.shareBinary(name, mime, b64); return true; }
    const ok = await new Promise((res) => { if (fileSaved) fileSaved(false); fileSaved = res; B.saveBinary(name, mime, b64); });
    if (ok) toast('Файл сохранён');
    return ok;
  }
  function dateTag() { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; }
  // текстовый файл (KML, данные): в приложении — системное меню «Поделиться» (MainActivity.Bridge.shareFile)
  function giveFile(name, mime, text) {
    if (window.AndroidBridge && window.AndroidBridge.shareFile) { window.AndroidBridge.shareFile(name, mime, text); return; }
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast('Файл готов');
  }
  function exportKml() {
    if (!KM) { notYet('Экспорт'); return; }
    giveFile(`FieldMap-${dateTag()}.kml`, 'application/vnd.google-earth.kml+xml', KM.build(S));
  }
  // всё, что есть на карте: объекты, маркеры и линии с фото, слои кабелей и трубок, бобины.
  // Фото — отдельно в photoData { id: картинка } (как файл из прототипа); чужие фото при этом скачиваются с общей карты
  async function exportData() {
    toast('Собираю фото…');
    const photoData = {};
    for (const it of S.markers.concat(S.lines)) {
      for (const p of it.photos || []) {
        const id = isShot(p) ? p.id : typeof p === 'string' && p.startsWith('photo:') ? p.slice(6) : null;
        if (!id || photoData[id]) continue;
        const v = await photoSrc(p);
        if (v) photoData[id] = v;
      }
    }
    const data = { activeFolderId: S.activeFolderId, stageV1: true };
    ['folders', 'markers', 'lines', 'reels'].forEach((k) => { data[k] = S[k] || []; });
    giveFile(`FieldMap-data-${dateTag()}.json`, 'application/json', JSON.stringify({ fieldmapExport: 2, exportedAt: Date.now(), data, photoData }));
  }
  function importFile() {
    $('fileInput').value = '';
    $('fileInput').click();
  }
  // файл данных (из прототипа или из «Экспорт данных»): объекты с теми же id заменяются, новые добавляются
  function importDataJson(obj) {
    const d = obj && (obj.data || obj);
    if (!d || !Array.isArray(d.folders) || !Array.isArray(d.markers) || !Array.isArray(d.lines)) throw new Error('bad');
    // файл из старого приложения (3.x): объект без своего цвета там рисовался цветом своего объекта (папки)
    const oldApp = !d.stageV1;
    const fcol = new Map(d.folders.filter((f) => f && f.id).map((f) => [f.id, f.color]));
    const cnt = { markers: 0, lines: 0 };
    ['folders', 'markers', 'lines', 'reels'].forEach((k) => (Array.isArray(d[k]) ? d[k] : []).forEach((it) => {
      if (!it || typeof it.id !== 'string') return;
      if (oldApp && (k === 'markers' || k === 'lines') && !it.color) it.color = safeColor(fcol.get(it.folderId) || PALETTE[0]);
      if (!Array.isArray(S[k])) S[k] = [];
      const i = S[k].findIndex((x) => x.id === it.id);
      if (i >= 0) S[k][i] = it; else S[k].push(it);
      if (k in cnt) cnt[k]++;
    }));
    // картинки фото (файл из прототипа и «Экспорт данных»)
    const pd = obj && obj.photoData;
    if (pd && typeof pd === 'object') Object.keys(pd).forEach((id) => { if (typeof pd[id] === 'string') PhotoStore.put(id, pd[id]); });
    if (!S.activeFolderId && typeof d.activeFolderId === 'string') S.activeFolderId = d.activeFolderId;
    fixActiveFolder();
    return cnt;
  }
  function importKmlText(text) {
    const groups = KM.parse(text);
    const ids = {}, now = Date.now(), cnt = { markers: 0, lines: 0 };
    groups.forEach((g) => {
      const id = uid();
      ids[g.key] = id;
      const f = { id, name: g.name || 'Импорт', color: PALETTE[S.folders.length % PALETTE.length] };
      if (g.parentKey && ids[g.parentKey]) f.parentId = ids[g.parentKey];
      S.folders.push(f);
      g.markers.forEach((m) => {
        const it = { id: uid(), folderId: id, name: m.name || '', description: m.description || '', color: KM.okColor(m.color) || f.color,
          lat: m.lat, lng: m.lng, createdAt: now, createdBy: me().id };
        if (SHAPE_IDS.includes(m.shape)) it.shape = m.shape;
        S.markers.push(it); cnt.markers++;
      });
      g.lines.forEach((l) => {
        const it = { id: uid(), folderId: id, name: l.name || '', description: l.description || '', color: KM.okColor(l.color) || f.color,
          points: l.points, createdAt: now, createdBy: me().id };
        S.lines.push(it); cnt.lines++;
      });
    });
    if (!S.activeFolderId && S.folders.length) S.activeFolderId = S.folders[0].id;
    return cnt;
  }
  $('fileInput').addEventListener('change', async () => {
    const file = $('fileInput').files[0];
    if (!file) return;
    let cnt;
    try {
      const text = await file.text();
      cnt = /^\s*\{/.test(text) ? importDataJson(JSON.parse(text)) : (KM ? importKmlText(text) : null);
    } catch (e) { cnt = null; }
    if (!cnt) { toast('Не удалось прочитать файл'); return; }
    if (!cnt.markers && !cnt.lines) { toast('В файле нет маркеров и линий'); return; }
    closePage();
    repairFolders();
    commit();
    fitPoints(allPoints());
    toast(`${tr('Импортировано:')} ${cnt.markers} ${pw(cnt.markers, 'marker')}, ${cnt.lines} ${pw(cnt.lines, 'line')}`);
  });

  // ---------- общая карта (js/sync.js) ----------
  const SYNC_STATE = { off: 'Выключена', connecting: 'Подключение…', online: 'Подключено', offline: 'Нет связи с сервером, изменения сохранятся' };
  const syncReady = () => !!(SY && ST && SY.configured());
  function syncSubtitle() {
    if (!syncReady()) return 'Firebase не настроен: заполните js/firebase-config.js';
    if (!ST.mapId) return SYNC_STATE.off;
    if (!(AU && AU.google())) return `${tr('Код:')} ${SY.pretty(ST.mapId)} · ${tr('Не вошли — общая карта недоступна')}`;
    return `${tr('Код:')} ${SY.pretty(ST.mapId)} · ${tr(SYNC_STATE[SY.status().state] || '')}`;
  }
  function syncStatusText() {
    const s = SY.status();
    return tr(SYNC_STATE[s.state] || s.state) + (s.msg && s.msg !== SYNC_STATE[s.state] ? ' — ' + tr(s.msg) : '');
  }
  let syncStatusEl = null, syncPageConnected = false, syncBusy = false;
  const syncPageOpen = () => pageIsOpen() && $('page').dataset.screen === 'sync';
  async function syncRun(fn, okMsg) {
    if (syncBusy) return;
    syncBusy = true;
    toast('Подключение…');
    try { await fn(); toast(okMsg); }
    catch (e) { toast(tr((e && e.message) || String(e))); }
    syncBusy = false;
    if (syncPageOpen()) openSyncPage();
    if (drawerOpen()) renderTop();
  }
  function joinShared(raw) {
    const code = SY.norm(raw);
    if (code.length !== 10) { toast('Код должен состоять из 10 символов (буквы и цифры)'); return; }
    openSheet(
      h('h3', { text: 'Что сделать с данными на этом телефоне?' }),
      h('button', { class: 'btn', text: 'Объединить с общей картой',
        onclick: () => { closeSheet(); syncRun(() => SY.join(code, 'merge'), 'Подключено к общей карте'); } }),
      h('button', { class: 'btn', text: 'Заменить общей картой',
        onclick: () => { closeSheet(); syncRun(() => SY.join(code, 'replace'), 'Подключено к общей карте'); } }),
      h('div', { class: 'note', text: '«Заменить» убирает с этого телефона объекты, которых нет на общей карте. На общей карте ничего не удаляется.' }),
      h('button', { class: 'btn ghost', text: 'Отмена', onclick: closeSheet }));
  }
  const SHARE_NOTE = 'Передайте код тем, с кем ведёте карту. Войти в карту может любой, кто знает код и вошёл через Google.';
  function openSyncPage() {
    const nodes = [];
    syncStatusEl = null;
    syncPageConnected = !!(ST && ST.mapId);
    if (!syncReady()) {
      nodes.push(pgCard(h('div', { class: 'pg-note', text: 'Firebase не настроен: заполните js/firebase-config.js' })),
        h('div', { class: 'note', text: 'Инструкция — в README.md, раздел «Общая карта»' }));
    } else if (!(AU && AU.google())) {
      // общая карта — только для вошедших через Google
      nodes.push(pgCard(h('div', { class: 'pg-note', text: 'Войдите через Google, чтобы работать с общей картой' })),
        pgCard(pgRow('user', 'Войти через Google', () => signInFlow(() => { if (syncPageOpen()) openSyncPage(); }), 'accent')));
      if (syncPageConnected) nodes.push(pgSec('Код карты'), pgCard(h('div', { class: 'sync-code', text: SY.pretty(ST.mapId) })));
    } else if (syncPageConnected) {
      syncStatusEl = h('div', { class: 'pg-note', text: syncStatusText() });
      nodes.push(
        pgSec('Код карты'), pgCard(h('div', { class: 'sync-code', text: SY.pretty(ST.mapId) })),
        h('div', { class: 'note', text: SHARE_NOTE }),
        pgSec('Состояние'), pgCard(syncStatusEl),
        pgCard(
          pgRow('people', 'Участники карты', () => openMembers(openSyncPage)),
          pgRow('copy', 'Скопировать код', () => copyText(SY.pretty(ST.mapId))),
          pgRow('x', 'Отключиться', () => confirmSheet('Отключиться от общей карты? Данные останутся на телефоне.', 'Отключиться', () => {
            SY.leave(); openSyncPage();
          }), 'danger')));
    } else {
      const codeIn = h('input', { class: 'field', type: 'text', placeholder: 'XXXXX-XXXXX', maxlength: '11',
        autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' });
      nodes.push(
        pgCard(pgRow('cloud', 'Создать общую карту из моих данных', () => syncRun(() => SY.create(), 'Общая карта создана'), 'accent')),
        pgSec('Код карты'), pgCard(codeIn),
        pgCard(pgRow('import', 'Подключиться по коду', () => joinShared(codeIn.value), 'accent')),
        SY.status().msg ? pgCard(h('div', { class: 'pg-note', text: syncStatusText() })) : null,
        h('div', { class: 'note', text: SHARE_NOTE }));
    }
    openPage('Общая карта', { onBack: () => { closePage(); openDrawer(); }, onSave: closePage }, nodes);
    $('page').dataset.screen = 'sync';
  }
  // изменения с других телефонов: перерисовка не чаще раза за кадр
  let remoteRaf = null;
  function onRemoteData() {
    if (remoteRaf) return;
    remoteRaf = requestAnimationFrame(() => {
      remoteRaf = null;
      fixActiveFolder();
      // чужая работа не попадает в журнал этого телефона: снимок журнала догоняет пришедшие изменения
      if (journalOn) S.logSnap = workNow();
      onLineMemo = new Map();
      saveData();
      draw();
      if (drawerOpen()) renderDrawer();
    });
  }

  // ---------- аккаунт: вход через Google ----------
  // вход — один раз: телефон показывает свои Google-аккаунты, пароль не нужен; потом один раз спрашиваем имя
  let signing = false;
  async function signInFlow(after) {
    if (!AU || signing) return;
    signing = true;
    toast('Подключение…');
    let u = null;
    try { u = await AU.signIn(); } catch (e) { toast(tr((e && e.message) || String(e))); }
    signing = false;
    if (!u) return;
    if (ST) ST.setUser(u.uid);
    toast('Вход выполнен');
    if (drawerOpen()) renderDrawer();
    if (!u.named) askName(after); else if (after) after();
  }
  function askName(after) {
    const u = (AU && AU.user) || {};
    if (!u.google) return;
    const inp = h('input', { class: 'field', type: 'text', maxlength: '60', placeholder: 'Ваше имя', value: u.name || u.gname || '' });
    const ok = () => {
      const v = inp.value.trim();
      if (!v) { toast('Впишите имя'); return; }
      closeSheet();
      AU.setName(v).then(() => { toast('Имя сохранено'); if (drawerOpen()) renderDrawer(); if (after) after(); });
    };
    openSheet(
      h('h3', { text: 'Как вас зовут?' }),
      inp,
      h('div', { class: 'note', style: 'margin:8px 2px 12px', text: 'Имя видят все участники карты. Email не видит никто, кроме вас.' }),
      h('button', { class: 'btn primary', text: 'Сохранить имя', onclick: ok }));
  }
  function openAccount() {
    const u = AU && AU.user;
    if (!u || !u.google) { signInFlow(); return; }
    const nameIn = h('input', { class: 'field', type: 'text', maxlength: '60', placeholder: 'Ваше имя', value: u.name || '' });
    const saveName = () => {
      const v = nameIn.value.trim();
      if (!v) { toast('Впишите имя'); return; }
      AU.setName(v).then(() => { toast('Имя сохранено'); if ($('page').dataset.screen === 'account') openAccount(); });
    };
    openPage('Аккаунт', { onBack: () => { closePage(); openDrawer(); }, onSave: saveName }, [
      pgSec('Ваше имя'), pgCard(nameIn),
      h('div', { class: 'note', text: 'Имя видят все участники карты. Email не видит никто, кроме вас.' }),
      pgCard(pgRow('check', 'Сохранить имя', saveName, 'accent')),
      pgSec('Email (видите только вы)'), pgCard(h('div', { class: 'acc-mail', text: u.email || '—' })),
      ST && ST.mapId ? pgCard(pgRow('people', 'Участники карты', () => openMembers(openAccount))) : null,
      pgCard(pgRow('x', 'Выйти', () => confirmSheet('Выйти из аккаунта? Данные останутся на телефоне, общая карта отключится до следующего входа.', 'Выйти', async () => {
        try { await AU.signOut(); } catch (e) { /* на телефоне выходим всё равно */ }
        if (ST) ST.setUser(null);
        toast('Вы вышли из аккаунта');
        closePage(); openDrawer();
      }), 'danger')),
    ]);
    $('page').dataset.screen = 'account';
  }
  // участники общей карты: имя и роль (владелец — первый, кто вошёл в карту); роли — потом
  async function openMembers(back) {
    const goBack = back || (() => { closePage(); openDrawer(); });
    const box = h('div', { class: 'pg-card' }, h('div', { class: 'pg-note', text: 'Загружаю…' }));
    openPage('Участники карты', { onBack: goBack }, [pgSec('Кто работает с этой картой'), box]);
    $('page').dataset.screen = 'members';
    let list;
    try { list = await SY.members(); } catch (e) { box.replaceChildren(h('div', { class: 'pg-note', text: 'Не удалось загрузить список' })); return; }
    if ($('page').dataset.screen !== 'members') return;
    if (!list.length) { box.replaceChildren(h('div', { class: 'pg-note', text: 'Список пока пуст: участник появляется, когда входит в карту' })); return; }
    list.sort((a, b) => (b.role === 'owner') - (a.role === 'owner') || String(a.name || '').localeCompare(String(b.name || '')));
    box.replaceChildren(...list.map((m) => h('div', { class: 'mem-row' }, ico('user'),
      h('div', null, h('b', { text: m.name || '—' }),
        h('small', { text: [tr(m.role === 'owner' ? 'Владелец' : 'Участник'), m.uid === me().id ? tr('это вы') : '',
          m.joinedAt ? `${tr('с')} ${fmtStamp(m.joinedAt).slice(0, 10)}` : ''].filter(Boolean).join(' · ') })))));
  }
  // при запуске, пока не вошли: предложить вход (можно отложить)
  function loginPrompt() {
    if (!AU || AU.google() || !AU.configured() || !window.GOOGLE_WEB_CLIENT_ID || !(window.AndroidBridge && window.AndroidBridge.googleSignIn)) return;
    if (pageIsOpen() || !$('sheet').classList.contains('hidden')) return;
    openSheet(
      h('h3', { text: 'Вход через Google' }),
      h('div', { class: 'note', style: 'margin:0 2px 14px', text: 'Вход — один раз: выберите свой Google-аккаунт, пароль не нужен. Нужен для общей карты: так видно, кто что поставил.' }),
      h('button', { class: 'btn primary', text: 'Войти через Google', onclick: () => { closeSheet(); signInFlow(); } }),
      h('button', { class: 'btn ghost', text: 'Позже', onclick: closeSheet }));
  }

  // ---------- точка из Google Карт, WhatsApp и т.п.: «Поделиться» → FieldMap ставит маркер ----------
  // MainActivity передаёт текст и ссылки (короткие ссылки maps.app.goo.gl она уже развернула)
  function parseSharedLocation(text, urls) {
    const dec = (v) => {
      let t = String(v || '');
      for (let i = 0; i < 3; i++) { try { const u = decodeURIComponent(t); if (u === t) break; t = u; } catch (e) { break; } }
      return t.replace(/\+/g, ' ');
    };
    const all = [text].concat(urls || []).map(dec);
    const ok = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
    const pats = [
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,                                           // точное место в ссылке Google Карт
      /[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/,
      /\/(?:search|place|dir)\/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/,
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /geo:(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];
    for (const re of pats) for (const s of all) { const m = s.match(re); if (m && ok(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] }; }
    // градусы, минуты, секунды: 44°26'29.8"N 8°50'44.5"E
    const dms = /(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([NSСЮ])[\s,]+(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([EWВЗ])/i;
    for (const s of all) {
      const m = s.match(dms);
      if (!m) continue;
      const v = (d, mi, se, h2) => (+d + +mi / 60 + +se / 3600) * (/[SWЮЗ]/i.test(h2) ? -1 : 1);
      const a = v(m[1], m[2], m[3], m[4]), b = v(m[5], m[6], m[7], m[8]);
      if (ok(a, b)) return { lat: a, lng: b };
    }
    // просто два числа: 44.4416, 8.8457
    for (const s of all) { const m = s.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/); if (m && ok(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] }; }
    return null;
  }
  // название места: первая строка текста без ссылки и без координат
  function sharedName(text) {
    const line = String(text || '').split('\n').map((x) => x.trim())
      .find((x) => x && !/https?:\/\/|geo:/i.test(x) && !/\d+\.\d{3,}\s*,\s*-?\d+\.\d{3,}/.test(x) && !/°/.test(x));
    return line ? line.slice(0, 80) : '';
  }
  window.__onSharedLocation = (payload) => {
    let p = payload;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = { text: p }; } }
    const pos = p && parseSharedLocation(p.text, p.urls);
    if (!pos) { toast('В присланном нет координат'); return false; }
    if (mode) endMode();
    closeSheet(); closeMSheet(); closeDrawer(); closeSearch();
    if (pageIsOpen()) closePage();
    viewFresh = false;
    V.lat = pos.lat; V.lng = pos.lng; V.z = Math.max(V.z, 17);
    // объекта ещё нет — сначала его создают, потом маркер ставится сам
    if (needFolder(() => window.__onSharedLocation(p))) { onMove(); return true; }
    const fid = S.activeFolderId;
    const m = { id: uid(), folderId: fid, name: sharedName(p.text) || nextName(fid), color: S.placeColor || null, shape: S.placeShape || undefined,
      lat: pos.lat, lng: pos.lng, createdAt: Date.now(), createdBy: me().id };
    stamp(m);
    showFolder(fid);
    S.markers.push(m);
    markAnims.set(m.id, performance.now());
    commit(); onMove(); kickAnim();
    toast('Маркер поставлен по присланной точке');
    return true;
  };

  // ---------- кнопка «Назад» Android (MainActivity.onBackPressed): true — страница закрыла что-то сама ----------
  window.__onBack = () => {
    if (!$('viewer').classList.contains('hidden')) { closeViewer(); return true; }
    if ($('schemaActs')) { closeSchemaActs(); return true; }
    if (!$('sheet').classList.contains('hidden')) { closeSheet(); return true; }
    const sc = $('schema');
    if (sc && !sc.classList.contains('hidden')) { closeSchema(); return true; }
    if ($('areaBox')) { endAreaPdf(); return true; }
    if (!$('search').classList.contains('hidden')) { closeSearch(); return true; }
    if (pageIsOpen()) { const b = $('pageHead').querySelector('button'); if (b) b.click(); else closePage(); return true; }
    if (drawerOpen()) { closeDrawer(); return true; }
    if ($('mapPop') && !$('mapPop').hidden) { closeMapPop(); return true; }
    if (!$('mSheet').classList.contains('hidden')) { closeMSheet(); return true; }
    if (mode === 'line' && (LS.pts.length || (LS.layerS && LS.layerS.length))) { toast('Двойное нажатие ✕ — удалить линию'); return true; }
    if (mode) { endMode(); return true; }
    if (pickerOpen) { closeLinePicker(); draw(); return true; }
    const lp = $('layerPanel');
    if (lpIsOpen() || (lp && !lp.hidden)) { hideLayerPanel(); clearSelection(); draw(); return true; }
    if (photoPins) { hidePhotoPins(); return true; }
    if (clearSelection()) { draw(); return true; }
    return false;
  };

  // ---------- запуск части приложения: общая карта, вход, GPS, присланная точка ----------
  function appStart() {
    if (SY) {
      SY.onRemote(onRemoteData);
      SY.onStatus((st) => {
        if (drawerOpen()) renderTop();
        if (syncPageOpen()) {
          if (!!(ST && ST.mapId) !== syncPageConnected) openSyncPage();
          else if (syncStatusEl) syncStatusEl.textContent = syncStatusText();
        }
        if (st.state === 'off' && st.msg) toast(st.msg);
      });
    }
    if (AU) {
      AU.onChange((u) => {
        if (ST) ST.setUser(u && u.google ? u.uid : null);
        if (drawerOpen()) renderDrawer();
        if (syncPageOpen()) openSyncPage();
      });
      AU.start().catch(() => { /* без интернета: остаётся вход, сохранённый на телефоне */ });
    }
    if (SY) SY.autostart();
    gpsStart();
    // точка, присланная в приложение до загрузки страницы (Поделиться → FieldMap)
    let shared = null;
    try { shared = window.AndroidBridge && window.AndroidBridge.takeShared ? window.AndroidBridge.takeShared() : null; } catch (e) { shared = null; }
    if (shared) window.__onSharedLocation(shared);
    else if (AU && !AU.google()) setTimeout(loginPrompt, 700);
    else if (AU && AU.user && !AU.user.named) setTimeout(() => askName(), 700);
  }

