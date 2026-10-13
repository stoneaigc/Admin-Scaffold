/**
 * 扩展性验证：新增权限位 / 新增模块时，前端是否需要改代码？
 *
 * 做法是真的往 permissions 表插数据（含两个此前不存在的 module），
 * 断言页面自动多出对应分组与勾选项，最后清理。
 * 这条用例存在的意义：它是「后续权限扩张能不能直接用」这句话的唯一硬证据。
 */
const path = require('path');
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');

const ROOT = 'D:/workbuddy_workspaces/fit2cloud-admin-scaffold';
const BASE = 'http://localhost:3100';
const EXEC = 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

// db.js 通过 .env 读相对路径 ./data/app.db，因此 cwd 必须是 server 目录
process.chdir(path.join(ROOT, 'server'));
const db = require(path.join(ROOT, 'server', 'db'));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  << ' + extra : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NEW_PERMS = [
  ['audit', 'view', 'audit:view', '审计日志查看'],
  ['audit', 'export', 'audit:export', '审计日志导出'],
  ['billing', 'manage', 'billing:manage', '计费管理'],
];

(async () => {
  const token = (await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  })).json()).token;

  const before = (await (await fetch(BASE + '/api/admin/permissions', {
    headers: { Authorization: 'Bearer ' + token },
  })).json()).length;

  // ---- 写入三条新权限，覆盖两个全新模块 ----
  for (const [module, action, key, name] of NEW_PERMS) {
    await db.query(
      'INSERT INTO permissions (module, action, key, name) VALUES ($1, $2, $3, $4)',
      [module, action, key, name]
    );
  }

  const browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.evaluate((t) => localStorage.setItem('as_token', t), token);
  await page.goto(BASE + '/admin/roles', { waitUntil: 'networkidle' });
  await sleep(1600);

  const mods = await page.locator('section[data-module]').evaluateAll((els) => els.map((e) => e.dataset.module));
  ok('T1 新模块自动成组（无需改前端）', mods.includes('audit') && mods.includes('billing'), mods.join(','));
  ok('T2 未登记中文名的模块排在已登记模块之后', mods.slice(-2).join(',') === 'audit,billing', mods.join(','));

  const bodyText = await page.textContent('body');
  ok('T3 未登记中文名的模块回退显示原始 module 名', /audit/.test(bodyText) && /billing/.test(bodyText));
  ok('T4 新权限项出现在页面上', /审计日志查看/.test(bodyText) && /计费管理/.test(bodyText));

  const rows = await page.locator('label:has(input[type=checkbox]):visible').count();
  ok('T5 权限项总数按库自动增长', rows === before + NEW_PERMS.length, `${before} + ${NEW_PERMS.length} -> ${rows}`);

  const badge = await page.textContent('[data-testid="picked-count"]');
  ok('T6 已选分母同步为新总数', badge.includes('/ ' + (before + NEW_PERMS.length)), badge.trim());

  // 新分组内的全选应可用（说明动态生成的分组不是「只读展示」）
  const secAudit = page.locator('section[data-module="audit"]');
  await secAudit.getByRole('button', { name: '全选', exact: true }).click();
  await sleep(300);
  ok('T7 动态新增的分组可正常勾选（2 项）',
    (await page.textContent('[data-testid="picked-count"]')).includes('3 / ' + (before + NEW_PERMS.length)),
    (await page.textContent('[data-testid="picked-count"]')).trim());

  // 先滚回顶部再截图：fullPage 截图在非零滚动位置下会让 sticky 侧栏重复渲染
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await page.screenshot({ path: path.join(ROOT, 'walkthrough', '28-roles-extended.png'), fullPage: true });
  await page.getByRole('button', { name: '还原' }).click();

  // ---- 清理 ----
  await db.query("DELETE FROM permissions WHERE module IN ('audit', 'billing')");
  const after = (await (await fetch(BASE + '/api/admin/permissions', {
    headers: { Authorization: 'Bearer ' + token },
  })).json()).length;
  ok('T8 用例数据已清理（权限数复原）', after === before, `${rows} -> ${after}`);

  await browser.close();
  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
