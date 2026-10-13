const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');

const BASE = 'http://localhost:3100';

function check(label, txt) {
  const hasErr = txt.includes('加载失败') || txt.includes('加载中') || txt.includes('资源加载失败');
  const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
  console.log(`\n=== ${label} ===`);
  console.log('body length:', txt.length, '| hasErrorState:', hasErr);
  console.log('first 12 non-empty lines:');
  console.log(lines.slice(0, 12).join('\n'));
  return !hasErr;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
    args: ['--no-sandbox', '--no-proxy-server'],
  });
  const page = await browser.newPage();
  const failed = [];
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' }).catch(() => {});
  await page.locator('input[placeholder="请输入用户名"]').fill('admin');
  await page.locator('input[placeholder="请输入密码"]').fill('admin123456');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2000);

  // Home
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  const homeOk = check('HOME /', await page.locator('body').innerText());

  // Users
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  const usersOk = check('USERS /admin/users', await page.locator('body').innerText());

  // Roles
  await page.goto(BASE + '/admin/roles', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  const rolesOk = check('ROLES /admin/roles', await page.locator('body').innerText());

  console.log('\n=== SUMMARY ===');
  console.log('homeOk:', homeOk, '| usersOk:', usersOk, '| rolesOk:', rolesOk);
  console.log('all-normal-state-clean:', homeOk && usersOk && rolesOk);
  console.log('unexpected api >=400 (excluding intentional):', failed.join(', ') || 'none');
  await browser.close();
})();
