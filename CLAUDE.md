# FieldMap — памятка для новых сессий

Android-приложение для полевой работы (прокладка оптики): общая карта с объектами (папками), маркерами, линиями,
слоями кабелей и трубок, бобинами и фото. Пользователь пишет по-русски, отвечать по-русски.

## Где код

- **Весь проект лежит в архиве `fieldmap_v3.zip`** в корне репозитория (внутри — папка `fieldmap2/`).
- Рядом: `apk-port/` — перенос прототипа в страницу APK (`port.py` + `app_part.js`), `apk-tests/` — проверки страницы APK
  (Playwright), `proto-tests/` — проверки самого прототипа.
- Основная ветка — **`main`**. Изменения делать в своей ветке и вливать в `main` через pull request (по просьбе пользователя).

Как менять код:
1. `unzip -q fieldmap_v3.zip -d <папка в scratchpad>` и править там.
2. Собрать архив обратно **с той же структурой** (`fieldmap2/` наверху):
   `cd <папка> && zip -qrX ../fieldmap_v3.zip fieldmap2`, скопировать в корень репозитория.
3. Коммит, push в свою ветку, pull request в `main`.

## Устройство приложения (версия 4.0)

```
fieldmap2/
  app/src/main/java/com/fibra/fieldmapweb/MainActivity.java   WebView-оболочка, камера, файлы, вход через Google
  app/src/main/AndroidManifest.xml                            разрешения, FileProvider, приём «Поделиться»
  app/src/main/assets/web/index.html                          вся карта (~9500 строк; собирается apk-port/port.py)
  app/src/main/assets/web/js/store.js                         сохранение, фото (IndexedDB), учёт изменений для синхронизации
  app/src/main/assets/web/js/sync.js                          вход через Google (Auth) и общая карта через Firestore (Sync)
  app/src/main/assets/web/js/kml.js                           импорт/экспорт KML
  app/src/main/assets/web/js/firebase-config.js               ключи Firebase и GOOGLE_WEB_CLIENT_ID
  firestore.rules                                             окончательные правила Firestore (только вход через Google)
  firestore-transition.rules                                  переходные: 3.x (анонимно) синхронизируются, участники — только Google
  README.md                                                   описание для пользователя
```

