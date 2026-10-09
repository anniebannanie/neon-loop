const { chromium } = require('playwright');
const pickC = async (pg, i, label) => { await pg.locator('#rows tr').nth(i).locator('[data-act=pick]').click(); await pg.locator('#pkGrid .pk[data-name="' + label + '"]').click(); };

const M = n => __dirname + '/media/' + n, URL0 = 'file://' + require('path').resolve(__dirname, '../../public/legacy/index.html');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const errs = [], res = []; const ck = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(URL0); await p.click('#btnNew'); await p.fill('#evNameIn', 'Designer test'); await p.click('#evSave');
  await p.setInputFiles('#media', [M('Holding Slate.png')]); await p.waitForSelector('.asset');
  const setVal = (sel, v) => p.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
  const layers = () => p.locator('#dzStage .dz-l').count();
  const pix = name => p.evaluate(name => new Promise(r => { const q = indexedDB.open('neonloop'); q.onsuccess = () => { const g = q.result.transaction('assets').objectStore('assets').getAll(); g.onsuccess = async () => {
    const a = g.result.find(x => x.name === name); if (!a) return r(null); const bm = await createImageBitmap(a.blob), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
    window.__px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data.slice(0, 3)); window.__area = (X, Y, W, H) => { const d = x.getImageData(X, Y, W, H).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) n++; return n; };
    r({ w: bm.width, h: bm.height, type: a.blob.type, size: a.blob.size, design: !!a.design, layers: a.design ? a.design.layers.length : 0, rev: a.rev }); }; }; }), name);
  const px = (x, y) => p.evaluate(([x, y]) => window.__px(x, y), [x, y]);

  // ---------- open, starting point ----------
  await p.click('#btnDesign');
  ck('designer opens on a 1920 × 1080 canvas with the title starting point', await p.isVisible('#designer') && (await p.textContent('#dzSize')) === '1920 × 1080' && (await layers()) === 2 && await p.isDisabled('#dzUndo'));
  ck('canvas is scaled to fit and stays 16:9', await p.evaluate(() => { const w = document.getElementById('dzWrap').getBoundingClientRect(), f = document.getElementById('dzFit').getBoundingClientRect(); return Math.abs(w.width / w.height - 16 / 9) < 0.01 && w.width <= f.width && w.height <= f.height && w.width > 500; }));
  ck('starting text is centred', await p.evaluate(() => { const n = document.querySelector('#dzStage .dz-l'); return Math.abs(n.offsetLeft + n.offsetWidth / 2 - 960) < 6; }));
  await p.screenshot({ path: 'dz-open.png' });

  // ---------- background colour + a shape, then check the saved pixels ----------
  await p.selectOption('#dzBgType', 'color'); await setVal('#dzC1', '#ff0000');
  await p.locator('#dzLayers .dz-row').nth(0).locator('[data-a=del]').click(); await p.locator('#dzLayers .dz-row').nth(0).locator('[data-a=del]').click();
  ck('layers can be deleted from the list', (await layers()) === 0);
  await p.click('#dzAddRect'); await setVal('#dzTools [data-p=fill]', '#00ff00'); await setVal('#dzTools [data-p=opacity]', '100'); await setVal('#dzTools [data-p=radius]', '0');
  await p.fill('#dzName', 'Test card'); await p.click('#dzSave'); await p.waitForFunction(() => !document.body.classList.contains('designing'));
  let info = await pix('Test card');
  ck('saved as a 1920 × 1080 PNG content item with its design', info && info.w === 1920 && info.h === 1080 && info.type === 'image/png' && info.design && info.layers === 1 && (await p.locator('.asset').count()) === 2);
  ck('saved picture matches the canvas: red background, green shape in the middle', JSON.stringify(await px(10, 10)) === '[255,0,0]' && JSON.stringify(await px(960, 540)) === '[0,255,0]' && JSON.stringify(await px(1900, 1070)) === '[255,0,0]');
  const card = () => p.locator('.asset:has(input[value="Test card"])');
  ck('library card shows it with an Edit design button', (await card().locator('.meta').textContent()).includes('1920×1080') && await card().locator('[data-act=design]').isVisible());

  // ---------- reopen, text, drag, snap, resize, undo ----------
  await card().locator('[data-act=design]').click();
  ck('reopens with the saved layers and name', (await layers()) === 1 && (await p.inputValue('#dzName')) === 'Test card');
  await p.click('#dzAddText'); await p.fill('#dzTools [data-p=text]', 'Annie Gregory');
  ck('typing changes the text on the canvas and in the layers list', (await p.textContent('#dzStage .dz-text.sel')) === 'Annie Gregory' && (await p.textContent('#dzLayers .dz-row.sel .nm')).includes('Annie Gregory'));
  await setVal('#dzTools [data-p=color]', '#ffffff'); await p.uncheck('#dzTools [data-p=shadow]');
  const geo = () => p.evaluate(() => { const n = document.querySelector('#dzStage .dz-l.sel'), k = parseFloat(getComputedStyle(document.getElementById('dzStage')).getPropertyValue('--k')), r = n.getBoundingClientRect(); return { l: n.offsetLeft, t: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight, k, cx: r.left + r.width / 2, cy: r.top + r.height / 2, fs: parseFloat(n.style.fontSize) }; });
  let g0 = await geo();
  await p.mouse.move(g0.cx, g0.cy); await p.mouse.down(); await p.mouse.move(g0.cx - 150, g0.cy - 120, { steps: 6 }); await p.mouse.up();
  let g1 = await geo();
  ck('dragging moves a layer by the right amount', Math.abs((g1.l - g0.l) - (-150 / g0.k)) < 3 && Math.abs((g1.t - g0.t) - (-120 / g0.k)) < 3);
  await p.mouse.move(g1.cx, g1.cy); await p.mouse.down(); await p.mouse.move(g1.cx + 60, g1.cy, { steps: 4 });
  const targetX = (await p.evaluate(() => document.getElementById('dzWrap').getBoundingClientRect().left)) + 960 * g0.k;
  await p.mouse.move(targetX + 3, g1.cy, { steps: 4 });
  ck('centre guide appears near the middle', await p.isVisible('#dzGv')); await p.mouse.up();
  let g2 = await geo(); ck('and the layer snaps to the centre line', Math.abs(g2.l + g2.w / 2 - 960) < 1.5 && !(await p.isVisible('#dzGv')));
  const grip = await p.locator('#dzGrip').boundingBox();
  await p.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await p.mouse.down(); await p.mouse.move(grip.x + 90, grip.y + 40, { steps: 5 }); await p.mouse.up();
  let g3 = await geo(); ck('dragging the corner handle makes text bigger', g3.fs > g2.fs * 1.15 && (await p.inputValue('#dzTools [data-p=size]')) === String(g3.fs));
  await p.click('#dzUndo'); ck('undo reverts the resize', (await geo()).fs === g2.fs); await p.click('#dzRedo'); ck('redo reapplies it', (await geo()).fs === g3.fs);
  await p.click('#dzTools [data-a=cy]'); let g4 = await geo(); ck('centre top to bottom', Math.abs(g4.t + g4.h / 2 - 540) < 1.5);
  await p.keyboard.press('Shift+ArrowDown'); ck('arrow keys nudge', (await geo()).t === g4.t + 10);
  await p.keyboard.press('Delete'); ck('Delete key removes the selected layer', (await layers()) === 1); await p.keyboard.press('Control+z'); ck('Ctrl+Z brings it back', (await layers()) === 2);
  await p.locator('#dzStage .dz-text').click(); await p.click('#dzTools [data-a=cx]'); await p.click('#dzTools [data-a=cy]');
  const box = await geo();
  await p.screenshot({ path: 'dz-edit.png' });
  await p.click('#dzSave'); await p.waitForFunction(() => !document.body.classList.contains('designing'));
  const info2 = await pix('Test card');
  ck('saving an edit updates the same content item', (await p.locator('.asset').count()) === 2 && info2.layers === 2 && info2.rev > (info.rev || 0));
  const white = await p.evaluate(b => window.__area(b.l, b.t, b.w, b.h), box), outside = await p.evaluate(() => window.__area(40, 40, 300, 120));
  ck('text is drawn into the saved picture where it sat on the canvas', white > 400 && outside === 0);
  console.log('white px in text box', white);

  // ---------- gradient, picture background from content, image layer ----------
  await p.click('#btnDesign'); await p.click('#designer [data-preset=presenter]');
  ck('presenter starting point: panel plus two lines', (await layers()) === 3);
  await p.selectOption('#dzBgType', 'image'); await p.selectOption('#dzBgAsset', { label: 'Holding Slate' });
  ck('background can be a picture from the event content', await p.evaluate(() => getComputedStyle(document.getElementById('dzStage')).backgroundImage.includes('blob:')));
  await setVal('#dzDim', '40');
  await p.setInputFiles('#dzImgFile', M('Small Logo.png')); await p.waitForFunction(() => document.querySelectorAll('#dzStage img.dz-l').length === 1);
  ck('an uploaded logo becomes a layer, even though it breaks the 1920×1080 upload rule', await p.evaluate(() => { const i = document.querySelector('#dzStage img.dz-l'); return i.offsetWidth > 100 && Math.abs(i.offsetWidth / i.offsetHeight - 800 / 600) < 0.02; }));
  await p.fill('#dzName', 'Presenter Annie'); await p.screenshot({ path: 'dz-presenter.png' }); await p.click('#dzSave'); await p.waitForFunction(() => !document.body.classList.contains('designing'));
  const info3 = await pix('Presenter Annie');
  ck('saved with the picture background and logo', info3 && info3.layers === 4 && (await p.locator('.asset').count()) === 3);
  ck('logo pixels are in the saved picture', JSON.stringify(await px(960, 540)) !== JSON.stringify(await px(10, 10)));

  // ---------- on air: assign, take, then redesign and see the output follow ----------
  await p.click('#tabRun'); await p.click('#btnEdit'); await pickC(p, 0, 'Test card'); await p.click('#btnEdit');
  const [o] = await Promise.all([ctx.waitForEvent('page'), p.click('#btnOut')]); await o.waitForLoadState();
  await p.waitForFunction(() => document.getElementById('outTxt').textContent === 'Output live'); await p.keyboard.press('Space'); await o.waitForTimeout(1300);
  const src1 = await o.evaluate(() => { const i = document.querySelector('img.layer'); return i ? i.src : ''; });
  ck('a designed graphic goes to air like any other content', src1.startsWith('blob:'));
  await p.click('#tabLib'); await card().locator('[data-act=design]').click(); await setVal('#dzC1', '#0000ff'); await p.click('#dzSave'); await p.waitForFunction(() => !document.body.classList.contains('designing'));
  await o.waitForTimeout(2600);
  const src2 = await o.evaluate(() => { const l = [...document.querySelectorAll('img.layer')].filter(e => getComputedStyle(e).opacity === '1'); return l.length ? l[l.length - 1].src : ''; });
  ck('redesigning a graphic that is on air updates the screen', src2.startsWith('blob:') && src2 !== src1);
  await pix('Test card'); ck('and the new background colour is in the file', JSON.stringify(await px(10, 10)) === '[0,0,255]');

  // ---------- cancel, keyboard isolation, export ----------
  await p.click('#btnDesign'); await p.click('#dzAddText'); await p.click('#dzCancel');
  ck('cancel closes without adding content', !(await p.evaluate(() => document.body.classList.contains('designing'))) && (await p.locator('.asset').count()) === 3);
  ck('no page errors', errs.length === 0); if (errs.length) console.log(errs);
  console.log(res.join('\n')); await b.close(); process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
