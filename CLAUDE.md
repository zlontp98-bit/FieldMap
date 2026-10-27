# FieldMap — памятка для новых сессий

Android-приложение для полевой работы (прокладка оптики): общая карта с папками, маркерами, линиями,
слоями кабелей и трубок, бобинами и фото. Пользователь пишет по-русски, отвечать по-русски.

## Где код

- **Весь проект лежит в архиве `fieldmap_v3.zip`** в корне репозитория (внутри — папка `fieldmap2/`).
  Отдельных исходников в репозитории нет.
- Рабочая ветка: **`claude/online-app-network-copy-loeg16`**. В `main` пока старая первая версия
  (перенос в `main` отложен — см. «Отложенные задачи»).

Как менять код:
1. `unzip -q fieldmap_v3.zip -d <папка в scratchpad>` и править там.
2. Собрать архив обратно **с той же структурой** (`fieldmap2/` наверху):
   `cd <папка> && zip -qrX ../fieldmap_v3.zip fieldmap2`, скопировать в корень репозитория.
3. Коммит, push в рабочую ветку.

## Устройство приложения

```
fieldmap2/
  app/src/main/java/com/fibra/fieldmapweb/MainActivity.java   WebView-оболочка
  app/src/main/AndroidManifest.xml                            разрешения, FileProvider, приём «Поделиться»
  app/src/main/assets/web/index.html                          вся карта (одна страница, ~5000 строк JS внутри)
  app/src/main/assets/web/js/store.js                         сохранение и учёт изменений для синхронизации
  app/src/main/assets/web/js/sync.js                          общая карта через Firestore
  app/src/main/assets/web/js/kml.js                           импорт/экспорт KML
  app/src/main/assets/web/js/firebase-config.js               ключи проекта Firebase
  firestore.rules                                             правила Firestore (вставляются в консоли вручную)
  README.md                                                   описание для пользователя
```

