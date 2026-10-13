async page => {
  const DIR = 'D:/workbuddy_workspaces/fit2cloud-admin-scaffold/walkthrough';
  const log = [];
  page.on('console', m => { if (m.type() === 'error') log.push(m.text()); });
  page.on('pageerror', e => log.push('PAGEERROR: ' + e.message));
  async function shot(name) { await page.screenshot({ path: DIR + '/' + name }); }
  try {
    await page.locator('input:not([type="password"])').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123456');
    await page.locator('button').filter({ hasText: '登录' }).click();
    await page.waitForURL('**/', { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot('02-home.png');
    await page.goto('http://localhost:3100/admin/users');
    await page.waitForTimeout(1500);
    await shot('03-users.png');
    await page.goto('http://localhost:3100/admin/roles');
    await page.waitForTimeout(1500);
    await shot('04-roles.png');
    await page.route('**/api/admin/users', route => route.fulfill({ status: 500, body: 'Server Error' }));
    await page.goto('http://localhost:3100/admin/users');
    await page.waitForTimeout(1500);
    await shot('05-users-error.png');
    await page.unroute('**/api/admin/users');
    await page.locator('button').filter({ hasText: '重试' }).click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot('06-users-recovered.png');
    await page.route('**/api/admin/roles', route => route.fulfill({ status: 500, body: 'Server Error' }));
    await page.goto('http://localhost:3100/admin/roles');
    await page.waitForTimeout(1500);
    await shot('07-roles-error.png');
  } catch (e) {
    await shot('err-unexpected.png');
    log.push('SCRIPT_ERROR: ' + e.message);
  }
  console.log('WALKTHROUGH_DONE errors=' + log.length);
  console.log('CONSOLE_ERRORS=' + JSON.stringify(log));
}
