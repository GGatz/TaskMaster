const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(process.env.BASE_URL + '/');
  await page.waitForSelector('.home-card, .sidebar');
  await page.screenshot({ path: (process.env.SHOTS_DIR || require('os').tmpdir()) + '/01-home.png' });
  await page.click('.sidebar .page-row');
  await page.waitForSelector('.editor .block');
  await page.waitForTimeout(800);
  await page.screenshot({ path: (process.env.SHOTS_DIR || require('os').tmpdir()) + '/02-page.png' });
  console.log('blocks:', await page.locator('.block').count());
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})();
