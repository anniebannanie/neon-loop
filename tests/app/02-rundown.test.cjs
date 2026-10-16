// The rundown screen in the app: planning, editing with undo, saving to Supabase in the shape the live show reads.
const { chromium } = require('playwright');
const H = require('./harness.cjs'), { sb, close } = H.start(), db = sb.db;
const EV = 'e1111111-1111-4111-8111-111111111111', TREVOR = '11111111-1111-4111-8111-111111111111', ANNIE = '22222222-2222-4222-8222-222222222222';
db.events.push({ id: EV, name: 'TFN Flagship', type: 'Flagship', event_date: '2026-10-22', created_at: '2026-10-01T00:00:00Z', rules: { w: 1920 }, holding_asset: null, fade_ms: 400, updated_at: '2026-10-01T00:00:00Z',
  rundown: { start: '18:30', end: '20:00', holdMusic: '', trans: 'fade', items: [
    { k: 'a', title: 'Doors and arrivals', dur: 1800, asset: 'a1111111-1111-4111-8111-111111111111', who: '', notes: 'Holding slate' },
    { k: 'b', title: 'Welcome and MC intro', dur: 600, who: 'MC', org: 'org-from-live-show', lx: 'Warm' },
    { k: 'c', title: 'Meal break', dur: 1200, type: 'flex' },
    { k: 'd', title: 'Q&A 1', dur: 360, fix: '19:30' }] } });
db.assets.push({ id: 'a1111111-1111-4111-8111-111111111111', event_id: EV, name: 'Holding Slate', kind: 'image', url: null, created_at: '1' },
  { id: 'a2222222-2222-4222-8222-222222222222', event_id: EV, name: 'Org 1 Title', kind: 'image', url: null, created_at: '2' },
  { id: 'a3333333-3333-4333-8333-333333333333', event_id: EV, name: 'Walk In', kind: 'audio', url: null, created_at: '3' });
