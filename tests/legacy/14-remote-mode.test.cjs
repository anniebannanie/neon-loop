const { chromium } = require('playwright');
const sb = require('./mocksb.cjs'); const srv = sb.start(8788), db = sb.db, rt = sb.rt;
const URL0 = 'file://' + require('path').resolve(__dirname, '../../public/legacy/index.html');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const open = async (w, h, hash) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push((hash || 'A') + ': ' + e)); p.on('dialog', d => d.accept()); await p.goto(URL0 + (hash || '')); return [p, c]; };
  const signin = async (p, email, pw, btn) => { await p.click(btn); await p.fill('#cdUrl', 'http://localhost:8788'); await p.fill('#cdKey', 'anon-test'); await p.click('#cdGo'); await p.waitForSelector('#cdEmail', { state: 'visible' }); await p.fill('#cdEmail', email); await p.fill('#cdPass', pw); await p.click('#cdGo'); await p.waitForSelector('#cdAccount', { state: 'visible' }); await p.click('#cdClose'); };
  // ---------- show laptop ----------
  const [A, ctxA] = await open(1440, 900);
  await signin(A, 'trevor@example.com', 'secret123', '#btnCloud');
  await A.click('#btnNew'); await A.fill('#evNameIn', 'TFN Flagship 1'); await A.click('#evSave');
  await A.waitForFunction(() => document.getElementById('cloudTxt2').textContent === 'Cloud: all saved', null, { timeout: 10000 });
  await A.click('#navGst'); await A.click('#gImport'); await A.fill('#impPaste', 'First name\tLast name\tCompany\tTable\tWristband\nLoren\tAlderuccio\tBupa\t3\tBAND-7\nAsad\tAbbasi\tHope Network\t5\t'); await A.waitForSelector('#impMap select'); await A.click('#impGo');
  await A.click('#navPlg'); await A.click('#plSetupBtn2'); await A.locator('#psOrgs input[data-k=name]').nth(0).fill('River Nile'); await A.locator('#psOrgs input[data-k=name]').nth(1).fill('Hope Network'); await A.fill('#psBig', ''); await A.click('#psSave');
  await A.click('#navRun'); await A.click('#btnEdit');
  await A.locator('#rows tr:has(input[data-f=title][value="Pledging: Org 2"])').locator('select[data-f=org]').selectOption({ label: 'Hope Network' }); await A.click('#btnEdit');
  await A.click('#navSet');
  ck('remote card explains how to start', await A.isVisible('#rmCard') && !(await A.isChecked('#rmOn')) && (await A.textContent('#rmHow')).includes('#remote'));
  await A.check('#rmOn'); await A.waitForFunction(() => document.getElementById('rmPillTxt').textContent === 'Remote: waiting', null, { timeout: 8000 });
  ck('switching remotes on joins the live channel', rt.log.some(l => l.startsWith('join Trevor')));
  // ---------- remote on a phone ----------
  const [R, ctxR] = await open(390, 844, '#remote');
  ck('remote opens on its own page asking to connect', await R.isVisible('#rvSetup') && !(await R.isVisible('#homeUI')) && !(await R.isVisible('#eventUI')));
  await signin(R, 'trevor@example.com', 'secret123', '#rvCloud');
  await R.waitForSelector('#rvEvList button'); ck('remote lists cloud events', (await R.textContent('#rvEvList')).includes('TFN Flagship 1'));
  await R.click('#rvEvList button'); await R.waitForFunction(() => document.getElementById('rvConn').textContent === 'Live with the show laptop', null, { timeout: 8000 });
  ck('remote is live with the laptop and the laptop shows it', (await R.textContent('#rvOrgs')).includes('River Nile') && await A.waitForFunction(() => document.getElementById('rmPillTxt').textContent === '1 remote').then(() => true, () => false));
  ck('remote never downloads events onto the device', await R.evaluate(() => !(JSON.parse(localStorage.getItem('neonloop.v3') || '{"events":[]}').events || []).length));
  // pledge by name search
  await R.fill('#rvWho', 'lor'); await R.waitForSelector('#rvSug button'); ck('guest search on the remote', (await R.locator('#rvSug button').first().textContent()).includes('Loren Alderuccio (Bupa)'));
  await R.keyboard.press('Enter'); await R.fill('#rvAmt', '500'); await R.keyboard.press('Enter');
  await R.waitForFunction(() => document.getElementById('rvMine').textContent.includes('✓ Recorded'), null, { timeout: 8000 });
  const ev = () => A.evaluate(() => JSON.parse(localStorage.getItem('neonloop.v3')).events.find(e => e.eventName === 'TFN Flagship 1'));
  let e = await ev(); ck('pledge from the remote is recorded on the laptop', e.pledges.length === 1 && e.pledges[0].amount === 500 && e.pledges[0].donorName === 'Loren Alderuccio (Bupa)' && e.pledges[0].via === 'Trevor');
  await A.click('#navPlg'); ck('laptop marks where it came from', (await A.locator('.prow .chip.via').first().textContent()) === 'Trevor');
  await R.waitForFunction(() => document.getElementById('rvTotal').textContent === '$500'); ck('remote total updates', true);
  // wristband, walk-in, anonymous
  await R.fill('#rvWho', 'band-7'); await R.waitForSelector('#rvSug button'); ck('wristband ID finds exactly one guest', (await R.locator('#rvSug button').count()) === 1);
  await R.keyboard.press('Escape'); await R.fill('#rvWho', 'Sam Smith'); await R.locator('#rvSug button', { hasText: 'walk-in guest' }).click(); await R.click('#rvOrgs button >> nth=1'); await R.fill('#rvAmt', '250'); await R.click('#rvGo');
  await R.waitForFunction(() => document.querySelectorAll('#rvMine .ok').length === 2, null, { timeout: 8000 });
  e = await ev(); const sam = e.guests.find(g => g.first === 'Sam');
  ck('walk-in added from the remote becomes a guest on the laptop', !!sam && sam.walkIn && e.pledges[1].donorId === sam.id && e.pledges[1].org === e.orgs[1].id);
  await R.check('#rvAnon'); await R.fill('#rvAmt', '100'); await R.click('#rvGo'); await R.waitForFunction(() => document.querySelectorAll('#rvMine .ok').length === 3, null, { timeout: 8000 });
  ck('anonymous from the remote', (await ev()).pledges[2].anon === true);
  await R.fill('#rvAmt', '50'); await R.click('#rvGo'); ck('remote needs a donor or anonymous', (await R.textContent('#rvMsg')).includes('Choose who'));
  // show control
  await R.click('#rvTabShow'); await R.click('#rvTake'); await A.waitForFunction(() => JSON.parse(localStorage.getItem('neonloop.v3')).events[0].run.current === 0, null, { timeout: 8000 }).catch(() => {});
  await R.waitForFunction(() => document.getElementById('rvAir').textContent === 'Doors and arrivals', null, { timeout: 8000 });
  ck('take next from the remote takes on the laptop', (await A.textContent('#airTtl')) === 'Doors and arrivals' && (await R.textContent('#rvAirLab')) === 'ON AIR' && /\d+:\d\d/.test(await R.textContent('#rvTimer')));
  await R.click('#rvHold'); await A.waitForFunction(() => document.getElementById('airLab').textContent === 'HOLDING', null, { timeout: 8000 });
  await R.waitForFunction(() => document.getElementById('rvHold').getAttribute('aria-pressed') === 'true', null, { timeout: 8000 }); ck('holding from the remote', true);
  await R.click('#rvHold'); await A.waitForFunction(() => document.getElementById('airLab').textContent === 'ON AIR', null, { timeout: 8000 });
  await R.locator('#rvRows button', { hasText: 'Pledging: Org 2' }).click();
  await A.waitForFunction(() => document.getElementById('airTtl').textContent === 'Pledging: Org 2', null, { timeout: 8000 });
  ck('take a chosen row from the remote', true);
  await R.waitForFunction(() => document.getElementById('rvAir').textContent === 'Pledging: Org 2');
  await R.click('#rvTabPlg'); ck('remote pledge screen follows the rundown', (await R.getAttribute('#rvOrgs button >> nth=1', 'aria-pressed')) === 'true');
  await R.screenshot({ path: 'remote-pledge.png' }); await R.click('#rvTabShow'); await R.screenshot({ path: 'remote-show.png' });
  // laptop turns show control off
  await A.click('#navSet'); await A.uncheck('#rmShow'); await R.waitForFunction(() => document.getElementById('rvTake').disabled, null, { timeout: 8000 });
  ck('show control can be switched off from the laptop', (await R.textContent('#rvShowNote')).includes('switched off'));
  await R.evaluate(() => { document.getElementById('rvTake').disabled = false; document.getElementById('rvTake').click(); }); await R.waitForTimeout(1200);
  ck('and the laptop refuses a take if one is sent anyway', (await A.textContent('#airTtl')) === 'Pledging: Org 2');
  await A.check('#rmShow');
  // laptop goes away: pledges queue on the remote and arrive once
  await A.close(); await R.waitForTimeout(500);
  await R.click('#rvTabPlg'); await R.fill('#rvWho', 'asad'); await R.waitForSelector('#rvSug button'); await R.keyboard.press('Enter'); await R.fill('#rvAmt', '1000'); await R.click('#rvGo');
  await R.waitForTimeout(400); ck('without the laptop the pledge waits on the device', (await R.textContent('#rvMine')).includes('Sending') );
  await R.waitForFunction(() => document.getElementById('rvConn').textContent === 'Waiting for the show laptop', null, { timeout: 20000 }); ck('remote says the laptop has gone quiet', true);
  await R.reload(); await R.waitForSelector('#rvMine'); ck('queued pledge survives the remote reloading', (await R.textContent('#rvMine')).includes('Sending'));
  const A2 = await ctxA.newPage(); A2.on('pageerror', x => errs.push('A2: ' + x)); A2.on('dialog', d => d.accept()); await A2.goto(URL0);
  await R.waitForFunction(() => document.querySelectorAll('#rvMine .ok').length === 4, null, { timeout: 20000 });
  const e2 = await A2.evaluate(() => JSON.parse(localStorage.getItem('neonloop.v3')).events.find(x => x.eventName === 'TFN Flagship 1'));
  ck('laptop back: the queued pledge is recorded exactly once', e2.pledges.length === 4 && e2.pledges.filter(x => x.amount === 1000).length === 1);
  // budget limit refused remotely
  await A2.click('#navPlg'); await A2.click('#plSetupBtn'); await A2.check('#plDlg [name=fmode][value=budget]'); await A2.fill('#psCompany', 'AMP'); await A2.fill('#psBudget', '2000'); await A2.click('#psSave');
  await R.waitForTimeout(1500); await R.fill('#rvAmt', '5000'); await R.click('#rvGo');
  await R.waitForFunction(() => document.querySelector('#rvMine .err'), null, { timeout: 8000 });
  ck('a budget overspend is refused with a reason', (await R.textContent('#rvMine')).includes('budget past what is allowed') && (await A2.evaluate(() => JSON.parse(localStorage.getItem('neonloop.v3')).events.find(x => x.eventName === 'TFN Flagship 1').pledges.length)) === 4);
  // someone without access to the event
  const [N] = await open(390, 844, '#remote'); await signin(N, 'annie@example.com', 'secret456', '#rvCloud');
  await N.waitForSelector('#rvEvList'); await N.waitForTimeout(800);
  ck('a team member not on the event does not see it', !(await N.textContent('#rvEvList')).includes('TFN Flagship 1'));
  await N.evaluate(id => { localStorage.setItem('neonloop.remoteEv', JSON.stringify({ id: id, name: 'x' })); }, e2.id); await N.reload();
  await N.waitForFunction(() => document.getElementById('rvConn').textContent === 'Refused', null, { timeout: 8000 });
  ck('and is refused the live channel even with the event ID', (await N.textContent('#rvOrgs')).includes('refused'));
  console.log(await R.evaluate(() => { const W = window.innerWidth, out = []; document.querySelectorAll('body *').forEach(n => { const r = n.getBoundingClientRect(); if (r.right > W + 1 && n.offsetParent !== null) out.push(n.tagName + '#' + n.id + '.' + n.className + ' ' + Math.round(r.right)); }); return document.documentElement.scrollWidth + ' ' + out.slice(0, 12).join(' | '); })); await R.setViewportSize({ width: 390, height: 844 }); ck('remote fits a phone', await R.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length); console.log(res.join('\n')); await b.close(); srv.close(); process.exit(0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
