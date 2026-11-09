#!/usr/bin/env python3
# Перенос прототипа FieldMap (артефакт claude.ai) в страницу приложения (APK).
# Запуск: python3 port.py <прототип index.html> <выход index.html>
# Каждая замена проверяет, что исходный кусок встречается ровно один раз: если прототип поменялся
# и кусок не найден — скрипт падает с понятной ошибкой (поправить замену под новый прототип).
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit(f'замена: найдено {n} раз(а) вместо {count}:\n{old[:300]}')
    s = s.replace(old, new)


def rep_re(pat, new, flags=0):
    global s
    m = list(re.finditer(pat, s, flags))
    if len(m) != 1:
        raise SystemExit(f'замена (regex): найдено {len(m)} раз(а): {pat[:200]}')
    s = s[:m[0].start()] + new + s[m[0].end():]


def insert_before(anchor, text):
    rep(anchor, text + anchor)


def insert_after(anchor, text):
    rep(anchor, anchor + text)


# ---------------------------------------------------------------- разметка
HEAD = '''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>FieldMap</title>
<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>
'''
rep_re(r'\A<!doctype html><html><head>.*?\n<title>FieldMap прототип</title>\n', HEAD, re.S)

APK_CSS = '''/* ---- только в приложении: общая карта, аккаунт, «Поделиться» ---- */
.sync-code{padding:16px;font-size:30px;font-weight:700;letter-spacing:3px;text-align:center;font-variant-numeric:tabular-nums;user-select:text}
.act-row .ic{width:24px;height:24px;flex:none}
.act-row .ic svg{width:24px;height:24px}
.pg-card + .note{margin:8px 12px 0;padding:0 6px}
.note + .pg-sec + .pg-card, .note + .pg-card{margin-top:12px}
.share-coords{font-size:20px;font-weight:650;font-variant-numeric:tabular-nums;margin:0 2px 10px;user-select:text}
.acc-mail{padding:14px 16px;font-size:15px;user-select:text;word-break:break-all}
.mem-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--hair, #34363e)}
.mem-row:first-child{border-top:0}
.mem-row .ic{color:var(--tx-2, #9aa0a6)}
.mem-row b{display:block;font-weight:600}
.mem-row small{display:block;color:var(--tx-2, #9aa0a6);margin-top:2px}
.login-g{display:flex;align-items:center;justify-content:center;gap:10px}
.login-g svg{width:20px;height:20px;flex:none}
'''
rep('</style>\n\n<canvas id="map"', APK_CSS + '</style>\n</head>\n<body>\n<canvas id="map"')
rep_re(r'<img id="bgImg"[^\n]*\n', '')

insert_before('<script>\n(function () {\n', '''<input id="fileInput" type="file" hidden>
<script src="js/firebase-config.js"></script>
<script src="js/store.js"></script>
<script src="js/kml.js"></script>
<script src="js/sync.js"></script>

''')

rep("  // Работаем только в прототипе; в приложение переносим по команде пользователя.\n",
    "  // Работаем только в прототипе; в приложение переносим по команде пользователя.\n"
    "  // ЭТА СТРАНИЦА — ВЕРСИЯ ДЛЯ ПРИЛОЖЕНИЯ: прототип + Store/Sync/Kml (js/), вход через Google, общая карта,\n"
    "  // GPS, подложка Google/CARTO, AndroidBridge (камера, файлы, «Поделиться»), кнопка «Назад». Роли и бригады пока скрыты:\n"
    "  // у всех права админа. Скрипт переноса — apk-port/port.py (в репозитории).\n")

