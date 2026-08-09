import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // Inject the auth cookie so we don't have to log in via UI
  await context.addCookies([{
    name: 'sixos_session',
    value: 'C2aSPLvEocABXtyYvsz8DZclA0F4exmMimJ4NKs_on0',
    domain: 'localhost',
    path: '/'
  }]);

  const page = await context.newPage();

  page.on('pageerror', err => {
    console.log('REACT RUNTIME ERROR:', err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });
  page.on('requestfailed', request => {
    console.log('FAILED REQUEST:', request.url(), request.failure().errorText);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('API ERROR:', response.status(), response.url());
    }
  });

  await page.goto('http://localhost:8788/');
  await page.waitForLoadState('networkidle');
  
  // Click on "EVOLUÇÃO"
  // Let's find the link for Evolução
  try {
    const locators = await page.getByText(/Evolução/i);
    if (await locators.count() > 0) {
      await locators.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // give it time to render/crash
    } else {
      console.log("Could not find Evolução button");
    }
  } catch (err) {
    console.log("Navigation error:", err.message);
  }

  await browser.close();
})();
