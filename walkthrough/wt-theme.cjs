// walkthrough/wt-theme.cjs
// 本轮（侧栏折叠 / 主题切换 / 系统设置）的 UI 走查 + 行为断言。
//
// 说明：不只截图，还对关键行为做程序化断言 —— 折叠后的侧栏宽度、暗色类名是否挂上、
// 主题色 CSS 变量是否真的变了、系统设置里改名是否真的作用到侧栏。
// 只截图容易「看着像对的」，断言才能把回归钉死。
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');
const fs = require('fs');
const DIR = 'D:/workbuddy_workspaces/fit2cloud-admin-scaffold/walkthrough';
const BASE = 'http://localhost:3100';

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail: String(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
    args: ['--no-sandbox', '--no-proxy-server'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const log = [];
  page.on('console', (m) => {
    if (m.type() === 'error') log.push(m.text());
  });
  page.on('pageerror', (e) => log.push('PAGEERR: ' + e.message));
  const shot = (n) => page.screenshot({ path: `${DIR}/${n}` });
  const wait = (ms) => page.waitForTimeout(ms);

  const asideWidth = async () => {
    const box = await page.locator('aside').boundingBox();
    return box ? Math.round(box.width) : -1;
  };
  const cssVar = (v) =>
    page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), v);

  try {
    // ---------------- 登录 / 首页 / 基础页 ----------------
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {});
    await wait(900);
    await shot('01-login.png');
    check('登录页渲染（浅色 hero）', (await page.locator('body').innerText()).includes('登 录'));

    await page.locator('input[placeholder="请输入用户名"]').fill('admin');
    await page.locator('input[placeholder="请输入密码"]').fill('admin123456');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/', { timeout: 8000 }).catch(() => {});
    await wait(1200);

    // 注意：登录后落地页是「第一个可见的后台菜单」（这里是 /admin/users），
    // 所以必须显式访问 / 才能截到营销首页，否则 02 与 03 会是同一张图。
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }).catch(() => {});
    await wait(1600);
    await shot('02-home.png');
    check('营销首页渲染', (await page.locator('body').innerText()).includes('一站式资源自助平台'));

    await page.goto(`${BASE}/admin/users`);
    await wait(1500);
    await shot('03-users.png');
    const usersText = await page.locator('body').innerText();
    check('用户页正常态（非错误态）', usersText.includes('admin') && !usersText.includes('加载失败'));

    // ---------------- 侧栏折叠 ----------------
    const wExpanded = await asideWidth();
    await page.locator('button[title="收起侧栏"]').click();
    await wait(600);
    const wCollapsed = await asideWidth();
    await shot('12-sidebar-collapsed.png');
    check(
      '侧栏折叠：宽度 240 → 68',
      wExpanded === 240 && wCollapsed === 68,
      `${wExpanded} → ${wCollapsed}`
    );

    const collapsedState = await page.evaluate(() => localStorage.getItem('as_sidebar'));
    check('折叠状态已持久化', collapsedState === '1', `as_sidebar=${collapsedState}`);

    // 折叠态图标仍在（导航未消失）
    const navIcons = await page.locator('aside nav a svg').count();
    check('折叠后导航图标仍渲染', navIcons >= 3, `svg=${navIcons}`);

    await page.locator('button[title="展开侧栏"]').click();
    await wait(500);
    check('可再次展开：宽度回到 240', (await asideWidth()) === 240, `w=${await asideWidth()}`);

    // ---------------- 角色页 / 错误态 ----------------
    await page.goto(`${BASE}/admin/roles`);
    await wait(1500);
    await shot('04-roles.png');

    // 请求现在带 ?page=&pageSize=，glob 末尾不再精确匹配，用正则覆盖带参形式
    await page.route(/\/api\/admin\/users(\?|$)/, (r) => r.fulfill({ status: 500, body: 'Server Error' }));
    await page.goto(`${BASE}/admin/users`);
    await wait(1500);
    await shot('05-users-error.png');
    check('错误态展示（拦截 500）', (await page.locator('body').innerText()).includes('加载失败'));

    await page.unroute(/\/api\/admin\/users(\?|$)/);
    await page.locator('button').filter({ hasText: '重试' }).click().catch(() => {});
    await wait(1500);
    await shot('06-users-recovered.png');
    check('重试后可恢复数据', !(await page.locator('body').innerText()).includes('加载失败'));

    await page.route('**/api/admin/roles', (r) => r.fulfill({ status: 500, body: 'Server Error' }));
    await page.goto(`${BASE}/admin/roles`);
    await wait(1500);
    await shot('07-roles-error.png');
    await page.unroute('**/api/admin/roles');

    // ---------------- 系统设置：四个 Tab ----------------
    await page.goto(`${BASE}/admin/settings`);
    await wait(1500);
    await shot('08-settings-brand.png');
    const brandText = await page.locator('body').innerText();
    check('系统设置页可访问', brandText.includes('系统设置') && brandText.includes('品牌信息'));
    check(
      '四个 Tab 齐全',
      ['基础信息', '外观主题', '邮件配置', '第三方登录'].every((t) => brandText.includes(t))
    );
    check('出现「品牌信息」表单', brandText.includes('系统名称') && brandText.includes('Logo'));

    await page.locator('button').filter({ hasText: '外观主题' }).first().click();
    await wait(600);
    await shot('09-settings-appearance.png');
    const appearanceText = await page.locator('body').innerText();
    check(
      '外观 Tab：模式 + 主题色 + 界面偏好',
      ['外观模式', '主题色', '默认收起侧栏', '界面密度', '圆角风格'].every((t) =>
        appearanceText.includes(t)
      )
    );

    await page.locator('button').filter({ hasText: '邮件配置' }).first().click();
    await wait(600);
    await shot('10-settings-email.png');
    const emailText = await page.locator('body').innerText();
    check(
      '邮件 Tab：SMTP 字段齐全',
      ['SMTP 服务器', '端口', '加密方式', '发件人邮箱', 'SMTP 密码'].every((t) =>
        emailText.includes(t)
      )
    );
    // M3 后邮件已真实接入（SMTP 可发信），这里改成断言「不再标注占位」；
    // 第三方登录仍是 UI 占位，那条断言保持不变。
    check('邮件 Tab 不再标注「待接入」', !emailText.includes('UI 占位') && !emailText.includes('待实现'));
    check('邮件 Tab 说明已接入发信能力', emailText.includes('sendMail') || emailText.includes('已接入'));

    await page.locator('button').filter({ hasText: '第三方登录' }).first().click();
    await wait(600);
    const oauthText0 = await page.locator('body').innerText();
    check(
      '第三方登录：企微 / 钉钉 / 飞书 三卡片',
      ['企业微信', '钉钉', '飞书'].every((t) => oauthText0.includes(t))
    );

    // 展开第一个（企业微信）配置。
    // 注意：不能用 hasText:'配置' —— 「邮件配置」Tab 按钮也含该子串，会点错元素。
    // 用按钮可访问名精确匹配。
    await page.getByRole('button', { name: '配置', exact: true }).first().click();
    await wait(600);
    await shot('11-settings-oauth.png');
    const oauthText = await page.locator('body').innerText();
    check(
      '企微配置项展开（CorpID/AgentID/Secret）',
      ['CorpID', 'AgentID', 'Secret', '回调地址'].every((t) => oauthText.includes(t))
    );
    const cb = await page.locator('input[readonly]').first().inputValue().catch(() => '');
    check('回调地址自动生成', /\/api\/oauth\/wecom\/callback$/.test(cb), cb);

    // ---------------- 主题切换：模式 ----------------
    const inkLight = await cssVar('--ink-50');
    await page.locator('button[title="主题外观"]').click();
    await wait(400);
    await shot('15-theme-dropdown.png');
    const ddText = await page.locator('[role="dialog"]').first().innerText();
    check(
      '主题下拉内容（模式 + 主题色）',
      ['外观模式', '主题色', '浅色', '深色', '跟随系统'].every((t) => ddText.includes(t))
    );

    await page.locator('[role="dialog"] button').filter({ hasText: '深色' }).first().click();
    await wait(600);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const inkDark = await cssVar('--ink-50');
    check('切换到深色：html.dark 生效', isDark);
    check('深色令牌生效（--ink-50 变化）', inkLight !== inkDark, `${inkLight} → ${inkDark}`);
    const stored = await page.evaluate(() => localStorage.getItem('as_theme'));
    check('主题偏好已持久化', !!stored && stored.includes('dark'), stored);

    await page.keyboard.press('Escape');
    await page.goto(`${BASE}/admin/users`);
    await wait(1500);
    await shot('13-dark-users.png');

    await page.goto(`${BASE}/admin/settings`);
    await wait(1400);
    await page.locator('button').filter({ hasText: '第三方登录' }).first().click();
    await wait(500);
    await page.getByRole('button', { name: '配置', exact: true }).first().click();
    await wait(600);
    await shot('14-dark-settings-oauth.png');

    // ---------------- 主题色切换（运行时换色） ----------------
    await page.locator('button[title="主题外观"]').click();
    await wait(400);
    const brandBefore = await cssVar('--brand-500');
    await page.locator('[role="dialog"] button[aria-label="紫罗兰"]').click();
    await wait(500);
    const brandAfter = await cssVar('--brand-500');
    await shot('16-accent-violet.png');
    check('运行时换主题色（--brand-500 变化）', brandBefore !== brandAfter, `${brandBefore} → ${brandAfter}`);

    // 恢复默认（浅色 + 苹果蓝）
    await page.locator('[role="dialog"] button').filter({ hasText: '恢复默认' }).click();
    await wait(500);
    const backLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
    const brandReset = await cssVar('--brand-500');
    check('恢复默认：回到浅色 + 苹果蓝', backLight && brandReset === '0 113 227', brandReset);
    await page.keyboard.press('Escape');
    await wait(300);

    // ---------------- 系统设置改名 -> 侧栏实时生效 ----------------
    await page.goto(`${BASE}/admin/settings`);
    await wait(1400);
    const NEW_NAME = '飞致云统一控制台';
    await page.locator('input[type="text"]').first().fill(NEW_NAME);
    await page.locator('button').filter({ hasText: '保存更改' }).click();
    await wait(900);
    const asideText = await page.locator('aside').innerText();
    check('改名后侧栏实时生效', asideText.includes(NEW_NAME), asideText.replace(/\n/g, ' / ').slice(0, 60));
    await shot('17-brand-renamed.png');

    // 复原
    await page.locator('button').filter({ hasText: '恢复默认' }).click();
    await wait(400);
    await page.locator('button').filter({ hasText: '保存更改' }).click();
    await wait(800);
    const asideRestored = await page.locator('aside').innerText();
    check('恢复默认后品牌名回退', asideRestored.includes('Admin Scaffold'), asideRestored.split('\n')[0]);

    // ---------------- 移动端抽屉 ----------------
    // 注意：移动端 aside 是 fixed + -translate-x-full，boundingBox 仍能取到盒子，
    // 因此不能断言「宽度」，要看 x 位移是否真的滑出/滑回。
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(500);
    await page.goto(`${BASE}/admin/users`);
    await wait(1500);
    const boxClosed0 = await page.locator('aside').boundingBox();
    check('移动端默认收起（侧栏滑出屏外）', boxClosed0.x <= -200, `x=${Math.round(boxClosed0.x)}`);

    await page.locator('button[title="打开菜单"]').click();
    await wait(700);
    const boxOpen = await page.locator('aside').boundingBox();
    await shot('18-mobile-drawer.png');
    check(
      '移动端抽屉可滑出',
      Math.abs(boxOpen.x) <= 2,
      `x ${Math.round(boxClosed0.x)} → ${Math.round(boxOpen.x)}`
    );

    await page
      .locator('div.fixed.inset-0')
      .first()
      .click({ position: { x: 350, y: 700 } })
      .catch(() => {});
    await wait(700);
    const boxClosed1 = await page.locator('aside').boundingBox();
    check('点遮罩可收起抽屉', boxClosed1.x <= -200, `x=${Math.round(boxClosed1.x)}`);
  } catch (e) {
    log.push('SCRIPT_ERROR: ' + e.message);
    await shot('err-unexpected.png');
  }

  fs.writeFileSync(DIR + '/console-errors.txt', log.join('\n'));
  fs.writeFileSync(DIR + '/theme-checks.json', JSON.stringify(checks, null, 2));
  const failed = checks.filter((c) => !c.ok);
  console.log(`\nCHECKS total=${checks.length} failed=${failed.length}`);
  await browser.close();
})();
