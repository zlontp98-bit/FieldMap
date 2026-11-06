const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(700);
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('fieldmap_proto_v1')));
  console.log('done mode: fabLine dim', await p.evaluate(() => document.getElementById('fabLine').className));
  await p.click('#fabLine'); await p.waitForTimeout(300);
  console.log('toast:', await p.textContent('#toast'), '| mode banner hidden:', await p.evaluate(() => document.getElementById('modeTop').hidden));
  // раскладка слоя (бобина) в «Выполнении» по-прежнему работает
  await p.evaluate(() => [...document.querySelectorAll('#workMode button')].find((x) => x.textContent === 'Проект').click()); await p.waitForTimeout(300);
  console.log('plan mode: fabLine', await p.evaluate(() => document.getElementById('fabLine').className));
  const n0 = (await st()).lines.length;
  await p.click('#fabLine'); await p.waitForTimeout(300);
  await p.click('#linePlus'); await p.waitForTimeout(200);
  await p.mouse.move(200, 400); await p.mouse.down(); await p.mouse.move(110, 300, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  await p.click('#linePlus'); await p.click('#lineSave'); await p.waitForTimeout(600);
  const s = await st(); const nl = s.lines[s.lines.length - 1];
  console.log('lines', n0, '->', s.lines.length, 'new plan:', nl.plan);
  // рабочий: кнопки линии нет
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('fieldmap_proto_v1')); S.people.push({ id: 'W', name: 'Пётр', role: 'worker', status: 'active' }); S.meId = 'W'; S.folders.forEach((f) => { f.access = { 'p:W': 'edit' }; }); localStorage.setItem('fieldmap_proto_v1', JSON.stringify(S)); });
  await p.reload(); await p.waitForTimeout(600);
  console.log('worker fabLine hidden:', await p.evaluate(() => document.getElementById('fabLine').hidden), '| fabReels hidden:', await p.evaluate(() => document.getElementById('fabReels').hidden));
  await b.close();
})();
