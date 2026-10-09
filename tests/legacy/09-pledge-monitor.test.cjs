const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('file://' + require('path').resolve(__dirname, '../../public/legacy/index.html')); await p.click('#btnNew'); await p.fill('#evNameIn', 'Test'); await p.click('#evSave');
  await p.click('#navPlg'); await p.click('#plSetupBtn2');
  for (let i = 0; i < 2; i++) await p.locator('#psOrgs input[data-k=name]').nth(i).fill(["Teddy's Charity", "Boris's Charity"][i]); await p.click('#psSave');
  const rd = () => p.evaluate(() => { const m = document.getElementById('monPlg'), r = m.querySelector('.tlyin').getBoundingClientRect(), o = m.getBoundingClientRect(); const q = s => (m.querySelector(s) || {}).textContent || '';
    return { org: q('.t-org'), amt: q('.t-amt'), rows: [...m.querySelectorAll('.t-row')].map(x => x.textContent), bdg: q('.bdg'), fit: Math.abs(r.width - (o.width - 4)) < 2, n: m.querySelectorAll('.tly').length, note: document.getElementById('monPlgNote').textContent, vis: o.width > 200 }; });
  await p.waitForTimeout(400); let t = await rd();
  ck('pledges page has a preview of the tally for the chosen organisation', t.vis && t.fit && t.org === "Teddy's Charity" && t.amt === '$0' && t.bdg === 'PREVIEW' && t.note.includes('Not on screen'));
  await p.fill('#plWho', 'Annie Gregory'); await p.locator('#plSug button', { hasText: 'walk-in guest' }).click(); await p.fill('#plAmt', '500'); await p.keyboard.press('Enter'); await p.waitForTimeout(1300); t = await rd();
  ck('recording a pledge updates the preview', t.amt === '$500' && t.rows[0] === 'Annie Gregory$500' && t.n === 1);
  await p.click('#plOrgs button >> nth=1'); await p.waitForTimeout(1300); t = await rd();
  ck('choosing another organisation switches the preview', t.org === "Boris's Charity" && t.amt === '$0' && t.n === 1);
  // put the tally on air for Teddy
  await p.click('#navRun'); await p.click('#btnEdit');
  const row = p.locator('#rows tr:has(input[data-f=title][value="Pledging: Org 1"])');
  await row.locator('select[data-f=org]').selectOption({ index: 1 }); await row.locator('[data-act=pick]').click(); await p.click('#pkLive [data-t=follow]'); await p.click('#btnEdit');
  await p.locator('#rows tr', { hasText: 'Pledging: Org 1' }).locator('[data-act=take]').click();
  await p.click('#navPlg'); await p.waitForTimeout(1300); t = await rd();
  ck('with the tally on air the box shows the real output', t.bdg === 'ON SCREEN' && t.org === "Teddy's Charity" && t.amt === '$500' && t.note.includes('output window is closed'));
  await p.click('#plOrgs button >> nth=1'); await p.fill('#plAmt', '50'); await p.keyboard.press('Enter'); await p.waitForTimeout(1300); t = await rd();
  ck('a pledge for another organisation does not change what is on screen', t.org === "Teddy's Charity" && t.amt === '$500' && t.bdg === 'ON SCREEN');
  await p.screenshot({ path: 'plgmon.png' });
  await p.setViewportSize({ width: 390, height: 800 }); ck('phone width fits', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length); console.log(res.join('\n')); await b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
