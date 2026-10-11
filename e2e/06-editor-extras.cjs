const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const SCR = process.env.SHOTS_DIR || require('os').tmpdir();
const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, ok ? '' : extra]); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(process.env.BASE_URL + '/');
  await page.click('.sidebar-foot .new-page');
  await page.waitForFunction(() => document.activeElement?.classList.contains('page-title'));
  await page.keyboard.type('Claims');
  await page.keyboard.press('Enter');
  const kb = page.keyboard;
  const htmls = () => page.$$eval('.editor .editable', (els) => els.map((e) => e.innerHTML));

  // columns by dropping on right edge
  await kb.type('Left block'); await kb.press('Enter'); await kb.type('Right block');
  const left = page.locator('.editor > .block').nth(0);
  const right = page.locator('.editor > .block').nth(1);
  await right.hover();
  const grip = right.locator('> .block-row .gutter-btn.grip');
  const lb = await left.locator('> .block-row .block-body').boundingBox();
  await grip.dragTo(left.locator('> .block-row'), { targetPosition: { x: lb.width - 15, y: lb.height / 2 } });
  await page.waitForTimeout(300);
  check('drop on side edge makes columns', await page.locator('.columns .column').count() === 2, `cols=${await page.locator('.columns .column').count()}`);

  // Shift+Enter soft break
  await page.click('.editor-tail');
  await kb.type('line one'); await kb.press('Shift+Enter'); await kb.type('line two');
  const h = (await htmls()).find((x) => x.includes('line one')) || '';
  check('shift+enter inserts <br> in same block', /line one(<br>|\n)line two/.test(h), h);

  // ctrl+enter toggles todo
  await kb.press('Enter');
  await kb.type('[] task');
  await kb.press('Control+Enter');
  check('ctrl+enter checks to-do', await page.locator('.li.todo.checked').count() === 1);

  // image resize + align
  await page.click('.editor-tail');
  await kb.type('/image'); await kb.press('Enter');
  await page.click('.media-empty');
  await page.click('.tabs button:has-text("Embed link")');
  await page.fill('.media-picker input', process.env.BASE_URL + '/favicon.svg');
  await page.click('.media-picker button[type=submit]');
  await page.waitForSelector('.image-frame img');
  const frame = page.locator('.image-frame');
  await frame.hover();
  const fb = await frame.boundingBox();
  const handle = page.locator('.resize-handle.right');
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + 3, hb.y + 20);
  await page.mouse.down();
  await page.mouse.move(hb.x - 150, hb.y + 20, { steps: 8 });
  await page.mouse.up();
  const fb2 = await frame.boundingBox();
  check('image resize by handle shrinks it', fb2.width < fb.width - 50, `${fb.width} -> ${fb2.width}`);
  await frame.hover();
  await page.click('.image-tools button[title="Align left"]');
  check('image align left', await page.locator('.image-block.align-left').count() === 1);

  // block selection: select two blocks, copy, paste
  await page.click('.editor-tail');
  await kb.type('Copy me'); await kb.press('Enter'); await kb.type('And me too');
  await kb.press('Escape');
  await kb.press('Shift+ArrowUp');
  check('shift+arrow extends selection', await page.locator('.block.selected').count() === 2, String(await page.locator('.block.selected').count()));
  await kb.press('Control+c');
  await kb.press('ArrowDown'); // collapse to last
  await kb.press('Enter');     // back into text
  await kb.press('End');
  await kb.press('Enter');
  await kb.press('Control+v');
  await page.waitForTimeout(300);
  const all = await htmls();
  check('copy/paste of selected blocks duplicates them', all.filter((x) => x === 'Copy me').length === 2 && all.filter((x) => x === 'And me too').length === 2, JSON.stringify(all.slice(-5)));

  // sidebar resize
  const sb = await page.locator('.sidebar').boundingBox();
  await page.mouse.move(sb.x + sb.width - 1, 400);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width + 80, 400, { steps: 6 });
  await page.mouse.up();
  const sb2 = await page.locator('.sidebar').boundingBox();
  check('sidebar resizes by dragging its edge', sb2.width > sb.width + 40, `${sb.width} -> ${sb2.width}`);

  // persistence of everything above
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent === 'Saved');
  await page.reload();
  await page.waitForSelector('.editor .block');
  check('columns + image persisted', await page.locator('.columns .column').count() === 2 && await page.locator('.image-block.align-left').count() === 1);
  check('sidebar width persisted', Math.abs((await page.locator('.sidebar').boundingBox()).width - sb2.width) < 2);

  console.log(results.map((r) => r.join(' | ')).join('\n'));
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.log(results.map((r) => r.join(' | ')).join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 700)); process.exit(1); });
