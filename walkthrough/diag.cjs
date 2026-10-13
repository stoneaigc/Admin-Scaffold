const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const reqs = [];
  page.on('response', r => {
    if (r.url().includes('/api/')) reqs.push(r.status() + ' ' + r.request().method() + ' ' + r.url());
  });
  page.on('requestfailed', r => {
    if (r.url().includes('/api/')) reqs.push('FAILED ' + r.method() + ' ' + r.url() + ' :: ' + (r.failure() && r.failure().errorText));
  });

  await page.goto('http://localhost:3100/login', { waitUntil: 'networkidle' }).catch(() => {});
  await page.locator('input[placeholder="请输入用户名"]').fill('admin');
  await page.locator('input[placeholder="请输入密码"]').fill('admin123456');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);

  console.log('=== URL after login ===');
  console.log(page.url());
  console.log('=== localStorage token ===');
  console.log(await page.evaluate(() => (localStorage.getItem('as_token') || '').slice(0, 40)));
  console.log('=== API responses ===');
  console.log(reqs.join('\n'));
  console.log('=== visible body text ===');
  const txt = await page.locator('body').innerText();
  console.log(txt.slice(0, 600));
  await browser.close();
})();
