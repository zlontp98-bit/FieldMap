// итальянский: обходим экраны и ищем оставшуюся кириллицу на виду
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + process.argv[2]);
  await p.evaluate(() => localStorage.setItem('fieldmap_lang', 'it'));
  await p.reload(); await p.waitForTimeout(700);
  const cyr = async (label) => {
    const t = await p.evaluate(() => {
      const out = new Set();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode, el = n.parentElement;
        if (!el || el.closest('script,style') || !el.getClientRects().length) continue;
        const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') continue;
        if (/[А-Яа-яЁё]/.test(n.textContent)) out.add(n.textContent.trim().slice(0, 70));
      }
      return [...out];
    });
    console.log(`[${label}]`, t.length ? t.join(' | ') : 'ok');
  };
  await cyr('map');
  await p.evaluate(() => document.querySelector('.top-bar .tb-btn').click()); await p.waitForTimeout(300); await cyr('drawer');
  await p.evaluate(() => [...document.querySelectorAll('#dTop .row')][4].click()); await p.waitForTimeout(400); await cyr('report');
  await p.click('#pageHead [aria-label]'); await p.waitForTimeout(300);
  await p.evaluate(() => { const r = [...document.querySelectorAll('#dTop .row')].find((x) => x.textContent.includes('Bobine')); if (r) r.click(); }); await p.waitForTimeout(300); await cyr('reels');
  await p.evaluate(() => { document.getElementById('page').classList.add('hidden'); });
  await p.click('#fabReels'); await p.waitForTimeout(400);
  if (!(await p.evaluate(() => !document.getElementById('sheet').classList.contains('hidden')))) { const lp = await p.$('#linePick .lp-row'); if (lp) { await lp.click(); await p.waitForTimeout(400); } }
  await cyr('new layer sheet');
  await p.evaluate(() => [...document.querySelectorAll('#sheetBox .lt-tile')][2].click()); await p.waitForTimeout(300); await cyr('custom layer');
  await b.close();
})();
