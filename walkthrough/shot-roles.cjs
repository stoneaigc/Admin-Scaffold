/**
 * 角色权限页截图（浅色 / 深色、展开 / 收起 / 搜索）
 * 页面结构与配色改动后重新取证用。
 */
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');
const BASE = 'http://localhost:3100';
const EXEC = 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const token = (await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  })).json()).token;

  const b = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.evaluate((t) => localStorage.setItem('as_token', t), token);

  async function setTheme(mode) {
    await p.evaluate((m) => localStorage.setItem('as_theme', JSON.stringify({ mode: m, accent: 'apple' })), mode);
    await p.reload({ waitUntil: 'networkidle' });
    await sleep(900);
  }

  async function goRoles() {
    await p.goto(BASE + '/admin/roles', { waitUntil: 'networkidle' });
    await sleep(1500);
  }

  // 浅色
  await setTheme('light');
  await goRoles();
  await p.screenshot({ path: 'walkthrough/23-roles-default.png', fullPage: true });

  await p.getByRole('button', { name: '全部收起' }).click();
  await sleep(400);
  await p.screenshot({ path: 'walkthrough/24-roles-collapsed.png', fullPage: true });
  await p.getByRole('button', { name: '全部展开' }).click();
  await sleep(300);

  await p.getByPlaceholder('搜索权限…').fill('删除');
  await sleep(450);
  await p.screenshot({ path: 'walkthrough/25-roles-search.png', fullPage: true });
  await p.getByPlaceholder('搜索权限…').fill('');
  await sleep(300);

  // 深色
  await setTheme('dark');
  await goRoles();
  await p.screenshot({ path: 'walkthrough/26-roles-dark.png', fullPage: true });

  // 深色 + 移动端窄屏（验证新布局在窄屏回落为单列）
  await p.setViewportSize({ width: 900, height: 900 });
  await sleep(600);
  await p.screenshot({ path: 'walkthrough/27-roles-dark-narrow.png', fullPage: true });

  await setTheme('light');
  await b.close();
  console.log('截图完成: 23 / 24 / 25 / 26 / 27');
})();
