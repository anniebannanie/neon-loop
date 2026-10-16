// Videos that play once: their real length sets the row's time, and when they end the show goes to holding or the next row.
const { chromium } = require('playwright'), path = require('path');
const M = f => path.join(__dirname, 'media', f);
const pickC = async (pg, i, label) => { await pg.locator('#rows tr').nth(i).locator('[data-act=pick]').click(); await pg.locator('#pkGrid .pk[data-name="' + label + '"]').click(); };
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
  const errs = [], res = [], ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(__dirname, '../../public/legacy/index.html')); await p.click('#btnNew'); await p.fill('#evNameIn', 'Videos'); await p.click('#evSave');
  await p.setInputFiles('#media', [M('Holding Slate.png'), M('Pitch Loop.webm')]); await p.waitForSelector('.asset:has-text("Video")');
  await p.waitForFunction(() => /0:02/.test([...document.querySelectorAll('.asset')].map(x => x.textContent).join()));
  const vid = p.locator('.asset', { hasText: 'Video' });
  ck('a new video plays once, and the library shows its length', (await vid.textContent()).includes('Video · 0:02, plays once') && !(await vid.locator('input[data-k=loop]').isChecked()));
  await p.locator('.asset', { hasText: 'Image' }).locator('button[data-act=hold]').click();
  await p.click('#navRun'); await p.click('#btnEdit');
  const er = i => p.locator('#rows tr').nth(i), setF = async (loc, v) => { await loc.fill(v); await loc.dispatchEvent('change'); };
  await pickC(p, 0, 'Pitch Loop');
  ck('choosing the video sets the row to its length', (await er(0).locator('input[data-f=dur]').inputValue()) === '0:02');
  ck('the row offers what happens after, holding by default', (await er(0).locator('select[data-f=after]').inputValue()) === '' && (await er(0).locator('select[data-f=after] option').allTextContents()).join('|') === 'Then holding|Then next row');
  await setF(er(1).locator('input[data-f=dur]'), '3:00'); await pickC(p, 1, 'Pitch Loop');
  ck('a time you typed is kept when the video is chosen', (await er(1).locator('input[data-f=dur]').inputValue()) === '3:00');
  await er(1).locator('select[data-f=after]').selectOption('next');
  ck('rows without a video have no after choice', (await er(2).locator('select[data-f=after]').count()) === 0);
  await p.click('#btnEdit');
  const rr = i => p.locator('#rows tr').nth(i);
  ck('running view says how each video ends', (await rr(0).textContent()).includes('Plays once (0:02), then holding') && (await rr(1).textContent()).includes('then next row'));
  ck('a typed time shows the video length beside it', (await rr(1).locator('td.dur').textContent()) === '3:00video 0:02');
  const third = (await p.evaluate(() => JSON.parse(localStorage.getItem('neonloop.v3')).events[0].items[2].title));
  // with the output open: the output's own "ended" moves the show on
  const [out] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnOut')]); out.on('pageerror', x => errs.push('out: ' + x)); await out.waitForTimeout(1200);
  await p.keyboard.press('Space'); await p.waitForTimeout(400);
  ck('on air, the video counts down and says what comes next', /^Video 0:0[12] left, then holding$/.test(await p.textContent('#airVid')));
  const t0 = Date.now(); await p.waitForFunction(() => document.getElementById('airLab').textContent === 'HOLDING', null, { timeout: 8000 });
  ck('when it ends, the show goes to holding by itself', Date.now() - t0 < 4500);
  await out.waitForFunction(() => { const l = document.querySelector('.layer.on'); return l && l.tagName === 'IMG'; }, null, { timeout: 4000 }).catch(() => {});
  ck('the output shows the holding content', await out.evaluate(() => { const l = document.querySelector('.layer.on'); return !!l && l.tagName === 'IMG'; }));
  ck('the countdown is cleared', (await p.textContent('#airVid')) === '');
  await p.waitForTimeout(1500); ck('it stays on holding (no repeat)', (await p.textContent('#airLab')) === 'HOLDING');
  await rr(1).locator('td').nth(2).click(); await p.keyboard.press('Space'); await p.waitForTimeout(300);
  ck('row set to next row says so on air', /then next row$/.test(await p.textContent('#airVid')));
  await p.waitForFunction(t => document.getElementById('airTtl').textContent === t, third, { timeout: 8000 }).catch(() => {});
  ck('when it ends, the next row is taken', (await p.textContent('#airTtl')) === third && (await p.textContent('#airLab')) === 'ON AIR');
  // with no output window, a timer does the same job
  await out.close(); await p.waitForTimeout(3000);
  await rr(0).locator('td').nth(2).click(); await p.keyboard.press('Space');
  await p.waitForFunction(() => document.getElementById('airLab').textContent === 'HOLDING', null, { timeout: 8000 }).catch(() => {});
  ck('without the output open, it still goes to holding', (await p.textContent('#airLab')) === 'HOLDING');
  // holding always loops, even a play-once video
  await p.click('#navLib'); await p.locator('.asset', { hasText: 'Video' }).locator('button[data-act=hold]').click(); await p.click('#navRun'); await p.waitForTimeout(300);
  const loops = await p.evaluate(() => { const v = document.querySelector('#monPgm video'); return !!v && v.loop; });
  ck('a play-once video used as holding loops', loops);
  // ticking Loop: the row keeps its time and no longer ends by itself
  await p.click('#navLib'); await p.locator('.asset', { hasText: 'Video' }).locator('input[data-k=loop]').check(); await p.click('#navRun');
  ck('a looping video has no end note', !(await rr(0).textContent()).includes('Plays once') && (await rr(0).locator('td.dur').textContent()).startsWith('0:02'));
  // unticking Loop again on a row nobody timed: it takes the length
  await p.click('#btnEdit'); await pickC(p, 3, 'Pitch Loop'); await p.click('#btnEdit');
  await p.click('#navLib'); await p.locator('.asset', { hasText: 'Video' }).locator('input[data-k=loop]').uncheck(); await p.click('#navRun');
  ck('making a video play once fits the rows that use it, but not typed ones', (await rr(3).locator('td.dur').textContent()).startsWith('0:02') && (await rr(1).locator('td.dur').textContent()).startsWith('3:00'));
  // a video that arrived without its length (older upload, or downloaded) is measured
  await p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('neonloop'); r.onsuccess = () => { const t = r.result.transaction('assets', 'readwrite'), st = t.objectStore('assets');
    st.getAll().onsuccess = e => { e.target.result.filter(a => a.kind === 'video').forEach(a => { a.secs = 0; st.put(a); }); }; t.oncomplete = () => { r.result.close(); res(); }; t.onerror = rej; }; }));
  await p.reload(); await p.click('#navLib');
  await p.waitForFunction(() => /Video · 0:02/.test([...document.querySelectorAll('.asset')].map(x => x.textContent).join()), null, { timeout: 6000 }).catch(() => {});
  const measured = /Video · 0:02/.test(await p.locator('.asset', { hasText: 'Video' }).textContent()) ? 2 : 0; await p.click('#navRun');
  ck('a video without a length is measured on the laptop', Math.round(measured) === 2);
  ck('saved: after and typed-time flags on the rows', await p.evaluate(() => { const e = JSON.parse(localStorage.getItem('neonloop.v3')).events[0]; return e.items[1].after === 'next' && e.items[1].durSet === true && !e.items[0].durSet; }));
  await p.click('#btnEdit'); await p.screenshot({ path: path.join(__dirname, 'out/video-length.png') }); await p.click('#btnEdit');
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length);
  console.log(res.join('\n')); await b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
