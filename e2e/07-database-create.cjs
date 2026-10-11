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
  await page.goto(process.env.BASE_URL + '/');
  await page.click('.home-card.new:has-text("New database")');
  await page.waitForSelector('.database');
  check('full-page database created', (await page.locator('.view-tab').count()) === 1);
  await page.keyboard.type('Reading list');
  await page.waitForTimeout(300);

  // table: add row, type title
  await page.click('.new-btn');
  await page.waitForSelector('.tv-row .title-input');
  await page.keyboard.type('Dune');
  await page.click('.tv-new');
  await page.keyboard.type('Neuromancer');
  await page.click('.tv-new');
  await page.keyboard.type('Foundation');
  check('3 rows created', (await page.locator('.tv-row .title-input').count()) === 3);

  // add property: Rating (number)
  await page.click('.tv-th.add button');
  await page.fill('.popover input[aria-label="Property name"]', 'Rating');
  await page.click('.popover .menu-item:has-text("Number")');
  await page.waitForSelector('.th-btn:has-text("Rating")');
  // edit number cells
  const ratingCells = page.locator('.tv-row:not(.tv-head) .tv-td:nth-child(3) .cell-text');
  await ratingCells.nth(0).click(); await page.keyboard.type('5'); await page.keyboard.press('Enter');
  await ratingCells.nth(1).click(); await page.keyboard.type('3'); await page.keyboard.press('Enter');
  await ratingCells.nth(2).click(); await page.keyboard.type('4'); await page.keyboard.press('Enter');
  check('number cells saved', (await page.locator('.tv-row:not(.tv-head) .tv-td:nth-child(3)').allInnerTexts()).join(',') === '5,3,4');

  // tags (multi select) create option via picker
  await page.click('.tv-row:not(.tv-head) >> nth=0 >> .tv-td:nth-child(2) .cell-button');
  await page.keyboard.type('Sci-fi');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.tag:has-text("Sci-fi")');
  check('select option created from picker', true);
  await page.keyboard.press('Escape');

  // sort by rating desc
  await page.click('.tool-btn:has-text("Sort")');
  await page.click('.popover .menu-item:has-text("Add sort")');
  await page.selectOption('.popover select[aria-label="Sort property"]', { label: 'Rating' });
  await page.selectOption('.popover select[aria-label="Direction"]', 'desc');
  await page.keyboard.press('Escape');
  const order = await page.$$eval('.tv-row:not(.tv-head) .title-input', (els) => els.map((e) => e.value));
  check('sort by rating desc', order.join(',') === 'Dune,Foundation,Neuromancer', order.join(','));

  // filter rating > 3
  await page.click('.tool-btn:has-text("Filter")');
  await page.click('.popover .menu-item:has-text("Add filter")');
  await page.selectOption('.popover select[aria-label="Property"]', { label: 'Rating' });
  await page.selectOption('.popover select[aria-label="Condition"]', 'gt');
  await page.fill('.popover input[aria-label="Value"]', '3');
  await page.keyboard.press('Escape');
  check('filter rating > 3 leaves 2 rows', (await page.locator('.tv-row:not(.tv-head)').count()) === 2);
  await page.screenshot({ path: SCR + '/08-table.png' });

  // switch to board: add a board view (group by Tags? needs select/status). Add status prop through board prompt.
  await page.click('.view-tabs button[title="Add a view"]');
  await page.click('.popover .menu-item:has-text("Board")');
  await page.waitForSelector('.empty-state, .board');
  check('board without status shows prompt', await page.locator('.empty-state').count() === 1);
  await page.click('.empty-state .btn');
  await page.waitForSelector('.board-col');
  const cols = await page.locator('.board-col-head .tag').allInnerTexts();
  check('board columns from new status property', cols.join(',').includes('Not started') && cols.join(',').includes('Done'), cols.join(','));

  // new card inline in "Not started"
  await page.click('.board-col:has-text("Not started") .board-new');
  await page.keyboard.type('Hyperion');
  await page.keyboard.press('Enter');
  check('inline card created in column', await page.locator('.board-col:has-text("Not started") .card:has-text("Hyperion")').count() === 1);

  // drag card Not started -> Done with mouse
  const card = page.locator('.card:has-text("Hyperion")');
  const target = page.locator('.board-col:has-text("Done") .board-cards');
  const cb = await card.boundingBox();
  const tb = await target.boundingBox();
  await page.mouse.move(cb.x + 20, cb.y + 15);
  await page.mouse.down();
  await page.mouse.move(cb.x + 40, cb.y + 30, { steps: 5 });
  await page.mouse.move(tb.x + 60, tb.y + 20, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  check('card dragged to Done column', await page.locator('.board-col:has-text("Done") .card:has-text("Hyperion")').count() === 1);
  await page.screenshot({ path: SCR + '/09-board.png' });

  // open the card as page
  await page.click('.card:has-text("Hyperion")');
  await page.waitForSelector('.row-props');
  check('row page shows property panel', (await page.locator('.row-prop').count()) >= 3);
  check('breadcrumb shows database', (await page.locator('.breadcrumbs').innerText()).includes('Reading list'));
  await page.screenshot({ path: SCR + '/10-rowpage.png' });
  await page.goBack();
  await page.waitForSelector('.database');
  // persistence of view + data
  await page.reload();
  await page.waitForSelector('.database');
  check('views persisted after reload', (await page.locator('.view-tab').count()) === 2);

  console.log(results.map((r) => r.join(' | ')).join('\n'));
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.log(results.map((r) => r.join(' | ')).join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 600)); process.exit(1); });
