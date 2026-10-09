const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('file://' + require('path').resolve(__dirname, '../../public/legacy/index.html')); await p.click('#btnNew'); await p.fill('#evNameIn', 'TFN Flagship 1'); await p.click('#evSave');
  // guests: 6 from Bupa (2 first-timers by import), others
  let csv = 'First name\tLast name\tCompany\tFirst time\n';
  for (let i = 1; i <= 6; i++) csv += 'Bupa' + i + '\tStaff\tBupa\t' + (i <= 2 ? 'Yes' : '') + '\n';
  for (let i = 1; i <= 30; i++) csv += 'Guest' + i + '\tPerson\t' + (i <= 3 ? 'AMP' : '') + '\t' + (i <= 4 ? 'yes' : 'no') + '\n';
  await p.click('#navGst'); await p.click('#gImport'); await p.fill('#impPaste', csv); await p.waitForSelector('#impMap select');
  ck('import matches a first-time column', await p.evaluate(() => { const s = document.querySelector('#impMap select[data-f=newDonor]'); return s.options[s.selectedIndex].textContent === 'First time'; }));
  await p.click('#impGo');
  const ev = () => p.evaluate(() => JSON.parse(localStorage.getItem('neonloop.v3')).events[0]);
  let e = await ev(); ck('first-time flag imported', e.guests.length === 36 && e.guests.filter(g => g.newDonor).length === 6);
  await p.locator('#gRows .gn', { hasText: 'Guest30 Person' }).click(); ck('guest dialog shows the flag', !(await p.isChecked('#g_new'))); await p.check('#g_new'); await p.click('#gSave');
  ck('flag can be set by hand', (await ev()).guests.find(g => g.first === 'Guest30').newDonor === true);
  await p.click('#navPlg'); await p.click('#plSetupBtn2'); await p.locator('#psOrgs input[data-k=name]').nth(0).fill('River Nile');
  ck('recognition takeovers are on by default', await p.isChecked('#psPeople')); await p.fill('#psBig', ''); await p.fill('#psStep', ''); await p.click('#psSave');
  // rundown: thank-you wall on one segment and as holding
  await p.click('#navRun'); await p.click('#btnEdit');
  const row = t => p.locator('#rows tr:has(input[data-f=title][value="' + t + '"])');
  await row('Pledging: Org 1').locator('[data-act=pick]').click(); await p.click('#pkLive [data-t=thanks]');
  await row('Pledging: Org 2').locator('select[data-f=org]').selectOption({ label: 'River Nile' }); await row('Pledging: Org 2').locator('[data-act=pick]').click(); await p.click('#pkLive [data-t=follow]');
  await p.click('#btnEdit');
  const [out] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnOut')]); out.on('pageerror', x => errs.push('out: ' + x)); await out.setViewportSize({ width: 1280, height: 720 });
  await p.locator('#rows tr', { hasText: 'Pledging: Org 1' }).locator('[data-act=take]').click(); await out.waitForSelector('.layer.tly.on'); await out.waitForTimeout(700);
  const wall = pg => pg.evaluate(() => { const b = [...document.querySelectorAll('.tly')].pop(); const q = s => (b.querySelector(s) || {}).textContent || ''; return { big: q('.k-big'), sub: q('.k-head .t-sub'), names: [...b.querySelectorAll('.k-names span')].map(x => x.textContent), co: q('.k-co'), pg: q('.k-pg'), amt: b.textContent.includes('$') }; });
  let w = await wall(out); ck('empty wall invites the first pledge', w.big === 'Be the first to give tonight' && !w.names.length);
  await p.click('#navPlg');
  const pledge = async (who, amt) => { if (await p.isVisible('#plChipX')) await p.click('#plChipX'); await p.fill('#plWho', who); await p.locator('#plSug button').first().click(); await p.fill('#plAmt', String(amt)); await p.keyboard.press('Enter'); };
  await pledge('Guest10 Person', 50); await pledge('Guest10 Person', 70); await pledge('Guest1 Person', 20); await out.waitForTimeout(600); w = await wall(out);
  ck('wall thanks each person once, by name, with no amounts', w.big === '2 people have given tonight' && w.names.join('|') === 'Guest10 Person|Guest1 Person' && !w.amt && w.sub === '1 giving for the first time');
  ck('pledges page monitor shows the wall as on screen', await p.evaluate(() => document.querySelector('#monPlg .k-big').textContent === '2 people have given tonight' && document.getElementById('monPlgBdg').textContent === 'ON SCREEN'));
  await p.check('#plAnon'); await pledge('Guest2 Person', 500); await p.uncheck('#plAnon'); await out.waitForTimeout(600); w = await wall(out);
  ck('anonymous donors are counted but not named', w.big === '3 people have given tonight' && !w.names.includes('Guest2 Person') && w.sub === '2 giving for the first time');
  // company roll call
  for (let i = 1; i <= 4; i++) await pledge('Bupa' + i + ' Staff', 100);
  await out.waitForTimeout(500); ck('no company moment before five people', !(await out.locator('.tov').count()));
  await pledge('Bupa5 Staff', 100); await out.waitForSelector('.tov');
  let t = await out.evaluate(() => { const b = document.querySelector('.tov'); const q = s => (b.querySelector(s) || {}).textContent || ''; return { lab: q('.tv-lab'), head: q('.tv-head'), big: q('.tv-big'), sub: q('.tv-sub') }; });
  ck('fifth person from one company fires Giving together', t.lab === 'Giving together' && t.head === 'Bupa' && t.big === '5 people' && t.sub === 'from Bupa have pledged tonight');
  await out.screenshot({ path: 'to-company.png' }); await out.waitForTimeout(9200);
  await pledge('Bupa5 Staff', 100); await out.waitForTimeout(600); ck('a repeat pledge from the same person does not fire it again', !(await out.locator('.tov').count()));
  w = await wall(out); ck('wall lists companies by number of people', w.co.includes('Bupa 5') && w.co.includes('AMP 2'));
  // first-timers: so far Guest1, Guest2(anon), Bupa1, Bupa2 = 4 -> Guest3 makes 5
  await pledge('Guest3 Person', 30); await out.waitForSelector('.tov');
  t = await out.evaluate(() => { const b = document.querySelector('.tov'); const q = s => (b.querySelector(s) || {}).textContent || ''; return { lab: q('.tv-lab'), head: q('.tv-head'), big: q('.tv-big') }; });
  ck('fifth first-time donor fires a welcome', t.lab === 'Welcome' && t.big === '5 people' && t.head === 'Giving for the first time'); await out.waitForTimeout(9200);
  // pages
  for (let i = 11; i <= 29; i++) await pledge('Guest' + i + ' Person', 10);
  await out.waitForTimeout(600); w = await wall(out);
  ck('more than one page of names: opens on the newest', w.pg === '2 of 2' && w.names.length === 3 && w.names[2] === 'Guest29 Person' && w.big === '28 people have given tonight');
  await out.screenshot({ path: 'thanks-p2.png' }); await out.waitForTimeout(7300); w = await wall(out);
  ck('pages rotate by themselves', w.pg === '1 of 2' && w.names.length === 24); await out.waitForTimeout(2500); await out.screenshot({ path: 'thanks.png' });
  // name privacy and off switch
  await p.click('#plSetupBtn'); await p.selectOption('#psScreen', 'amount'); await p.uncheck('#psPeople'); await p.click('#psSave'); await out.waitForTimeout(600); w = await wall(out);
  ck('amount-only setting keeps names off the wall', !w.names.length && w.big === '28 people have given tonight');
  await pledge('Bupa6 Staff', 100); await out.waitForTimeout(600);
  await p.click('#plSetupBtn'); await p.selectOption('#psScreen', 'full'); await p.click('#psSave');
  // as the holding graphic, and the tally still works
  await p.click('#navRun'); await p.click('#btnEdit'); await p.selectOption('#edHold', { label: 'Thank-you wall' }); await p.click('#btnEdit');
  await p.locator('#rows tr', { hasText: 'Pledging: Org 2' }).locator('[data-act=take]').click(); await out.waitForTimeout(1500);
  ck('tally segment still shows the tally', await out.evaluate(() => { const b = [...document.querySelectorAll('.tly')].pop(); return !!b.querySelector('.t-org') && b.querySelector('.t-org').textContent === 'River Nile'; }));
  await p.click('#btnHold'); await out.waitForTimeout(1200); w = await wall(out);
  ck('wall works as the holding graphic', w.big === '29 people have given tonight' && w.names.length > 0);
  await p.click('#btnHold'); await p.reload(); await p.waitForSelector('#rows tr');
  await p.setViewportSize({ width: 390, height: 800 }); ck('phone width fits', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length); console.log(res.join('\n')); await b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
