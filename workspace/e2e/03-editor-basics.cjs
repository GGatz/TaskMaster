const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const SCR = process.env.SHOTS_DIR || require('os').tmpdir();
const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, extra]); };
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
  await page.keyboard.type('Edit Test Page');
  await page.keyboard.press('Enter');
  const kb = page.keyboard;
  const types = async () => page.$$eval('.editor .block', (els) => els.map((e) => e.className.match(/block-(\w+)/)[1]));
  const texts = async () => page.$$eval('.editor .editable', (els) => els.map((e) => e.innerHTML));

  // markdown shortcuts
  await kb.type('# Heading one');
  await kb.press('Enter');
  await kb.type('Plain paragraph with **bold** and `code` text');
  await kb.press('Enter');
  await kb.type('- first bullet');
  await kb.press('Enter');
  await kb.type('second bullet');
  await kb.press('Tab');
  await kb.press('Enter');
  await kb.press('Enter'); // empty nested -> outdent
  await kb.press('Enter'); // empty bullet -> paragraph
  await kb.type('[] a todo');
  await kb.press('Enter');
  await kb.type('1. numbered one');
  await kb.press('Enter');
  await kb.type('numbered two');
  await kb.press('Enter');
  await kb.press('Enter');
  await kb.type('> toggle head');
  await kb.press('Enter');
  await kb.type('inside toggle');
  await page.waitForTimeout(200);
  console.log('types:', JSON.stringify(await types()));
  const t = await types();
  check('heading_1 created', t[0] === 'heading_1');
  check('bulleted created', t.includes('bulleted_list'));
  check('to_do created', t.includes('to_do'));
  check('numbered created', t.includes('numbered_list'));
  check('toggle created', t.includes('toggle'));
  const tx = await texts();
  check('inline bold', tx[1].includes('<strong>bold</strong>'), tx[1]);
  check('inline code', tx[1].includes('<code>code</code>'), tx[1]);
  // nested bullet exists
  check('nested bullet', await page.locator('.block-children .block-bulleted_list').count() >= 1);
  // toggle child
  check('toggle child created', await page.locator('.block-toggle .block-children .editable').count() === 1);

  // slash menu
  await kb.press('Escape'); // select block
  await page.click('.editor-tail');
  await kb.type('/code');
  await page.waitForSelector('.slash-menu');
  check('slash menu shows Code', (await page.locator('.slash-title').first().innerText()) === 'Code');
  await kb.press('Enter');
  await page.waitForTimeout(100);
  check('code block inserted', (await types()).includes('code'));
  await page.selectOption('.code-head select', 'javascript');
  await page.click('.code-input');
  await kb.type('const x = 1;');
  await page.waitForTimeout(100);
  check('code highlighted', (await page.locator('.code-hl .tk-kw').count()) >= 1);

  // block selection via Escape + delete
  const before = (await types()).length;
  await kb.press('Escape');
  await page.waitForTimeout(100);
  check('block selected', await page.locator('.block.selected').count() === 1);
  await kb.press('Backspace');
  await page.waitForTimeout(100);
  check('selected block deleted', (await types()).length === before - 1, `${before} -> ${(await types()).length}`);

  // undo
  await kb.press('Control+z');
  await page.waitForTimeout(150);
  check('undo restores code block', (await types()).includes('code'));
  await kb.press('Control+Shift+z');
  await page.waitForTimeout(150);
  check('redo removes it again', !(await types()).includes('code'));
  await kb.press('Control+z');

  // format toolbar + color + link
  await page.locator('.editor .block-paragraph .editable').first().click();
  await kb.press('Home');
  await kb.down('Shift'); for (let i = 0; i < 5; i++) await kb.press('ArrowRight'); await kb.up('Shift');
  await page.waitForSelector('.format-toolbar');
  check('format toolbar visible on selection', true);
  await page.click('.format-toolbar button[title^="Italic"]');
  const first = (await texts())[1];
  check('italic applied', /<(em|i)>/.test(first), first);
  await page.screenshot({ path: SCR + '/05-toolbar.png' });

  // wait for save, reload, verify persistence
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent === 'Saved', null, { timeout: 5000 });
  await page.reload();
  await page.waitForSelector('.editor .block');
  const after = await types();
  check('content persisted after reload', after[0] === 'heading_1' && after.includes('toggle'), JSON.stringify(after));
  check('title persisted', (await page.inputValue('.page-title')) === 'Edit Test Page');
  await page.screenshot({ path: SCR + '/06-edit.png', fullPage: false });
  console.log(results.map((r) => r.join(' | ')).join('\n'));
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.log(results.map((r) => r.join(' | ')).join('\n')); console.error('SCRIPT ERROR', e.message); process.exit(1); });