- **index.html** — это прототип пользователя с claude.ai (артефакт «FieldMap прототип»,
  https://claude.ai/artifact/GUpDC2p6FmZbZaKoUfHenb), в который встроены: Store/Sync/Kml, GPS,
  карты Google, «Поделиться», импорт данных, обработка кнопки «Назад». Рисует всё на `<canvas>`
  своей проекцией Web Mercator (без Leaflet). Строки интерфейса — по-русски, переводы it/en в `DICT`
  (ключ — русский текст, функция `tr()`).
- **Данные страницы** — объект `S`: `folders` (с `parentId`), `markers` (`photos` — data:URL),
  `lines` (`points`, `layers` — слои кабелей/трубок с вложенными массивами), `reels` (бобины),
  плюс личное для телефона: `activeFolderId`, `view`, `placeColor` и т.п. Сохраняется через
  `saveData()` → `Store.save()`; ключ localStorage `fieldmap_proto_v1` (не менять — иначе данные
  пользователей пропадут). Фото хранятся в IndexedDB, в localStorage — ссылки `photo:<id>`.
- **Синхронизация**: Firestore, документ на объект `maps/{код}/items/{вид}_{id}`, вид — folders,
  markers, lines, reels, photos. Объект передаётся строкой JSON в поле `json` (Firestore не принимает
  вложенные массивы). Побеждает более позднее изменение (`updatedAt`, время телефона), удаление —
  `deleted:true`. Фото — отдельные документы `photos_{id}` (одно фото на документ). Вход анонимный,
  доступ — по 10-значному коду карты. SDK Firebase 10.14.1 грузится с gstatic.com.
- **Firebase**: проект `fieldmap-afaf2` (регион europe-west8, бесплатный тариф Spark, база `(default)`),
  анонимный вход включён, правила из `firestore.rules` опубликованы. В базе есть тестовая карта
  `BKA2L7HRCD` от проверки — можно игнорировать.
- **Карта-подложка**: Google схема/спутник (`mt*.google.com/vt/lyrs=m|y`, неофициальный адрес без
  ключа) и белая CARTO. Фото Бузаллы и сетку пользователь просил **не возвращать**.
- **AndroidBridge** (MainActivity → JS): `shareFile`, `shareText`, `openMap`, `takeShared`,
  `requestLocationPermission`. JS → натив: `window.__onBack`, `window.__onLocationPermission`,
  `window.__onSharedLocation` (точка из «Поделиться»: короткие ссылки maps.app.goo.gl MainActivity
  разворачивает сама).
- Страница грузится по адресу `file:///android_asset/web/index.html` — не менять (данные в
  хранилище WebView привязаны к адресу).

## Сборка APK

- В этой среде Android SDK нет и сайты Google закрыты: APK собирает GitHub Actions
  (`.github/workflows/build-apk.yml`). Сам workflow запускается при push в `main` или вручную.
- Из рабочей ветки — вручную: `actions_run_trigger` (`run_workflow`, `build-apk.yml`,
  ref = рабочая ветка). Сборка ~1 минута, кладёт APK в релиз **`latest`** (заменяет предыдущий).
- Пользователь не может скачать APK по ссылке GitHub — после сборки скачать
  `https://github.com/zlontp98-bit/FieldMap/releases/download/latest/FieldMap.apk` через curl
  и отправить файлом (SendUserFile). Сверить sha256 с digest релиза.
- Перед каждой новой сборкой поднимать `versionCode`/`versionName` в `app/build.gradle`
  (сейчас 4 / 3.1). Подпись — `app/debug.keystore` (одинаковая, ставится поверх).
- MainActivity можно проверить компиляцией `javac` против `android-all` с Maven Central
  (`org.robolectric:android-all:13-robolectric-9030017`) и заглушки `androidx.core.content.FileProvider`.

## Как проверять

- Страницу проверять в Chromium через Playwright (`require('playwright')`, установлен), открывая
  `file://…/index.html`. Сайты Google и CARTO закрыты — их запросы перехватывать (`route`).
- Синхронизацию двух «телефонов» — двумя контекстами браузера; вместо Firestore можно подставить
  `window.FIELDMAP_BACKEND_FACTORY` (заглушка-ретранслятор через `exposeFunction`).
- Настоящий Firebase тоже проверяется: SDK взять из `npm pack firebase@10.14.1` и подставлять вместо
  gstatic через `route`, браузер запускать с `proxy: { server: process.env.HTTPS_PROXY }` и
  `ignoreHTTPSErrors`. Пишет в настоящую базу пользователя — только тестовой картой и сказать об этом.

## Отложенные задачи (пользователь просил «потом»)

1. **Фото только при открытии маркера** — сейчас фото скачиваются на все телефоны сразу; на бесплатном
   тарифе узкое место — трафик 10 ГБ/мес и 50 000 чтений/сутки.
2. **Перенос в `main`** (pull request). До этого пользователю нельзя загружать файлы в `main` через
   сайт: сборка запустится сама из старой версии и заменит APK в `latest`.
3. **Роли участников**: владелец / редактор / наблюдатель, проверка в правилах Firestore; участник
   определяется анонимным входом (переустановка = новый участник).

Ещё предложено (не заказано): корзина и история правок; офлайн-карты («скачать район»); хранить слои
линии отдельно (сейчас двое на одной линии затирают правки друг друга); кнопка камеры в маркере;
«маркер там, где я стою», запись трека, экономия батареи GPS; отчёты (Excel/PDF); нормальная
подписанная сборка и уведомление об обновлении.

## Правила работы с пользователем

- Пользователь работает с телефона, присылает скриншоты. Объяснять по шагам, просто, без жаргона.
- Новые сборки отдавать файлом APK, коротко перечислять, что изменилось и что проверено, а что нет.
- Прототип на claude.ai может меняться в других чатах: перед встраиванием читать его свежую версию.
