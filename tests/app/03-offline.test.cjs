// Offline for real: the app saves itself (service worker), the live show downloads the event's content,
// the offline check says so, and with the network cut the page still opens and plays the content.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const H = require('./harness.cjs'), { sb, close } = H.start(), db = sb.db;
const EV = 'e3333333-3333-4333-8333-333333333333', A = 'a7777777-7777-4777-8777-777777777777', png = fs.readFileSync(path.join(__dirname, '../legacy/media/Holding Slate.png'));
db.events.push({ id: EV, name: 'Venue Without Wi-Fi', type: 'Flagship', event_date: '2026-10-30', created_at: '1', rules: { jpeg: true, png: true, video: true, audio: true, res: 'any', w: 1920, h: 1080, maxMB: 500 }, holding_asset: null, fade_ms: 400, updated_at: '2026-10-01T00:00:00Z',
  rundown: { start: '18:30', end: '', holdMusic: '', trans: 'fade', items: [{ k: 'a', title: 'Doors', dur: 600, asset: A }, { k: 'b', title: 'Welcome', dur: 300 }] } });
db.assets.push({ id: A, event_id: EV, name: 'Holding Slate', kind: 'image', url: null, storage_path: EV + '/' + A + '.png', mime: 'image/png', bytes: png.length, width: 1920, height: 1080, loop: true, sound: false, fade_s: 2, created_at: '1' });
db.files.set(EV + '/' + A + '.png', { body: png, type: 'image/png' });
const res = [], ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
(async () => {
  const b = await chromium.launch(H.launchOpts()), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'allow', locale: 'en-AU' }), p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await H.signIn(p, 'http://localhost:8791', 'trevor@example.com', 'secret123');
  await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await p.goto('http://localhost:8791/legacy/?event=' + EV + '&view=run'); await p.waitForSelector('#rows tr');
  await p.waitForFunction(() => document.querySelector('#rows tr .cont img'), null, { timeout: 15000 });     // content downloaded
  const read = async () => { await p.waitForFunction(() => !/Checking/.test(document.getElementById('rdSum').textContent)); return { sum: await p.textContent('#rdSum'), items: await p.$$eval('#rdList li', l => l.map(x => ({ st: x.className, t: x.querySelector('b').textContent, d: x.querySelector('span').textContent }))) }; };
  await p.click('#btnReady'); let r = await read(), it = t => r.items.find(x => x.t === t);
  ck('online: the app is saved in this browser', it('The app').st === 'ok' && it('The app').d.includes('Saved in this browser'));
  ck('online: the downloaded content is on the laptop', it('Content').st === 'ok' && it('Content').d.startsWith('1 file') && !r.items.some(x => x.st === 'bad'));
  await p.click('#rdClose');
  // cut the network and start again from nothing but this browser
  await ctx.setOffline(true);
  await p.goto('http://localhost:8791/legacy/'); await p.waitForSelector('#rows tr', { timeout: 15000 });
  ck('offline: the live show opens from the saved copy, on the same event', (await p.textContent('#evName')) === 'Venue Without Wi-Fi' && (await p.locator('#rows tr').count()) === 2);
  await p.click('#btnReady'); r = await read(); it = t => r.items.find(x => x.t === t);
  ck('offline: the check still says ready', it('The app').st === 'ok' && it('Content').st === 'ok' && !r.items.some(x => x.st === 'bad'));
  await p.click('#rdClose');
  await p.keyboard.press('Space'); await p.waitForFunction(() => { const i = document.querySelector('#monPgm img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
  ck('offline: taking the first row puts the content on program', true);
  await p.goto('http://localhost:8791/'); await p.waitForSelector('.hero, .top', { timeout: 15000 });
  ck('offline: the main app opens too', await p.isVisible('.top'));
  await ctx.setOffline(false);
  // a file that never downloaded is caught, with a way to fetch it
  db.assets.push({ id: 'a8888888-8888-4888-8888-888888888888', event_id: EV, name: 'Sponsor Loop', kind: 'image', url: null, storage_path: EV + '/a8888888-8888-4888-8888-888888888888.png', mime: 'image/png', bytes: 10, width: 1920, height: 1080, loop: true, sound: false, fade_s: 2, created_at: '2' });
  await p.goto('http://localhost:8791/legacy/?event=' + EV + '&view=run'); await p.waitForSelector('#rows tr'); await p.waitForTimeout(2500);
  await p.click('#btnReady'); r = await read(); it = t => r.items.find(x => x.t === t);
  ck('a file that is not on the laptop is listed as a problem', r.sum.startsWith('Not ready') && it('Sponsor Loop') && it('Sponsor Loop').st === 'bad');
  db.files.set(EV + '/a8888888-8888-4888-8888-888888888888.png', { body: png, type: 'image/png' });
  ck('and Download missing content is offered while online', await p.isVisible('#rdFix'));
  await p.click('#rdFix'); await p.waitForFunction(() => /^Ready/.test(document.getElementById('rdSum').textContent), null, { timeout: 30000 }).catch(() => {});
  ck('downloading it makes the event ready', (await p.textContent('#rdSum')).startsWith('Ready'));
  errs.filter(e => !/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED/.test(e)).forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.filter(e => !/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED/.test(e)).length);
  console.log(res.join('\n')); await b.close(); close(); process.exit(0);
})().catch(e => { console.log(res.join('\n')); console.error('CRASH', String(e).slice(0, 1200)); process.exit(1); });