# ---------------------------------------------------------------- переводы
T = [
    # ru, it, en
    ('Ищу местоположение…', 'Ricerca della posizione…', 'Finding your location…'),
    ('Геолокация недоступна на этом устройстве', 'Geolocalizzazione non disponibile su questo dispositivo', 'Location is not available on this device'),
    ('Нет доступа к геолокации. Разрешите его в настройках телефона', 'Nessun accesso alla posizione. Consentilo nelle impostazioni del telefono', 'No access to location. Allow it in the phone settings'),
    ('Местоположение недоступно: включите GPS', 'Posizione non disponibile: attiva il GPS', 'Location unavailable: turn on GPS'),
    ('Не удалось определить местоположение', 'Impossibile determinare la posizione', 'Could not determine your location'),
    ('Выключена', 'Disattivata', 'Off'),
    ('Подключение…', 'Connessione…', 'Connecting…'),
    ('Подключено', 'Connesso', 'Connected'),
    ('Нет связи с сервером, изменения сохранятся', 'Nessuna connessione al server, le modifiche verranno conservate', 'No connection to the server, changes will be kept'),
    ('Firebase не настроен: заполните js/firebase-config.js', 'Firebase non è configurato: compila js/firebase-config.js', 'Firebase is not configured: fill in js/firebase-config.js'),
    ('Инструкция — в README.md, раздел «Общая карта»', 'Le istruzioni sono nel README.md, sezione «Общая карта»', 'Instructions are in README.md, section «Общая карта»'),
    ('Создать общую карту из моих данных', 'Crea una mappa condivisa dai miei dati', 'Create a shared map from my data'),
    ('Код карты', 'Codice della mappa', 'Map code'),
    ('Код:', 'Codice:', 'Code:'),
    ('Подключиться по коду', 'Connetti con il codice', 'Join with code'),
    ('Код должен состоять из 10 символов (буквы и цифры)', 'Il codice deve avere 10 caratteri (lettere e cifre)', 'The code must have 10 characters (letters and digits)'),
    ('Что сделать с данными на этом телефоне?', 'Cosa fare con i dati su questo telefono?', 'What to do with the data on this phone?'),
    ('Объединить с общей картой', 'Unisci alla mappa condivisa', 'Merge with the shared map'),
    ('Заменить общей картой', 'Sostituisci con la mappa condivisa', 'Replace with the shared map'),
    ('«Заменить» убирает с этого телефона объекты, которых нет на общей карте. На общей карте ничего не удаляется.',
     '«Sostituisci» rimuove da questo telefono gli oggetti che non sono sulla mappa condivisa. Sulla mappa condivisa non viene eliminato nulla.',
     '«Replace» removes from this phone the objects that are not on the shared map. Nothing is deleted on the shared map.'),
    ('Отключиться', 'Disconnetti', 'Disconnect'),
    ('Отключиться от общей карты? Данные останутся на телефоне.', 'Disconnettersi dalla mappa condivisa? I dati restano sul telefono.', 'Disconnect from the shared map? The data stays on the phone.'),
    ('Скопировать код', 'Copia il codice', 'Copy code'),
    ('Скопировано', 'Copiato', 'Copied'),
    ('Передайте код тем, с кем ведёте карту. Войти в карту может любой, кто знает код и вошёл через Google.',
     'Condividi il codice con chi lavora sulla mappa. Può entrare chiunque conosca il codice e abbia fatto l’accesso con Google.',
     'Share the code with the people you map with. Anyone who knows the code and is signed in with Google can join.'),
    ('Общая карта создана', 'Mappa condivisa creata', 'Shared map created'),
    ('Подключено к общей карте', 'Connesso alla mappa condivisa', 'Connected to the shared map'),
    ('Состояние', 'Stato', 'Status'),
    ('Нет сети', 'Nessuna rete', 'No network'),
    ('Карта с таким кодом не найдена', 'Nessuna mappa con questo codice', 'No map with this code was found'),
    ('В Firebase не включён вход через Google (Authentication → Sign-in method → Google)', 'In Firebase l’accesso con Google non è attivo (Authentication → Sign-in method → Google)', 'Google sign-in is not enabled in Firebase (Authentication → Sign-in method → Google)'),
    ('Нет доступа: проверьте правила Firestore (firestore.rules)', 'Accesso negato: controlla le regole di Firestore (firestore.rules)', 'Access denied: check the Firestore rules (firestore.rules)'),
    ('Неверный ключ Firebase в js/firebase-config.js', 'Chiave Firebase non valida in js/firebase-config.js', 'Invalid Firebase key in js/firebase-config.js'),
    ('Google не подтвердил вход: проверьте Web client ID и SHA-1 в Firebase', 'Google non ha confermato l’accesso: controlla Web client ID e SHA-1 in Firebase', 'Google did not confirm the sign-in: check the Web client ID and SHA-1 in Firebase'),
    ('Файл готов', 'File pronto', 'File ready'),
    ('Файл сохранён', 'File salvato', 'File saved'),
    ('Импортировано:', 'Importati:', 'Imported:'),
    ('В файле нет маркеров и линий', 'Il file non contiene marcatori né linee', 'The file has no markers or lines'),
    ('Не удалось прочитать файл', 'Impossibile leggere il file', 'Could not read the file'),
    ('Импорт данных или KML', 'Importa dati o KML', 'Import data or KML'),
    ('Экспорт данных (объекты, фото, кабели)', 'Esporta dati (cantieri, foto, cavi)', 'Export data (sites, photos, cables)'),
    ('Собираю фото…', 'Raccolgo le foto…', 'Collecting photos…'),
    ('Отправить (WhatsApp, Telegram…)', 'Invia (WhatsApp, Telegram…)', 'Send (WhatsApp, Telegram…)'),
    ('Открыть в Google Картах', 'Apri in Google Maps', 'Open in Google Maps'),
    ('Скопировать координаты', 'Copia le coordinate', 'Copy coordinates'),
    ('В присланном нет координат', 'Nessuna coordinata in ciò che è stato inviato', 'No coordinates in what was shared'),
    ('Маркер поставлен по присланной точке', 'Marcatore aggiunto dal punto condiviso', 'Marker added from the shared point'),
    ('Схема Google', 'Mappa Google', 'Google map'),
    ('Спутник Google', 'Satellite Google', 'Google satellite'),
    ('Фото сохранено. Место — по карте (нет GPS)', 'Foto salvata. Luogo dalla mappa (niente GPS)', 'Photo saved. Place from the map (no GPS)'),
    ('Поделиться рапортом', 'Condividi il rapporto', 'Share the report'),
    ('Не удалось сохранить файл', 'Impossibile salvare il file', 'Could not save the file'),
    # аккаунт
    ('Аккаунт', 'Account', 'Account'),
    ('Войти через Google', 'Accedi con Google', 'Sign in with Google'),
    ('Вход через Google', 'Accesso con Google', 'Sign in with Google'),
    ('Позже', 'Più tardi', 'Later'),
    ('Выйти', 'Esci', 'Sign out'),
    ('Выйти из аккаунта? Данные останутся на телефоне, общая карта отключится до следующего входа.',
     'Uscire dall’account? I dati restano sul telefono, la mappa condivisa si scollega fino al prossimo accesso.',
     'Sign out? The data stays on the phone; the shared map disconnects until you sign in again.'),
    ('Ваше имя', 'Il tuo nome', 'Your name'),
    ('Как вас зовут?', 'Come ti chiami?', 'What is your name?'),
    ('Имя видят все участники карты. Email не видит никто, кроме вас.', 'Il nome lo vedono tutti i partecipanti della mappa. L’email la vedi solo tu.', 'Everyone on the map sees your name. Only you see your email.'),
    ('Сохранить имя', 'Salva il nome', 'Save name'),
    ('Имя сохранено', 'Nome salvato', 'Name saved'),
    ('Впишите имя', 'Scrivi il nome', 'Enter a name'),
    ('Email (видите только вы)', 'Email (la vedi solo tu)', 'Email (only you see it)'),
    ('Вход выполнен', 'Accesso effettuato', 'Signed in'),
    ('Вы вышли из аккаунта', 'Sei uscito dall’account', 'You signed out'),
    ('Вход — один раз: выберите свой Google-аккаунт, пароль не нужен. Нужен для общей карты: так видно, кто что поставил.',
     'L’accesso si fa una volta: scegli il tuo account Google, senza password. Serve per la mappa condivisa: così si vede chi ha messo cosa.',
     'Sign in once: pick your Google account, no password needed. It is needed for the shared map, so everyone sees who added what.'),
    ('Не вошли — общая карта недоступна', 'Accesso non effettuato: la mappa condivisa non è disponibile', 'Not signed in: the shared map is unavailable'),
    ('Войдите через Google — общая карта только для вошедших', 'Accedi con Google: la mappa condivisa è solo per chi ha fatto l’accesso', 'Sign in with Google: the shared map is only for signed-in users'),
    ('Войдите через Google, чтобы работать с общей картой', 'Accedi con Google per lavorare sulla mappa condivisa', 'Sign in with Google to work on the shared map'),
    ('Вход через Google работает только в приложении на телефоне', 'L’accesso con Google funziona solo nell’app sul telefono', 'Google sign-in only works in the app on the phone'),
    ('Вход через Google ещё не настроен: нет Web client ID в js/firebase-config.js', 'L’accesso con Google non è ancora configurato: manca il Web client ID in js/firebase-config.js', 'Google sign-in is not set up yet: no Web client ID in js/firebase-config.js'),
    ('Вход отменён', 'Accesso annullato', 'Sign-in cancelled'),
    ('Не удалось войти', 'Accesso non riuscito', 'Could not sign in'),
    ('Участники карты', 'Partecipanti della mappa', 'Map members'),
    ('Владелец', 'Proprietario', 'Owner'),
    ('Участник', 'Partecipante', 'Member'),
    ('это вы', 'sei tu', 'you'),
    ('Загружаю…', 'Caricamento…', 'Loading…'),
    ('Список пока пуст: участник появляется, когда входит в карту', 'L’elenco è vuoto: un partecipante appare quando entra nella mappa', 'The list is empty: a member appears after joining the map'),
    ('Не удалось загрузить список', 'Impossibile caricare l’elenco', 'Could not load the list'),
    ('Кто работает с этой картой', 'Chi lavora su questa mappa', 'Who works on this map'),
    ('с', 'dal', 'since'),
]
for lang, col in (('it', 1), ('en', 2)):
    m = re.search(r'\n "' + lang + r'": \{\n(.*?)\n \}', s, re.S)
    block = m.group(1)
    lines = []
    for t in T:
        key = '"' + t[0].replace('\\', '\\\\').replace('"', '\\"') + '":'
        if ('\n  ' + key) in ('\n' + block):
            continue
        val = t[col].replace('\\', '\\\\').replace('"', '\\"')
        lines.append(f'  {key} "{val}",\n')
    s = s[:m.start(1)] + ''.join(lines) + s[m.start(1):]

