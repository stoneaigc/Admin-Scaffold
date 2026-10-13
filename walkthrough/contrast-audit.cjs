// walkthrough/contrast-audit.cjs
// 不依赖肉眼与截图的验证：直接采样元素「计算后颜色」，按 WCAG 2.1 计算对比度。
//
// 为什么需要它：深色模式最容易出的问题不是「不生效」（那能断言），
// 而是「生效了但文字看不清」。后者在截图里靠肉眼都容易放过，
// 程序化算对比度才能钉死。
//
// 同类问题也出现在浅色下的浅灰小字（如 text-ink-400 落在白底只有 3.6:1），
// 因此审计范围覆盖「用户管理」与「角色权限」两页，深浅两种模式。
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');
const fs = require('fs');
const DIR = 'D:/workbuddy_workspaces/fit2cloud-admin-scaffold/walkthrough';
const BASE = 'http://localhost:3100';

const AUDIT = (targets) => `(() => {
  function parse(s) {
    const m = String(s).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  }
  function over(fg, bg) {
    const a = fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  }
  // 逐级向上合成真实背景色（很多元素背景是透明的，不能只看自身）
  function bgOf(el) {
    const chain = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const rgba = parse(getComputedStyle(cur).backgroundColor);
      if (rgba[3] > 0.001) chain.push(rgba);
      cur = cur.parentElement;
    }
    let base = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (base[3] < 0.001) base = [255, 255, 255, 1];
    for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base);
    return base;
  }
  function lum(rgb) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  function ratio(a, b) {
    const l1 = lum(a), l2 = lum(b);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  const targets = ${JSON.stringify(targets)};
  const out = [];
  for (const [label, sel] of targets) {
    const el = document.querySelector(sel);
    if (!el) { out.push({ label, sel, missing: true }); continue; }
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const bg = bgOf(el);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // WCAG：大字（>=18.66px 粗体 或 >=24px）阈值 3.0，其余 4.5
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    out.push({
      label,
      sel,
      text: (el.textContent || '').trim().slice(0, 18),
      fontSize: size,
      bold: weight >= 700,
      fg: fg.slice(0, 3).map(Math.round).join(','),
      bg: bg.slice(0, 3).map(Math.round).join(','),
      ratio: Math.round(ratio(fg, bg) * 100) / 100,
      required: large ? 3.0 : 4.5,
    });
  }
  return out;
})()`;

const USER_TARGETS = [
  ['侧栏品牌名', 'aside .text-ink-900'],
  ['导航-激活项', 'aside nav a.router-link-active'],
  ['侧栏次要文字', 'aside .text-ink-500'],
  ['顶栏标题', 'header h1'],
  ['页头标题', 'main h2'],
  ['页头副标题', 'main p'],
  ['表头', 'thead th'],
  ['表格正文', 'tbody td .font-medium'],
  ['表格次要文字', 'tbody td .text-xs'],
  ['卡片边框区域文字', '.bg-panel'],
];

// 角色权限页：覆盖新布局里所有「小字 + 浅底」的组合，这些最容易踩线
const ROLES_TARGETS = [
  ['角色列表项名', 'button[data-role-id] .font-medium'],
  ['角色选中项名', 'button[data-role-id][class*="bg-brand-50"] .font-medium'],
  ['角色列表次行', 'button[data-role-id] .text-xs'],
  ['权限位标题', 'main h3'],
  ['已选计数徽章', '[data-testid="picked-count"]'],
  ['分组模块名', 'section[data-module] header .text-sm'],
  ['分组 module code', 'section[data-module] header code'],
  ['分组计数徽章', 'section[data-module] header span[class*="rounded-full"]'],
  ['权限项名（未选）', 'section[data-module] label:not([class*="bg-brand-50"]) .text-sm'],
  ['权限 key（未选）', 'section[data-module] label:not([class*="bg-brand-50"]) code'],
  ['权限项名（已选）', 'section[data-module] label[class*="bg-brand-50"] .text-sm'],
  ['权限 key（已选）', 'section[data-module] label[class*="bg-brand-50"] code'],
  ['底栏说明文字', 'main div[class*="border-t"] p'],
  ['主按钮文字', 'main button[class*="bg-brand-600"]'],
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
    args: ['--no-sandbox', '--no-proxy-server'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(700);
  await page.locator('input[placeholder="请输入用户名"]').fill('admin');
  await page.locator('input[placeholder="请输入密码"]').fill('admin123456');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/', { timeout: 8000 }).catch(() => {});

  async function setMode(mode) {
    await page.evaluate((m) => {
      localStorage.setItem('as_theme', JSON.stringify({ mode: m, accent: 'apple' }));
    }, mode);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
  }

  async function audit(path, targets) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    return page.evaluate(AUDIT(targets));
  }

  const lines = [];
  let badTotal = 0;
  const summarize = (rows, tag) => {
    lines.push(`\n===== ${tag} =====`);
    let bad = 0;
    for (const r of rows) {
      if (r.missing) {
        lines.push(`SKIP | ${r.label} | 选择器未命中 ${r.sel}`);
        bad++; // 选择器失效同样视为问题，否则会「静默全绿」
        continue;
      }
      const ok = r.ratio >= r.required;
      if (!ok) bad++;
      lines.push(
        `${ok ? 'PASS' : 'FAIL'} | ${r.label.padEnd(16)} | ${String(r.ratio).padStart(6)} (需 ${r.required}) | ${r.fontSize}px${r.bold ? ' bold' : ''} | 前景 ${r.fg} / 背景 ${r.bg} | "${r.text}"`
      );
    }
    lines.push(`-- ${tag}: ${rows.length - bad}/${rows.length} 达 AA`);
    badTotal += bad;
  };

  for (const mode of ['light', 'dark']) {
    await setMode(mode);
    summarize(await audit('/admin/users', USER_TARGETS), `${mode === 'light' ? '浅色' : '深色'}模式 · 用户管理`);
    summarize(await audit('/admin/roles', ROLES_TARGETS), `${mode === 'light' ? '浅色' : '深色'}模式 · 角色权限`);
  }

  const report = lines.join('\n');
  console.log(report);
  fs.writeFileSync(DIR + '/contrast-audit.txt', report);
  console.log(`\nCONTRAST_FAIL_TOTAL=${badTotal}`);
  await browser.close();
})();
