// walkthrough/verify-frontend-hardening.cjs
// 前端对抗用例：专测「肉眼看不出来、但会静默出错」的交互。
//   1) 弹窗可访问性（role/Esc/焦点陷阱/滚动锁）
//   2) 角色切换竞态（慢请求后返回会不会把勾选盖到新角色上）
//   3) 写操作失败是否有反馈（重名建用户、删除失败）
//   4) 是否还在用原生 confirm
//   5) 用户列表是否带分页参数（否则超过一页的人直接消失）
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');
const BASE = 'http://localhost:3100';
const EXEC = 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
  cond ? pass++ : fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  const token = (await lr.json()).token;
  const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  const browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  let nativeDialog = false;
  page.on('dialog', (d) => { nativeDialog = true; d.dismiss().catch(() => {}); });
  const userReqUrls = [];
  const pageErrs = [];
  page.on('request', (r) => { if (/\/api\/admin\/users(\?|$)/.test(r.url())) userReqUrls.push(r.url()); });
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.evaluate((t) => localStorage.setItem('as_token', t), token);

  // 监听从「设好 token」之后开始：登录页在未登录状态下打 /api/auth/me 必然 401，
  // 那是预期行为，算进来只会淹没真正的失败。
  page.on('pageerror', (e) => pageErrs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') pageErrs.push(m.text()); });
  // 按 URL 判定真实 HTTP 失败：console 里的 "Failed to load resource" 不带 URL，
  // 没法区分 favicon 404 与接口 500，容易误报也容易掩盖真问题
  const httpErrs = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) httpErrs.push(r.status() + ' ' + r.url());
  });

  // ============================================================ 1. 弹窗可访问性
  console.log('\n--- 弹窗可访问性 ---');
  await page.goto(BASE + '/admin/roles', { waitUntil: 'networkidle' });
  await page.waitForSelector('button[data-role-id]', { timeout: 10000 });
  await sleep(800);

  await page.getByRole('button', { name: '新建角色' }).click();
  await page.waitForTimeout(400);

  const dialog = page.locator('[role="dialog"]');
  ok('T01 弹窗带 role="dialog"', (await dialog.count()) === 1, 'count=' + (await dialog.count()));
  ok('T02 弹窗带 aria-modal="true"', (await dialog.getAttribute('aria-modal')) === 'true');
  const labelledby = await dialog.getAttribute('aria-labelledby');
  ok('T03 aria-labelledby 指向存在的标题节点',
    !!labelledby && (await page.locator('#' + labelledby).count()) === 1, String(labelledby));

  // 焦点应已移入弹窗
  const focusInside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return !!d && d.contains(document.activeElement);
  });
  ok('T04 打开后焦点移入弹窗内', focusInside);

  // 背景滚动应被锁住
  const scrollLocked = await page.evaluate(() => getComputedStyle(document.body).position === 'fixed');
  ok('T05 打开时锁定背景滚动', scrollLocked);

  // Tab 循环：连按 8 次焦点仍应在弹窗内
  let escaped = false;
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return !!d && d.contains(document.activeElement);
    });
    if (!inside) { escaped = true; break; }
  }
  ok('T06 Tab 循环被限制在弹窗内（焦点陷阱）', !escaped);

  // Esc 关闭
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok('T07 Esc 可关闭弹窗', (await page.locator('[role="dialog"]').count()) === 0);
  const scrollRestored = await page.evaluate(() => getComputedStyle(document.body).position !== 'fixed');
  ok('T08 关闭后解除滚动锁', scrollRestored);

  // ============================================================ 2. 角色切换竞态
  console.log('\n--- 角色切换竞态 ---');
  const roles = await (await fetch(BASE + '/api/admin/roles', { headers: auth })).json();
  const adminRole = roles.find((r) => r.name === 'admin');
  const userRole = roles.find((r) => r.name === 'user');
  const userPerms = await (await fetch(BASE + '/api/admin/roles/' + userRole.id, { headers: auth })).json();
  const adminPerms = await (await fetch(BASE + '/api/admin/roles/' + adminRole.id, { headers: auth })).json();
  ok('T09 两个角色权限数不同（用例前提）',
    (userPerms.permissionIds || []).length !== (adminPerms.permissionIds || []).length,
    `admin=${adminPerms.permissionIds.length} user=${userPerms.permissionIds.length}`);

  // 让「第一个详情页请求」慢、第二个快 —— 制造后发先至
  let seq = 0;
  await page.route('**/api/admin/roles/*', async (route) => {
    const n = ++seq;
    await sleep(n === 1 ? 2500 : 300);
    await route.continue();
  });
  await page.goto(BASE + '/admin/roles', { waitUntil: 'networkidle' });
  await page.waitForSelector('button[data-role-id]', { timeout: 10000 });
  // 页面默认选中 admin（触发第 1 个慢请求），趁它没返回立刻切到 user
  await sleep(300);
  await page.locator(`button[data-role-id="${userRole.id}"]`).click();
  await sleep(3200); // 等慢请求也回来，若没有防竞态此时会被覆盖成 admin 的勾选

  const picked = Number((await page.textContent('body')).match(/(\d+) \/ \d+ 已选/)[1]);
  ok('T10 ★慢请求后返回不会覆盖新角色的勾选',
    picked === (userPerms.permissionIds || []).length,
    `显示 ${picked}，user 实际 ${userPerms.permissionIds.length}`);
  ok('T11 切换完成后不应出现「未保存修改」误报',
    !/有未保存的修改/.test(await page.textContent('body')));
  await page.unroute('**/api/admin/roles/*');

  // ============================================================ 3. 写操作失败反馈
  console.log('\n--- 写操作失败反馈 ---');
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await sleep(1200);

  ok('T12 用户列表请求带分页参数', userReqUrls.some((u) => /page=1&pageSize=20/.test(u)),
    userReqUrls.slice(-1)[0] || '无请求');

  await page.getByRole('button', { name: '新建用户' }).click();
  await page.waitForTimeout(400);
  await page.locator('[role="dialog"] input').first().fill('admin'); // 必然重名
  await page.locator('[role="dialog"] input').nth(2).fill('123456');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await sleep(1200);
  const bodyText = await page.textContent('body');
  ok('T13 重名建用户时给出错误提示', /已存在|失败/.test(bodyText), (bodyText.match(/用户名已存在[^。]*/) || ['无'])[0]);
  ok('T14 失败后弹窗保持打开（不静默关闭）', (await page.locator('[role="dialog"]').count()) === 1);

  // ============================================================ 4. 原生 confirm 已清除
  console.log('\n--- 原生 confirm ---');
  await page.keyboard.press('Escape');
  await sleep(400);
  const delBtn = page.locator('button[aria-label="删除用户"]').first();
  if (await delBtn.count()) {
    await delBtn.click();
    await sleep(500);
    ok('T15 删除走自绘弹窗而非原生 confirm', /确认删除用户/.test(await page.textContent('body')));
    ok('T16 全程未触发原生 dialog', !nativeDialog);
    await page.keyboard.press('Escape');
  } else {
    ok('T15 删除走自绘弹窗而非原生 confirm', true, '无可删用户，跳过');
    ok('T16 全程未触发原生 dialog', !nativeDialog);
  }

  // ============================================================ 5. 脚本错误
  console.log('\n--- 脚本错误 ---');
  // 409 是本用例 T13 刻意制造的重名冲突，属于预期；其余 4xx/5xx 都算问题
  const real = httpErrs.filter((e) => !/^409 .*\/api\/admin\/users/.test(e));
  ok('T17 全流程无未预期的 HTTP 失败', real.length === 0, real.slice(0, 2).join(' | '));

  // 未捕获的 JS 异常会造成「点了没反应」这类最难排查的故障，单独盯
  const crashes = pageErrs.filter((e) => e.startsWith('pageerror'));
  ok('T18 无未捕获的脚本异常', crashes.length === 0, crashes.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\nFRONTEND_HARDENING passed=${pass} failed=${fail}`);
  process.exit(fail ? 1 : 0);
})();
