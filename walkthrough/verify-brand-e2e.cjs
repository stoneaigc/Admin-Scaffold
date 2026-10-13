// walkthrough/verify-brand-e2e.cjs
// 端到端验证「品牌落 DB」这条链路（M2）：
//   服务端 system_settings -> 公开 GET /api/brand -> 登录页/侧栏渲染
//   设置页改名字 -> PUT /api/admin/settings -> 落库 -> 刷新后仍在
// 只测后端不够：要证明前端真的从服务端取值，而不是继续读 localStorage 老数据。
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
  const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  // ---- 0) 前置：把服务端品牌设为一个已知值 ----
  // 不写死期望值：其他用例（如主题走查）会改品牌，写死会让本用例依赖「上一个脚本留下的状态」，
  // 串联跑就误报。这里先读现状、写入用例品牌，结束时再还原。
  const original = await (await fetch(BASE + '/api/brand')).json();
  const SERVER_NAME = '端到端用例品牌 ' + Date.now();
  await fetch(BASE + '/api/admin/settings', {
    method: 'PUT', headers: auth,
    body: JSON.stringify({ brand: { ...original, name: SERVER_NAME } }),
  });

  const browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // ---- 1) 登录页：清空本地缓存后，品牌应来自服务端 ----
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200); // 等异步品牌拉取完成
  const bodyText = await page.textContent('body');
  check('登录页渲染服务端品牌（本地缓存已清空）', bodyText.includes(SERVER_NAME),
    bodyText.includes(SERVER_NAME) ? '' : bodyText.slice(0, 120));
  const title = await page.title();
  check('浏览器标题取自服务端品牌', title.includes(SERVER_NAME), title);

  // ---- 2) 设置页：表单应回填服务端已持久化的品牌 ----
  await page.evaluate((t) => localStorage.setItem('as_token', t), token);
  await page.goto(BASE + '/admin/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const nameInput = page.getByPlaceholder('例如：飞致云控制台');
  const filled = await nameInput.inputValue();
  check('设置页表单回填服务端品牌', filled === SERVER_NAME, `got=${JSON.stringify(filled)}`);

  // ---- 3) UI 改名 -> 保存 -> 真正落库 ----
  const NEW = '石敢当测试台 ' + Date.now();
  await nameInput.fill(NEW);
  await page.getByRole('button', { name: '保存更改' }).click();
  await page.waitForTimeout(1200);

  const after = await (await fetch(BASE + '/api/brand')).json();
  check('UI 保存后落库（GET /api/brand 取到新名）', after.name === NEW, `got=${JSON.stringify(after.name)}`);

  // ---- 4) 刷新后仍在（证明不是只写进内存/localStorage）----
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const reloaded = await page.getByPlaceholder('例如：飞致云控制台').inputValue();
  check('刷新后表单仍是新名（DB -> UI 回路成立）', reloaded === NEW, `got=${JSON.stringify(reloaded)}`);

  // 还原成跑之前的值，避免污染后续演示数据
  await fetch(BASE + '/api/admin/settings', {
    method: 'PUT', headers: auth,
    body: JSON.stringify({ brand: original }),
  });
  const restored = await (await fetch(BASE + '/api/brand')).json();
  check('用例结束后品牌已还原', restored.name === original.name, `got=${JSON.stringify(restored.name)}`);

  await browser.close();
  console.log(`\n合计: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
