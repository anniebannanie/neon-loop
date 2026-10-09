const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('file://' + require('path').resolve(__dirname, '../../public/legacy/index.html')); await p.click('#btnNew'); await p.fill('#evNameIn', 'TFN Flagship 1'); await p.click('#evSave');
  await p.click('#navPlg'); await p.click('#plSetupBtn2');
  const nm = ['River Nile', 'Hope Network'];
  for (let i = 0; i < 2; i++) await p.locator('#psOrgs input[data-k=name]').nth(i).fill(nm[i]);
  await p.locator('#psOrgs input[data-k=target]').nth(0).fill('5,000'); await p.locator('#psOrgs input[data-k=impactAmt]').nth(0).fill('250'); await p.locator('#psOrgs input[data-k=impactUnit]').nth(0).fill('weeks of tutoring');
  await p.locator('#psOrgs input[data-k=match]').nth(1).fill('1000');
  ck('takeover settings start with sensible defaults', (await p.inputValue('#psBig')) === '1000' && (await p.inputValue('#psStep')) === '5000' && await p.isChecked('#psToTarget') && await p.isChecked('#psToMatch') && await p.isChecked('#psAsk'));
  await p.click('#psSave');
  const ev = () => p.evaluate(() => JSON.parse(localStorage.getItem('neonloop.v3')).events[0]);
  let e = await ev(); ck('target and impact saved with the organisation', e.orgs[0].target === 5000 && e.orgs[0].impactAmt === 250 && e.orgs[0].impactUnit === 'weeks of tutoring' && e.fund.to.big === 1000);
  await p.click('#plSetupBtn'); ck('and shown again when reopened', (await p.locator('#psOrgs input[data-k=target]').nth(0).inputValue()) === '5000' && (await p.locator('#psOrgs input[data-k=impactUnit]').nth(0).inputValue()) === 'weeks of tutoring'); await p.click('#psCancel');
  const pledge = async (who, amt) => { if (await p.isVisible('#plChipX')) await p.click('#plChipX'); await p.fill('#plWho', who); await p.locator('#plSug button', { hasText: 'walk-in guest' }).click(); await p.fill('#plAmt', String(amt)); await p.keyboard.press('Enter'); };
  // nothing fires while the tally is not on screen
  await pledge('Early Bird', 1500);
  ck('no takeover and no prompt while the tally is off screen', !(await p.isVisible('#toBar')) && !(await p.locator('.tov').count()));
  await p.locator('.prow', { hasText: 'Early Bird' }).locator('[data-a=to]').click();
  ck('manual takeover explains why it cannot play', (await p.textContent('#toast')).includes('Takeovers play over the live tally'));
  // tally on air for both organisations
  await p.click('#navRun'); await p.click('#btnEdit');
  const row = t => p.locator('#rows tr:has(input[data-f=title][value="' + t + '"])');
  await row('Pledging: Org 1').locator('select[data-f=org]').selectOption({ label: 'River Nile' }); await row('Pledging: Org 1').locator('[data-act=pick]').click(); await p.click('#pkLive [data-t=follow]');
  await row('Pledging: Org 2').locator('select[data-f=org]').selectOption({ label: 'Hope Network' }); await row('Pledging: Org 2').locator('[data-act=pick]').click(); await p.click('#pkLive [data-t=follow]');
  await p.click('#btnEdit');
  const [out] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnOut')]); out.on('pageerror', x => errs.push('out: ' + x)); await out.setViewportSize({ width: 1280, height: 720 });
  await p.locator('#rows tr', { hasText: 'Pledging: Org 1' }).locator('[data-act=take]').click(); await out.waitForSelector('.layer.tly.on'); await out.waitForTimeout(1200);
  const tl = await out.evaluate(() => ({ goal: document.querySelector('.t-goal').textContent, sub: document.querySelector('.t-sub').textContent }));
  ck('tally shows progress to the target and the impact so far', tl.goal === '$1,500 of the $5,000 target' && tl.sub === '1 pledge · 6 weeks of tutoring funded');
  const tov = pg => pg.evaluate(() => { const b = document.querySelector('.tov'); if (!b) return null; const q = s => (b.querySelector(s) || {}).textContent || ''; const r = b.querySelector('.tovin').getBoundingClientRect(), i = b.querySelector('.tv-bar i');
    return { kind: b.className, lab: q('.tv-lab'), head: q('.tv-head'), big: q('.tv-big'), sub: q('.tv-sub'), note: q('.tv-note'), bar: q('.tv-barw'), w: Math.round(r.width), bw: i ? i.style.width : '' }; });
  await p.click('#navPlg');
  // small pledge: nothing
  await pledge('Sam Small', 200); await out.waitForTimeout(500);
  ck('an ordinary pledge fires nothing', !(await out.locator('.tov').count()) && !(await p.isVisible('#toBar')));
  // big pledge: waits for approval
  await pledge('Sarah Chen', 2000); await out.waitForTimeout(500);
  ck('a big pledge waits for approval before it goes on screen', await p.isVisible('#toBar') && (await p.textContent('#toBarTxt')) === 'Big pledge: Sarah Chen, $2,000 for River Nile' && !(await out.locator('.tov').count()));
  await p.click('#toBarGo'); await out.waitForSelector('.tov'); let t = await tov(out);
  ck('approved: the takeover plays on the output', t.lab === 'Big pledge' && t.head === 'Sarah Chen' && t.big === '$2,000' && t.sub === 'for River Nile' && t.note === 'That funds 8 weeks of tutoring' && t.bar.includes('34% to 74% of the $5,000 target') && t.w === 1280);
  ck('and on the program and pledges monitors', (await p.locator('#monPlg .tov').count()) === 1 && (await p.locator('#monPgm .tov').count()) === 1 && !(await p.isVisible('#toBar')));
  await out.waitForTimeout(3600); await out.screenshot({ path: 'to-gold.png' }); t = await tov(out); ck('the bar moves from before to after', t.bw === '74%'); await out.screenshot({ path: 'to-big.png' });
  await out.waitForTimeout(6000); ck('it clears itself and the tally is back', !(await out.locator('.tov').count()) && (await out.locator('.layer.tly.on').count()) === 1 && !(await p.locator('.tov').count()));
  // skip
  await pledge('Tom Typo', 50000); await p.click('#toBarNo'); await out.waitForTimeout(400);
  ck('a skipped big pledge never reaches the screen', !(await p.isVisible('#toBar')));
  await out.waitForSelector('.tov'); t = await tov(out);
  ck('but crossing the target still celebrates the organisation', t.lab === 'Target reached' && t.head === 'River Nile' && t.big === '$5,000' && t.note.includes('weeks of tutoring funded'));
  await p.locator('.prow', { hasText: 'Tom Typo' }).locator('[data-a=void]').click(); await out.waitForTimeout(9000);
  // next organisation: match unlocked, name-only mode, no approval
  await p.click('#plSetupBtn'); await p.uncheck('#psAsk'); await p.fill('#psBig', '500'); await p.click('#psSave');
  await p.click('#navRun'); await p.locator('#rows tr', { hasText: 'Pledging: Org 2' }).locator('[data-act=take]').click(); await out.waitForTimeout(1200); await p.click('#navPlg');
  await pledge('Mia Wong', 600); await out.waitForSelector('.tov'); t = await tov(out);
  ck('without approval a big pledge plays straight away', t.lab === 'Big pledge' && t.head === 'Mia Wong' && t.big === '$600' && t.bar === '' && t.note === '');
  await out.waitForTimeout(9200);
  await pledge('Lee Small', 100); await out.waitForSelector('.tov'); t = await tov(out);
  ck('crossing a milestone for the night fires on a small pledge too', t.lab === 'Milestone' && t.big === '$5,000' && t.head === 'Raised tonight'); await out.screenshot({ path: 'to-mile.png' });
  await out.waitForTimeout(9200);
  await pledge('Ned Park', 450); await out.waitForSelector('.tov'); t = await tov(out);
  ck('matched funding fully used fires Match unlocked', t.lab === 'Match unlocked' && t.head === 'Hope Network' && t.big === '$1,000'); await out.screenshot({ path: 'to-match.png' });
  await out.waitForTimeout(9200);
  await p.click('#plSetupBtn'); await p.selectOption('#psScreen', 'name'); await p.click('#psSave');
  await p.locator('.prow', { hasText: 'Mia Wong' }).locator('[data-a=to]').click(); await out.waitForSelector('.tov'); t = await tov(out);
  ck('manual takeover from a pledge row; name-only hides the amount', t.head === 'Mia Wong' && t.big === 'Thank you' && !JSON.stringify(t).includes('600'));
  await out.waitForTimeout(9200);
  await p.click('#plSetupBtn'); await p.selectOption('#psScreen', 'amount'); await p.click('#psSave');
  await p.check('#plAnon'); if (await p.isVisible('#plChipX')) await p.click('#plChipX'); await p.fill('#plAmt', '700'); await p.keyboard.press('Enter'); await p.uncheck('#plAnon'); await out.waitForSelector('.tov'); t = await tov(out);
  ck('amount-only hides the name', t.head === 'A generous pledge' && t.big === '$700');
  await out.waitForTimeout(9200);
  // switched off
  await p.click('#plSetupBtn'); await p.fill('#psBig', ''); await p.fill('#psStep', ''); await p.uncheck('#psToTarget'); await p.uncheck('#psToMatch'); await p.click('#psSave');
  await pledge('Quiet One', 9000); await out.waitForTimeout(800);
  ck('every trigger can be switched off', !(await out.locator('.tov').count()) && !(await p.isVisible('#toBar')));
  // holding stops takeovers
  await p.click('#plSetupBtn'); await p.fill('#psBig', '500'); await p.click('#psSave'); await p.click('#navRun'); await p.click('#btnHold'); await p.click('#navPlg');
  await pledge('During Hold', 800); await out.waitForTimeout(800);
  ck('nothing fires while holding', !(await out.locator('.tov').count()));
  await p.setViewportSize({ width: 390, height: 800 }); ck('phone width fits', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length); console.log(res.join('\n')); await b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