# ---------------------------------------------------------------- «я» и роли: роли пока скрыты, у всех права админа
rep("  function people() { return Array.isArray(S.people) ? S.people : []; }\n  function personById(id) { return people().find((p) => p.id === id) || null; }\n",
    "  // в приложении «я» — вошедший Google-аккаунт; ролей и бригад пока нет (у всех права админа), журнал у каждого телефона свой\n"
    "  const AU = typeof Auth !== 'undefined' ? Auth : null;\n"
    "  function people() { return [me()]; }\n"
    "  function personById(id) { return id ? me() : null; }\n")
rep("  function me() { return personById(S.meId) || { id: S.meId || 'me', name: 'Я', role: 'admin', status: 'active' }; }\n",
    "  function me() {\n"
    "    const u = AU && AU.user;\n"
    "    return { id: (u && u.uid) || 'me', name: (u && u.google && u.name) || tr('Я'), role: 'admin', status: 'active', team: null };\n"
    "  }\n")
rep("""  function initRoles() {
    if (!Array.isArray(S.people) || !S.people.length) S.people = [{ id: 'me', name: tr('Я'), role: 'admin', status: 'active', createdAt: Date.now() }];
    if (!Array.isArray(S.teams)) S.teams = [];
    if (!personById(S.meId)) S.meId = (activeAdmins()[0] || S.people[0]).id;
  }""", """  function initRoles() {
    // люди и бригады прототипа в приложении не используются (роли — потом, через участников общей карты)
    S.people = []; S.teams = []; delete S.meId; delete S.reportCrew;
  }""")

