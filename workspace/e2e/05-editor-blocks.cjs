const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
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
  page.on('dialog', (d) => d.accept());
  await page.goto(process.env.BASE_URL + '/');
  await page.click('.sidebar-foot .new-page');
  await page.waitForFunction(() => document.activeElement?.classList.contains('page-title'));
  await page.keyboard.type('Extras');
  await page.keyboard.press('Enter');
  const kb = page.keyboard;
  const types = () => page.$$eval('.editor .block', (els) => els.map((e) => e.className.match(/block-(\w+)/)[1]));
  const htmls = () => page.$$eval('.editor .editable', (els) => els.map((e) => e.innerHTML));

  // headings for TOC + TOC block
  await kb.type('## First heading'); await kb.press('Enter');
  await kb.type('/contents'); await kb.press('Enter');
  await page.waitForSelector('.toc-item');
  check('TOC lists heading', (await page.locator('.toc-item').first().innerText()) === 'First heading');
  await page.click('.editor-tail');
  await kb.type('### Third level');
  await page.waitForTimeout(100);
  check('TOC updates live', (await page.locator('.toc-item').count()) === 2);

  // + button inserts block with slash menu
  await page.hover('.editor > .block >> nth=0');
  await page.click('.editor > .block >> nth=0 >> .gutter-btn[aria-label="Add block below"]');
  await page.waitForSelector('.slash-menu');
  check('+ button opens slash menu', true);
  await kb.type('callout');
  await kb.press('Enter');
  await kb.type('Hello callout');
  check('callout created via + menu', (await types()).includes('callout'));

  // block menu: turn into, color, duplicate, delete
  const callout = page.locator('.block-callout').first();
  await callout.hover();
  await callout.locator('.gutter-btn.grip').click();
  await page.click('.block-menu .menu-item:has-text("Color")');
  await page.click('.block-menu .menu-item:has-text("Blue background")');
  check('block color applied', await page.locator('.callout.color-blue_bg').count() === 1);
  await callout.hover();
  await callout.locator('.gutter-btn.grip').click();
  await page.click('.block-menu .menu-item:has-text("Duplicate")');
  check('duplicate block', await page.locator('.block-callout').count() === 2);
  await page.locator('.block-callout').nth(1).hover();
  await page.locator('.block-callout').nth(1).locator('.gutter-btn.grip').click();
  await page.click('.block-menu .menu-item:has-text("Turn into")');
  await page.click('.block-menu .menu-item:has-text("Quote")');
  check('turn into quote', (await types()).includes('quote') && await page.locator('.block-callout').count() === 1);
  await page.locator('.block-quote').first().hover();
  await page.locator('.block-quote').first().locator('.gutter-btn.grip').click();
  await page.click('.block-menu .menu-item:has-text("Delete")');
  check('delete via block menu', !(await types()).includes('quote'));

  // nesting with tab / outdent
  await page.click('.editor-tail');
  await kb.type('- parent'); await kb.press('Enter'); await kb.type('child'); await kb.press('Tab');
  check('tab nests block', await page.locator('.block-children .block-bulleted_list').count() === 1);
  await kb.press('Shift+Tab');
  check('shift+tab outdents', await page.locator('.block-children .block-bulleted_list').count() === 0);
  // Cmd+Shift+Up moves block
  await kb.press('Control+Shift+ArrowUp');
  const h = await htmls();
  const iParent = h.indexOf('parent'); const iChild = h.indexOf('child');
  check('ctrl+shift+up moves block up', iChild >= 0 && iChild < iParent, JSON.stringify(h.slice(-3)));

  // link via toolbar
  await page.click('.editor-tail');
  await kb.type('click here now');
  await kb.press('Home');
  await kb.down('Shift'); for (let i = 0; i < 10; i++) await kb.press('ArrowRight'); await kb.up('Shift');
  await page.waitForSelector('.format-toolbar');
  await page.click('.format-toolbar button[title^="Link"]');
  await page.fill('.link-form input', 'example.com');
  await kb.press('Enter');
  const ahtml = (await htmls()).find((x) => x.includes('example.com')) || '';
  check('link applied with https', /<a href="https:\/\/example\.com"/.test(ahtml), ahtml);
  // text color
  await kb.press('Home');
  await kb.down('Shift'); for (let i = 0; i < 5; i++) await kb.press('ArrowRight'); await kb.up('Shift');
  await page.click('.format-toolbar button[title="Color"]');
  await page.click('.color-panel .swatch.tc-red');
  check('text color applied', (await htmls()).some((x) => x.includes('class="tc-red"')));

  // bookmark + embed blocks
  await page.click('.editor-tail');
  await kb.type('/bookmark'); await kb.press('Enter');
  await page.fill('.bookmark-empty input', 'https://example.com/docs');
  await page.click('.bookmark-empty button');
  await page.waitForSelector('.bookmark');
  check('bookmark created', (await page.inputValue('.bookmark-title')) === 'example.com');

  // link to page picker
  await page.click('.editor-tail');
  await kb.type('/link to'); await kb.press('Enter');
  await page.waitForSelector('.search-modal');
  await kb.type('Getting');
  await page.waitForSelector('.search-result:has-text("Getting Started")');
  await kb.press('Enter');
  await page.waitForSelector('.page-link');
  check('link-to-page block created', (await page.locator('.page-link-title').first().innerText()) === 'Getting Started');

  // table row/col operations
  await page.click('.editor-tail');
  await kb.type('/table'); await kb.press('Enter');
  await page.waitForSelector('.table-block');
  await page.hover('.table-block');
  await page.click('.table-add-row');
  check('table add row', await page.locator('.table-block tr').count() === 3);
  await page.click('.table-add-col');
  check('table add column', await page.locator('.table-block tr:first-child td').count() === 3);
  await page.locator('.table-block .col-handle').first().click({ force: true });
  await page.click('.popover .menu-item:has-text("Delete column")');
  check('table delete column', await page.locator('.table-block tr:first-child td').count() === 2);

  // delete key merge
  await page.click('.editor-tail');
  await kb.type('AAA'); await kb.press('Enter'); await kb.type('BBB');
  await kb.press('ArrowUp'); await kb.press('End'); await kb.press('Delete');
  check('delete key merges next block', (await htmls()).includes('AAABBB'), JSON.stringify((await htmls()).slice(-3)));

  // undo coalescing: typing is one undo step
  await page.click('.editor-tail');
  await kb.type('typed words here');
  await kb.press('Control+z');
  const afterUndo = await htmls();
  check('undo removes whole typing burst', !afterUndo.some((x) => x.includes('typed words')), JSON.stringify(afterUndo.slice(-2)));

  await page.waitForTimeout(800);
  await page.screenshot({ path: SCR + '/12-extras.png', fullPage: false });
  console.log(results.map((r) => r.join(' | ')).join('\n'));
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.log(results.map((r) => r.join(' | ')).join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 700)); process.exit(1); });
