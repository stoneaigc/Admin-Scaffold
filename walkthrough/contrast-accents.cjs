/**
 * 强调色矩阵审计：6 个主题色 × 浅/深两模式，验证关键组合的对比度。
 *
 * 为什么单独做：brand 色阶是运行时按主题色生成的，改一处 ramp 逻辑会影响全部 6 套配色。
 * 只测「苹果蓝」会漏掉青碧/松绿/赤橙这类原色亮度本就不达标的色。
 */
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');
const fs = require('fs');
const BASE = 'http://localhost:3100';
const DIR = 'D:/workbuddy_workspaces/fit2cloud-admin-scaffold/walkthrough';
const EXEC = 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

const ACCENTS = ['apple', 'indigo', 'teal', 'green', 'orange', 'violet'];

const PROBE = `(() => {
  function parse(s) {
    const m = String(s).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  }
  function over(fg, bg) { const a = fg[3]; return [fg[0]*a+bg[0]*(1-a), fg[1]*a+bg[1]*(1-a), fg[2]*a+bg[2]*(1-a), 1]; }
  function bgOf(el) {
    const chain = []; let cur = el;
    while (cur && cur.nodeType === 1) {
      const rgba = parse(getComputedStyle(cur).backgroundColor);
      if (rgba[3] > 0.001) chain.push(rgba);
      cur = cur.parentElement;
    }
    let base = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (base[3] < 0.001) base = [255,255,255,1];
    for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base);
    return base;
  }
  function lum(rgb) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(rgb[0]) + 0.7152*f(rgb[1]) + 0.0722*f(rgb[2]);
  }
  const ratio = (a,b) => { const l1=lum(a), l2=lum(b); const hi=Math.max(l1,l2), lo=Math.min(l1,l2); return (hi+0.05)/(lo+0.05); };
  const targets = [
    ['主按钮(白字 on 600)', 'main button[class*="bg-brand-600"]'],
    ['已选计数徽章', '[data-testid="picked-count"]'],
    ['权限项名(已选 700 on 50/60)', 'section[data-module] label[class*="bg-brand-50"] .text-sm'],
    ['分组模块名', 'section[data-module] header .text-sm'],
  ];
  const out = [];
  for (const [label, sel] of targets) {
    const el = document.querySelector(sel);
    if (!el) { out.push({ label, sel, missing: true }); continue; }
    const cs = getComputedStyle(el);
    const fg = parse(cs.color), bg = bgOf(el);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    out.push({
      label, text: (el.textContent||'').trim().slice(0,14),
      fg: fg.slice(0,3).map(Math.round).join(','), bg: bg.slice(0,3).map(Math.round).join(','),
      ratio: Math.round(ratio(fg,bg)*100)/100, required: large ? 3.0 : 4.5,
    });
  }
  return out;
})()`;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.locator('input[placeholder="请输入用户名"]').fill('admin');
  await page.locator('input[placeholder="请输入密码"]').fill('admin123456');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/', { timeout: 8000 }).catch(() => {});

  const lines = [];
  let bad = 0, total = 0;

  for (const accent of ACCENTS) {
    for (const mode of ['light', 'dark']) {
      await page.evaluate(({ a, m }) => {
        localStorage.setItem('as_theme', JSON.stringify({ mode: m, accent: a }));
      }, { a: accent, m: mode });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(900);
      await page.goto(BASE + '/admin/roles', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1300);
      const rows = await page.evaluate(PROBE);
      const tag = `${accent.padEnd(7)} ${mode.padEnd(5)}`;
      const bads = [];
      for (const r of rows) {
        total++;
        if (r.missing) { bad++; bads.push(`${r.label}=选择器未命中`); continue; }
        if (r.ratio < r.required) { bad++; bads.push(`${r.label}=${r.ratio}(需${r.required})`); }
      }
      lines.push(`${bads.length ? 'FAIL' : 'PASS'} | ${tag} | ${rows.filter(r=>!r.missing).map(r=>r.ratio).join(' / ')}${bads.length ? '  << ' + bads.join(', ') : ''}`);
      if (bad) lines.push(`       详情: ${rows.map(r=>`${r.label} fg=${r.fg} bg=${r.bg}`).join(' | ')}`);
    }
  }

  // 复位为默认配色
  await page.evaluate(() => localStorage.setItem('as_theme', JSON.stringify({ mode: 'light', accent: 'apple' })));

  const report = lines.join('\n');
  console.log(report);
  console.log(`\nACCENT_CHECKS=${total} FAIL=${bad}`);
  fs.writeFileSync(DIR + '/contrast-accents.txt', report);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