# ---------------------------------------------------------------- данные: Store (js/store.js) и общая карта
rep("""  // ---------- данные (хранятся только в этом браузере) ----------
  function seed() {
    return {
      folders: [{ id: 'f1', name: 'Пример', color: PALETTE[0] }, { id: 'f2', name: 'Объект по умолчанию', color: PALETTE[1] }],
      markers: [{ id: 'm1', folderId: 'f1', name: 'Точка 1', color: null, lat: 44.5480, lng: 8.9670, createdAt: Date.now() }],
      lines: [{ id: 'l1', folderId: 'f1', name: 'Линия 1', color: null, createdAt: Date.now(), points: [[44.5488, 8.9660], [44.5493, 8.9680], [44.5482, 8.9700]] }],
      activeFolderId: 'f1',
    };
  }
  function loadData() {
    try {""", """  // ---------- данные ----------
  // В приложении данные сохраняет Store (js/store.js): он же передаёт изменения на общую карту (js/sync.js).
  // Без этих файлов страница работает как прототип: данные только в этом браузере.
  const ST = typeof Store !== 'undefined' ? Store : null;
  const SY = typeof Sync !== 'undefined' ? Sync : null;
  const KM = typeof Kml !== 'undefined' ? Kml : null;
  // первый запуск: пусто, объект создаётся при первом маркере или линии
  function seed() {
    return { folders: [], markers: [], lines: [], reels: [], activeFolderId: null };
  }
  function loadData() {
    if (ST) return ST.load() || seed();
    try {""")
rep("""  function saveData() {
    dataVer++;
    logWork();
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Память браузера заполнена, часть данных не сохранена'); }
  }
  let S = loadData();
""", """  function saveData() {
    dataVer++;
    logWork();
    if (ST) { if (!ST.save()) toast('Память браузера заполнена, часть данных не сохранена'); return; }
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Память браузера заполнена, часть данных не сохранена'); }
  }
  let S = loadData();
  // активный объект мог пропасть (удалили на другом телефоне): берём первый объект верхнего уровня
  function fixActiveFolder() {
    if (S.activeFolderId && !S.folders.some((f) => f.id === S.activeFolderId)) {
      const f = S.folders.find((x) => !x.parentId) || S.folders[0];
      S.activeFolderId = f ? f.id : null;
    }
  }
  fixActiveFolder();
  if (ST) { ST.setUser(AU && AU.google() ? AU.user.uid : null); ST.attach(S); }
""")

