// Long rundowns: the monitors stay in view, the list follows the show, and "Back to on air" finds the live row.
const { chromium } = require('playwright'), path = require('path');
const M = f => path.join(__dirname, 'media', f);
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
  const errs = [], res = [], ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(__dirname, '../../public/legacy/index.html')); await p.click('#btnNew'); await p.fill('#evNameIn', 'Long Night'); await p.click('#evSave');
  await p.setInputFiles('#media', [M('Holding Slate.png'), M('Org 1 Title.png')]); await p.waitForTimeout(400);
  await p.locator('.asset', { hasText: 'Image' }).first().locator('button[data-act=hold]').click();
  await p.locator('.asset').nth(1).locator('button[data-act=add]').click();
  await p.click('#navRun');
  const n = await p.locator('#rows tr').count();
  const strip = () => p.isVisible('#liveStrip'), settle = () => p.waitForTimeout(700);
  const rowBox = i => p.locator('#rows tr').nth(i).boundingBox();
  ck('a long rundown to scroll (' + n + ' rows)', n >= 15);
  ck('at the top, the big monitors show and the strip is hidden', !(await strip()) && await p.isVisible('#monPgm'));
  await p.mouse.wheel(0, 3000); await settle();
  ck('scrolled down, the strip pins the monitors to the top', await strip() && (await p.locator('#liveStrip').boundingBox()).y === 0 && await p.isVisible('#lsPgm') && await p.isVisible('#lsPvw'));
  ck('strip says what is next and offers Take and Holding', (await p.textContent('#lsNxt')) === (await p.textContent('#nxtTtl')) && await p.isVisible('#lsTake') && await p.isVisible('#lsHold'));
  // take from the strip
  await p.click('#lsTake'); await settle();
  ck('Take in the strip takes the first row', (await p.textContent('#airLab')) === 'ON AIR' && (await p.textContent('#lsLab')) === 'ON AIR');
  // jump far down the list: the list follows
  await p.locator('#rows tr').nth(12).dblclick(); await p.waitForTimeout(1200);
  let bx = await rowBox(12), sh = (await p.locator('#liveStrip').boundingBox()).height;
  ck('taking a row far down scrolls it to just under the strip', await strip() && bx.y >= sh && bx.y + bx.height <= 900 * 0.75);
  ck('the row before it is still showing', (await rowBox(11)).y >= sh - 4);
  ck('strip timer runs', /left of|over of/.test(await p.textContent('#lsTimer')));
  // reading ahead: no button while it is in view, a button once it is out of sight
  ck('no Back button while the live row is in view', !(await p.isVisible('#backAir')));
  await p.mouse.wheel(0, -6000); await settle();
  ck('scrolled away, "Back to on air" appears, pointing down', await p.isVisible('#backAir') && (await p.textContent('#backAir')).startsWith('↓'));
  await p.click('#backAir'); await p.waitForTimeout(1200); bx = await rowBox(12); sh = (await p.locator('#liveStrip').boundingBox()).height;
  ck('the button brings the live row back into view', bx.y >= sh && bx.y < 900 && !(await p.isVisible('#backAir')));
  await p.locator('#rows tr').nth(2).dblclick(); await p.waitForTimeout(1200);
  await p.mouse.wheel(0, 9000); await settle();
  ck('scrolled past it, the button points up', (await rowBox(2)).y + 40 < sh && await p.isVisible('#backAir') && (await p.textContent('#backAir')).startsWith('↑'));
  await p.click('#backAir'); await p.waitForTimeout(1200); bx = await rowBox(2);
  ck('and brings it back', bx.y >= 0 && bx.y < 900 * 0.7 && !(await p.isVisible('#backAir')));
  await p.mouse.wheel(0, 9000); await settle(); await p.keyboard.press('Space'); await p.waitForTimeout(1200); bx = await rowBox(3);
  ck('the next take follows again', bx.y >= 0 && bx.y + bx.height <= 900 && !(await p.isVisible('#backAir')));
  await p.locator('#rows tr').nth(n - 1).dblclick(); await p.waitForTimeout(1200);
  ck('the strip shows the on-air picture', await p.evaluate(() => { const i = document.querySelector('#lsPgm img'); return !!i && i.complete && i.naturalWidth > 0; }));
  // holding from the strip
  await p.click('#lsHold'); await settle();
  ck('Holding in the strip goes to holding', (await p.textContent('#airLab')) === 'HOLDING' && (await p.textContent('#lsHold')) === 'RETURN' && await p.evaluate(() => document.getElementById('liveStrip').classList.contains('hold')));
  await p.screenshot({ path: path.join(__dirname, 'out/live-strip.png') });
  await p.click('#lsHold'); await settle();
  // edit mode: a slimmer strip, no following
  await p.evaluate(() => scrollTo(0, 0)); await settle(); await p.click('#btnEdit'); await p.mouse.wheel(0, 3000); await settle();
  const eh = (await p.locator('#lsPgm').boundingBox()).height;
  ck('editing: a slimmer strip stays pinned', await strip() && eh < 80);
  ck('editing: no Back button', !(await p.isVisible('#backAir')));
  await p.screenshot({ path: path.join(__dirname, 'out/live-strip-edit.png') });
  await p.click('#btnEdit'); await settle();
  // other pages: no strip
  await p.click('#navLib'); await settle(); ck('no strip away from the rundown', !(await strip()));
  await p.click('#navRun'); await settle();
  // phone width
  await p.setViewportSize({ width: 390, height: 800 }); await p.mouse.wheel(0, 4000); await settle();
  ck('phone: the strip fits the width', await strip() && await p.evaluate(() => { const r = document.getElementById('liveStrip').getBoundingClientRect(); return r.left === 0 && r.right <= 390 && document.documentElement.scrollWidth <= 392; }));
  await p.screenshot({ path: path.join(__dirname, 'out/live-strip-phone.png') });
  errs.forEach(x => res.push('ERR ' + x)); ck('no page errors', !errs.length);
  console.log(res.join('\n')); await b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
