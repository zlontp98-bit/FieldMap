# Проверка правил Firestore в эмуляторе

Рядом с test.cjs положить правила из проекта:
`fieldmap2/firestore-transition.rules` → `transition.rules`, `fieldmap2/firestore.rules` → `final.rules`. Потом:

```
npm i firebase-tools@13 firebase@10.14.1 @firebase/rules-unit-testing@3
JAVA_TOOL_OPTIONS= npx firebase emulators:exec --project demo-fieldmap --only firestore "node test.cjs"
```

Нужна Java 11+. Старый телефон 3.x — анонимный вход (`identities: {}`), 4.0 — Google (`identities['google.com']`),
телефон 3.x после входа через Google — анонимный uid с привязанным Google.