# ---------------------------------------------------------------- подложка: Google схема/спутник, белая CARTO; вид запоминается
rep("""  // фото-подложка: приблизительная привязка к Бузалле (нужна калибровка по двум точкам)
  const BG = { lat: 44.5475, lng: 8.9680, z: 18 };
  const bgImg = $('bgImg');
  let mapMode = 'photo';   // photo | white | grid
  const V = { lat: BG.lat, lng: BG.lng, z: BG.z, rot: 0 };   // rot — поворот карты (радианы, по часовой)
""", """  // тип подложки: road — Google схема, sat — Google спутник, white — белая карта (CARTO); запоминается на телефоне.
  // grid — только запасной вариант для PDF, если подложку нельзя сохранить картинкой
  const MAP_MODES = ['road', 'sat', 'white'];
  let mapMode = (() => { try { const v = localStorage.getItem('fieldmap_maptype'); if (MAP_MODES.includes(v)) return v; } catch (e) { /* ignore */ } return 'road'; })();
  // вид карты запоминается на телефоне; при первом запуске — Италия, потом объекты или GPS
  const VIEW_KEY = 'fieldmap_view';
  let viewFresh = false;
  const V = (() => {   // rot — поворот карты (радианы, по часовой)
    try {
      const v = JSON.parse(localStorage.getItem(VIEW_KEY));
      if (v && [v.lat, v.lng, v.z].every(Number.isFinite)) return { lat: clamp(v.lat, -85, 85), lng: v.lng, z: clamp(v.z, 3, 20), rot: Number.isFinite(v.rot) ? v.rot : 0 };
    } catch (e) { /* ignore */ }
    viewFresh = true;
    return { lat: 42.8, lng: 12.5, z: 6, rot: 0 };
  })();
  let viewTimer = null;
  function saveView() {
    clearTimeout(viewTimer);
    viewTimer = setTimeout(() => {
      try { localStorage.setItem(VIEW_KEY, JSON.stringify({ lat: V.lat, lng: V.lng, z: V.z, rot: V.rot || 0 })); } catch (e) { /* ignore */ }
    }, 400);
  }
  // тайлы Google: схема (m) или спутник с подписями улиц (y). crossOrigin — чтобы карту можно было сохранить в PDF
  const gTileCache = new Map();                  // ключ -> Image; порядок вставки — для вытеснения старых
  let gTileRaf = null;
  const gTileReady = (img) => !!(img && img.complete && img.naturalWidth);
  function gTile(z, x, y, load) {
    const lyr = mapMode === 'sat' ? 'y' : 'm';
    const key = lyr + LANG + '/' + z + '/' + x + '/' + y;
    let img = gTileCache.get(key);
    if (img) { gTileCache.delete(key); gTileCache.set(key, img); return img; }
    if (!load) return null;
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!gTileRaf) gTileRaf = requestAnimationFrame(() => { gTileRaf = null; draw(); }); };
    img.onerror = () => setTimeout(() => { if (gTileCache.get(key) === img) gTileCache.delete(key); }, 10000);   // без сети: повторим позже
    img.src = `https://mt${(x + y) % 4}.google.com/vt/lyrs=${lyr}&hl=${LANG}&x=${x}&y=${y}&z=${z}` + (DPR > 1.5 ? '&scale=2' : '');
    gTileCache.set(key, img);
    if (gTileCache.size > 500) gTileCache.delete(gTileCache.keys().next().value);
    return img;
  }
  // рисуется без поворота (холст поворачивает withMapRotation): при повороте закрываем круг вокруг центра
  function drawGoogle(W, H) {
    const tz = clamp(Math.round(V.z), 0, 20);
    const k = Math.pow(2, V.z - tz), size = TILE * k, n = Math.pow(2, tz);
    const c = worldPx(V.lat, V.lng, tz);
    const R = V.rot ? Math.hypot(W, H) / 2 : 0, hw = V.rot ? R : W / 2, hh = V.rot ? R : H / 2;
    const x0 = Math.floor((c[0] - hw / k) / TILE), x1 = Math.floor((c[0] + hw / k) / TILE);
    const y0 = Math.max(0, Math.floor((c[1] - hh / k) / TILE)), y1 = Math.min(n - 1, Math.floor((c[1] + hh / k) / TILE));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const xx = ((x % n) + n) % n;
        const sx = W / 2 + (x * TILE - c[0]) * k, sy = H / 2 + (y * TILE - c[1]) * k;
        const img = gTile(tz, xx, y, true);
        if (gTileReady(img)) { ctx.drawImage(img, sx, sy, size + 0.5, size + 0.5); continue; }
        // пока тайл грузится — увеличенный кусок уже загруженного тайла крупнее
        for (let d = 1; d <= 6 && tz - d >= 0; d++) {
          const pimg = gTile(tz - d, xx >> d, y >> d, false);
          if (!gTileReady(pimg)) continue;
          const m = 1 << d, sw = pimg.naturalWidth / m, sh = pimg.naturalHeight / m;
          ctx.drawImage(pimg, (xx % m) * sw, (y % m) * sh, sw, sh, sx, sy, size + 0.5, size + 0.5);
          break;
        }
      }
    }
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);   // подпись не поворачивается вместе с картой
    ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
    ctx.fillStyle = mapMode === 'sat' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.6)';
    ctx.fillText('© Google', 8, H - 6);
    ctx.restore();
  }
""")
rep("""    } else if (mapMode === 'photo' && bgImg.complete && bgImg.naturalWidth) {
      // фото: масштаб относительно уровня BG.z, центр фото — в BG.lat/BG.lng (без поворота — его делает холст)
      const k = Math.pow(2, V.z - BG.z), pb = worldPx(BG.lat, BG.lng, V.z), cc = [W / 2 + pb[0] - c[0], H / 2 + pb[1] - c[1]];
      const w = bgImg.naturalWidth * k, hh = bgImg.naturalHeight * k;
      ctx.drawImage(bgImg, cc[0] - w / 2, cc[1] - hh / 2, w, hh);
    } else {
      // запасной вариант: сетка""", """    } else if (mapMode !== 'grid') {
      drawGoogle(W, H);
    } else {
      // запасной вариант (PDF без подложки): сетка""")
rep("  function toggleBg() { mapMode = mapMode === 'photo' ? 'white' : mapMode === 'white' ? 'grid' : 'photo'; renderDrawer(); draw(); }\n"
    "  function mapModeName() { return mapMode === 'photo' ? tr('Фото: Бузалла') : mapMode === 'white' ? tr('Белая карта') : tr('Сетка'); }\n",
    """  function toggleBg() {
    mapMode = MAP_MODES[(MAP_MODES.indexOf(mapMode) + 1) % MAP_MODES.length];
    try { localStorage.setItem('fieldmap_maptype', mapMode); } catch (e) { /* ignore */ }
    renderDrawer(); draw();
  }
  function mapModeName() { return mapMode === 'sat' ? tr('Спутник Google') : mapMode === 'white' ? tr('Белая карта') : tr('Схема Google'); }
""")
rep("  bgImg.addEventListener('load', () => draw());\n", "")
# вид карты запоминается: после сдвига и поворота
rep("  function onMove() {\n    lastMoveAt = performance.now();\n", "  function onMove() {\n    saveView();\n    lastMoveAt = performance.now();\n")
rep("""    const n = b.querySelector('svg');
    if (n) n.style.transform = `rotate(${V.rot}rad)`;
  }""", """    const n = b.querySelector('svg');
    if (n) n.style.transform = `rotate(${V.rot}rad)`;
    saveView();
  }""")