const row = () => db.events.find(e => e.id === EV), items = () => row().rundown.items;
const res = [], ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
(async () => {
  const b = await chromium.launch(H.launchOpts()), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', locale: 'en-AU', timezoneId: 'Australia/Melbourne' }), p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await H.signIn(p, 'http://localhost:8791', 'trevor@example.com', 'secret123');
  await p.locator('.ev', { hasText: 'TFN Flagship' }).locator('button.primary').click(); await p.waitForSelector('.rd-table tbody tr');
  const rows = () => p.locator('.rd-table tbody tr'), cell = (i, j) => rows().nth(i).locator('td').nth(j);
  const stat = async () => (await p.locator('.rd-stat .rs').allTextContents()).join(' | ');
  const patches = () => db.log.filter(l => l.startsWith('PATCH event')).length; let seen = 0;
  const saved = async () => {                       // wait for a new save to reach Supabase and the page to say so
    const t0 = Date.now(); while (patches() <= seen && Date.now() - t0 < 8000) await p.waitForTimeout(50); seen = patches();
    await p.waitForFunction(() => document.querySelector('.rd-head .pill').textContent === 'All changes saved', null, { timeout: 8000 });
  };
  ck('rundown opens in the app with every segment', (await rows().count()) === 4 && (await cell(0, 2).textContent()).startsWith('Doors and arrivals'));
  ck('start times from the show start', /^6:30\s?pm$/i.test(await cell(0, 1).textContent()) && /^7:10\s?pm$/i.test(await cell(2, 1).textContent()));
  ck('content shown by name, black when none', (await cell(0, 4).textContent()) === 'Holding Slate' && (await cell(2, 4).textContent()) === 'Black');
  ck('breaks and fixed starts are labelled', (await rows().nth(2).textContent()).includes('Break, can shorten to 10:00') && (await rows().nth(3).textContent()).includes('Fixed start 7:30 pm') && await rows().nth(2).evaluate(n => n.classList.contains('brk')));
  let s = await stat(); ck('plan against the schedule', s.includes('Scheduled 6:30 pm to 8:00 pm') && s.includes('Planned to run 1:06:00') && s.includes('24:00 spare before the finish'));
  ck('Run the show opens the live show at this rundown', (await p.getAttribute('a:has(button:has-text("Run the show"))', 'href')) === '/legacy/?event=' + EV + '&view=run');
  // edit
  await p.click('button:has-text("Edit rundown")');
  const ed = i => rows().nth(i);
  await ed(1).locator('input[aria-label=Segment]').fill('Welcome, MC and housekeeping'); await saved();
  ck('an edit saves to Supabase and keeps fields this screen does not show', items()[1].title === 'Welcome, MC and housekeeping' && items()[1].org === 'org-from-live-show' && items()[1].lx === 'Warm' && row().rundown.trans === 'fade');
  await ed(1).locator('input[aria-label="Planned length"]').fill('15:00'); await ed(1).locator('input[aria-label="Planned length"]').press('Enter'); await saved();
  ck('changing a length moves the start times and the plan', items()[1].dur === 900 && /^7:15\s?pm$/i.test(await ed(2).locator('td').nth(1).textContent()));
  s = await stat(); ck('a missed fixed start is called out', s.includes('Q&A 1 is planned 5:00 after its fixed 7:30 pm'));
  await p.click('button:has-text("Undo")'); await saved(); ck('undo steps the length back', items()[1].dur === 600 && !(await stat()).includes('is planned'));
  await ed(2).locator('[title="Add a segment below"]').click(); await saved();
  ck('add a segment below a row', items().length === 5 && items()[3].title === 'New segment');
  await ed(3).locator('[title="Move up"]').click(); await saved(); ck('move a segment up', items()[2].title === 'New segment' && items()[3].title === 'Meal break');
  await ed(2).locator('[title=Delete]').click(); await saved(); ck('delete a segment', items().length === 4 && !items().some(x => x.title === 'New segment'));
  await p.click('button:has-text("Undo")'); await saved(); ck('undo brings a deleted segment back', items().length === 5 && items()[2].title === 'New segment');
  await ed(2).locator('[title=Delete]').click(); await saved();
  await p.evaluate(() => {                           // drag row 4 by its handle to above row 1
    const rs = document.querySelectorAll('.rd-table tbody tr'), dt = new DataTransfer(), r0 = rs[0].getBoundingClientRect();
    rs[3].querySelector('.grip').dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    return new Promise(res => setTimeout(() => { rs[0].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: r0.top + 2 }));
      setTimeout(() => { rs[0].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: r0.top + 2 })); res(); }, 50); }, 50));
  }); await saved();
  ck('drag a segment by its handle', items()[0].title === 'Q&A 1' && items()[1].title === 'Doors and arrivals');
  await p.click('button:has-text("Undo")'); await saved();
  await ed(2).locator('select[aria-label=Content]').selectOption({ label: 'Org 1 Title' }); await ed(2).locator('select[aria-label=Type]').selectOption('break');
  await ed(1).locator('select[aria-label=Music]').selectOption({ label: 'Walk In' }); await saved();
  ck('content, music and break type set from the gallery', items()[2].asset === 'a2222222-2222-4222-8222-222222222222' && items()[2].type === 'break' && items()[1].music === 'a3333333-3333-4333-8333-333333333333');
  await p.locator('.rd-editbar input[type=time]').first().fill('18:45'); await p.locator('.rd-editbar select').first().selectOption({ label: 'Holding Slate' });
  await p.locator('.rd-editbar select').nth(3).selectOption('800'); await saved();
  ck('show start, holding content and speed save', row().rundown.start === '18:45' && row().holding_asset === 'a1111111-1111-4111-8111-111111111111' && row().fade_ms === 800);
  // offline
  await ctx.setOffline(true); await ed(0).locator('input[aria-label=Notes]').fill('Holding slate, doors open'); await p.waitForTimeout(1200);
  ck('offline: the change is kept on this device', (await p.textContent('.rd-head .pill')).includes('Saved on this device') && items()[0].notes === 'Holding slate');
  await ctx.setOffline(false); await saved(); ck('back online: it is sent', items()[0].notes === 'Holding slate, doors open');
  await p.click('button:has-text("Done")'); ck('Done leaves edit mode', !(await p.locator('.rd-editbar').count()) && (await p.locator('text=Edit rundown').count()) === 1);
  // the live show sees it
  const q = await ctx.newPage(); q.on('pageerror', e => errs.push('live: ' + e)); q.on('dialog', d => d.accept());
  await q.goto('http://localhost:8791/legacy/?event=' + EV + '&view=run'); await q.waitForFunction(() => document.querySelectorAll('#rows tr').length === 4, null, { timeout: 10000 });
  ck('the live show opens the same rundown with the edits', (await q.locator('#rows tr').nth(1).textContent()).includes('Welcome, MC and housekeeping') && (await q.locator('#rows tr').nth(0).textContent()).includes('doors open'));
  await q.keyboard.press('Space'); await q.waitForTimeout(500); await q.keyboard.press('Space'); await q.waitForTimeout(1800);
  ck('what is on air in the live show shows here', (await rows().nth(1).locator('.tag').textContent()) === 'ON AIR' && (await rows().nth(2).locator('.tag').textContent()) === 'NEXT' && (await stat()).includes('Live show: on air'));
  await q.close();
  // phone, then a team member
  await p.setViewportSize({ width: 390, height: 844 }); ck('phone width: the page fits, the table scrolls inside', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  db.members.push({ event_id: EV, user_id: ANNIE, role: 'team' });
  const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', locale: 'en-AU', timezoneId: 'Australia/Melbourne' })).newPage(); a.on('pageerror', e => errs.push('annie: ' + e));
  await H.signIn(a, 'http://localhost:8791', 'annie@example.com', 'secret456'); await a.locator('.ev').first().locator('button.primary').click(); await a.waitForSelector('.rd-table tbody tr');
  ck('team members see the rundown but cannot edit it', !(await a.locator('text=Edit rundown').count()) && (await a.locator('.rd-table tbody tr').count()) === 4);
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length); console.log(res.join('\n')); await b.close(); close(); process.exit(0);
})().catch(e => { console.log(res.join('\n')); console.error('CRASH', String(e).slice(0, 900)); process.exit(1); });
