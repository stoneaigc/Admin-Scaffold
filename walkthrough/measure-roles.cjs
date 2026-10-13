/**
 * 量测角色权限页的纵向占用（用于改前/改后对比）
 * 用法: node walkthrough/measure-roles.cjs "标签"
 */
const { chromium } = require('D:/nodejs/node_global/node_modules/@playwright/cli/node_modules/playwright-core');
const BASE = 'http://localhost:3100';
const EXEC = 'E:/FIT2CLOUD/caches/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const label = process.argv[2] || 'measure';

(async () => {
  const t = (await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  })).json()).token;

  const b = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.evaluate((x) => localStorage.setItem('as_token', x), t);
  await p.goto(BASE + '/admin/roles', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);

  const m = await p.evaluate(() => {
    // 权限区：包含「权限位 ·」标题的那张卡片，取其纵向占用
    const cards = [...document.querySelectorAll('div.bg-panel')];
    const panel = cards.find((c) => /权限位 ·/.test(c.textContent));
    const rect = panel ? panel.getBoundingClientRect() : null;
    const checkboxRows = [...document.querySelectorAll('label')].filter((l) => l.querySelector('input[type=checkbox]'));
    const rowYs = [...new Set(checkboxRows.map((l) => Math.round(l.getBoundingClientRect().y)))];
    return {
      page: document.documentElement.scrollHeight,
      permPanel: rect ? Math.round(rect.height) : 0,
      rows: checkboxRows.length,
      distinctRowTops: rowYs.length,
      viewport: window.innerHeight,
    };
  });

  console.log(`${label}`);
  console.log(`  页面总高        ${m.page}px   (视口 ${m.viewport}px → ${m.page > m.viewport ? '需滚动 ' + (m.page - m.viewport) + 'px' : '单屏放得下'})`);
  console.log(`  权限区纵向占用  ${m.permPanel}px`);
  console.log(`  权限项           ${m.rows} 个，占 ${m.distinctRowTops} 个不同纵坐标行`);
  await b.close();
})();
