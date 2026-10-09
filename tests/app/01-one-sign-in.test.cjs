// The main app and the live show share one sign-in, and the live show opens the event and section asked for.
// Builds the app against the mock Supabase, then drives it in Chromium. Run: node tests/app/01-one-sign-in.test.cjs
const { chromium } = require('playwright');
const H = require('./harness.cjs'), { sb, close } = H.start();
sb.db.events.push({ id: 'e2222222-2222-4222-8222-222222222222', name: "Annie's Event", type: 'Flagship', event_date: '2026-11-12', created_at: '2026-10-02T00:00:00Z', rules: null, rundown: { items: [{ k: 'a', title: 'Doors', dur: 600 }] }, updated_at: '2026-10-02T00:00:00Z' });
const res = [], ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
(async () => {
  const b = await chromium.launch(H.launchOpts()); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8791/'); await p.fill('#email', 'trevor@example.com'); await p.fill('#pass', 'secret123'); await p.click('button.primary'); await p.waitForSelector('.ev');
  const ls = await p.evaluate(() => ({ s: JSON.parse(localStorage.getItem('neonloop.session')), c: JSON.parse(localStorage.getItem('neonloop.cloud')), pr: JSON.parse(localStorage.getItem('neonloop.profile')) }));
  ck('signing in stores one shared session the live show understands', ls.s.access_token === 'tok-11111111-1111-4111-8111-111111111111' && ls.s.refresh_token && ls.s.user.id && ls.s.expires_at > 0 && ls.c.url === 'http://localhost:8790' && ls.pr.role === 'producer');
  ck('no separate "current Neon Loop" button on the events page', !(await p.locator('text=Open current Neon Loop').count()));
  await p.locator('.ev', { hasText: "Annie's Event" }).locator('button.primary').click(); await p.waitForSelector('.rail');
  await p.click('.rail a:has-text("Pledges")');
  await p.waitForFunction(() => /view=plg/.test(document.querySelector('.rail-live').getAttribute('href')), null, { timeout: 3000 }).catch(() => {});
  ck('Live show and the page button open this event and section', (await p.getAttribute('.rail-live', 'href')) === '/legacy/?event=e2222222-2222-4222-8222-222222222222&view=plg' && (await p.textContent('.notice button.primary')) === 'Open pledges in the live show');
  await p.click('.notice button.primary');
  await p.waitForFunction(() => document.getElementById('viewTitle') && document.getElementById('viewTitle').textContent === 'Pledges' && document.body.className.indexOf('v-plg') >= 0, null, { timeout: 10000 });
  ck('live show opens straight into the event, already signed in, no project or password asked', (await p.textContent('#evName')) === "Annie's Event" && /Cloud: (all saved|Saving|Syncing)/.test(await p.textContent('#cloudTxt2')) && !(await p.isVisible('#cloudDlg')));
  ck('the address is tidied after opening', p.url() === 'http://localhost:8791/legacy/');
  await p.click('#btnHome'); await p.waitForURL('http://localhost:8791/'); await p.waitForSelector('.hero');
  ck('Events in the live show goes back to the main events page', true);
  const s2 = await p.evaluate(() => JSON.parse(localStorage.getItem('neonloop.session')).access_token); ck('still the same single sign-in', s2 === ls.s.access_token);
  await p.click('text=Sign out'); await p.waitForSelector('#email');
  await p.goto('http://localhost:8791/legacy/'); await p.waitForTimeout(800);
  ck('signing out in the main app signs the live show out too', (await p.textContent('#cloudTxt2')) === 'Cloud: signed out');
  // and the other way: sign in from the live show, main app is signed in
  await p.click(await p.isVisible('#btnCloud') ? '#btnCloud' : '#btnCloud2'); await p.waitForSelector('#cdEmail', { state: 'visible' }); await p.fill('#cdEmail', 'trevor@example.com'); await p.fill('#cdPass', 'secret123'); await p.click('#cdGo'); await p.waitForSelector('#cdAccount', { state: 'visible' });
  await p.goto('http://localhost:8791/'); await p.waitForSelector('.ev', { timeout: 8000 }).catch(() => {});
  ck('signing in from the live show signs the main app in too', await p.isVisible('.ev') && (await p.textContent('.top')).includes('Trevor'));
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length); console.log(res.join('\n')); await b.close(); close(); process.exit(0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
