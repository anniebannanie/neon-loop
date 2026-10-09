const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
  const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  await ctx.clock.install({ time: new Date('2026-10-07T18:20:00+11:00') });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('file://' + require('path').resolve(__dirname, '../../public/legacy/index.html')); await p.click('#btnNew'); await p.fill('#evNameIn', 'Breaks'); await p.click('#evSave'); await p.click('#navRun');
  const ff = async t => { await ctx.clock.fastForward(t); await ctx.clock.runFor(600); };
  const stat = async () => { await ctx.clock.runFor(300); return (await p.locator('#runStat .rs').allTextContents()).join(' | '); };
  const setF = async (loc, v) => { await loc.fill(v); await loc.dispatchEvent('change'); };
  await p.click('#btnEdit'); await setF(p.locator('#edStart'), '18:30');
  ck('Edit has a type and fixed start column', (await p.locator('#rhead th', { hasText: 'Type and fixed start' }).count()) === 1);
  const er = i => p.locator('#rows tr').nth(i);
  await er(2).locator('input[data-f=title]').fill('Meal break'); await er(2).locator('input[data-f=dur]').fill('20:00'); await er(2).locator('input[data-f=dur]').dispatchEvent('change');
  await er(2).locator('select[data-f=type]').selectOption('flex');
  ck('break row is banded as soon as its type is set', await er(2).evaluate(n => n.classList.contains('brk')));
  await er(2).locator('[data-act=pick]').click(); ck('picker offers the break countdown', await p.isVisible('#pkLive [data-t=break]')); await p.click('#pkLive [data-t=break]');
  await setF(er(3).locator('input[data-f=fix]'), '19:25');
  ck('edit bar warns when the plan misses a fixed start', (await p.textContent('#edEnd')).includes('"Q&A 1" is planned 5:00 after its fixed 7:25 pm'));
  await p.click('#btnUndo'); ck('undo clears the fixed start', (await er(3).locator('input[data-f=fix]').inputValue()) === '');
  await setF(er(3).locator('input[data-f=fix]'), '19:30'); ck('no warning when the plan meets it', !(await p.textContent('#edEnd')).includes('fixed'));
  await p.click('#btnEdit');
  const ev = () => p.evaluate(() => JSON.parse(localStorage.getItem('neonloop.v3')).events[0]);
  let e = await ev(); ck('type, fixed start and countdown saved on the rows', e.items[2].type === 'flex' && e.items[3].fix === '19:30' && !!e.items[2].asset);
  const rr = i => p.locator('#rows tr').nth(i);
  ck('running view: break band and labels', await rr(2).evaluate(n => n.classList.contains('brk')) && (await rr(2).textContent()).includes('Break, can shorten to 10:00') && (await rr(3).textContent()).includes('Fixed start 7:30 pm'));
  let s = await stat(); ck('before the show: fixed start shown as on time', s.includes('Q&A 1 fixed for 7:30 pm: on time'));
  const [out] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnOut')]); out.on('pageerror', x => errs.push('out: ' + x)); await out.setViewportSize({ width: 1280, height: 720 });
  // run: doors on time, welcome overruns by 6 minutes
  await ff('10:00'); await p.keyboard.press('Space'); await ff('30:00'); await p.keyboard.press('Space');
  await rr(2).click(); await ctx.clock.runFor(800);
  ck('preview of the break shows its planned length', await p.evaluate(() => { const c = document.querySelector('#monPvw .k-cd'); return !!c && c.textContent === '20:00' && document.querySelector('#monPvw .k-ttl').textContent === 'Meal break'; }));
  await ff('16:00'); s = await stat();
  ck('a flexible break absorbs the overrun in the forecast', s.includes('On time') && s.includes('Q&A 1 fixed for 7:30 pm: on time') && !s.includes('behind'));
  await p.keyboard.press('Space'); await ctx.clock.runFor(1500);
  ck('taken late, the break is shortened to land on time', /of 13:5\d/.test(await p.textContent('#airTimer')) && /shortened to 13:5\d/.test(await rr(2).textContent()));
  const cd = pg => pg.evaluate(() => { const b = [...document.querySelectorAll('.tly')].pop(); const q = x => (b && b.querySelector(x) || {}).textContent || ''; return { lab: q('.k-brk .t-lab'), ttl: q('.k-ttl'), cd: q('.k-cd'), sub: q('.k-brk .t-sub') }; });
  await out.waitForSelector('.layer.tly.on'); let c = await cd(out);
  ck('output counts down to the end of the break', c.lab === 'We resume in' && c.ttl === 'Meal break' && /^13:[45]\d$/.test(c.cd) && c.sub === 'Back at 7:30 pm');
  await new Promise(r => setTimeout(r, 900)); await out.screenshot({ path: 'break.png' });
  await ff('04:00'); c = await cd(out); ck('and keeps counting', /^9:5\d$/.test(c.cd));
  ck('program monitor counts with it', await p.evaluate(() => /^9:5\d$/.test(document.querySelector('#monPgm .k-cd').textContent)));
  await p.screenshot({ path: 'break-control.png' });
  await ff('11:00'); c = await cd(out); ck('past the end it says the show is about to resume', c.cd === 'Starting again shortly' && c.lab === '');
  s = await stat(); ck('an overrunning break shows against the fixed start', /Running 1:[01]\d behind/.test(s));
  await p.keyboard.press('Space'); await ctx.clock.runFor(600);
  ck('finished break row shows how long it ran', (await rr(2).textContent()).includes('ran 15:0'));
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#btnTimes')]); await d1.saveAs(require('path').join(__dirname, 'out') + '/times2.csv'); const csv = fs.readFileSync(require('path').join(__dirname, 'out') + '/times2.csv', 'utf8');
  ck('run times export marks the break', csv.includes('Meal break (break)'));
  // very late: the break never drops below half
  await p.click('#navSet'); await p.click('#btnReset'); await p.click('#navRun'); await ctx.clock.runFor(600); await p.keyboard.press('Space'); await ctx.clock.runFor(600); await p.keyboard.press('Space'); s = await stat();
  ck('very late: forecast shows the fixed start will be missed', /Q&A 1 fixed for 7:30 pm: now expected 2[12]:\d\d late/.test(s));
  await p.keyboard.press('Space'); await ctx.clock.runFor(1200);
  ck('a flexible break never goes below half its length', (await p.textContent('#airTimer')).includes('of 10:00'));
  // fixed-length break does not shrink
  await p.click('#btnEdit'); await er(2).locator('select[data-f=type]').selectOption('break'); await p.click('#btnEdit');
  ck('fixed-length break label', (await rr(2).textContent()).includes('Break') && !(await rr(2).textContent()).includes('can shorten'));
  await p.click('#navSet'); await p.click('#btnReset'); await p.click('#navRun'); await ctx.clock.runFor(600); for (let i = 0; i < 3; i++) { await p.keyboard.press('Space'); await ctx.clock.runFor(600); }
  ck('fixed-length break keeps its full time when late', (await p.textContent('#airTimer')).includes('of 20:00'));
  // holding with the countdown, reload, phone
  await p.click('#btnEdit'); await p.selectOption('#edHold', { label: 'Break countdown' }); await p.click('#btnEdit'); await p.click('#btnHold'); await ctx.clock.runFor(1500); c = await cd(out);
  ck('as the holding graphic it shows a plain back shortly', c.cd === 'Back shortly'); await p.click('#btnHold');
  await p.reload(); await p.waitForSelector('#rows tr'); await ctx.clock.runFor(800);
  ck('breaks survive a reload', await rr(2).evaluate(n => n.classList.contains('brk')) && (await p.textContent('#airTimer')).includes('of 20:00'));
  await p.setViewportSize({ width: 390, height: 800 }); ck('phone width fits', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length); console.log(res.join('\n')); await b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
