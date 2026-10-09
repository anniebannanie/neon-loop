const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
  const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date('2026-10-07T18:20:00+11:00') });
  await p.goto('file://' + require('path').resolve(__dirname, '../../public/legacy/index.html')); await p.click('#btnNew'); await p.fill('#evNameIn', 'Timing'); await p.click('#evSave'); await p.click('#navRun');
  const stat = async () => { await p.clock.runFor(300); return (await p.locator('#runStat .rs').allTextContents()).join(' | '); };
  let s = await stat(); ck('before a start time is set: planned length only', s === 'Planned to run 2:24:00');
  await p.click('#btnEdit'); await p.fill('#edStart', '18:30'); await p.dispatchEvent('#edStart', 'change'); await p.fill('#edFinish', '20:45'); await p.dispatchEvent('#edFinish', 'change');
  ck('edit bar says how the plan sits against the finish', (await p.textContent('#edEnd')).includes('Runs 2:24:00') && (await p.textContent('#edEnd')).includes('9:00 over the finish time'));
  await p.click('#btnUndo'); ck('undo steps the finish time back', (await p.inputValue('#edFinish')) === ''); await p.fill('#edFinish', '21:00'); await p.dispatchEvent('#edFinish', 'change');
  ck('and spare time when it fits', (await p.textContent('#edEnd')).includes('6:00 spare'));
  await p.click('#btnEdit');
  const ev = () => p.evaluate(() => JSON.parse(localStorage.getItem('neonloop.v3')).events[0]);
  ck('start and finish saved', (await ev()).showStart === '18:30' && (await ev()).showEnd === '21:00');
  s = await stat(); ck('before the show: schedule, planned length and spare time', s.includes('Scheduled 6:30 pm to 9:00 pm') && s.includes('Planned to run 2:24:00') && s.includes('6:00 spare before the finish'));
  ck('status hidden while editing', await p.evaluate(() => { document.body.classList.add('edit'); const h = getComputedStyle(document.getElementById('runStat')).display === 'none'; document.body.classList.remove('edit'); return h; }));
  // start 2 minutes late: 18:32
  await p.clock.runFor(12 * 60000); await p.keyboard.press('Space'); s = await stat();
  ck('late start is shown and carried into the forecast', /Started 6:32 pm, 2:0\d late/.test(s) && /Running 2:0\d behind/.test(s) && /On track to finish 8:56 pm, 3:5\d before the 9:00 pm finish/.test(s));
  let r = await p.locator('#rows tr').nth(0).textContent(); ck('row shows its actual start under the planned one', r.includes('6:30 pm') && /6:32 pm · 2:0\d late/.test(r));
  // first segment planned 30:00, run it 25:00 -> take next at 18:57
  await p.clock.runFor(25 * 60000); await p.keyboard.press('Space'); s = await stat();
  ck('finishing a segment early pulls time back', /Running 2:5\d ahead/.test(s) && s.includes('On track to finish 8:51 pm'));
  r = await p.locator('#rows tr').nth(0).textContent(); ck('finished row shows how long it really ran', r.includes('ran 25:00'));
  r = await p.locator('#rows tr').nth(1).textContent(); ck('next row started early against plan', /6:57 pm · 2:5\d early/.test(r));
  // overrun second segment (planned 10:00) by 8 minutes without taking
  await p.clock.runFor(18 * 60000); s = await stat();
  ck('an overrunning segment pushes the forecast out live', /Running 5:0\d behind/.test(s) && s.includes('On track to finish 8:59 pm'));
  await p.clock.runFor(3 * 60000); s = await stat();
  ck('and warns once it passes the finish time', /Running 8:0\d behind/.test(s) && /2:0\d after the 9:00 pm finish/.test(s) && (await p.locator('#runStat .rs.late').count()) >= 2);
  await p.screenshot({ path: 'timing.png' });
  await p.keyboard.press('Space'); r = await p.locator('#rows tr').nth(1).textContent(); ck('overrun recorded on the finished row', r.includes('ran 21:0') && (await p.locator('#rows tr').nth(1).locator('.act.late').count()) >= 1);
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#btnTimes')]); await d1.saveAs(require('path').join(__dirname, 'out') + '/times.csv'); const csv = fs.readFileSync(require('path').join(__dirname, 'out') + '/times.csv', 'utf8').replace(/^\ufeff/, '').split('\r\n');
  ck('run times export: planned and actual per segment', csv[0].startsWith('#,Segment,Planned start,Actual start') && /Doors and arrivals,6:30 pm,6:32:0\d pm,30:00,25:00,-(300|299)/.test(csv[1]) && /10:00,21:0\d,6[56]\d/.test(csv[2]) && csv[4].endsWith(',,'));
  await p.reload(); await p.waitForSelector('#rows tr'); s = await stat(); r = await p.locator('#rows tr').nth(0).textContent();
  ck('timing survives a reload', s.includes('Started 6:32 pm') && r.includes('ran 25:00'));
  // drag order change keeps actuals with their segments
  await p.click('#btnEdit'); await p.locator('#rows tr').nth(0).locator('[data-act=down]').click(); await p.click('#btnEdit');
  r = await p.locator('#rows tr', { hasText: 'Doors and arrivals' }).textContent(); ck('actual times stay with their segment when rows move', r.includes('ran 25:00'));
  // restart clears
  await p.click('#navSet'); await p.click('#btnReset'); await p.click('#navRun'); s = await stat(); ck('restart clears the recorded times', s.includes('Scheduled 6:30 pm') && !(await p.locator('#rows .act').count()));
  // no start time: still tracks against plan from the actual start
  await p.click('#btnEdit'); await p.fill('#edStart', ''); await p.dispatchEvent('#edStart', 'change'); await p.fill('#edFinish', ''); await p.dispatchEvent('#edFinish', 'change'); await p.click('#btnEdit');
  await p.keyboard.press('Space'); await p.clock.runFor(40 * 60000); s = await stat();
  ck('with no schedule set it still tracks overrun from the real start', s.includes('Started') && /Running 30:0\d behind/.test(s) && s.includes('On track to finish') && !s.includes('late'));
  // export / import carries the finish time
  await p.click('#btnEdit'); await p.fill('#edFinish', '21:00'); await p.dispatchEvent('#edFinish', 'change'); await p.click('#btnEdit');
  await p.setViewportSize({ width: 390, height: 800 }); ck('phone width fits', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length); console.log(res.join('\n')); await b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
