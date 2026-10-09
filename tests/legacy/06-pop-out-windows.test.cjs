const { chromium } = require('playwright');
const pickM = async (pg, i, label) => { await pg.locator('#rows tr').nth(i).locator('[data-act=pickm]').click(); await pg.locator('#pkGrid .pk[data-name="' + label + '"]').click(); };

const pickC = async (pg, i, label) => { await pg.locator('#rows tr').nth(i).locator('[data-act=pick]').click(); await pg.locator('#pkGrid .pk[data-name="' + label + '"]').click(); };

const M = n => __dirname + '/media/' + n, URL0 = 'file://' + require('path').resolve(__dirname, '../../public/legacy/index.html');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push('main ' + e)); p.on('dialog', d => d.accept());
  await p.goto(URL0); await p.click('#btnNew'); await p.fill('#evNameIn', 'Pop test'); await p.click('#evSave');
  await p.setInputFiles('#media', [M('Holding Slate.png'), M('Org 1 Title.png'), M('Pitch Loop.webm'), M('Walk In.wav')]); await p.waitForFunction(() => document.querySelectorAll('.asset').length === 4);
  await p.click('#tabRun'); await p.click('#btnEdit');
  const sel = (i, n) => pickC(p, i, n);
  await sel(0, 'Holding Slate'); await sel(1, 'Org 1 Title'); await sel(2, 'Pitch Loop'); await pickM(p, 1, 'Walk In'); await p.click('#btnEdit');

  // ---------- monitors window ----------
  const [m] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnPopMon')]); m.on('pageerror', e => errs.push('mon ' + e)); await m.waitForLoadState();
  await m.setViewportSize({ width: 1600, height: 900 });
  await m.waitForFunction(() => document.getElementById('nxtTtl') && document.getElementById('nxtTtl').textContent === 'Doors and arrivals', null, { timeout: 6000 });
  const tag = (pg, id) => pg.evaluate(id => { const e = document.getElementById(id).querySelector('img,video,iframe'); return e ? e.tagName : 'BLACK'; }, id);
  ck('monitors window shows preview and standby', (await m.title()).includes('Pop test') && (await tag(m, 'monPvw')) === 'IMG' && (await tag(m, 'monPgm')) === 'BLACK' && (await m.textContent('#airLab')) === 'STANDBY' && (await m.locator('.src').count()) === 3);
  ck('main window hides its monitors and sources while popped out', await p.evaluate(() => document.body.classList.contains('popmon')) && !(await p.isVisible('#monPgm')) && !(await p.isVisible('#srcWrap')) && await p.isVisible('#btnTake') && (await p.textContent('#btnPopMon')) === 'Show monitors window');
  ck('pop-out monitors are bigger than the main ones were', await m.evaluate(() => document.getElementById('monPgm').getBoundingClientRect().width > 600));
  await m.click('#btnTake'); await m.waitForFunction(() => document.getElementById('airLab').textContent === 'ON AIR');
  ck('Take in the monitors window takes in the main window', (await p.textContent('#airTtl')) === 'Doors and arrivals' && (await m.textContent('#airTtl')) === 'Doors and arrivals' && (await tag(m, 'monPgm')) === 'IMG');
  await m.waitForTimeout(600);
  ck('timer and tally follow', /^\d+:\d\d/.test(await m.textContent('#airTimer')) && (await m.locator('.src.pgm').count()) === 1 && (await m.locator('.src.pvw').count()) === 1 && (await m.textContent('#remain')).length > 3);
  await m.keyboard.press('Space'); await m.waitForFunction(() => document.getElementById('airTtl').textContent === 'Welcome and MC intro'); await m.waitForTimeout(700);
  ck('Space in the monitors window takes next; preview shows the video', (await tag(m, 'monPvw')) === 'VIDEO' && (await m.locator('#monPgm img').count()) === 1);
  await m.keyboard.press('h'); await m.waitForFunction(() => document.getElementById('airLab').textContent === 'HOLDING');
  ck('H holds from the monitors window', (await p.textContent('#airLab')) === 'HOLDING' && (await m.textContent('#btnHold')) === 'RETURN FROM HOLDING'); await m.click('#btnHold'); await m.waitForFunction(() => document.getElementById('airLab').textContent === 'ON AIR');
  await m.screenshot({ path: 'pop-mon.png' });
  await m.reload(); await m.waitForFunction(() => document.getElementById('airTtl') && document.getElementById('airTtl').textContent === 'Welcome and MC intro', null, { timeout: 6000 });
  ck('monitors window recovers after a refresh', (await tag(m, 'monPgm')) === 'IMG' && (await tag(m, 'monPvw')) === 'VIDEO');
  await p.click('#btnHome'); await m.waitForFunction(() => document.getElementById('airLab').textContent === 'NO EVENT OPEN');
  ck('monitors window shows when no event is open', await m.isDisabled('#btnTake') && (await tag(m, 'monPgm')) === 'BLACK'); await p.click('.ev [data-act=open]');
  await m.waitForFunction(() => document.getElementById('airTtl').textContent === 'Welcome and MC intro');
  await p.screenshot({ path: 'pop-main.png' });
  await m.close(); await p.waitForFunction(() => !document.body.classList.contains('popmon'), null, { timeout: 6000 });
  ck('closing the monitors window puts the monitors back in the main window', await p.isVisible('#monPgm') && await p.isVisible('#srcWrap') && (await p.textContent('#btnPopMon')) === 'Pop out monitors' && (await tag(p, 'monPgm')) === 'IMG');

  // ---------- sound window ----------
  const [s] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnPopSnd')]); s.on('pageerror', e => errs.push('snd ' + e)); await s.waitForLoadState();
  await s.waitForFunction(() => document.getElementById('musName') && document.getElementById('musName').textContent === 'Walk In, looping', null, { timeout: 6000 });
  ck('sound window shows the track and the saved fader positions', (await s.inputValue('#musVol')) === '80' && (await s.inputValue('#masVol')) === '100' && await s.isChecked('#duck'));
  ck('main window hides its sound bar while popped out', !(await p.isVisible('#musBar')));
  await s.evaluate(() => { const e = document.getElementById('vidVol'); e.value = 35; e.dispatchEvent(new Event('input', { bubbles: true })); }); await s.click('#musMute'); await s.uncheck('#duck');
  await p.waitForFunction(() => { const x = JSON.parse(localStorage.getItem('neonloop.mix')); return x.video === 0.35 && x.mm === true && x.duck === false; }, null, { timeout: 5000 });
  const mix = await p.evaluate(() => JSON.parse(localStorage.getItem('neonloop.mix')));
  ck('faders, mute and ducking in the sound window drive the mix', mix.video === 0.35 && mix.mm === true && mix.duck === false);
  await s.waitForFunction(() => document.getElementById('musMute').textContent === 'Unmute'); ck('sound window reflects the change back', (await s.getAttribute('#musMute', 'aria-pressed')) === 'true');
  await s.screenshot({ path: 'pop-snd.png' });
  await s.close(); await p.waitForFunction(() => !document.body.classList.contains('popsnd'), null, { timeout: 6000 });
  ck('closing the sound window brings the sound bar back with the new settings', await p.isVisible('#musBar') && (await p.inputValue('#vidVol')) === '35' && (await p.textContent('#musMute')) === 'Unmute');
  ck('no page errors', errs.length === 0); if (errs.length) console.log(errs);
  console.log(res.join('\n')); await b.close(); process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