# ---------------------------------------------------------------- GPS
rep("    drawPhotoPins();\n    if (mode === 'line' && LS.layerMode", "    drawPhotoPins();\n    drawGps();\n    if (mode === 'line' && LS.layerMode")
GPS = r"""  // ---------- GPS: синяя точка и круг точности; кнопка ◎ переводит карту к текущей позиции ----------
  const GPS = { pos: null, acc: 0, t: 0, watch: null, center: false, denied: false };
  function gpsStart() {
    if (GPS.watch !== null || !navigator.geolocation) return;
    try {
      GPS.watch = navigator.geolocation.watchPosition(gpsFix, gpsErr, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    } catch (e) { GPS.watch = null; }
  }
  function gpsStop() {
    if (GPS.watch === null) return;
    try { navigator.geolocation.clearWatch(GPS.watch); } catch (e) { /* ignore */ }
    GPS.watch = null;
  }
  function gpsFix(p) {
    GPS.pos = [p.coords.latitude, p.coords.longitude];
    GPS.acc = p.coords.accuracy || 0;
    GPS.t = Date.now();
    GPS.denied = false;
    // при самом первом запуске карта сама переходит к текущему месту
    if (GPS.center || viewFresh) { GPS.center = false; viewFresh = false; flyTo(GPS.pos[0], GPS.pos[1], Math.max(V.z, 17)); } else draw();
  }
  function gpsErr(e) {
    if (e && e.code === 1) { GPS.denied = true; gpsStop(); }
    if (!GPS.center) return;
    GPS.center = false;
    toast(e && e.code === 1 ? 'Нет доступа к геолокации. Разрешите его в настройках телефона'
      : e && e.code === 2 ? 'Местоположение недоступно: включите GPS' : 'Не удалось определить местоположение');
  }
  function gpsButton() {
    if (!navigator.geolocation) { toast('Геолокация недоступна на этом устройстве'); return; }
    if (GPS.pos) { flyTo(GPS.pos[0], GPS.pos[1], Math.max(V.z, 17)); gpsStart(); return; }
    GPS.center = true;
    toast('Ищу местоположение…');
    // в приложении: доступа нет — заново спрашиваем разрешение у Android, ответ придёт в __onLocationPermission
    if (GPS.denied && window.AndroidBridge && window.AndroidBridge.requestLocationPermission) {
      window.AndroidBridge.requestLocationPermission();
      return;
    }
    gpsStop(); gpsStart();
    // разовый запрос вдобавок к слежению: на некоторых телефонах так первая точка приходит быстрее
    navigator.geolocation.getCurrentPosition(gpsFix, gpsErr, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  }
  // вызывается из MainActivity после ответа на системный запрос разрешения
  window.__onLocationPermission = (ok) => {
    if (ok) { GPS.denied = false; gpsStop(); gpsStart(); return; }
    if (GPS.center) { GPS.center = false; toast('Нет доступа к геолокации. Разрешите его в настройках телефона'); }
  };
  function drawGps() {
    if (!GPS.pos) return;
    const [x, y] = screenOf(GPS.pos[0], GPS.pos[1]);
    const mpp = 156543.03392 * Math.cos(GPS.pos[0] * Math.PI / 180) / Math.pow(2, V.z);   // метров в пикселе
    const r = GPS.acc / mpp;
    ctx.save();
    if (r > 10) {
      ctx.beginPath(); ctx.arc(x, y, Math.min(r, 5000), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59,130,246,.16)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(59,130,246,.65)'; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }

"""
insert_before("  // ---------- переходы по карте ----------\n", GPS)
rep("  $('fabGps').onclick = () => notYet('GPS');\n", "  $('fabGps').onclick = gpsButton;\n")

