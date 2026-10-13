// walkthrough/verify-frontnav-e2e.cjs
// 验证「后台点品牌 Logo -> 跳前台首页 -> 还能回后台」这条回路。
// 单向跳过去却回不来等于把人锁死在前台，所以回来那一步必须一起验。
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');
const BASE = 'http://localhost:3100';
const EXEC = 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
  ok ? pass++ : fail++;
}

(async () => {
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  const token = (await lr.json()).token;

  const browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.evaluate((t) => localStorage.setItem('as_token', t), token);

  // ---- 1) 后台页：品牌区应是一个指向前台的链接 ----
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const brandLink = page.locator('aside a[href="/"]').first();
  const href = await brandLink.getAttribute('href').catch(() => null);
  check('侧栏品牌区是指向前台的链接', href === '/', 'href=' + href);

  // ---- 2) 点 Logo -> 到前台 ----
  await brandLink.click();
  await page.waitForTimeout(900);
  check('点品牌区跳到前台首页', new URL(page.url()).pathname === '/', page.url());

  const frontText = await page.textContent('body');
  check('前台首页已渲染（资源广场）', /浏览|资源|立即浏览/.test(frontText), frontText.slice(0, 60).replace(/\s+/g, ' '));

  // ---- 3) 前台能回后台（否则等于单向跳，人会被锁在前台）----
  const backBtn = page.getByRole('button', { name: /进入后台|管理后台/ }).first();
  const hasBack = (await backBtn.count()) > 0;
  check('前台有「进入后台」入口', hasBack);
  if (hasBack) {
    await backBtn.click();
    await page.waitForTimeout(900);
    check('能从前台回到后台', /\/admin\//.test(page.url()), page.url());
  }

  // ---- 4) 侧栏折叠后 Logo 仍可点 ----
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const aside = page.locator('aside').first();
  const wBefore = (await aside.boundingBox()).width;
  await page.locator('header button, aside ~ * button').first().click().catch(() => {});
  // 折叠按钮在顶栏最左：用 title 或 aria 定位更稳
  const collapse = page.getByTitle(/折叠|收起|展开/).first();
  if (await collapse.count()) await collapse.click();
  await page.waitForTimeout(600);
  const wAfter = (await aside.boundingBox()).width;
  check('侧栏已折叠', wAfter < wBefore, `${wBefore} -> ${wAfter}`);
  await page.locator('aside a[href="/"]').first().click();
  await page.waitForTimeout(800);
  check('折叠态下点 Logo 仍能跳前台', new URL(page.url()).pathname === '/', page.url());

  await page.screenshot({ path: 'walkthrough/21-front-home.png', fullPage: true });
  await browser.close();
  console.log(`\n---- ${pass} passed, ${fail} failed ----`);
  process.exit(fail ? 1 : 0);
})();
