const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const SCR = process.env.SHOTS_DIR || require('os').tmpdir();
const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, ok ? '' : extra]); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto(process.env.BASE_URL + '/');

  // create two pages
  const mk = async (title) => {
    await page.click('.sidebar-foot .new-page');
    await page.waitForFunction(() => document.activeElement?.classList.contains('page-title'));
    await page.keyboard.type(title);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  };
  await mk('Alpha Zebra');
  await page.keyboard.type('unique-needle-phrase lives here');
  await mk('Beta Zebra');
  await page.waitForTimeout(800);

  // icon + cover
  await page.click('.head-actions .ghost-btn:has-text("Add icon")');
  await page.waitForSelector('.emoji-picker');
  await page.fill('.emoji-top input', 'rocket');
  await page.click('.emoji-grid button >> nth=0');
  check('icon set', (await page.locator('.big-icon').innerText()) === '🚀');
  await page.click('.head-actions .ghost-btn:has-text("Add cover")');
  await page.click('.gradient-swatch >> nth=2');
  await page.waitForSelector('.cover');
  check('cover set', await page.locator('.cover').count() === 1);
  await page.keyboard.press('Escape');

  // favorites
  await page.click('button[aria-label="Toggle favorite"]');
  await page.waitForSelector('.side-title:has-text("Favorites")');
  check('favorite appears in sidebar', await page.locator('.side-title:has-text("Favorites") + .page-row, .side-title:has-text("Favorites") ~ .page-row:has-text("Beta Zebra")').count() >= 1);

  // search by content
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.search-modal');
  await page.keyboard.type('needle-phrase');
  await page.waitForSelector('.search-result:has-text("Alpha Zebra")');
  check('search finds page by body text', await page.locator('.sr-snippet').first().innerText().then((t) => t.includes('unique-needle-phrase')));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.page-title')?.value === 'Alpha Zebra');
  check('search result opens page', true);

  // nest Beta under Alpha via sidebar drag
  const beta = page.locator('.sidebar .page-row:has-text("Beta Zebra")').last();
  const alpha = page.locator('.sidebar .page-row:has-text("Alpha Zebra")').first();
  const ab = await alpha.boundingBox();
  await beta.dragTo(alpha, { targetPosition: { x: 80, y: ab.height / 2 } });
  await page.waitForTimeout(500);
  const apiTree = await page.evaluate(async () => (await fetch('/api/pages')).json());
  const a = apiTree.find((p) => p.title === 'Alpha Zebra');
  const b = apiTree.find((p) => p.title === 'Beta Zebra');
  check('drag nests page under another', b.parent_id === a.id, JSON.stringify([a.id, b.parent_id]));

  // page options: lock + font + export
  await page.click('button[aria-label="Page options"]');
  await page.click('.popover .switch-row:has-text("Lock page") input');
  await page.keyboard.press('Escape');
  check('locked page title is read-only', await page.locator('.page-title').getAttribute('readonly') !== null);
  check('locked page editor is not editable', await page.locator('.editor [contenteditable="true"]').count() === 0);
  await page.click('button[aria-label="Page options"]');
  await page.click('.popover .switch-row:has-text("Lock page") input');
  await page.click('.font-btn.font-serif');
  check('serif font applied', await page.locator('.page-scroll.font-serif').count() === 1);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.popover .menu-item:has-text("Export as Markdown")')]);
  const path = await dl.path();
  const md = require('fs').readFileSync(path, 'utf8');
  check('markdown export contains title and body', md.startsWith('# Alpha Zebra') && md.includes('unique-needle-phrase'), md.slice(0, 80));

  // trash + undo toast + restore from trash modal
  await page.click('button[aria-label="Page options"]');
  await page.click('.popover .menu-item:has-text("Move to Trash")');
  await page.waitForSelector('.toast');
  check('trash shows undo toast', (await page.locator('.toast').innerText()).includes('Undo'));
  let tree = await page.evaluate(async () => (await fetch('/api/pages')).json());
  check('trashed page leaves tree (children too)', !tree.find((p) => p.title === 'Alpha Zebra') && !tree.find((p) => p.title === 'Beta Zebra'));
  await page.click('.sidebar-foot .side-row:has-text("Trash")');
  await page.waitForSelector('.trash-modal .search-result');
  check('trash modal lists the page', await page.locator('.trash-modal .search-result:has-text("Alpha Zebra")').count() >= 1);
  await page.click('.trash-modal .search-result:has-text("Alpha Zebra") >> nth=0 >> button[title="Restore"]');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  tree = await page.evaluate(async () => (await fetch('/api/pages')).json());
  check('restore brings page and child back', !!tree.find((p) => p.title === 'Alpha Zebra') && !!tree.find((p) => p.title === 'Beta Zebra'));

  // dark mode
  await page.click('.sidebar-foot .side-row:has-text("Settings")');
  await page.selectOption('.settings-modal select', 'dark');
  await page.keyboard.press('Escape');
  check('dark theme applied', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await page.click('.sidebar .page-row:has-text("Getting Started")');
  await page.waitForSelector('.db-block .database');
  await page.waitForTimeout(500);
  await page.screenshot({ path: SCR + '/11-dark.png' });

  // keyboard: toggle sidebar
  await page.keyboard.press('Control+\\');
  check('Ctrl+\\ hides sidebar', await page.locator('.sidebar').count() === 0);
  await page.keyboard.press('Control+\\');

  console.log(results.map((r) => r.join(' | ')).join('\n'));
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.log(results.map((r) => r.join(' | ')).join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 700)); process.exit(1); });