# ---------------------------------------------------------------- «Поделиться» маркером: отправить, Google Карты, копировать
rep_re(r"  // поделиться координатами маркера: системное меню «Поделиться».*?\n  function shareMarker\(m\) \{\n.*?\n    toast\(coords\);\n  \}\n", r"""  // копирование текста: буфер обмена, если нельзя — через скрытое поле
  function copyText(text) {
    const fallback = () => {
      const t = h('textarea', { style: 'position:fixed;opacity:0' }); t.value = text;
      document.body.append(t); t.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      t.remove();
    };
    try { navigator.clipboard.writeText(text).catch(fallback); } catch (e) { fallback(); }
    toast('Скопировано');
  }
  // поделиться маркером: отправить точку (WhatsApp, Telegram, почта…) или открыть её в Google Картах
  function shareMarker(m) {
    const name = m.name || tr('Маркер');
    const lat = m.lat.toFixed(6), lng = m.lng.toFixed(6);
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const text = `${name}\n${lat}, ${lng}\n${url}`;
    const B = window.AndroidBridge;
    openSheet(
      h('h3', { text: name }),
      h('div', { class: 'share-coords', text: `${lat}, ${lng}` }),
      h('button', { class: 'btn primary', text: 'Отправить (WhatsApp, Telegram…)', onclick: () => {
        closeSheet();
        if (B && B.shareText) B.shareText(text);
        else if (navigator.share) navigator.share({ title: name, text }).catch(() => {});
        else copyText(text);
      } }),
      h('button', { class: 'btn', text: 'Открыть в Google Картах', onclick: () => {
        closeSheet();
        if (B && B.openMap) B.openMap(Number(lat), Number(lng), name); else window.open(url, '_blank');
      } }),
      h('button', { class: 'btn', text: 'Скопировать координаты', onclick: () => { closeSheet(); copyText(`${lat}, ${lng}`); } }),
      h('button', { class: 'btn ghost', text: 'Отмена', onclick: closeSheet }));
  }
""", re.S)

# ---------------------------------------------------------------- фото: общее хранилище Store, скачивание по запросу
rep("  const PhotoStore = (() => {\n",
    "  // в приложении картинки хранит Store (IndexedDB «fieldmap»): чужие фото он скачивает с общей карты, только когда их открывают\n"
    "  const PhotoStore = ST ? {\n"
    "    put: (id, src) => ST.photoPut(id, src),\n"
    "    get: (id) => ST.photoGet(id),\n"
    "    del: (id) => ST.photoDel(id),\n"
    "    keys: () => ST.photoKeys(),\n"
    "  } : (() => {\n")
rep("""  function photoSrc(p) {
    if (!isShot(p)) return Promise.resolve(p || null);""", """  function photoSrc(p) {
    if (typeof p === 'string' && p.startsWith('photo:')) return PhotoStore.get(p.slice(6));   // фото из галереи и старые фото
    if (!isShot(p)) return Promise.resolve(p || null);""")
rep("""  function gpsOnce() {
    return new Promise((res) => {""", """  function gpsOnce() {
    // свежая точка от слежения GPS — сразу
    if (GPS.pos && Date.now() - GPS.t < 20000) return Promise.resolve({ lat: GPS.pos[0], lng: GPS.pos[1], acc: GPS.acc });
    return new Promise((res) => {""")
rep("toast(p.gps ? 'Фото сохранено' : 'Фото сохранено. Место — по карте (GPS — в приложении)');",
    "toast(p.gps ? 'Фото сохранено' : 'Фото сохранено. Место — по карте (нет GPS)');")
rep("""    S.markers.concat(S.lines).forEach((it) => (it.photos || []).forEach((p) => { if (isShot(p)) used.add(p.id); }));""",
    """    S.markers.concat(S.lines).forEach((it) => (it.photos || []).forEach((p) => {
      const id = isShot(p) ? p.id : typeof p === 'string' && p.startsWith('photo:') ? p.slice(6) : null;
      if (id) used.add(id);
    }));""")
# поделиться фото — через AndroidBridge
rep("""    const blob = new Blob([bytes], { type: 'image/jpeg' });
    let file = null;
    try { file = new File([blob], name, { type: 'image/jpeg' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }""", """    const blob = new Blob([bytes], { type: 'image/jpeg' });
    if (hasFileBridge()) { await giveBlob(name, 'image/jpeg', blob, true); return; }
    let file = null;
    try { file = new File([blob], name, { type: 'image/jpeg' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }""")

# ---------------------------------------------------------------- PDF: «Поделиться» и «Сохранить» через AndroidBridge
rep("""    const blob = new Blob([pdf], { type: 'application/pdf' });
    if (share) {
      // «Поделиться» — системное меню телефона (WhatsApp, почта…); где его нет — файл сохраняется""", """    const blob = new Blob([pdf], { type: 'application/pdf' });
    if (hasFileBridge()) { if (await giveBlob(name, 'application/pdf', blob, share)) endAreaPdf(); return; }
    if (share) {
      // «Поделиться» — системное меню телефона (WhatsApp, почта…); где его нет — файл сохраняется""")
rep("""  async function deliverPdf(pdf, name, share) {
    const blob = new Blob([pdf], { type: 'application/pdf' });
""", """  async function deliverPdf(pdf, name, share) {
    const blob = new Blob([pdf], { type: 'application/pdf' });
    if (hasFileBridge()) return giveBlob(name, 'application/pdf', blob, share);
""")

# ---------------------------------------------------------------- меню: общая карта, тип карты, аккаунт; без «Люди и роли»
rep("""        row('☁️', 'Общая карта', 'Синхронизация не запускается в прототипе', () => notYet('Синхронизация')),""",
    """        row('☁️', 'Общая карта', syncSubtitle(), () => { closeDrawer(); openSyncPage(); }),
        ST && ST.mapId && AU && AU.google() ? row(ico('people'), 'Участники карты', tr('Кто работает с этой картой'), () => { closeDrawer(); openMembers(); }) : null,""")
