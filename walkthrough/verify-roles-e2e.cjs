/**
 * 角色权限页（RolesView）布局改造走查
 * 覆盖：左角色列表 / 右权限分组、默认展开、折叠、搜索、组内全选、保存落库、自定义删除确认
 */
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');

const BASE = 'http://localhost:3100';
const EXEC = 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  << ' + extra : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// v-show 隐藏的元素仍会被 count() 统计，必须显式用 :visible 判定可见性
const VISIBLE_ROWS = 'label:has(input[type=checkbox]):visible';

(async () => {
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  const token = (await lr.json()).token;
  const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  const rolesApi = await (await fetch(BASE + '/api/admin/roles', { headers: auth })).json();
  const userRole = rolesApi.find((r) => r.name === 'user');
  ok('前置：存在 user 角色', !!userRole, JSON.stringify(rolesApi.map((r) => r.name)));

  const browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrs = [];
  const httpErrs = [];
  let dialogSeen = false;
  page.on('dialog', (d) => { dialogSeen = true; d.dismiss().catch(() => {}); });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.evaluate((t) => localStorage.setItem('as_token', t), token);
  // 监听器在设好 token 之后才注册：登录前访问受保护接口的 401 属预期，不该进统计
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) httpErrs.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE + '/admin/roles', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // ---- 1) 左：角色列表 ----
  const roleListText = await page.locator('button[data-role-id]').first().textContent();
  ok('T1 左栏渲染角色列表', /admin/.test(roleListText), roleListText.trim().slice(0, 50));
  ok('T2 角色项显示成员/权限计数', /项权限/.test(roleListText), roleListText.trim().slice(0, 80));
  ok('T3 左栏有角色搜索框', (await page.getByPlaceholder('搜索角色…').count()) === 1);

  // ---- 2) 右：权限分组 ----
  let bodyText = await page.textContent('body');
  ok('T4 右栏标题显示当前角色', /权限位 · admin/.test(bodyText));
  ok('T5 有权限搜索框', (await page.getByPlaceholder('搜索权限…').count()) === 1);
  ok('T6 显示已选统计', /\d+ \/ 24 已选/.test(bodyText), (bodyText.match(/\d+ \/ 24 已选/) || [''])[0]);
  const mods = await page.locator('section[data-module]').evaluateAll((els) => els.map((e) => e.dataset.module));
  ok('T7 六个模块分组齐全', mods.join(',') === 'user,role,menu,resource,group,system', mods.join(','));

  // ---- 3) 默认全展开 + 密度 ----
  const visibleRows = await page.locator(VISIBLE_ROWS).count();
  ok('T8 默认全展开（24 个权限项可见）', visibleRows === 24, '实际 ' + visibleRows);

  const secUser = page.locator('section[data-module="user"]');
  const rowBoxes = await secUser.locator('label').evaluateAll(
    (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height) }; })
  );
  ok('T9 权限项为紧凑单行（高 ≤ 40px）', rowBoxes[0].h > 0 && rowBoxes[0].h <= 40, '高 ' + rowBoxes[0].h + 'px');
  const sameRow = rowBoxes.filter((b) => b.y === rowBoxes[0].y).length;
  ok('T10 分组内多列排布（同一行 ≥ 2 项）', sameRow >= 2, '同行 ' + sameRow + ' 项');
  const secUserH = await secUser.evaluate((e) => Math.round(e.getBoundingClientRect().height));
  ok('T11 「用户」组总高 < 140px（旧双列卡片约 300px）', secUserH < 140, secUserH + 'px');

  await page.screenshot({ path: 'walkthrough/23-roles-default.png', fullPage: true });

  // ---- 4) 折叠 ----
  await secUser.locator('header button').first().click();
  await sleep(350);
  ok('T12 折叠分组后其权限项隐藏', (await page.locator(VISIBLE_ROWS).count()) === 18,
    '剩余 ' + (await page.locator(VISIBLE_ROWS).count()));
  await secUser.locator('header button').first().click();
  await sleep(300);
  ok('T13 再次点击可展开', (await page.locator(VISIBLE_ROWS).count()) === 24);

  await page.getByRole('button', { name: '全部收起' }).click();
  await sleep(300);
  ok('T14 全部收起后无可见权限项', (await page.locator(VISIBLE_ROWS).count()) === 0);
  await page.screenshot({ path: 'walkthrough/24-roles-collapsed.png', fullPage: true });
  await page.getByRole('button', { name: '全部展开' }).click();
  await sleep(300);

  // ---- 5) 搜索 ----
  await page.getByPlaceholder('搜索权限…').fill('删除');
  await sleep(350);
  const searchRows = await page.locator(VISIBLE_ROWS).count();
  const searchText = await page.textContent('body');
  ok('T15 搜索过滤权限项', searchRows > 0 && searchRows < 24, '命中 ' + searchRows);
  ok('T16 搜索结果均为删除类权限', /用户删除/.test(searchText) && !/用户查看/.test(searchText));
  await page.screenshot({ path: 'walkthrough/25-roles-search.png', fullPage: true });
  await page.getByPlaceholder('搜索权限…').fill('');
  await sleep(300);

  // ---- 6) 组内全选 / 已选统计（切到 user 角色，避免 admin 全选无增量的假阴性）----
  const permsApi = await (await fetch(BASE + '/api/admin/permissions', { headers: auth })).json();
  const idsBefore = (await (await fetch(`${BASE}/api/admin/roles/${userRole.id}`, { headers: auth })).json()).permissionIds || [];
  // 预期增量 = 组内权限中该角色尚未拥有的数量（不能假设整组都是新增）
  const expectedAdd = permsApi.filter((p) => p.module === 'group' && !idsBefore.includes(p.id)).length;
  ok('前置：user 角色已有权限数已知', idsBefore.length >= 0, `${idsBefore.length} 项，组内将新增 ${expectedAdd} 项`);

  await page.locator(`button[data-role-id="${userRole.id}"]`).click();
  await sleep(700);
  ok('T17 切换到 user 角色', /权限位 · user/.test(await page.textContent('body')));

  const pickedOf = async () => Number((await page.textContent('body')).match(/(\d+) \/ 24 已选/)[1]);
  const before = await pickedOf();
  ok('T17b 已选数与该角色实际权限一致', before === idsBefore.length, `页面 ${before} / 接口 ${idsBefore.length}`);
  const secGroup = page.locator('section[data-module="group"]');
  await secGroup.getByRole('button', { name: '全选', exact: true }).click();
  await sleep(300);
  const after = await pickedOf();
  ok('T18 组内全选使已选数增加', after === before + expectedAdd, `${before} -> ${after}（预期 +${expectedAdd}）`);
  ok('T19 出现未保存提示', /有未保存的修改/.test(await page.textContent('body')));
  const groupBadge = (await secGroup.locator('span').filter({ hasText: /^\d+ \/ \d+$/ }).first().textContent()).trim();
  ok('T20 分组徽章同步（5 / 5）', groupBadge === '5 / 5', groupBadge);

  // ---- 7) 还原 ----
  await page.getByRole('button', { name: '还原' }).click();
  await sleep(300);
  ok('T21 还原回滚未保存改动', (await pickedOf()) === before, `${after} -> ${await pickedOf()}`);
  ok('T22 还原后未保存提示消失', !/有未保存的修改/.test(await page.textContent('body')));

  // ---- 8) 保存落库 ----
  await secGroup.getByRole('button', { name: '全选', exact: true }).click();
  await sleep(250);
  await page.getByRole('button', { name: '保存权限' }).click();
  await sleep(1000);
  ok('T23 保存后出现已保存提示', /已保存/.test(await page.textContent('body')));
  const idsAfter = (await (await fetch(`${BASE}/api/admin/roles/${userRole.id}`, { headers: auth })).json()).permissionIds || [];
  ok('T24 保存真实落库（role_permissions 增加）', idsAfter.length === idsBefore.length + expectedAdd,
    `${idsBefore.length} -> ${idsAfter.length}（预期 +${expectedAdd}）`);
  await fetch(`${BASE}/api/admin/roles/${userRole.id}/permissions`, {
    method: 'PUT', headers: auth, body: JSON.stringify({ permissionIds: idsBefore }),
  }); // 还原数据
  const idsRestored = (await (await fetch(`${BASE}/api/admin/roles/${userRole.id}`, { headers: auth })).json()).permissionIds || [];
  ok('T25 走查数据已还原', idsRestored.length === idsBefore.length, `${idsAfter.length} -> ${idsRestored.length}`);

  // ---- 9) 删除确认（自定义弹窗）----
  const tmp = await (await fetch(BASE + '/api/admin/roles', { method: 'POST', headers: auth, body: JSON.stringify({ name: '走查临时角色' }) })).json();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByPlaceholder('搜索角色…').fill('走查临时');
  await sleep(400);
  await page.locator('span[title="删除角色"]').first().click();
  await sleep(500);
  ok('T26 删除使用自定义确认弹窗', /确认删除角色/.test(await page.textContent('body')));
  ok('T27 未触发浏览器原生 confirm', dialogSeen === false);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await sleep(300);
  ok('T28 取消后角色仍在', (await (await fetch(BASE + '/api/admin/roles', { headers: auth })).json()).some((r) => r.id === tmp.id));
  await page.locator('span[title="删除角色"]').first().click();
  await sleep(400);
  await page.getByRole('button', { name: '删除', exact: true }).click();
  // 轮询等待删除落地，避免固定 sleep 与弹窗重渲染的竞态
  let gone = false;
  for (let i = 0; i < 12; i++) {
    await sleep(250);
    const list = await (await fetch(BASE + '/api/admin/roles', { headers: auth })).json();
    if (!list.some((r) => r.id === tmp.id)) { gone = true; break; }
  }
  ok('T29 确认后角色被删除', gone);

  // ---- 10) 控制台 / 接口 ----
  const realConsole = consoleErrs.filter((e) => !/favicon|Failed to load resource/i.test(e));
  ok('T30 控制台无未预期脚本错误', realConsole.length === 0, realConsole.slice(0, 2).join(' | '));
  ok('T31 无 4xx/5xx 接口错误', httpErrs.length === 0, httpErrs.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
