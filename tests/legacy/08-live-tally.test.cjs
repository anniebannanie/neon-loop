const { chromium } = require('playwright');
const URL0 = 'file://' + require('path').resolve(__dirname, '../../public/legacy/index.html');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(URL0); await p.click('#btnNew'); await p.fill('#evNameIn', 'TFN Flagship 1'); await p.click('#evSave');
  const ev = () => p.evaluate(() => JSON.parse(localStorage.getItem('neonloop.v3')).events[0]);
  const pledge = async (who, amt) => { if (await p.isVisible('#plChipX')) await p.click('#plChipX'); await p.fill('#plWho', who); await p.locator('#plSug button', { hasText: 'walk-in guest' }).click(); await p.fill('#plAmt', String(amt)); await p.keyboard.press('Enter'); };

  // before pledging is set up, Edit has no "Pledging for" column
  await p.click('#navRun'); await p.click('#btnEdit');
  ck('no organisation column until organisations exist', !(await p.locator('#rhead th', { hasText: 'Pledging for' }).count()));
  await p.click('#btnEdit');
  await p.click('#navPlg'); await p.click('#plSetupBtn2');
  const names = ['River Nile', 'Hope Network', 'Happy Brain'];
  for (let i = 0; i < 3; i++) await p.locator('#psOrgs input[data-k=name]').nth(i).fill(names[i]);
  await p.locator('#psOrgs input[data-k=match]').nth(1).fill('1000'); await p.click('#psSave');
  await pledge('Ann Lee', 500);                                  // River Nile
  let e = await ev(); const org = n => e.orgs.find(o => o.name === n).id;

  // rundown: set organisations and the tally on the pledging segments
  await p.click('#navRun'); await p.click('#btnEdit');
  ck('Edit shows a Pledging for column', (await p.locator('#rhead th', { hasText: 'Pledging for' }).count()) === 1);
  const row = t => p.locator('#rows tr:has(input[data-f=title][value="' + t + '"])');
  await row('Pledging: Org 1').locator('select[data-f=org]').selectOption({ label: 'River Nile' });
  await row('Pledging: Org 2').locator('select[data-f=org]').selectOption({ label: 'Hope Network' });
  await row('Pledging: Org 1').locator('[data-act=pick]').click();
  ck('picker offers the live pledge graphics', await p.isVisible('#pkLive'));
  await p.click('#pkLive [data-t=follow]');
  await row('Pledging: Org 2').locator('[data-act=pick]').click(); await p.click('#pkLive [data-t=follow]');
  await row('Total reveal and thanks').locator('[data-act=pick]').click(); await p.click('#pkLive [data-t=total]');
  await row('Pledging: Org 1').locator('[data-act=pickm]').click(); ck('music picker has no live graphics', !(await p.isVisible('#pkLive'))); await p.click('#pkCancel');
  await p.click('#btnUndo'); ck('undo steps back the last content choice', !(await row('Total reveal and thanks').textContent()).includes('Night total'));
  await row('Total reveal and thanks').locator('[data-act=pick]').click(); await p.click('#pkLive [data-t=total]');
  await p.click('#btnEdit');
  e = await ev(); const idx = t => e.items.findIndex(i => i.title === t);
  const tl = e.items[idx('Pledging: Org 1')].asset;
  ck('segments saved with organisation and one shared tally', e.items[idx('Pledging: Org 1')].org === org('River Nile') && e.items[idx('Pledging: Org 2')].org === org('Hope Network') && e.items[idx('Pledging: Org 2')].asset === tl && e.items[idx('Total reveal and thanks')].asset !== tl);
  ck('running view shows the organisation per segment', (await p.locator('#rows tr', { hasText: 'Pledging: Org 2' }).textContent()).includes('Hope Network') && (await p.locator('#rhead th', { hasText: 'Pledging for' }).count()) === 1);
  await p.click('#navLib');
  ck('content page lists them as live graphics, with no web address box', (await p.locator('.asset').count()) === 2 && (await p.locator('.asset', { hasText: 'Live graphic' }).count()) === 2 && !(await p.locator('.asset input[data-k=url]').count()));
  await p.click('#navRun');

  // output window
  const [out] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnOut')]); out.on('pageerror', x => errs.push('out: ' + x)); await out.setViewportSize({ width: 1280, height: 720 });
  await p.locator('#rows tr', { hasText: 'Pledging: Org 1' }).locator('[data-act=take]').click();
  await out.waitForSelector('.layer.tly.on'); await out.waitForTimeout(1300);
  const read = pg => pg.evaluate(() => { const b = [...document.querySelectorAll('.tly')].pop(); if (!b) return null; const q = s => { const n = b.querySelector(s); return n ? n.textContent : ''; }; const r = b.querySelector('.tlyin').getBoundingClientRect();
    return { org: q('.t-org'), amt: q('.t-amt'), sub: q('.t-sub'), night: q('.t-night b'), match: q('.t-match'), rows: [...b.querySelectorAll('.t-row')].map(x => x.textContent), orows: [...b.querySelectorAll('.t-orow')].map(x => x.textContent), w: Math.round(r.width), h: Math.round(r.height) }; });
  let t = await read(out);
  ck('output shows the on-air organisation and its total', t.org === 'River Nile' && t.amt === '$500' && t.sub === '1 pledge' && t.night === '$500' && t.rows.length === 1 && t.rows[0] === 'Ann Lee$500');
  ck('tally fills the 16:9 screen', t.w === 1280 && t.h === 720);
  ck('no web frame is loaded for a live graphic', !(await out.locator('iframe').count()));
  ck('program monitor shows the same tally', await p.evaluate(() => { const b = document.querySelector('#monPgm .tly'); return !!b && b.querySelector('.t-org').textContent === 'River Nile'; }));
  ck('preview monitor is black for the changeover', !(await p.locator('#monPvw .tly').count()));
  await out.screenshot({ path: 'tally-org.png' });

  // pledge screen follows the show, and a new pledge reaches the screen
  await p.click('#navPlg');
  ck('pledge screen is on the on-air organisation', (await p.getAttribute('#plOrgs button >> nth=0', 'aria-pressed')) === 'true' && (await p.textContent('#plOrgs .follow')) === 'Following the rundown');
  await pledge('Bob Ray', 250); await out.waitForTimeout(1300); t = await read(out);
  ck('a new pledge appears on the output without a take', t.amt === '$750' && t.sub === '2 pledges' && t.rows[0] === 'Bob Ray$250' && t.rows.length === 2);
  await p.check('#plAnon'); await p.click('#plChipX'); await p.fill('#plAmt', '100'); await p.keyboard.press('Enter'); await p.uncheck('#plAnon'); await out.waitForTimeout(1300); t = await read(out);
  ck('anonymous pledge counts but shows no name', t.amt === '$850' && t.rows[0] === 'Anonymous$100');

  // next organisation: same tally asset, different figures, matched funding
  await p.click('#navRun');
  await p.locator('#rows tr', { hasText: 'Pledging: Org 2' }).locator('[data-act=take]').click(); await out.waitForTimeout(1500); t = await read(out);
  ck('taking the next pledging segment switches the organisation', t.org === 'Hope Network' && t.amt === '$0' && t.night === '$850' && t.rows.length === 0 && t.match.includes('$0 of $1,000 matched funding unlocked'));
  ck('only one tally layer left on the output', (await out.locator('.tly').count()) === 1);
  await p.click('#navPlg');
  ck('pledge screen moved to Hope Network by itself', (await p.getAttribute('#plOrgs button >> nth=1', 'aria-pressed')) === 'true');
  await pledge('Cy Dunn', 600); await out.waitForTimeout(1300); t = await read(out);
  ck('matched funding is added and shown', t.amt === '$1,200' && t.match.includes('$600 of $1,000') && t.night === '$2,050');
  await pledge('Di Egan', 700); await out.waitForTimeout(1300); t = await read(out);
  ck('matching stops at its cap', t.amt === '$2,300' && t.match.includes('All $1,000 of matched funding unlocked'));
  await out.screenshot({ path: 'tally-match.png' });

  // what the screen shows about donors
  await p.click('#plSetupBtn'); await p.selectOption('#psScreen', 'name'); await p.click('#psSave'); await out.waitForTimeout(400); t = await read(out);
  ck('name only: amounts are left off the list', t.rows[0] === 'Di Egan' && t.amt === '$2,300');
  await p.click('#plSetupBtn'); await p.selectOption('#psScreen', 'amount'); await p.click('#psSave'); await out.waitForTimeout(400); t = await read(out);
  ck('amount only: names are left off the list', t.rows[0] === 'New pledge$700' && !JSON.stringify(t.rows).includes('Egan'));
  await p.click('#plSetupBtn'); ck('setting is remembered', (await p.inputValue('#psScreen')) === 'amount'); await p.selectOption('#psScreen', 'full'); await p.click('#psSave');
  await p.locator('.prow', { hasText: 'Di Egan' }).locator('[data-a=void]').click(); await out.waitForTimeout(1300); t = await read(out);
  ck('removing a pledge brings the screen back down', t.amt === '$1,200' && t.rows.length === 1);

  // night total
  await p.click('#navRun');
  await p.locator('#rows tr', { hasText: 'Total reveal and thanks' }).locator('[data-act=take]').click(); await out.waitForTimeout(1500); t = await read(out);
  ck('night total shows every organisation', t.amt === '$2,050' && t.sub === '4 pledges' && t.orows.length === 3 && t.orows[0] === 'River Nile$850' && t.orows[1] === 'Hope Network$1,200' && t.orows[2] === 'Happy Brain$0');
  await out.screenshot({ path: 'tally-total.png' }); await p.screenshot({ path: 'tally-control.png' });

  // holding and back; a tally segment with no organisation shows the night
  await p.click('#btnHold'); await out.waitForTimeout(700); ck('holding takes the tally off', (await out.locator('.tly.on').count()) === 0);
  await p.click('#btnHold'); await out.waitForSelector('.layer.tly.on');
  await p.click('#btnEdit'); await row('Pledging: Org 2').locator('select[data-f=org]').selectOption(''); await p.click('#btnEdit');
  await p.locator('#rows tr', { hasText: 'Pledging: Org 2' }).locator('[data-act=take]').click(); await out.waitForTimeout(1500); t = await read(out);
  ck('tally with no organisation set shows the whole night', t.org === '' && t.amt === '$2,050' && t.orows.length === 3);

  // output reloaded mid-show picks everything back up
  await p.locator('#rows tr', { hasText: 'Pledging: Org 1' }).locator('[data-act=take]').click(); await out.waitForTimeout(800);
  await out.reload(); await out.waitForSelector('.layer.tly.on'); await out.waitForTimeout(1500); t = await read(out);
  ck('reloaded output window recovers the tally', t.org === 'River Nile' && t.amt === '$850');

  // pop-out monitors
  const [mon] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnPopMon')]); mon.on('pageerror', x => errs.push('mon: ' + x));
  await mon.waitForSelector('#monPgm .tly'); await mon.waitForTimeout(1300);
  ck('pop-out monitors draw the tally', await mon.evaluate(() => document.querySelector('#monPgm .t-org').textContent === 'River Nile' && document.querySelector('#monPgm .t-amt').textContent === '$850' && [...document.querySelectorAll('.src .th.web')].some(x => x.textContent === 'LIVE')));
  await p.click('#navPlg'); await pledge('Flo Gray', 150); await mon.waitForTimeout(1300);
  ck('and keep up with new pledges', await mon.evaluate(() => document.querySelector('#monPgm .t-amt').textContent === '$1,000'));
  await mon.close();

  // reload the control window, removing an organisation, export and import
  await p.reload(); await p.waitForSelector('#rows tr'); await out.waitForTimeout(2500); t = await read(out);
  ck('control reload keeps the tally on air', t && t.org === 'River Nile' && t.amt === '$1,000');
  await p.click('#navPlg'); await p.click('#plSetupBtn'); await p.locator('#psOrgs .psrow').nth(0).locator('[data-a=rm]').click(); await p.click('#psSave'); await out.waitForTimeout(1500); t = await read(out);
  ck('removing the organisation falls back to the night total, no error', t.org === '' && t.orows.length === 2);
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#navRun');
  ck('phone width still fits', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length);
  console.log(res.join('\n')); await b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