rep("""        row(ico('user'), `${tr('Вы:')} ${me().name}`, `${personSub(Object.assign({}, me(), { id: null }))} · ${tr('Смотреть как…')}`, openWhoAmI),
        isManager() ? row(ico('people'), 'Люди и роли', peopleSummary(), () => { closeDrawer(); openPeople(); }) : null,""",
    """        AU && AU.google() ? row(ico('user'), `${tr('Вы:')} ${me().name}`, tr('Аккаунт'), () => { closeDrawer(); openAccount(); })
          : row(ico('user'), 'Войти через Google', tr('Не вошли — общая карта недоступна'), () => { closeDrawer(); signInFlow(); }),""")
rep("""      lbl('Данные'),
      toggleRow('Импорт KML', false, () => notYet('Импорт')),
      toggleRow('Экспорт KML', false, () => notYet('Экспорт')),
      toggleRow('Экспорт данных в приложение', false, exportForApp),
    ]);""", """      lbl('Данные'),
      actRow('import', 'Импорт данных или KML', importFile),
      actRow('export', 'Экспорт KML', exportKml),
      actRow('export', 'Экспорт данных (объекты, фото, кабели)', exportData),
      lbl('Аккаунт'),
      AU && AU.google() ? actRow('user', `${tr('Вы:')} ${me().name}`, () => { closePage(); openAccount(); })
        : actRow('user', 'Войти через Google', () => { closePage(); signInFlow(); }),
    ]);""")
rep("""    const toggleRow = (text, on, onclick) => h('button', { class: 'lang-row' + (on ? ' sel' : ''), onclick },
      h('span', { class: 'lang-name', text }), h('span', { class: 'lang-dot' }));
    openPage('Настройки',""", """    const toggleRow = (text, on, onclick) => h('button', { class: 'lang-row' + (on ? ' sel' : ''), onclick },
      h('span', { class: 'lang-name', text }), h('span', { class: 'lang-dot' }));
    const actRow = (icon, text, onclick) => h('button', { class: 'lang-row act-row', onclick },
      h('span', { class: 'lang-name', text }), ico(icon));
    openPage('Настройки',""")
rep("    document.title = tr('FieldMap прототип');\n", "    document.title = 'FieldMap';\n")

# ---------------------------------------------------------------- отчёт: место вписывают сами; рапорт можно отправить
rep("""    nodes.push(pgSec('Место (ближайший город)'), pgCard(placeIn,
      h('div', { class: 'pg-note', text: 'В приложении город определится сам — по тому, где стоят маркеры' })));""",
    """    nodes.push(pgSec('Место (ближайший город)'), pgCard(placeIn));""")
rep("""      try { navigator.clipboard.writeText(txt.value).then(done, manual); } catch (e) { manual(); }
    }, 'accent')));""",
    """      try { navigator.clipboard.writeText(txt.value).then(done, manual); } catch (e) { manual(); }
    }, 'accent'), window.AndroidBridge && window.AndroidBridge.shareText ? pgRow('export', tr('Поделиться рапортом'), () => {
      if (placeIn.value.trim() !== placeOf(day)) { setPlace(day, placeIn.value); if (!edited) fill(); }
      window.AndroidBridge.shareText(txt.value);
    }, 'accent') : null));""")

# ---------------------------------------------------------------- файлы, общая карта, аккаунт, присланные точки, «Назад»
APP = open(sys.argv[3] if len(sys.argv) > 3 else __file__.replace('port.py', 'app_part.js'), encoding='utf-8').read()
insert_before("  // ---------- подключение кнопок ----------\n", APP)

# ---------------------------------------------------------------- старт
rep("""  // проект и выполнение: один раз всё красное (как оно выглядело) становится проектом, цвет остаётся
  if (!S.stageV1) {""", """  // обновление со старого приложения (3.x): там объект без своего цвета рисовался цветом своего объекта (папки),
  // а здесь — красным. Один раз прописываем цвет объекта, и всё старое остаётся «Выполнено» с прежним видом
  // (миграция «красное — это проект» не запускается)
  if (!S.apkV4) {
    if (!S.stageV1) {
      const fc = (fid) => { const f = folderById(fid); return f && f.color ? safeColor(f.color) : PALETTE[0]; };
      S.markers.forEach((m) => { if (!m.color) m.color = fc(m.folderId); });
      S.lines.forEach((l) => { if (!l.color) l.color = fc(l.folderId); });
      S.stageV1 = true;
    }
    S.apkV4 = true;
  }
  // проект и выполнение: один раз всё красное (как оно выглядело) становится проектом, цвет остаётся
  if (!S.stageV1) {""")
rep("""  applyStatic();
  saveData();
  resize();
  updateFolderChip();
  renderDrawer();
})();""", """  applyStatic();
  saveData();
  resize();
  updateCompass();
  if (viewFresh && allPoints().length) { viewFresh = false; fitPoints(allPoints()); }
  updateFolderChip();
  renderDrawer();
  appStart();
})();""")

open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s), s.count('\n'))