- **index.html** = прототип пользователя с claude.ai (артефакт «FieldMap прототип», slug `7d5b4188-d90b-43f1-a4ce-3c204990d0c8`,
  https://claude.ai/artifact/GUpDC2p6FmZbZaKoUfHenb) + то, что нужно приложению. Делается **скриптом**:
  `python3 apk-port/port.py <прототип index.html> <…/assets/web/index.html>`. Скрипт — список точных замен (каждая проверяет,
  что кусок найден ровно один раз; если прототип поменялся — падает и показывает, какую замену поправить) и вставка
  `apk-port/app_part.js` (файлы, страница «Общая карта», аккаунт, участники, присланные точки, `__onBack`, `appStart()`).
  Прототип читать через Artifact `read_artifact` частями (offset/limit; большие части сохраняются в файл, склеить по `offset`).
  Руками index.html не править — править port.py/app_part.js и пересобирать, иначе следующий перенос всё сотрёт.
- Что меняет port.py: заголовок страницы, убирает фото Бузаллы (`bgImg`) — сетка осталась только как запасная подложка для PDF;
  подключает js/*; данные через Store (`loadData/saveData`, `seed()` пустой); подложка Google схема/спутник (`gTile`, `crossOrigin`)
  и CARTO, вид карты с поворотом запоминается (`fieldmap_view`); GPS (синяя точка, ◎, `__onLocationPermission`);
  «Поделиться» маркером (AndroidBridge); `PhotoStore` → Store; `photoSrc` понимает `photo:<id>`; PDF/фото — `giveBlob` через
  AndroidBridge; меню: «Общая карта», «Участники карты», «Вы: имя»/«Войти через Google»; настройки: импорт/экспорт, аккаунт;
  `me()` — вошедший аккаунт с правами админа, люди/бригады прототипа скрыты (`initRoles` их чистит); переводы it/en новых строк.
- **Миграция с 3.x** (`S.apkV4`, при первом запуске): объекту без своего цвета пишется цвет его объекта (в 3.x он так и
  рисовался), `S.stageV1 = true` до миграций прототипа — ничего не становится проектом. Объекты в синих папках стали
  синими = «уже существует» (в отчёт не идут) — пользователя предупредили.
- **Данные** — объект `S`: `folders` (с `parentId`), `markers`, `lines` (`points`, `layers` со слоями кабелей/трубок, `via`),
  `reels`. Личное для телефона (не синхронизируется): `workMode`, `autoColor`, `log`/`logSnap` (журнал), `reportPlace`,
  цвета, `view` и т.п. Ключ localStorage `fieldmap_proto_v1` (не менять). У объектов `createdBy`/`updatedBy` = uid (ставит Store).
- **Фото**: в `photos` у маркера и линии — строка `photo:<id>` (старые и из галереи) или запись снимка камеры
  `{id, lat, lng, t, by, gps?, acc?}`. Картинки — в IndexedDB `fieldmap`/`photos` по id (Store.photoGet/photoPut);
  data:URL в данных Store сам переносит в IndexedDB. На сервере — документы `photos_{id}`; **подписка их не получает**,
  фото скачивается при открытии (`Store.photoGet` → `backend.getPhoto`). Что уже на сервере — `meta.sent[код]`
  (при обновлении с 3.x все старые фото считаются отправленными).
- **Синхронизация**: `maps/{код}/items/{вид}_{id}`, объект строкой JSON в поле `json`, побеждает более поздний `updatedAt`,
  удаление — `deleted:true`. Подписка — `where('kind', 'in', [folders, markers, lines, reels])`.
  Участники: `maps/{код}/members/{uid}` = `{uid, name, role, joinedAt, seenAt}` (пишется при подключении и смене имени),
  владелец — `maps/{код}/info/owner` = `{uid}` (создаётся один раз первым вошедшим). Журнал у каждого телефона свой:
  пришедшие изменения в журнал не пишутся (`onRemoteData` обновляет `logSnap`).
- **Вход**: только Google. Кнопка → `AndroidBridge.googleSignIn(GOOGLE_WEB_CLIENT_ID)` → Credential Manager → ответ в
  `window.__onGoogleSignIn({idToken, name, email} | {error})` → `Auth.signIn` → Firebase `linkWithCredential` (если был
  анонимный uid из 3.x) или `signInWithCredential`. Аккаунт запоминается в localStorage `fieldmap_account`
  (`{uid, google, name, email, named}`), имя спрашивается один раз. Общая карта без входа не подключается.
- **Firebase**: проект `fieldmap-afaf2` (europe-west8, тариф Spark). В базе тестовые карты от проверок: `BKA2L7HRCD`,
  `ZFDWU7PDQE` (09.11.2026) — можно игнорировать.
- **Карта-подложка**: Google схема/спутник (`mt*.google.com/vt/lyrs=m|y`, без ключа, отдают `access-control-allow-origin: *`)
  и белая CARTO. Фото Бузаллы и сетку как подложку пользователь просил **не возвращать**.
- **AndroidBridge** (JS → натив): `shareFile(name, mime, text)`, `shareBinary(name, mime, base64)`, `saveBinary(name, mime, base64)`
  (системное «Сохранить», ответ в `__onFileSaved(ok)`), `shareText`, `openMap`, `takeShared`, `requestLocationPermission`,
  `googleSignIn(clientId)`. Натив → JS: `__onBack`, `__onLocationPermission`, `__onSharedLocation`, `__onGoogleSignIn`, `__onFileSaved`.
  Камера: `<input capture>` → `onShowFileChooser` → `ACTION_IMAGE_CAPTURE` в кэш (FileProvider `photos/`); разрешение CAMERA
  не объявлено намеренно (тогда приложение камеры снимает без него).
- Страница грузится по адресу `file:///android_asset/web/index.html` — не менять (данные в хранилище WebView привязаны к адресу).

## Сборка APK

- Android SDK в этой среде нет; APK собирает GitHub Actions (`.github/workflows/build-apk.yml`): сам при push в `main`
  и вручную `actions_run_trigger` (`run_workflow`, `build-apk.yml`, ref = ветка). ~1–2 минуты, кладёт APK в релиз
  **`latest`** (заменяет предыдущий). Скачать `https://github.com/zlontp98-bit/FieldMap/releases/download/latest/FieldMap.apk`
  через curl, сверить sha256 с digest релиза и отправить файлом (SendUserFile).
- Перед каждой новой сборкой поднимать `versionCode`/`versionName` в `app/build.gradle` (сейчас 7 / 4.0.1).
  Подпись — `app/debug.keystore` (одинаковая, ставится поверх; SHA-1 `F9:83:10:43:CB:EF:30:93:34:75:66:59:DD:41:38:EC:96:01:7E:3D`).
- Сайты Google теперь открыты (dl.google.com, gstatic, firestore): MainActivity проверяется `javac` против
  `android-all` (Maven Central, `org.robolectric:android-all:13-robolectric-9030017`), `androidx.core` 1.12.0,
  `androidx.credentials` 1.3.0 и `googleid` 1.1.1 (classes.jar из AAR с dl.google.com/dl/android/maven2).

## Как проверять

- `apk-tests/` (Playwright, Chromium): `FM_WEB=<…/assets/web> FM_OUT=<папка> node apk-tests/t2_sync.cjs`.
  Firestore заменён ретранслятором в Node (`FIELDMAP_BACKEND_FACTORY`), вход Google — заглушкой (`FIELDMAP_AUTH_FACTORY`),
  AndroidBridge — заглушкой (вызовы в `window.__bridgeCalls`). t1 — запуск и вход, t2 — два телефона, камера, фото по
  запросу, участники; t3 — обновление с данных 3.2 (цвета, старые фото, общая карта), журнал, присланная точка, «Назад»,
  экспорт, PDF; t4 — настоящий Firebase (анонимный вход вместо Google, работает только со старыми правилами; пишет
  тестовую карту — сказать пользователю); t5 — итальянский.
- Глобальные `Store`, `Sync`, `Auth` доступны из теста (`Store.data` — это `S` страницы).
- Правила Firestore — в эмуляторе Firebase: `apk-tests/rules/` (README там). 09.11.2026: переходные и окончательные —
  по 30 проверок, все прошли.

## Состояние на 09.11.2026 — перенос прототипа в APK (4.0) сделан

Сделано всё из плана от 06.11.2026: прототип целиком (кроме ролей и людей), миграция, камера, PDF, фото по запросу,
вход через Google, участники карты, новые правила. Пользователь включил провайдер Google, добавил Android-приложение
(SHA-1 добавляется уже после регистрации: Project settings → Your apps → Add fingerprint) и прислал Web client ID —
он вписан в `js/firebase-config.js`, сборка 7 / 4.0.1. Дальше: пользователь проверяет вход на своём телефоне.
Правила — в два шага: 09.11.2026 пользователю дали **переходные** (`firestore-transition.rules`: объекты — как раньше
`request.auth != null`, участники и владелец — только Google), чтобы «Участники карты» работали, пока не все обновились.
Когда все телефоны на 4.0 — публиковать **окончательные** `firestore.rules` (общая карта только для вошедших через Google,
проверка `'google.com' in request.auth.token.firebase.identities`). До этого не снимать камерой на общей карте:
3.x при правке маркера выбросит новые фото у всех. Владелец карты — первый, кто откроет её в 4.0 после переходных правил
(`info/owner` поменять нельзя — только в консоли Firebase вручную).
Не проверено на телефоне: вход через Google, камера, «Сохранить»/«Поделиться» файлом, PDF с настоящими тайлами в WebView.

## Отложенные задачи (пользователь просил «потом»)

1. **Роли участников**: владелец / редактор / наблюдатель, проверка в правилах Firestore. Участник — uid Google-аккаунта
   (`maps/{код}/members`); экран «Люди и роли» прототипа — будущий экран ролей и бригад (сейчас скрыт).
2. Город в отчёте сам (обратное геокодирование), общий журнал на всю карту, адрес на подписи фото — заметки в начале прототипа.

Ещё предложено (не заказано): корзина и история правок; офлайн-карты («скачать район»); хранить слои
линии отдельно (сейчас двое на одной линии затирают правки друг друга); «маркер там, где я стою», запись трека,
экономия батареи GPS; отчёты (Excel/PDF); нормальная подписанная сборка и уведомление об обновлении.

## Правила работы с пользователем

- Пользователь работает с телефона, присылает скриншоты. Объяснять по шагам, просто, без жаргона.
- Новые сборки отдавать файлом APK, коротко перечислять, что изменилось и что проверено, а что нет.
- Прототип на claude.ai может меняться в других чатах: перед встраиванием читать его свежую версию.
