const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const SCR = process.env.SHOTS_DIR || require('os').tmpdir();
const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, ok ? '' : extra]); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto(process.env.BASE_URL + '/');
  await page.click('.sidebar .page-row:has-text("Getting Started")');
  await page.waitForSelector('.db-block .database');
  await page.click('.view-tab:has-text("All tasks")');
  await page.waitForSelector('.table-view');
  const rows = () => page.locator('.tv-row:not(.tv-head)').count();
  check('seeded 7 tasks', (await rows()) === 7);

  // header menu: rename + type conversion
  await page.click('.th-btn:has-text("Priority")');
  await page.fill('.popover input[aria-label="Property name"]', 'Urgency');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.th-btn:has-text("Urgency")');
  check('rename property', true);
  await page.click('.th-btn:has-text("Urgency")');
  await page.click('.popover .menu-item:has-text("Select")');
  await page.click('.popover .menu-item:has-text("Text")');
  await page.waitForTimeout(300);
  const cellTexts = await page.$$eval('.tv-row:not(.tv-head) .tv-td:nth-child(3)', (els) => els.map((e) => e.innerText.trim()));
  check('select -> text converts option names', cellTexts.includes('High') && cellTexts.includes('Medium'), cellTexts.join(','));
  // convert back (re-seeds options from text)
  await page.click('.th-btn:has-text("Urgency")');
  await page.click('.popover .menu-item:has-text("Text")');
  await page.click('.popover .menu-item:has-text("Select")');
  await page.waitForTimeout(300);
  check('text -> select keeps values as tags', await page.locator('.tv-row:not(.tv-head) .tv-td:nth-child(3) .tag').count() === 7);

  // filter by select option
  await page.click('.tool-btn:has-text("Filter")');
  await page.click('.popover .menu-item:has-text("Add filter")');
  await page.selectOption('.popover select[aria-label="Property"]', { label: 'Status' });
  await page.selectOption('.popover select[aria-label="Value"]', { label: 'Done' });
  await page.keyboard.press('Escape');
  check('filter Status = Done', (await rows()) === 2, String(await rows()));
  // or-mode with second filter
  await page.click('.tool-btn:has-text("Filter")');
  await page.click('.popover .menu-item:has-text("Add filter")');
  await page.locator('.popover .filter-row').nth(1).locator('select').nth(1).selectOption({ label: 'Status' });
  await page.locator('.popover .filter-row').nth(1).locator('select').nth(2).selectOption({ label: 'Is' });
  await page.locator('.popover .filter-row').nth(1).locator('select').nth(3).selectOption({ label: 'In progress' });
  await page.selectOption('.popover select[aria-label="Match mode"]', 'or');
  await page.keyboard.press('Escape');
  check('OR filter widens results', (await rows()) === 4, String(await rows()));
  await page.click('.tool-btn:has-text("Filter")');
  await page.click('.popover .menu-item:has-text("Delete filters")');
  await page.keyboard.press('Escape');
  check('delete filters restores rows', (await rows()) === 7);

  // checkbox cell + date picker
  const done = page.locator('.tv-row:not(.tv-head) .tv-td .checkbox').first();
  const before = await done.getAttribute('aria-checked');
  await done.click();
  check('checkbox toggles', (await done.getAttribute('aria-checked')) !== before);
  await page.locator('.tv-row:not(.tv-head)').first().locator('.tv-td').nth(3).locator('.cell-button').click();
  await page.waitForSelector('.date-picker');
  await page.fill('.date-picker input[type=date]', '2026-12-25');
  await page.keyboard.press('Escape');
  check('date set via picker', await page.locator('.tv-row:not(.tv-head) .val-text:has-text("Dec 25, 2026")').count() === 1);

  // hide property
  await page.click('.tool-btn:has-text("Properties")');
  await page.click('.popover .menu-item:has-text("Tags")');
  await page.keyboard.press('Escape');
  check('hide property removes column', await page.locator('.th-btn:has-text("Tags")').count() === 0);

  // delete a row with undo
  const r0 = page.locator('.tv-row:not(.tv-head)').first();
  await r0.hover();
  await r0.locator('.row-menu-btn').click();
  await page.click('.popover .menu-item:has-text("Delete")');
  check('row deleted', (await rows()) === 6);
  await page.click('.toast button:has-text("Undo")');
  await page.waitForTimeout(500);
  check('undo restores row', (await rows()) === 7);

  // calendar: add on a day
  await page.click('.view-tab:has-text("Calendar")');
  await page.waitForSelector('.calendar');
  const day = page.locator('.cal-day:not(.out)').nth(19);
  await day.hover();
  await day.locator('.cal-add').click();
  await page.keyboard.type('Calendar born');
  await page.keyboard.press('Enter');
  check('calendar creates dated row', await page.locator('.cal-event:has-text("Calendar born")').count() === 1);
  // drag event to another day
  const ev = page.locator('.cal-event:has-text("Calendar born")');
  const target = page.locator('.cal-day:not(.out)').nth(22);
  await ev.dragTo(target);
  await page.waitForTimeout(300);
  check('calendar drag moves date', await target.locator('.cal-event:has-text("Calendar born")').count() === 1);

  // view duplicate + delete
  await page.click('.view-tab.active');
  await page.click('.popover .menu-item:has-text("Duplicate view")');
  check('view duplicated', await page.locator('.view-tab').count() === 6);
  await page.click('.view-tab.active');
  await page.click('.popover .menu-item:has-text("Delete view")');
  check('view deleted', await page.locator('.view-tab').count() === 5);

  // gallery + list render
  await page.click('.view-tab:has-text("Gallery")');
  check('gallery shows cards', await page.locator('.gallery-card:not(.new)').count() === 8);
  await page.click('.view-tab:has-text("List")');
  check('list shows rows', await page.locator('.list-row').count() === 8);

  // open as full page from inline db
  await page.click('button[aria-label="Open as full page"]');
  await page.waitForFunction(() => document.querySelector('.breadcrumbs')?.innerText.includes('Tasks'));
  await page.waitForSelector('.database:not(.inline)');
  check('inline DB opens as full page (path via parent)', await page.locator('.database:not(.inline)').count() === 1);
  await page.screenshot({ path: SCR + '/13-dbfull.png' });

  console.log(results.map((r) => r.join(' | ')).join('\n'));
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.log(results.map((r) => r.join(' | ')).join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 700)); process.exit(1); });
