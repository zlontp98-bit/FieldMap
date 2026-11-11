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
    try { list = await SY.members(); } catch (e) {
      const why = String((e && e.code) || '').includes('permission-denied')
        ? 'Firebase не пускает к списку участников: опубликуйте переходные правила Firestore (весь текст целиком) и перезапустите приложение'
        : String((e && e.message) || e || '');
      box.replaceChildren(h('div', { class: 'pg-note', text: 'Не удалось загрузить список' }), h('div', { class: 'pg-note', style: 'opacity:.75', text: why }));
      return;
    }
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
    if (lsLater('fieldmap_login_later')) return;     // «Позже» — до завтра не спрашиваем
    openSheet(
      h('h3', { text: 'Вход через Google' }),
      h('div', { class: 'note', style: 'margin:0 2px 14px', text: 'Вход — один раз: выберите свой Google-аккаунт, пароль не нужен. Нужен для общей карты: так видно, кто что поставил.' }),
      h('button', { class: 'btn primary', text: 'Войти через Google', onclick: () => { closeSheet(); signInFlow(); } }),
      h('button', { class: 'btn ghost', text: 'Позже', onclick: () => { lsLater('fieldmap_login_later', true); closeSheet(); } }));
  }
  // «Позже»: запоминается до конца дня
  function lsLater(key, set) {
    try {
      if (set) { localStorage.setItem(key, new Date().toDateString()); return true; }
      return localStorage.getItem(key) === new Date().toDateString();
    } catch (e) { return false; }
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
    if (CAM.isOpen) { CAM.close(); return true; }
    if (MARK.isOpen) { MARK.close(); return true; }
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

  // ---------- адрес по координатам (OpenStreetMap, нужен интернет) ----------
  // Сначала — геокодер телефона (сервис Google, с номерами домов; оболочка 10+), если не ответил —
  // Nominatim (не чаще раза в секунду, правило сервиса) и запасной Photon (komoot). Ответы запоминаются на телефоне.
  const GEO = (() => {
    const gWait = {};
    let gSeq = 0;
    window.__onGeocode = (id, a) => { const f = gWait[id]; delete gWait[id]; if (f) f(a && typeof a === 'object' ? a : null); };
    function phone(lat, lng) {
      const B = window.AndroidBridge;
      if (!B || !B.geocode) return Promise.resolve(null);
      return new Promise((res) => {
        const id = 'g' + (++gSeq);
        gWait[id] = res;
        setTimeout(() => { if (gWait[id]) { delete gWait[id]; res(null); } }, 6000);
        try { B.geocode(lat, lng, id); } catch (e) { delete gWait[id]; res(null); }
      });
    }
    const KEY = 'fieldmap_geo', MAX = 400;
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { cache = {}; }
    const save = () => {
      const ks = Object.keys(cache);
      if (ks.length > MAX) ks.sort((a, b) => cache[a].t - cache[b].t).slice(0, ks.length - MAX).forEach((k) => delete cache[k]);
      try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ignore */ }
    };
    let queue = Promise.resolve(), lastAt = 0;
    const lang = () => (LANG === 'ru' ? 'it' : LANG);   // названия улиц — как на месте
    const timed = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
    async function fetchJson(url) {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }
    // { road, house, quarter, city, line? } или null
    async function ask(lat, lng) {
      const g = await phone(lat, lng);
      if (g && (g.road || g.city)) {
        // строка адреса телефона без страны: «Via Borzoli, 116, 16153 Genova GE»
        let line = String(g.line || '');
        if (g.country) line = line.replace(new RegExp(',\\s*' + g.country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'), '');
        return { road: g.road || '', house: g.house || '', quarter: g.quarter || '', city: g.city || '', line: line.trim() };
      }
      return askOsm(lat, lng);
    }
    function askOsm(lat, lng) {
      const run = async () => {
        const wait = 1100 - (Date.now() - lastAt);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastAt = Date.now();
        try {
          const j = await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=${lang()}&lat=${lat}&lon=${lng}`);
          const a = j && j.address;
          if (a) return { road: a.road || a.pedestrian || a.footway || a.path || a.square || '', house: a.house_number || '',
            quarter: a.suburb || a.quarter || a.neighbourhood || a.city_district || a.hamlet || '',
            city: a.city || a.town || a.village || a.municipality || a.county || '' };
        } catch (e) { /* ниже — запасной сервис */ }
        try {
          const j = await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
          const a = j && j.features && j.features[0] && j.features[0].properties;
          if (a) return { road: a.street || '', house: a.housenumber || '', quarter: a.locality || a.district || '', city: a.city || a.county || '' };
        } catch (e) { /* без сети */ }
        return null;
      };
      const p = queue.then(run, run);
      queue = p.catch(() => null);
      return p;
    }
    async function get(lat, lng) {
      const k = '2:' + lat.toFixed(4) + ',' + lng.toFixed(4) + ':' + lang();
      if (cache[k]) return cache[k].a;
      if (navigator.onLine === false) return null;
      const a = await ask(+lat.toFixed(6), +lng.toFixed(6));
      if (a && (a.road || a.city)) { cache[k] = { t: Date.now(), a }; save(); }
      return a;
    }
    return {
      // «Via Borzoli 12, Borzoli, Genova» — для подписи фото
      async address(lat, lng, ms) {
        const a = await timed(get(lat, lng).catch(() => null), ms || 6000);
        if (!a) return '';
        if (a.line) return a.line;
        const road = [a.road, a.house].filter(Boolean).join(' ');
        return [road, a.quarter && a.quarter !== a.city ? a.quarter : '', a.city].filter(Boolean).join(', ');
      },
      // «Genova, Borzoli» — для места в отчёте
      async place(lat, lng, ms) {
        const a = await timed(get(lat, lng).catch(() => null), ms || 8000);
        if (!a) return '';
        return [a.city, a.quarter && a.quarter !== a.city ? a.quarter : ''].filter(Boolean).join(', ');
      },
    };
  })();

  // место для отчёта за день: по первому маркеру, поставленному в этот день, в каждом объекте,
  // где была работа (если маркеров не ставили — по началу линии, где тянули кабель или трубку)
  const autoBusy = {};
  function autoPlaceFor(ds) {
    if (autoBusy[ds]) return autoBusy[ds];
    const p = (async () => {
      const next = shiftDay(ds, 1);
      const day = (S.log || []).filter((e) => e.t >= ds && e.t < next).sort((a, b) => a.t - b.t);
      const first = new Map();   // объект → [lat, lng]
      day.forEach((e) => {
        if (e.cnt === undefined || e.cnt <= 0) return;
        const m = S.markers.find((x) => 'm:' + x.id === e.id);
        if (m && !first.has(topFolderId(m.folderId))) first.set(topFolderId(m.folderId), [m.lat, m.lng]);
      });
      day.forEach((e) => {
        if (e.cnt !== undefined) return;
        const l = S.lines.find((x) => (x.layers || []).some((ly) => ly.id === e.id));
        if (l && l.points && l.points.length && !first.has(topFolderId(l.folderId))) first.set(topFolderId(l.folderId), l.points[0]);
      });
      if (!first.size) return '';
      const names = [];
      for (const [lat, lng] of first.values()) { const n = await GEO.place(lat, lng); if (n && !names.includes(n)) names.push(n); }
      const v = names.join('; ').slice(0, 80);
      if (v) { if (!S.reportAuto || typeof S.reportAuto !== 'object') S.reportAuto = {}; S.reportAuto[ds] = v; saveData(); }
      return v;
    })().finally(() => { delete autoBusy[ds]; });
    autoBusy[ds] = p;
    return p;
  }

  // ---------- камера внутри приложения: на экране вживую дата, координаты с точностью GPS, адрес и компас ----------
  // Снимок — кадр с камеры, на него впечатывается ровно то, что было на экране в момент съёмки.
  // Нет камеры или доступа к ней — открывается приложение камеры телефона, как раньше.
  const CAM = (() => {
    let el = null, stream = null, timer = null, target = null, onShot = null, heading = null, addr = { at: null, text: '', busy: false, t: 0 };
    const DIRS = { ru: ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'], it: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'], en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] };
    const dirName = (h) => (DIRS[LANG] || DIRS.ru)[Math.round(h / 45) % 8];
    function ok() {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return false;
      const B = window.AndroidBridge;
      if (!B || !B.updateState) return true;
      try { return (JSON.parse(B.updateState()).apk || 0) >= 9; } catch (e) { return false; }
    }
    // куда смотрит задняя камера (0 — север, по часовой), по положению телефона
    function onOrient(e) {
      let h = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
      else if (e.alpha != null && (e.absolute || e.type === 'deviceorientationabsolute')) {
        const r = Math.PI / 180, a = e.alpha * r, b = (e.beta || 0) * r, g = (e.gamma || 0) * r;
        const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
        // направление «из задней стороны телефона»; телефон лежит плашмя — направление его верха
        let x = -(cG * sA * sB + cA * sG), y = -(sA * sG - cA * cG * sB);
        if (Math.hypot(x, y) < 0.35) { x = -cB * sA; y = cA * cB; }
        h = (Math.atan2(x, y) / r + 360) % 360;
      }
      if (h == null || !Number.isFinite(h)) return;
      heading = heading == null ? h : heading + ((((h - heading) % 360) + 540) % 360 - 180) * 0.3;   // сглаживание
      heading = (heading + 360) % 360;
    }
    const fix = () => (GPS.pos && Date.now() - GPS.t < 15000 ? { lat: GPS.pos[0], lng: GPS.pos[1], acc: GPS.acc } : null);
    // адрес запрашиваем заново, когда сдвинулись больше чем на 12 м (не чаще раза в 3 секунды)
    function refreshAddr(f) {
      if (!f || addr.busy) return;
      if (addr.at && hav(addr.at, [f.lat, f.lng]) < 12) return;
      if (Date.now() - addr.t < 3000) return;
      addr.busy = true; addr.t = Date.now();
      const at = [f.lat, f.lng];
      GEO.address(f.lat, f.lng, 8000).then((a) => { addr.busy = false; if (a) { addr.at = at; addr.text = a; } else addr.failed = navigator.onLine === false ? 'net' : 'none'; });
    }
    function paint() {
      if (!el) return;
      const f = fix();
      refreshAddr(f);
      const q = $('camGps');
      if (!f) { q.className = 'cam-gps bad'; q.textContent = tr(GPS.denied ? 'Нет доступа к GPS' : 'Ищу GPS…'); }
      else {
        const acc = Math.round(f.acc || 0), good = acc <= 10, fair = acc <= 25;
        q.className = 'cam-gps ' + (good ? 'good' : fair ? 'fair' : 'bad');
        q.textContent = `GPS ±${acc} ${tr('м')} — ${tr(good ? 'точно' : fair ? 'почти точно' : 'ждите, GPS уточняется')}`;
      }
      const lines = [fmtStamp(Date.now()), f ? `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}` : tr('Координаты: ищу GPS…'),
        addr.at && f && hav(addr.at, [f.lat, f.lng]) < 25 ? addr.text
          : addr.failed === 'net' ? tr('Нет интернета — адрес не определить') : tr('Ожидание адреса из интернета…')];
      $('camInfo').replaceChildren(...lines.map((s) => h('div', { text: s })));
      const c = $('camDir');
      c.hidden = heading == null;
      if (heading != null) { c.querySelector('svg').style.transform = `rotate(${-heading}deg)`; c.querySelector('b').textContent = dirName(heading); }
    }
    async function open(it, kind, done, fallback) {
      close();
      target = { it, kind }; onShot = done;
      addr = { at: null, text: '', busy: false, t: 0 };
      el = h('div', { id: 'camBox', class: 'cam-box' },
        // poster — прозрачная картинка: иначе Android рисует поверх видео большой серый значок «играть»
        h('video', { id: 'camVideo', autoplay: true, playsinline: true, muted: true,
          poster: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }),
        h('button', { type: 'button', id: 'camStart', class: 'cam-start', hidden: true, onclick: () => startVideo(true) }, ico('camera'), h('span', { text: 'Включить камеру' })),
        h('div', { class: 'cam-top' },
          h('button', { type: 'button', class: 'cam-x', 'aria-label': 'Закрыть', onclick: close }, ico('x')),
          h('div', { class: 'cam-title', text: [topFolderName(it.folderId), it.name].filter(Boolean).join(' · ') })),
        h('div', { id: 'camGps', class: 'cam-gps' }),
        h('div', { id: 'camInfo', class: 'cam-info' }),
        h('div', { id: 'camDir', class: 'cam-dir', hidden: true },
          h('span'), h('b')),
        h('div', { class: 'cam-bar' }, h('button', { type: 'button', id: 'camShot', class: 'cam-shot', 'aria-label': 'Снять' })));
      el.querySelector('#camDir').firstChild.innerHTML = '<svg viewBox="0 0 24 24" width="38" height="38"><path d="M12 2l6 18-6-4-6 4z" fill="#fff" stroke="#000" stroke-width=".8"/><path d="M12 2l6 18-6-4z" fill="#ef4444"/></svg>';
      document.body.appendChild(el);
      $('camShot').onclick = shoot;
      gpsStart();
      window.addEventListener('deviceorientationabsolute', onOrient);
      window.addEventListener('deviceorientation', onOrient);
      paint();
      timer = setInterval(paint, 500);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
        if (!el) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = $('camVideo');
        v.muted = true;
        v.srcObject = stream;
        startVideo(false);
      } catch (e) {
        close();
        if (fallback) fallback(); else toast('Нет доступа к камере');
      }
    }
    // видео с камеры: без нажатия Android иногда не запускает его — тогда кнопка «Включить камеру» (и нажатие по экрану)
    function startVideo(byTap) {
      const v = $('camVideo'), b = $('camStart');
      if (!v) return;
      const shown = () => { if (b) b.hidden = !v.paused; };
      const p = v.play();
      if (p && p.then) p.then(shown, () => { if (b) b.hidden = false; }); else shown();
      if (!byTap) setTimeout(shown, 1500);
      v.onclick = () => { if (v.paused) startVideo(true); };
      v.onplaying = () => { if (b) b.hidden = true; };
      if (!v.paused && b) b.hidden = true;
    }
    function close() {
      clearInterval(timer); timer = null;
      window.removeEventListener('deviceorientationabsolute', onOrient);
      window.removeEventListener('deviceorientation', onOrient);
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      if (el) { el.remove(); el = null; }
    }
    async function shoot() {
      const v = $('camVideo');
      if (!v || !v.videoWidth) { toast('Камера ещё не готова'); return; }
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      $('camShot').disabled = true;
      el.classList.add('flash');
      const f = fix(), { it, kind } = target, t = Date.now();
      let at;
      if (f) at = [f.lat, f.lng];
      else if (kind === 'l') { const p = lineTapGeo && lineTapGeo.id === it.id ? lineTapGeo.p : [V.lat, V.lng]; const q = snapOnLine(it, p[0], p[1]); at = [q.lat, q.lng]; }
      else at = [it.lat, it.lng];
      const place = addr.at && hav(addr.at, at) < 25 ? addr.text : photoPlace(it, kind);
      const dir = heading != null ? `${dirName(heading)} ${Math.round(heading)}°` : '';
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      let p;
      try {
        const src = await stampPhoto(blob, { t, at, place, dir, acc: f ? f.acc : null });
        p = { id: uid(), lat: at[0], lng: at[1], t, by: me().id };
        if (f) { p.gps = true; if (f.acc) p.acc = Math.round(f.acc); }
        if (!(await PhotoStore.put(p.id, src))) p.src = src;
      } catch (e) { close(); toast('Не удалось сохранить фото'); return; }
      const cb = onShot;
      close();
      if (cb) cb(p);
    }
    return { ok, open, close, get isOpen() { return !!el; } };
  })();

  // ---------- фото: удалить одним нажатием и отметки на фото (стрелка, круг, надпись) ----------
  // Отметки двигаются пальцем; размер и поворот — двумя пальцами или кнопками. Сохранение — новая картинка
  // (новый id фото, старая уходит из списка), место и время съёмки остаются прежними.
  const MARK = (() => {
    const COLORS = ['#e3000f', '#facc15', '#ffffff', '#22c55e'];
    let el = null, cv = null, img = null, items = [], sel = null, done = null, fit = null, color = COLORS[0];
    const ptrs = new Map();
    let drag = null, pinch = null, lastTap = 0;
    const base = () => Math.max(img.naturalWidth, img.naturalHeight);
    // стрелка как на образце: прямоугольный хвост и треугольный наконечник, без обводки
    const ARROW = [[-0.5, -0.12], [0.12, -0.12], [0.12, -0.26], [0.5, 0], [0.12, 0.26], [0.12, 0.12], [-0.5, 0.12]];
    function drawItem(g, it, k, selected) {
      g.save();
      g.translate(it.x * k, it.y * k); g.rotate(it.rot); g.scale(it.s * k, it.s * k);
      const B = base();
      if (it.type === 'arrow') {
        const L = B * 0.28;
        g.beginPath(); ARROW.forEach(([x, y], i) => (i ? g.lineTo(x * L, y * L) : g.moveTo(x * L, y * L))); g.closePath();
        g.fillStyle = it.color; g.fill();
      } else if (it.type === 'circle') {
        const R = B * 0.1;
        g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2);
        g.lineWidth = R * 0.14; g.strokeStyle = it.color; g.stroke();
      } else {
        const F = B * 0.055;
        g.font = `700 ${F}px system-ui, -apple-system, Roboto, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = F * 0.16; g.strokeStyle = it.color === '#ffffff' ? '#000' : '#fff';
        g.strokeText(it.text, 0, 0); g.fillStyle = it.color; g.fillText(it.text, 0, 0);
      }
      if (selected) {
        const b = box(it);
        g.setLineDash([B * 0.012, B * 0.012]); g.lineWidth = B * 0.004 / it.s; g.strokeStyle = '#3b82f6';
        g.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
      }
      g.restore();
    }
    // размер отметки без поворота и масштаба (в точках фото)
    function box(it) {
      const B = base();
      if (it.type === 'arrow') return { w: B * 0.3, h: B * 0.16 };
      if (it.type === 'circle') return { w: B * 0.23, h: B * 0.23 };
      const g = cv.getContext('2d'), F = B * 0.055;
      g.font = `700 ${F}px system-ui, -apple-system, Roboto, sans-serif`;
      return { w: g.measureText(it.text).width + F * 0.6, h: F * 1.4 };
    }
    function paint() {
      if (!el) return;
      const g = cv.getContext('2d'), W = cv.width, H = cv.height;
      const k = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      fit = { k, ox: (W - img.naturalWidth * k) / 2, oy: (H - img.naturalHeight * k) / 2 };
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.translate(fit.ox, fit.oy);
      g.drawImage(img, 0, 0, img.naturalWidth * k, img.naturalHeight * k);
      items.forEach((it) => drawItem(g, it, k, it === sel));
      $('mkSel').hidden = !sel;
      $('mkEditText').hidden = !(sel && sel.type === 'text');
    }
    function resize() {
      if (!el) return;
      const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); cv.dataset.d = d;
      paint();
    }
    // точка пальца → точка на фото
    function toImg(e) {
      const r = cv.getBoundingClientRect(), d = Number(cv.dataset.d) || 1;
      return [((e.clientX - r.left) * d - fit.ox) / fit.k, ((e.clientY - r.top) * d - fit.oy) / fit.k];
    }
    function hit(p) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i], dx = p[0] - it.x, dy = p[1] - it.y, c = Math.cos(-it.rot), s = Math.sin(-it.rot);
        const lx = (dx * c - dy * s) / it.s, ly = (dx * s + dy * c) / it.s, b = box(it);
        if (Math.abs(lx) <= b.w / 2 + base() * 0.02 && Math.abs(ly) <= b.h / 2 + base() * 0.02) return it;
      }
      return null;
    }
    function add(type, text) {
      const it = { type, x: img.naturalWidth / 2, y: img.naturalHeight / 2, s: 1, rot: 0, color, text: text || '' };
      items.push(it); sel = it; paint();
    }
    function askText(cur, cb) {
      const bar = $('mkText'), inp = $('mkTextIn');
      bar.hidden = false; inp.value = cur || '';
      setTimeout(() => inp.focus(), 50);
      $('mkTextOk').onclick = () => { const v = inp.value.trim(); bar.hidden = true; inp.blur(); if (v) cb(v); };
      $('mkTextNo').onclick = () => { bar.hidden = true; inp.blur(); };
    }
    function down(e) {
      e.preventDefault();
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        const p = toImg(e), it = hit(p);
        const now = Date.now();
        if (it && it === sel && it.type === 'text' && now - lastTap < 350) askText(it.text, (v) => { it.text = v; paint(); });
        lastTap = now;
        sel = it || null;
        drag = it ? { it, p0: p, x0: it.x, y0: it.y } : null;
        pinch = null;
        paint();
      } else if (ptrs.size === 2 && sel) {
        const [a, b] = [...ptrs.values()];
        pinch = { it: sel, d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x), s0: sel.s, r0: sel.rot };
        drag = null;
      }
    }
    function move(e) {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        pinch.it.s = Math.max(0.2, Math.min(6, pinch.s0 * Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, pinch.d0)));
        pinch.it.rot = pinch.r0 + Math.atan2(b.y - a.y, b.x - a.x) - pinch.a0;
        paint();
      } else if (drag) {
        const p = toImg(e);
        drag.it.x = drag.x0 + p[0] - drag.p0[0]; drag.it.y = drag.y0 + p[1] - drag.p0[1];
        paint();
      }
    }
    function up(e) { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) drag = null; }
    function btn(icon, text, fn, id) {
      return h('button', { type: 'button', class: 'mk-btn', id: id || null, onclick: fn }, icon, h('span', { text }));
    }
    function open(src, onSave) {
      close();
      done = onSave; items = []; sel = null; color = COLORS[0];
      img = new Image();
      img.onload = () => { if (el) resize(); };
      img.src = src;
      const svgI = (d) => { const s = document.createElement('span'); s.className = 'ic'; s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`; return s; };
      el = h('div', { id: 'mkBox', class: 'mk-box' },
        h('div', { class: 'mk-top' },
          h('button', { type: 'button', class: 'cam-x', 'aria-label': 'Отмена', onclick: close }, ico('x')),
          h('div', { class: 'mk-title', text: 'Отметки на фото' }),
          h('button', { type: 'button', class: 'mk-save', text: 'Сохранить', onclick: save })),
        h('canvas', { id: 'mkCanvas', class: 'mk-cv' }),
        h('div', { id: 'mkText', class: 'mk-text', hidden: true },
          h('input', { id: 'mkTextIn', class: 'field', type: 'text', maxlength: '60', placeholder: 'Надпись' }),
          h('button', { type: 'button', id: 'mkTextOk', class: 'mk-save', text: 'OK' }),
          h('button', { type: 'button', id: 'mkTextNo', class: 'cam-x', 'aria-label': 'Отмена' }, ico('x'))),
        h('div', { id: 'mkSel', class: 'mk-row', hidden: true },
          btn(svgI('<path d="M5 12h14"/>'), 'Меньше', () => { if (sel) { sel.s = Math.max(0.2, sel.s / 1.2); paint(); } }),
          btn(svgI('<path d="M12 5v14M5 12h14"/>'), 'Больше', () => { if (sel) { sel.s = Math.min(6, sel.s * 1.2); paint(); } }),
          btn(svgI('<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/>'), 'Повернуть', () => { if (sel) { sel.rot += Math.PI / 12; paint(); } }),
          btn(svgI('<path d="M4 20l4-1 11-11-3-3L5 16z"/>'), 'Текст', () => { if (sel && sel.type === 'text') askText(sel.text, (v) => { sel.text = v; paint(); }); }, 'mkEditText'),
          btn(ico('trash'), 'Убрать', () => { if (sel) { items = items.filter((x) => x !== sel); sel = null; paint(); } })),
        h('div', { class: 'mk-row' },
          btn(svgI('<path d="M3 10h11V6l7 6-7 6v-4H3z" fill="currentColor" stroke="none"/>'), 'Стрелка', () => add('arrow')),
          btn(svgI('<circle cx="12" cy="12" r="8"/>'), 'Круг', () => add('circle')),
          btn(svgI('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'), 'Надпись', () => askText('', (v) => add('text', v))),
          h('button', { type: 'button', id: 'mkColor', class: 'mk-btn', onclick: () => {
            color = COLORS[(COLORS.indexOf(color) + 1) % COLORS.length];
            $('mkColor').querySelector('i').style.background = color;
            if (sel) { sel.color = color; paint(); }
          } }, h('i', { class: 'mk-dot', style: `background:${color}` }), h('span', { text: 'Цвет' }))));
      document.body.appendChild(el);
      cv = $('mkCanvas');
      cv.addEventListener('pointerdown', down);
      cv.addEventListener('pointermove', move);
      ['pointerup', 'pointercancel'].forEach((t) => cv.addEventListener(t, up));
      window.addEventListener('resize', resize);
      if (img.complete && img.naturalWidth) resize();
    }
    function close() {
      window.removeEventListener('resize', resize);
      ptrs.clear(); drag = null; pinch = null;
      if (el) { el.remove(); el = null; }
    }
    async function save() {
      if (!items.length) { close(); return; }
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      items.forEach((it) => drawItem(g, it, 1, false));
      const src = c.toDataURL('image/jpeg', 0.88), cb = done;
      close();
      if (cb) await cb(src);
    }
    return { open, close, get isOpen() { return !!el; } };
  })();
  // отметки на текущем фото просмотра: новая картинка (новый id) на месте старой в списке фото маркера или линии
  async function markViewerPhoto() {
    const it = viewer.owner, p = viewer.list[viewer.i];
    if (!it || !p) return;
    if (!canEditIn(it.folderId)) { noRights(); return; }
    const src = await photoSrc(p);
    if (!src) { toast('Фото ещё не загрузилось'); return; }
    MARK.open(src, async (out) => {
      const id = uid();
      if (!(await PhotoStore.put(id, out))) { toast('Не удалось сохранить фото'); return; }
      const np = isShot(p) ? Object.assign({}, p, { id }) : 'photo:' + id;
      if (isShot(np)) delete np.src;
      const arr = it.photos || [];
      const i = arr.indexOf(p);
      if (i < 0) { toast('Не удалось сохранить фото'); return; }
      arr[i] = np;
      if (viewer.list !== arr) viewer.list[viewer.i] = np;
      commit();
      renderViewer();
      toast('Фото сохранено');
    });
  }
  // удалить текущее фото просмотра (с подтверждением)
  function deleteViewerPhoto() {
    const it = viewer.owner, p = viewer.list[viewer.i];
    if (!it || !p) return;
    if (!canEditIn(it.folderId)) { noRights(); return; }
    confirmSheet('Удалить это фото?', 'Удалить', () => {
      const arr = it.photos || [];
      const i = arr.indexOf(p);
      if (i >= 0) arr.splice(i, 1);
      if (viewer.list !== arr) { const j = viewer.list.indexOf(p); if (j >= 0) viewer.list.splice(j, 1); }
      commit();
      if (!viewer.list.length) { closeViewer(); toast('Фото удалено'); if (it.lat != null) showMarkerSheet(it); return; }
      viewer.i = Math.min(viewer.i, viewer.list.length - 1);
      renderViewer();
      toast('Фото удалено');
    });
  }

  // ---------- значок «отправлено»: видно, ушла ли работа на общую карту ----------
  const SYNC_MARK = { ok: 'M9.3 13.6l1.9 1.9 3.6-4', pend: 'M12 16.2v-5.4M9.7 13l2.3-2.4 2.3 2.4', off: 'M10 11.6l4 4M14 11.6l-4 4', wait: '' };
  function syncChipState() {
    if (!(ST && ST.mapId && syncReady())) return null;
    const n = ST.unsentCount(), st = SY.status().state;
    if (!(AU && AU.google()) || st === 'off') return { cls: 'off', n };
    if (n) return { cls: 'pend', n };
    return { cls: st === 'online' ? 'ok' : 'wait', n: 0 };
  }
  function updateSyncChip() {
    const b = $('tbSync');
    if (!b) return;
    const s = syncChipState();
    b.hidden = !s;
    if (!s) return;
    b.className = 'tb-btn tb-sync ' + s.cls;
    b.querySelector('.sy-mark').setAttribute('d', SYNC_MARK[s.cls]);
    $('tbSyncN').textContent = s.n ? (s.n > 99 ? '99+' : String(s.n)) : '';
  }
  function syncChipTap() {
    const s = syncChipState();
    if (!s) return;
    if (s.cls === 'ok') toast('Всё отправлено на общую карту');
    else if (s.cls === 'pend') toast(`${tr('Ждут отправки:')} ${s.n}. ${tr('Уйдут сами, когда появится сеть')}`);
    else if (s.cls === 'wait') toast('Нет связи с общей картой. Неотправленных правок нет');
    else { toast(s.n ? `${tr('Общая карта не подключена. Ждут отправки:')} ${s.n}` : 'Общая карта не подключена'); openSyncPage(); }
  }

  // ---------- кто поставил и кто менял (имена участников общей карты) ----------
  function authorText(it) {
    if (!it || !SY) return '';
    const a = SY.nameOf(it.createdBy), b = it.updatedBy && it.updatedBy !== it.createdBy ? SY.nameOf(it.updatedBy) : '';
    return [a ? `${tr('Добавил:')} ${a}` : '', b ? `${tr('изменил:')} ${b}` : ''].filter(Boolean).join(' · ');
  }
  const shotAuthor = (p) => (SY && isShot(p) && p.by ? SY.nameOf(p.by) : '');

  // ---------- корзина: удалённое можно вернуть 30 дней ----------
  function trashTitle(e) {
    const o = e.obj || {};
    if (e.kind === 'folders') return `${tr('Объект')} «${o.name || ''}»`;
    if (e.kind === 'markers') return o.name || shapeName(shapeId(o));
    if (e.kind === 'lines') return o.name || tr('Линия');
    if (e.kind === 'reels') return o.name || tr('Бобина');
    return `${o.name || layerTypeName(o)} · ${e.lineName || tr('Линия')}`;
  }
  function trashKind(e) {
    const o = e.obj || {};
    if (e.kind === 'markers') return tr('Маркер');
    if (e.kind === 'lines') return `${tr('Линия')} · ${fmtLen(pathLen(o.points || []))}`;
    if (e.kind === 'reels') return tr('Бобина');
    if (e.kind === 'layers') return `${layerTypeName(o)} · ${fmtLen(pathLen(o.points || []))}`;
    return '';
  }
  function trashWho(e) {
    const who = e.by ? (e.by === me().id ? tr('вы') : SY ? SY.nameOf(e.by) : '') : '';
    return [who ? `${tr('удалил:')} ${who}` : '', fmtStamp(e.t)].filter(Boolean).join(' · ');
  }
  async function trashRestoreGroup(list) {
    const res = await ST.trashRestore(list.map((e) => e.key));
    if (!res.done) {
      toast(list.some((e) => e.kind === 'layers') ? 'Линии этого слоя нет на карте — сначала верните линию' : 'Это уже есть на карте');
      openTrash();
      return;
    }
    repairFolders();
    list.forEach((e) => { const fid = e.kind === 'folders' ? e.obj.id : e.obj.folderId; if (fid) showFolder(topFolderId(fid)); });
    // удаляли не на этом телефоне — в журнал работ этого телефона возврат не пишется
    if (res.foreign && journalOn) S.logSnap = workNow();
    fixActiveFolder();
    commit();
    toast('Возвращено на карту');
    openTrash();
  }
  async function openTrash() {
    const box = h('div', null, pgCard(h('div', { class: 'pg-note', text: 'Загружаю…' })));
    openPage('Корзина', { onBack: () => { closePage(); openDrawer(); } }, [
      h('div', { class: 'note', style: 'margin:14px 16px 2px', text: 'Удалённое хранится на этом телефоне 30 дней. «Вернуть» возвращает его на карту — и на общую карту тоже.' }),
      box]);
    $('page').dataset.screen = 'trash';
    const list = ST ? await ST.trashList() : [];
    if (!pageIsOpen() || $('page').dataset.screen !== 'trash') return;
    if (!list.length) { box.replaceChildren(pgCard(h('div', { class: 'pg-note', text: 'Корзина пуста' }))); return; }
    // одно удаление — одна строка (объект удаляется вместе со всем, что в нём было)
    const groups = new Map();
    list.forEach((e) => { if (!groups.has(e.g)) groups.set(e.g, []); groups.get(e.g).push(e); });
    const rowOf = (g) => {
      const head = g.find((e) => e.kind === 'folders' && !e.obj.parentId) || g.find((e) => e.kind === 'folders') || (g.length === 1 ? g[0] : null);
      const cnt = (k) => g.filter((e) => e.kind === k).length;
      const inside = [cnt('markers') ? `${cnt('markers')} ${pw(cnt('markers'), 'marker')}` : '', cnt('lines') ? `${cnt('lines')} ${pw(cnt('lines'), 'line')}` : ''].filter(Boolean).join(', ');
      const title = head ? trashTitle(head) : inside || `${g.length}`;
      const sub = [head && head.kind !== 'folders' ? trashKind(head) : (head ? inside : ''), trashWho(g[0])].filter(Boolean).join(' · ');
      return h('div', { class: 'mem-row tr-row' }, ico(head && head.kind === 'folders' ? 'folder' : 'trash'),
        h('div', { class: 'tr-txt' }, h('b', { text: title }), h('small', { text: sub })),
        h('button', { type: 'button', class: 'tr-btn', text: 'Вернуть', onclick: () => trashRestoreGroup(g) }));
    };
    box.replaceChildren(h('div', { class: 'pg-card' }, [...groups.values()].map(rowOf)));
  }

  // ---------- обновление приложения без APK ----------
  // Описание обновления (update.json) лежит в релизах GitHub: stable — для всех, latest — пробные версии.
  // web — новая страница приложения (скачивается, проверяется и подставляется при следующем запуске);
  // apk — новый файл приложения, когда странице нужна более новая оболочка. minWeb — обязательная версия:
  // более старая страница не подключается к общей карте, пока её не обновят.
  const UPD = (() => {
    const W = window.FM_WEB && window.FM_WEB.v > 0 ? window.FM_WEB : null;   // нет — страница открыта не из сборки
    const B = () => window.AndroidBridge || {};
    const BASE = 'https://github.com/zlontp98-bit/FieldMap/releases/download/';
    const CH_KEY = 'fieldmap_channel', MIN_KEY = 'fieldmap_minweb', LATER_KEY = 'fieldmap_upd_later', SEEN_KEY = 'fieldmap_seen_web';
    const MUST = 'Обновите приложение: старая версия не работает с общей картой';
    const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
    const channel = () => (lsGet(CH_KEY) === 'test' ? 'test' : 'stable');
    let offer = null, busy = false, lastCheck = 0;
    function shell() { try { return JSON.parse(B().updateState ? B().updateState() : '{}') || {}; } catch (e) { return {}; } }
    const waiters = {};
    let seq = 0;
    window.__onFetchText = (id, text) => { const f = waiters[id]; delete waiters[id]; if (f) f(typeof text === 'string' ? text : null); };
    function getText(url) {
      return new Promise((res) => {
        if (B().fetchText) {
          const id = 'f' + (++seq);
          waiters[id] = res;
          setTimeout(() => { if (waiters[id]) { delete waiters[id]; res(null); } }, 25000);
          B().fetchText(url, id);
          return;
        }
        fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : null)).then(res, () => res(null));
      });
    }
    function setBlock(must) { if (SY) SY.block(must ? MUST : ''); }
    // проверка: есть ли обновление. manual — нажали «Проверить обновление» (тогда отвечаем и «у вас последняя версия»)
    async function check(manual) {
      if (!W) { if (manual) toast('Обновления работают только в приложении на телефоне'); return null; }
      lastCheck = Date.now();
      const txt = await getText(BASE + (channel() === 'test' ? 'latest' : 'stable') + '/update.json');
      let m = null;
      try { m = txt ? JSON.parse(txt) : null; } catch (e) { m = null; }
      if (!m || !m.web || !(m.web.version > 0)) { if (manual) toast('Не удалось проверить обновление. Проверьте интернет'); return null; }
      const sh = shell(), apkNow = sh.apk || 0, minWeb = m.minWeb || 0;
      lsSet(MIN_KEY, String(minWeb));
      const must = W.v < minWeb;
      const apkNewer = m.apk && m.apk.versionCode > apkNow && !!B().downloadApk;
      if (apkNewer && ((m.web.minApk || 0) > apkNow || m.apk.push === true)) offer = { kind: 'apk', name: m.apk.versionName || m.web.name, m, must };
      else if (m.web.version > W.v && m.web.version !== (sh.bad || 0) && (m.web.minApk || 0) <= apkNow && B().downloadWebUpdate) offer = { kind: 'web', name: m.web.name, m, must };
      else offer = null;
      setBlock(must);
      if (drawerOpen()) renderTop();
      if (offer) {
        const later = lsGet(LATER_KEY);
        if (manual || must || later !== `${offer.kind}${offer.kind === 'apk' ? m.apk.versionCode : m.web.version}:${new Date().toDateString()}`) show();
      } else if (manual) toast('У вас последняя версия');
      return offer;
    }
    function show() {
      if (!offer || (!$('sheet').classList.contains('hidden') && !offer.must)) return;
      const m = offer.m, notes = (m.notes && (m.notes[LANG] || m.notes.ru)) || '';
      openSheet(
        h('h3', { text: offer.must ? 'Нужно обновить приложение' : `${tr('Доступно обновление')} ${offer.name || ''}` }),
        offer.must ? h('div', { class: 'note', style: 'margin:0 2px 10px', text: MUST }) : null,
        notes ? h('div', { class: 'note', style: 'margin:0 2px 12px', text: notes }) : null,
        offer.kind === 'apk' ? h('div', { class: 'note', style: 'margin:0 2px 12px', text: 'Скачается новый файл приложения. Потом телефон спросит разрешение на установку — разрешите. Данные останутся.' })
          : h('div', { class: 'note', style: 'margin:0 2px 12px', text: 'Займёт несколько секунд. Данные останутся.' }),
        h('button', { class: 'btn primary', text: 'Обновить', onclick: () => { closeSheet(); run(); } }),
        h('button', { class: 'btn ghost', text: 'Позже', onclick: () => {
          lsSet(LATER_KEY, `${offer.kind}${offer.kind === 'apk' ? m.apk.versionCode : m.web.version}:${new Date().toDateString()}`);
          closeSheet();
        } }));
    }
    // окно загрузки поверх карты: видно, что обновление скачивается, и сколько уже скачано
    let boxTimer = null;
    function box(text, pct) {
      let e = $('updBox');
      if (!e) {
        e = h('div', { id: 'updBox', class: 'upd-box' }, h('div', { class: 'upd-card' },
          h('div', { class: 'upd-spin' }), h('b', { id: 'updText' }), h('div', { class: 'upd-bar' }, h('i', { id: 'updFill' })),
          h('small', { id: 'updPct' }), h('small', { class: 'upd-hint', text: 'Не закрывайте приложение' })));
        document.body.appendChild(e);
      }
      $('updText').textContent = tr(text);
      const known = pct >= 0;
      $('updFill').className = known ? '' : 'run';
      $('updFill').style.width = known ? Math.max(3, Math.min(100, pct)) + '%' : '';
      $('updPct').textContent = known ? pct + '%' : '';
    }
    function unbox() { clearInterval(boxTimer); boxTimer = null; const e = $('updBox'); if (e) e.remove(); }
    function failed() { busy = false; unbox(); toast('Не удалось скачать обновление. Проверьте интернет и попробуйте ещё раз'); }
    window.__onWebUpdate = (r) => {
      let o = r;
      if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
      if (!(o && o.ok)) { failed(); return; }
      clearInterval(boxTimer);
      box('Обновление скачано. Перезапускаю…', 100);
      if (ST) ST.persist();
      setTimeout(() => location.reload(), 900);
    };
    window.__onApkUpdate = (r) => {
      let o = r;
      if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
      if (!o || !busy) return;
      if (o.state === 'progress') box('Скачиваю обновление…', o.pct);
      else if (o.state === 'install') { busy = false; unbox(); toast('Обновление скачано. Нажмите «Установить»'); }
      else failed();
    };
    function run() {
      if (!offer || busy) return;
      busy = true;
      const m = offer.m, my = offer;
      if (offer.kind === 'apk') { box('Скачиваю обновление…', 0); B().downloadApk(m.apk.url, m.apk.sha256); }
      else {
        // страница маленькая и качается за секунды; оболочка не сообщает ход, поэтому проценты — по времени (до 90%)
        const t0 = Date.now();
        box('Скачиваю обновление…', 0);
        boxTimer = setInterval(() => box('Скачиваю обновление…', Math.min(90, Math.round((Date.now() - t0) / 80))), 200);
        B().downloadWebUpdate(m.web.url, m.web.sha256, m.web.version);
      }
      // ответа нет слишком долго — снимаем окно
      setTimeout(() => { if (busy && offer === my && $('updBox')) failed(); }, offer.kind === 'apk' ? 600000 : 90000);
    }
    function start() {
      if (!W) return;
      try { if (B().bootOk) B().bootOk(W.v); } catch (e) { /* ignore */ }
      // после обновления страницы: один раз сказать, что обновилось
      const seen = Number(lsGet(SEEN_KEY)) || 0;
      if (seen && seen < W.v) setTimeout(() => toast(`${tr('Приложение обновлено: версия')} ${W.name}`), 1200);
      if (seen !== W.v) lsSet(SEEN_KEY, String(W.v));
      // обязательная версия, запомненная с прошлой проверки, действует и без сети
      if (W.v < (Number(lsGet(MIN_KEY)) || 0)) setBlock(true);
      // подключение к общей карте ждёт первую проверку версии (не дольше 6 секунд)
      const first = check(false).catch(() => null);
      if (SY) SY.setGate(Promise.race([first, new Promise((r) => setTimeout(r, 6000))]));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 3 * 3600000) check(false); });
      setInterval(() => { if (Date.now() - lastCheck > 6 * 3600000) check(false); }, 30 * 60000);
    }
    return {
      start, check, show,
      get offer() { return offer; },
      version: () => (W ? `${W.name} (${W.v})` : '—'),
      channel,
      setChannel(c) { lsSet(CH_KEY, c === 'test' ? 'test' : 'stable'); lsSet(LATER_KEY, ''); check(true); },
    };
  })();

  // ---------- запуск части приложения: проверка версии, общая карта, вход, GPS, присланная точка ----------
  // ---------- настройки: группы с цветными значками, переключатели (как в настройках телефона) ----------
  ICONS.globe = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 3.8 5.8 3.8 9s-1.2 6.2-3.8 9c-2.6-2.8-3.8-5.8-3.8-9S9.4 5.8 12 3z"/>';
  ICONS.flask = '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>';
  const ST_CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function stRow({ icon, color, title, sub, value, on, onclick, cls }) {
    const right = [];
    if (value) right.push(h('span', { class: 'st-val', text: value }));
    if (on === undefined) { const c = h('span', { class: 'st-chev' }); c.innerHTML = ST_CHEV; right.push(c); }
    else right.push(h('span', { class: 'st-sw' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false' }, h('i')));
    return h('button', { type: 'button', class: 'st-row' + (cls ? ' ' + cls : ''), onclick },
      h('span', { class: 'st-ic', style: `background:${color}` }, ico(icon)),
      h('span', { class: 'st-txt' }, h('span', { class: 'st-ttl', text: title }), sub ? h('span', { class: 'st-sub', text: sub }) : null),
      ...right);
  }
  const stGroup = (title, ...rows) => [title ? h('div', { class: 'st-sec', text: title }) : null, h('div', { class: 'st-card' }, ...rows.flat().filter(Boolean))];
  function chooseLang() {
    openSheet(h('h3', { text: tr('Язык') }), h('div', { class: 'st-card st-in-sheet' },
      LANGS.map((code) => h('button', { type: 'button', class: 'st-row st-pick' + (LANG === code ? ' sel' : ''), onclick: () => { closeSheet(); setLang(code); } },
        h('span', { class: 'st-txt' }, h('span', { class: 'st-ttl', text: LANG_NAMES[code] })), h('span', { class: 'st-check' }, LANG === code ? ico('check') : null)))),
      h('button', { class: 'btn ghost', text: 'Отмена', onclick: closeSheet }));
  }
  function openSettings2() {
    const body = $('pageBody'), keep = pageIsOpen() && $('page').dataset.screen === 'settings' ? body.scrollTop : 0;
    const again = () => openSettings2();
    const google = !!(AU && AU.google());
    const who = google ? me() : null, mail = google && AU.user ? AU.user.email : '';
    const prof = h('button', { type: 'button', class: 'st-prof', onclick: () => { closePage(); if (google) openAccount(); else signInFlow(); } },
      h('span', { class: 'st-ava' + (google ? '' : ' off') }, google ? h('b', { text: (who.name || '?').trim().charAt(0).toUpperCase() }) : ico('user')),
      h('span', { class: 'st-txt' },
        h('span', { class: 'st-ttl big', text: google ? who.name : tr('Войти через Google') }),
        h('span', { class: 'st-sub', text: google ? (mail || tr('Аккаунт')) : tr('Чтобы работать с общей картой') })));
    const ch = h('span', { class: 'st-chev' }); ch.innerHTML = ST_CHEV; prof.append(ch);
    openPage('Настройки', { onBack: () => { closePage(); openDrawer(); } }, [
      h('div', { class: 'st-card st-prof-card' }, prof),
      stGroup(tr('Общие'),
        stRow({ icon: 'globe', color: '#3b82f6', title: tr('Язык'), value: LANG_NAMES[LANG], onclick: chooseLang })),
      stGroup(tr('Карта'),
        stRow({ icon: 'tag', color: '#f59e0b', title: tr('Подписи маркеров'), on: labelsOn, onclick: () => { toggleLabels(); again(); } }),
        stRow({ icon: 'bucket', color: '#22c55e', title: tr('Цвет по режиму'), sub: tr('Проект — красный, выполнено — зелёный. Меняется только цвет'),
          on: autoColorOn(), onclick: () => { S.autoColor = !autoColorOn(); applyAutoColor(); saveData(); again(); } })),
      stGroup(tr('Данные'),
        stRow({ icon: 'import', color: '#8b5cf6', title: tr('Импорт данных или KML'), onclick: importFile }),
        stRow({ icon: 'map', color: '#14b8a6', title: tr('Экспорт KML'), sub: tr('Для Google Earth и других карт'), onclick: exportKml }),
        stRow({ icon: 'export', color: '#6366f1', title: tr('Экспорт данных'), sub: tr('Объекты, фото, кабели — копия всего'), onclick: exportData }),
        ST ? stRow({ icon: 'trash', color: '#ef4444', title: tr('Корзина'), sub: tr('Удалённое можно вернуть в течение 30 дней'), onclick: () => { closePage(); openTrash(); } }) : null),
      stGroup(tr('Приложение'),
        stRow({ icon: 'cloud', color: '#0ea5e9', title: tr('Обновления'), sub: tr('Проверить, есть ли новая версия'), value: UPD.version() === '—' ? '' : UPD.version().replace(/ \(\d+\)$/, ''), onclick: () => UPD.check(true) }),
        stRow({ icon: 'flask', color: '#64748b', title: tr('Пробные версии'), sub: tr('Получать обновления раньше всех (для проверки)'),
          on: UPD.channel() === 'test', onclick: () => { UPD.setChannel(UPD.channel() === 'test' ? 'stable' : 'test'); again(); } })),
      UPD.version() === '—' ? null : h('div', { class: 'st-foot', text: `FieldMap ${UPD.version()}` }),
    ]);
    $('page').dataset.screen = 'settings';
    body.scrollTop = keep;
  }

  function appStart() {
    UPD.start();
    $('tbSync').onclick = syncChipTap;
    if (ST) ST.onUnsent(updateSyncChip);
    if (SY) {
      SY.onRemote(onRemoteData);
      SY.onStatus((st) => {
        updateSyncChip();
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
        updateSyncChip();
        if (drawerOpen()) renderDrawer();
        if (syncPageOpen()) openSyncPage();
      });
      AU.start().catch(() => { /* без интернета: остаётся вход, сохранённый на телефоне */ });
    }
    if (SY) SY.autostart();
    updateSyncChip();
    gpsStart();
    // точка, присланная в приложение до загрузки страницы (Поделиться → FieldMap)
    let shared = null;
    try { shared = window.AndroidBridge && window.AndroidBridge.takeShared ? window.AndroidBridge.takeShared() : null; } catch (e) { shared = null; }
    if (shared) window.__onSharedLocation(shared);
    else if (AU && !AU.google()) setTimeout(loginPrompt, 700);
    else if (AU && AU.user && !AU.user.named) setTimeout(() => askName(), 700);
  }

