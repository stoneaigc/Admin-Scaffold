// walkthrough/verify-groups-e2e.cjs
// 端到端验证「资源组」管理界面（菜单转正 + GroupsView）：
//   侧栏菜单可点 -> 建组 -> 勾资源保存 -> 刷新后回显（证明走了 DB 而非内存）
//   -> 成员 Tab 保存 -> 列表计数同步 -> 删除组
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');
const BASE = 'http://localhost:3100';
const EXEC = 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const NAME = 'E2E组' + Date.now();

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
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  // 清理历次运行残留（只删本脚本自己建的 E2E组*，不动用户数据）
  const stale = await (await fetch(BASE + '/api/admin/groups', { headers: H })).json();
  for (const g of stale) {
    if (String(g.name).startsWith('E2E组')) {
      await fetch(BASE + '/api/admin/groups/' + g.id, { method: 'DELETE', headers: H });
    }
  }

  const browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // 原生 confirm 已被自绘弹窗取代：这里改成「记录但不依赖」，顺带断言它不再出现
  let nativeDialog = false;
  page.on('dialog', (d) => { nativeDialog = true; d.accept(); });

  // 按 URL 判定，而不是看 console 文本（那条 "Failed to load resource: 404" 不带 URL，
  // 既没法证明是 favicon，如实报又会掩盖真问题）
  const bad = [];
  page.on('response', (r) => {
    if (r.status() < 400) return;
    if (/favicon/.test(r.url())) return;
    if (r.status() === 401 && /\/api\/auth\/me/.test(r.url())) return; // 未注入 token 时的预期 401
    bad.push(r.status() + ' ' + r.url());
  });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.evaluate((t) => localStorage.setItem('as_token', t), token);

  // ---- 1) 侧栏「资源组」不再是 soon 占位，可点击跳转 ----
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const menu = page.locator('aside').getByText('资源组', { exact: true });
  const menuCount = await menu.count();
  check('侧栏出现「资源组」菜单', menuCount > 0, 'count=' + menuCount);
  await menu.first().click();
  await page.waitForTimeout(800);
  check('菜单可点击并跳转 /admin/groups', page.url().endsWith('/admin/groups'), page.url());

  // ---- 2) 空态（新库无组）----
  const emptyOrList = await page.textContent('body');
  check('页面渲染出资源组视图', emptyOrList.includes('白名单授权') || emptyOrList.includes('暂无资源组'),
    emptyOrList.slice(0, 80).replace(/\s+/g, ' '));

  // ---- 3) 新建组 ----
  await page.getByRole('button', { name: '新建资源组' }).click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('资源组名称').fill(NAME);
  await page.getByRole('button', { name: '创建' }).click();
  await page.waitForTimeout(1200);
  const afterCreate = await page.textContent('body');
  check('新建后左侧列表出现该组', afterCreate.includes(NAME));

  // ---- 4) 新建后自动选中该组，右侧直接进入资源配置 ----
  // 注意：别用「组内资源」做断言，PageHeader 副标题里也有这五个字，会误匹配
  let selected = false;
  try {
    await page.getByText('0 项已选', { exact: true }).waitFor({ timeout: 5000 });
    selected = true;
  } catch {}
  check('新建后自动选中该组（右侧出现资源勾选面板）', selected);

  // ---- 5) 勾选一个资源并保存 ----
  await page.getByText('gateway', { exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: '保存资源授权' }).click();
  await page.waitForTimeout(1000);
  const savedToast = await page.textContent('body');
  check('保存后出现成功提示', savedToast.includes('已保存'));

  // ---- 6) 刷新后勾选仍在（DB -> UI 回路）----
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('button', { hasText: NAME }).first().click();
  await page.waitForTimeout(1000);
  const badge = await page.textContent('body');
  check('刷新后资源勾选回显（1 项已选）', badge.includes('1 项已选'), '');

  // ---- 7) 成员 Tab：勾选 admin 并保存 ----
  // 只定位 Tab 条上的按钮；用 role+name 会撞上左侧组列表（组名行里也有「成员」二字）
  await page.locator('button.border-b-2', { hasText: '成员' }).click();
  await page.waitForTimeout(600);
  await page.getByText('admin', { exact: true }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: '保存成员' }).click();
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const memberBody = await page.textContent('body');
  check('成员数写入列表计数（1 名成员）', memberBody.includes('1 名成员'), '');

  // ---- 8) 删除组（走自绘确认弹窗，不再是原生 confirm）----
  await page.locator('button', { hasText: NAME }).first().locator('button[title="删除资源组"]').click();
  await page.waitForTimeout(500);
  check('删除弹出确认框而非原生 confirm', /确认删除资源组/.test(await page.textContent('body')));
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.waitForTimeout(1200);
  // 用接口复核而不是页面文本：删除成功提示里也含组名，会被 includes 误判成「还在列表里」
  const left = await (await fetch(BASE + '/api/admin/groups', { headers: H })).json();
  check('删除后列表中不再有该组', !left.some((g) => g.name === NAME),
    '剩余: ' + left.map((g) => g.name).join(','));
  check('删除成功有明确反馈', /已删除资源组/.test(await page.textContent('body')));

  // ---- 9) 无非预期 HTTP 错误（favicon 404 / me 401 已白名单）----
  check('无非预期 HTTP 错误', bad.length === 0, bad.slice(0, 3).join(' | '));
  check('全程未使用原生 confirm', !nativeDialog);

  await page.screenshot({ path: 'walkthrough/19-groups.png', fullPage: true });
  await browser.close();
  console.log(`\n---- ${pass} passed, ${fail} failed ----`);
  process.exit(fail ? 1 : 0);
})();
