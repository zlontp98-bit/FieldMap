// Проверка правил Firestore в эмуляторе: переходные (transition.rules) и окончательные (final.rules)
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, query, where, deleteDoc } = require('firebase/firestore');
const fs = require('fs');
let bad = 0;
async function check(label, expectOk, fn) {
  try {
    if (expectOk) await assertSucceeds(fn()); else await assertFails(fn());
    console.log('  ок   ', (expectOk ? 'можно:  ' : 'нельзя: ') + label);
  } catch (e) {
    bad++;
    console.log('  ОШИБКА', (expectOk ? 'ждали «можно»:  ' : 'ждали «нельзя»: ') + label, '—', String(e.message || e).slice(0, 120));
  }
}
async function run(file, anonItems) {
  console.log(`\n=== ${file} (анонимные телефоны 3.x ${anonItems ? 'работают' : 'НЕ работают'}) ===`);
  const env = await initializeTestEnvironment({ projectId: 'demo-fieldmap', firestore: { rules: fs.readFileSync(file, 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  const tok = (sub, prov, ids) => ({ sub, firebase: { sign_in_provider: prov, identities: ids } });
  const anon = env.authenticatedContext('anon1', tok('anon1', 'anonymous', {})).firestore();
  const A = env.authenticatedContext('uidA', tok('uidA', 'google.com', { 'google.com': ['111'], email: ['a@x.com'] })).firestore();
  const B = env.authenticatedContext('uidB', tok('uidB', 'google.com', { 'google.com': ['222'], email: ['b@x.com'] })).firestore();
  // телефон 3.x, который вошёл через Google: анонимный uid привязан к Google
  const L = env.authenticatedContext('anon2', tok('anon2', 'anonymous', { 'google.com': ['333'] })).firestore();
  const none = env.unauthenticatedContext().firestore();
  const M = 'ABCDE12345';
  const it = (kind, id) => ({ kind, id, updatedAt: Date.now(), deleted: false, json: '{"name":"x"}' });
  const items = (db) => collection(db, 'maps', M, 'items');
  const q = (db) => query(items(db), where('kind', 'in', ['folders', 'markers', 'lines', 'reels']));

  console.log(' объекты карты:');
  await check('старый телефон 3.x (анонимно) пишет маркер', anonItems, () => setDoc(doc(items(anon), 'markers_m1'), it('markers', 'm1')));
  await check('старый телефон 3.x читает карту', anonItems, () => getDocs(items(anon)));
  await check('Google: пишет маркер', true, () => setDoc(doc(items(A), 'markers_m2'), it('markers', 'm2')));
  await check('Google: пишет фото', true, () => setDoc(doc(items(A), 'photos_p1'), { kind: 'photos', id: 'p1', data: 'data:image/jpeg;base64,xx', updatedAt: 1 }));
  await check('Google: подписка 4.0 (всё, кроме фото)', true, () => getDocs(q(A)));
  await check('Google: открыть одно фото', true, () => getDoc(doc(items(A), 'photos_p1')));
  await check('привязанный к Google телефон 3.x пишет', true, () => setDoc(doc(items(L), 'markers_m3'), it('markers', 'm3')));
  await check('без входа читает', false, () => getDocs(items(none)));
  await check('без входа пишет', false, () => setDoc(doc(items(none), 'markers_m4'), it('markers', 'm4')));
  await check('удалить документ', false, () => deleteDoc(doc(items(A), 'markers_m2')));
  await check('id документа не совпадает с видом и id', false, () => setDoc(doc(items(A), 'markers_zzz'), it('markers', 'm5')));
  await check('неизвестный вид', false, () => setDoc(doc(items(A), 'users_u1'), it('users', 'u1')));
  await check('код карты не 10 символов', false, () => setDoc(doc(collection(A, 'maps', 'SHORT', 'items'), 'markers_m6'), it('markers', 'm6')));

  console.log(' владелец и участники:');
  const owner = (db) => doc(db, 'maps', M, 'info', 'owner');
  const mem = (db, uid) => doc(db, 'maps', M, 'members', uid);
  await check('старый телефон читает участников', false, () => getDocs(collection(anon, 'maps', M, 'members')));
  await check('старый телефон записывает себя владельцем', false, () => setDoc(owner(anon), { uid: 'anon1', at: 1 }));
  await check('A (первый вошедший) становится владельцем', true, () => setDoc(owner(A), { uid: 'uidA', at: 1 }));
  await check('B пытается перезаписать владельца', false, () => setDoc(owner(B), { uid: 'uidB', at: 2 }));
  await check('A удаляет запись о владельце', false, () => deleteDoc(owner(A)));
  await check('A записывает себя: роль «владелец»', true, () => setDoc(mem(A, 'uidA'), { uid: 'uidA', name: 'Мария', role: 'owner', joinedAt: 1, seenAt: 1 }));
  await check('B записывает себя владельцем', false, () => setDoc(mem(B, 'uidB'), { uid: 'uidB', name: 'Олег', role: 'owner', joinedAt: 1, seenAt: 1 }));
  await check('B записывает себя: роль «участник»', true, () => setDoc(mem(B, 'uidB'), { uid: 'uidB', name: 'Олег', role: 'editor', joinedAt: 1, seenAt: 1 }));
  await check('B меняет своё имя', true, () => setDoc(mem(B, 'uidB'), { uid: 'uidB', name: 'Олег П.', role: 'editor', joinedAt: 1, seenAt: 2 }));
  await check('B сам делает себя владельцем', false, () => setDoc(mem(B, 'uidB'), { uid: 'uidB', name: 'Олег', role: 'owner', joinedAt: 1, seenAt: 3 }));
  await check('B пишет за A', false, () => setDoc(mem(B, 'uidA'), { uid: 'uidA', name: 'взлом', role: 'owner', joinedAt: 1, seenAt: 1 }));
  await check('имя длиннее 60 букв', false, () => setDoc(mem(B, 'uidB'), { uid: 'uidB', name: 'x'.repeat(61), role: 'editor', joinedAt: 1, seenAt: 4 }));
  await check('B видит список участников', true, () => getDocs(collection(B, 'maps', M, 'members')));
  await check('B читает, кто владелец', true, () => getDoc(owner(B)));
  await check('привязанный телефон 3.x записывает себя участником', true, () => setDoc(mem(L, 'anon2'), { uid: 'anon2', name: 'Иван', role: 'editor', joinedAt: 1, seenAt: 1 }));
  await check('участник удаляет себя', false, () => deleteDoc(mem(B, 'uidB')));
  await env.cleanup();
}
(async () => {
  await run('transition.rules', true);
  await run('final.rules', false);
  console.log(bad ? `\nОШИБОК: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
