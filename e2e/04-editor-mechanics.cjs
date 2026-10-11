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
  await page.waitForSelector('.page-title');
  await page.keyboard.type('Mechanics');
  await page.keyboard.press('Enter');
  const kb = page.keyboard;
  const htmls = () => page.$$eval('.editor .editable', (els) => els.map((e) => e.innerHTML));
  const types = () => page.$$eval('.editor .block', (els) => els.map((e) => e.className.match(/block-(\w+)/)[1]));

  // Enter splits in the middle
  await kb.type('HelloWorld');
  for (let i = 0; i < 5; i++) await kb.press('ArrowLeft');
  await kb.press('Enter');
  let h = await htmls();
  check('enter splits mid-text', h[0] === 'Hello' && h[1] === 'World', JSON.stringify(h));
  // caret is at start of second block: backspace merges back
  await kb.press('Backspace');
  h = await htmls();
  check('backspace merges blocks', h.length === 1 && h[0] === 'HelloWorld', JSON.stringify(h));
  // caret position after merge is at the join: typing inserts there
  await kb.type('-');
  h = await htmls();
  check('caret at join after merge', h[0] === 'Hello-World', JSON.stringify(h));

  // arrow navigation between blocks
  await kb.press('End');
  await kb.press('Enter');
  await kb.type('second');
  await kb.press('ArrowUp');
  await kb.type('!');
  h = await htmls();
  check('arrow up moves to previous block', h[0].endsWith('!') || h[0].includes('!'), JSON.stringify(h));
  await kb.press('ArrowDown');
  await kb.type('?');
  h = await htmls();
  check('arrow down moves to next block', h[1].includes('?'), JSON.stringify(h));

  // paste markdown
  await kb.press('Enter');
  await page.evaluate(() => navigator.clipboard.writeText('## Pasted heading\n\n- item a\n- item b\n\n- [x] done task\n\n> quoted\n\n```js\nlet a = 1\n```'));
  await kb.press('Control+v');
  await page.waitForTimeout(300);
  const t = await types();
  check('markdown paste creates heading', t.includes('heading_2'), JSON.stringify(t));
  check('markdown paste creates bullets', t.filter((x) => x === 'bulleted_list').length === 2, JSON.stringify(t));
  check('markdown paste creates todo', t.includes('to_do'), JSON.stringify(t));
  check('markdown paste creates quote', t.includes('quote'), JSON.stringify(t));
  check('markdown paste creates code', t.includes('code'), JSON.stringify(t));
  check('todo paste checked state', await page.locator('.li.todo.checked').count() === 1);

  // mention
  await page.click('.editor-tail');
  await kb.type('see @Getting');
  await page.waitForSelector('.mention-menu');
  await kb.press('Enter');
  await page.waitForTimeout(150);
  check('mention inserted', await page.locator('.editor a.mention').count() === 1);

  // drag block: move first block below the second
  const idsBefore = await page.$$eval('.editor > .block', (els) => els.map((e) => e.dataset.blockId));
  const src = page.locator('.editor > .block').nth(0);
  const dst = page.locator('.editor > .block').nth(1);
  await src.hover();
  const grip = src.locator('> .block-row .gutter-btn.grip');
  const dstBox = await dst.locator('> .block-row').boundingBox();
  await grip.dragTo(dst.locator('> .block-row'), { targetPosition: { x: 200, y: dstBox.height - 3 } });
  await page.waitForTimeout(200);
  const idsAfter = await page.$$eval('.editor > .block', (els) => els.map((e) => e.dataset.blockId));
  check('drag reorders blocks', idsAfter[0] === idsBefore[1] && idsAfter[1] === idsBefore[0], `${idsBefore.slice(0,3)} -> ${idsAfter.slice(0,3)}`);

  // slash: table
  await page.click('.editor-tail');
  await kb.type('/table');
  await kb.press('Enter');
  await page.waitForSelector('.table-block');
  await kb.type('A1');
  await kb.press('Tab');
  await kb.type('B1');
  await kb.press('Tab');
  await kb.type('A2');
  const cells = await page.$$eval('.table-block .cell-edit', (els) => els.map((e) => e.innerHTML));
  check('table cell navigation with Tab', cells[0] === 'A1' && cells[1] === 'B1' && cells[2] === 'A2', JSON.stringify(cells));

  // columns via slash
  await page.click('.editor-tail');
  await kb.type('/2 col');
  await kb.press('Enter');
  await page.waitForSelector('.columns .column');
  check('two columns rendered', await page.locator('.columns .column').count() === 2);
  await kb.type('in column');
  check('typing inside column', (await page.locator('.column .editable').first().innerText()) === 'in column');

  // image upload via picker
  await page.click('.editor-tail');
  await kb.type('/image');
  await kb.press('Enter');
  await page.waitForSelector('.media-empty');
  await page.click('.media-empty');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64');
  fs.writeFileSync(SCR + '/t.png', png);
  await page.setInputFiles('.media-picker input[type=file]', SCR + '/t.png');
  await page.waitForSelector('.image-block img');
  const src2 = await page.getAttribute('.image-block img', 'src');
  check('image uploaded and served', src2.startsWith('/uploads/'), src2);
  const ok = await page.evaluate(async (u) => (await fetch(u)).status, src2);
  check('uploaded image reachable', ok === 200);

  // subpage via slash
  await page.click('.editor-tail');
  await kb.type('/page');
  await page.waitForSelector('.slash-menu');
  await kb.press('Enter');
  await page.waitForFunction(() => location.hash.length > 5 && !location.hash.includes('undefined'), null, { timeout: 5000 });
  await page.waitForFunction(() => document.activeElement?.classList.contains('page-title') && document.querySelectorAll('.breadcrumbs .crumb').length >= 2);
  check('subpage created and opened', (await page.locator('.breadcrumbs .crumb').count()) >= 2);
  await page.keyboard.type('Child page');
  await page.waitForTimeout(900);
  await page.goBack();
  await page.waitForSelector('.page-link');
  check('subpage link block shows live title', (await page.locator('.page-link-title').first().innerText()) === 'Child page', await page.locator('.page-link-title').first().innerText());
  check('sidebar nests the subpage', await page.locator('.sidebar .page-row:has-text("Child page")').count() >= 1);

  await page.screenshot({ path: SCR + '/07-mechanics.png' });
  console.log(results.map((r) => r.join(' | ')).join('\n'));
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.log(results.map((r) => r.join(' | ')).join('\n')); console.error('SCRIPT ERROR', e.message); process.exit(1); });
