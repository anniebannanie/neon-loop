const { chromium } = require('playwright');
const pickC = async (pg, i, label) => { await pg.locator('#rows tr').nth(i).locator('[data-act=pick]').click(); await pg.locator('#pkGrid .pk[data-name="' + label + '"]').click(); };

const sb = require('./mocksb.cjs'); const srv = sb.start(8787), db = sb.db;
const M = n => __dirname + '/media/' + n, URL0 = 'file://' + require('path').resolve(__dirname, '../../public/legacy/index.html');
const jwt = role => 'x.' + Buffer.from(JSON.stringify({ role })).toString('base64') + '.y';
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const open = async (w) => { const c = await b.newContext({ viewport: { width: w || 1280, height: 800 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept()); await p.goto(URL0); return [p, c]; };
  const status = (p, t) => p.waitForFunction(t => document.getElementById('cloudTxt').textContent === t, t, { timeout: 8000 });
  const syncNow = async p => { if (!(await p.isVisible('#cloudDlg'))) await p.click(await p.isVisible('#homeUI') ? '#btnCloud' : '#btnCloud2'); await p.click('#cdSync'); await p.waitForTimeout(900); await p.click('#cdClose'); };
  const connect = async (p, email, pw) => { await p.click('#btnCloud'); await p.fill('#cdUrl', 'http://localhost:8787/'); await p.fill('#cdKey', 'anon-test'); await p.click('#cdGo'); await p.waitForSelector('#cdEmail', { state: 'visible' }); await p.fill('#cdEmail', email); await p.fill('#cdPass', pw); await p.click('#cdGo'); };

  // ---------- laptop A: a local event first, then connect ----------
  const [A, ctxA] = await open();
  ck('starts not connected', (await A.textContent('#cloudTxt')) === 'Cloud: not connected');
  await A.click('#btnNew'); await A.fill('#evNameIn', 'Local Rehearsal'); await A.click('#evSave');
  await A.setInputFiles('#media', [M('Holding Slate.png')]); await A.waitForSelector('.asset'); await A.click('#btnHome');
  ck('event made while signed out is local', (await A.textContent('.ev .where')) === 'On this laptop only' && db.log.length === 0);
  await A.click('#btnCloud'); await A.fill('#cdUrl', 'http://localhost:8787'); await A.fill('#cdKey', jwt('service_role')); await A.click('#cdGo');
  ck('secret key is refused', (await A.textContent('#cdErr')).includes('secret service key') && await A.evaluate(() => !localStorage.getItem('neonloop.cloud')));
  await A.fill('#cdKey', 'wrong'); await A.click('#cdGo'); await A.waitForTimeout(400);
  ck('wrong key is refused', (await A.textContent('#cdErr')).includes('did not accept'));
  await A.fill('#cdKey', 'anon-test'); await A.click('#cdGo'); await A.waitForSelector('#cdEmail', { state: 'visible' });
  await A.fill('#cdEmail', 'trevor@example.com'); await A.fill('#cdPass', 'nope'); await A.click('#cdGo'); await A.waitForTimeout(400);
  ck('wrong password message', (await A.textContent('#cdErr')).includes('do not match'));
  await A.fill('#cdPass', 'secret123'); await A.click('#cdGo'); await A.waitForSelector('#cdAccount', { state: 'visible' });
  ck('signed in as producer', (await A.textContent('#cdWho')).includes('Trevor') && (await A.textContent('#cdWho')).includes('Producer'));
  await A.click('#cdClose'); await status(A, 'Cloud: all saved');
  ck('welcome uses first name from the profile', (await A.textContent('#hello')) === 'Welcome, Trevor');
  ck('local event not uploaded on its own', db.events.length === 0 && await A.isVisible('.ev [data-act=cloud]'));
  await A.click('.ev [data-act=cloud]'); await A.waitForFunction(() => document.querySelector('.ev .where').textContent === 'In the cloud'); await status(A, 'Cloud: all saved');
  ck('send to cloud uploads event, content and file', db.events.length === 1 && db.events[0].name === 'Local Rehearsal' && db.assets.length === 1 && db.files.size === 1 && [...db.files.keys()][0].startsWith(db.events[0].id + '/'));

  // ---------- A: new cloud event with rules later, then content ----------
  await A.click('#btnNew'); await A.fill('#evNameIn', 'TFN Flagship 1'); await A.fill('#evDate', '2026-10-26'); await A.check('#evDlg [name=rmode][value=later]'); await A.click('#evSave');
  await A.waitForFunction(() => document.getElementById('cloudTxt2').textContent === 'Cloud: all saved');
  const ev1 = db.events.find(e => e.name === 'TFN Flagship 1');
  ck('new event saved to cloud with no rules', !!ev1 && ev1.rules === null && ev1.event_date === '2026-10-26' && ev1.rundown.items.length === 17);
  await A.click('#btnSetRules'); await A.click('#evSave');
  await A.setInputFiles('#media', [M('Org 1 Title.png'), M('Pitch Loop.webm')]); await A.waitForFunction(() => document.querySelectorAll('.asset').length === 2);
  await A.fill('#webName', 'Pledge dashboard'); await A.fill('#webUrl', 'http://localhost:8765/'); await A.click('#btnWeb');
  await A.waitForFunction(() => [...document.querySelectorAll('.asset .meta')].length === 3 && [...document.querySelectorAll('.asset .meta')].every(m => m.textContent.includes('In the cloud')), null, { timeout: 8000 });
  ck('content uploaded: 3 records, 2 files', db.assets.filter(a => a.event_id === ev1.id).length === 3 && db.files.size === 3 && ev1.rules && ev1.rules.w === 1920);
  const img = db.assets.find(a => a.name === 'Org 1 Title');
  ck('asset record carries size and type', img.width === 1920 && img.height === 1080 && img.mime === 'image/png' && img.storage_path === ev1.id + '/' + img.id + '.png');
  await A.click('#tabRun'); await A.click('#btnEdit'); await pickC(A, 0, 'Org 1 Title'); await A.click('#btnEdit');
  await A.waitForTimeout(2200);
  ck('rundown assignment saved to cloud', ev1.rundown.items[0].asset === img.id);

  // ---------- laptop B: the same producer on another machine ----------
  const [B] = await open(); await connect(B, 'trevor@example.com', 'secret123'); await B.waitForSelector('#cdAccount', { state: 'visible' }); await B.click('#cdClose');
  await B.waitForFunction(() => document.querySelectorAll('.ev').length === 2, null, { timeout: 8000 }); await status(B, 'Cloud: all saved');
  await B.locator('.ev', { hasText: 'TFN Flagship 1' }).locator('[data-act=open]').click();
  ck('second laptop gets the event, rundown and content', (await B.textContent('#tabLib')) === 'Content (3)' && (await B.locator('#rows tr').nth(0).locator('img.th').count()) === 1 && (await B.locator('#rows tr').nth(0).locator('.nm').textContent()) === 'Org 1 Title');
  ck('files are stored on the second laptop', await B.evaluate(() => new Promise(r => { const q = indexedDB.open('neonloop'); q.onsuccess = () => { const g = q.result.transaction('assets').objectStore('assets').getAll(); g.onsuccess = () => r(g.result.filter(a => a.blob && a.blob.size > 0).length === 3); }; })));
  await B.click('#tabLib'); await B.locator('.asset', { hasText: 'Image' }).locator('input[data-k=name]').fill('Org 1 Title v2'); await B.locator('.asset', { hasText: 'Image' }).locator('input[data-k=name]').blur();
  await B.waitForTimeout(2200); ck('rename on B reaches the cloud', img.name === 'Org 1 Title v2');
  await syncNow(A); await A.click('#tabLib');
  ck('rename arrives on A', (await A.locator('.asset input[data-k=name]').evaluateAll(l => l.map(i => i.value))).includes('Org 1 Title v2'));

  // ---------- A offline: keeps working, uploads when back ----------
  await ctxA.setOffline(true);
  await A.setInputFiles('#media', [M('Holding Slate.png')]); await A.waitForFunction(() => document.querySelectorAll('.asset').length === 4);
  await A.waitForFunction(() => document.getElementById('cloudTxt2').textContent === 'Offline, saved on this laptop', null, { timeout: 8000 });
  ck('offline: file is in the local library, waiting', (await A.locator('.asset', { hasText: 'Waiting to upload' }).count()) === 1 && db.files.size === 3);
  await A.click('#tabRun'); await A.keyboard.press('Space'); ck('offline: rundown still runs', (await A.textContent('#airLab')) === 'ON AIR');
  await ctxA.setOffline(false); await syncNow(A);
  await A.waitForFunction(() => document.getElementById('cloudTxt2').textContent === 'Cloud: all saved', null, { timeout: 8000 });
  ck('back online: the waiting file uploads', db.files.size === 4 && db.assets.filter(a => a.event_id === ev1.id).length === 4);

  // ---------- delete an asset on A, B follows ----------
  await A.click('#tabLib'); await A.locator('.asset:has(input[value="Holding Slate"])').locator('[data-act=del]').click(); await A.waitForTimeout(2200);
  ck('asset delete removes record and file', db.assets.filter(a => a.event_id === ev1.id).length === 3 && db.files.size === 3);
  await syncNow(B); ck('asset delete reaches B', (await B.textContent('#tabLib')) === 'Content (3)');

  // ---------- laptop C: a team member ----------
  const [C] = await open(); await connect(C, 'annie@example.com', 'secret456'); await C.waitForSelector('#cdAccount', { state: 'visible' });
  ck('team member signed in', (await C.textContent('#cdWho')).includes('Annie') && (await C.textContent('#cdWho')).includes('Team')); await C.click('#cdClose'); await status(C, 'Cloud: all saved');
  ck('team member sees no events they are not added to', (await C.locator('.ev').count()) === 0 && (await C.textContent('#hello')) === 'Welcome, Annie');
  ck('team member cannot create events', !(await C.isVisible('#btnNew')) && !(await C.isVisible('#btnHeroNew')));
  db.members.push({ event_id: ev1.id, user_id: sb.users['annie@example.com'].id }); await syncNow(C);
  await C.waitForSelector('.ev'); ck('after being added, the event appears with no edit or delete', (await C.locator('.ev').count()) === 1 && !(await C.isVisible('.ev [data-act=del]')) && !(await C.isVisible('.ev [data-act=edit]')));
  await C.click('.ev [data-act=open]'); await C.click('#tabLib');
  await C.waitForFunction(() => document.querySelectorAll('.asset img.th, .asset video.th').length === 2, null, { timeout: 8000 });
  await C.setInputFiles('#media', [M('Holding Slate.png')]); await C.waitForFunction(() => [...document.querySelectorAll('.asset .meta')].length === 4 && [...document.querySelectorAll('.asset .meta')].every(m => m.textContent.includes('In the cloud')), null, { timeout: 8000 });
  ck('team member can upload to their event', db.assets.filter(a => a.event_id === ev1.id).length === 4 && !(await C.isVisible('.asset [data-act=del]')));
  await C.screenshot({ path: 'cloud-team.png' });
  db.members.length = 0; await syncNow(C);
  ck('removed from the event: it disappears and they land on the events page', await C.isVisible('#homeUI') && (await C.locator('.ev').count()) === 0);

  // ---------- delete the event on A; sign out ----------
  await A.click('#btnHome'); await A.locator('.ev', { hasText: 'TFN Flagship 1' }).locator('[data-act=del]').click(); await A.waitForTimeout(2200);
  ck('event delete removes event, records and files', !db.events.some(e => e.id === ev1.id) && !db.assets.some(a => a.event_id === ev1.id) && db.files.size === 1);
  await syncNow(B); ck('event delete reaches B while it was open there', await B.isVisible('#homeUI') && (await B.locator('.ev').count()) === 1);
  await A.screenshot({ path: 'cloud-home.png' });
  await A.click('#btnCloud'); await A.screenshot({ path: 'cloud-dlg.png' }); await A.click('#cdSignOut'); await A.click('#cdClose');
  ck('signed out: events stay on the laptop, greeting resets', (await A.textContent('#cloudTxt')) === 'Cloud: signed out' && (await A.textContent('#hello')) === 'Welcome' && (await A.locator('.ev').count()) === 1);
  await A.reload(); ck('still signed out after reload, project remembered', (await A.textContent('#cloudTxt')) === 'Cloud: signed out');
  await B.reload(); await status(B, 'Cloud: all saved'); ck('B stays signed in across a reload', (await B.textContent('#hello')) === 'Welcome, Trevor');
  ck('no page errors', errs.length === 0); if (errs.length) console.log(errs);
  console.log(res.join('\n')); await b.close(); srv.close(); process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
