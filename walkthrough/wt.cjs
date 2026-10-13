const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');
const fs = require('fs');
const DIR = 'D:/workbuddy_workspaces/fit2cloud-admin-scaffold/walkthrough';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
    args: ['--no-sandbox', '--no-proxy-server'],
  });
  const page = await browser.newPage();
  const log = [];
  page.on('console', m => { if (m.type() === 'error') log.push(m.text()); });
  page.on('pageerror', e => log.push('PAGEERR: ' + e.message));
  async function shot(n) { await page.screenshot({ path: DIR + '/' + n }); }

  try {
    await page.goto('http://localhost:3100/login', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(800);
    await shot('01-login.png');
    await page.locator('input[placeholder="请输入用户名"]').fill('admin');
    await page.locator('input[placeholder="请输入密码"]').fill('admin123456');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/', { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot('02-home.png');

    await page.goto('http://localhost:3100/admin/users');
    await page.waitForTimeout(1500);
    await shot('03-users.png');

    await page.goto('http://localhost:3100/admin/roles');
    await page.waitForTimeout(1500);
    await shot('04-roles.png');

    // 错误态：拦截 /api/admin/users -> 500
    await page.route('**/api/admin/users', route => route.fulfill({ status: 500, body: 'Server Error' }));
    await page.goto('http://localhost:3100/admin/users');
    await page.waitForTimeout(1500);
    await shot('05-users-error.png');

    // 点重试，先解除拦截恢复真实数据
    await page.unroute('**/api/admin/users');
    await page.locator('button').filter({ hasText: '重试' }).click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot('06-users-recovered.png');

    // 角色页错误态：拦截 roles 接口
    await page.route('**/api/admin/roles', route => route.fulfill({ status: 500, body: 'Server Error' }));
    await page.goto('http://localhost:3100/admin/roles');
    await page.waitForTimeout(1500);
    await shot('07-roles-error.png');
  } catch (e) {
    await shot('err-unexpected.png');
    log.push('SCRIPT_ERROR: ' + e.message);
  }

  fs.writeFileSync(DIR + '/console-errors.txt', log.join('\n'));
  console.log('WALKTHROUGH_DONE errors=' + log.length);
  console.log('CONSOLE_ERRORS=' + JSON.stringify(log));
  await browser.close();
})();
