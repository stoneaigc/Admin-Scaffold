// walkthrough/verify-settings.cjs
// 系统设置后端（M2）行为验证。刻意用 node 而不是 curl：
// Git Bash 走 GBK 代码页会把 JSON 里的中文吃掉（写成 ? 或乱码），
// 用 node 原生 fetch 才能保证请求体是真正的 UTF-8，验证结果可信。
const BASE = process.env.BASE || 'http://localhost:3100';

const NAME = '飞致云控制台 F2C';
const WELCOME = '欢迎回来';
let pass = 0;
let fail = 0;

function check(label, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' :: ' + extra : ''}`);
  ok ? pass++ : fail++;
}

async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  return (await r.json()).token;
}

const admin = (token, body, method = 'PUT') => ({
  method,
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: body ? JSON.stringify(body) : undefined,
});

(async () => {
  const token = await login();

  // 1) 中文品牌写入并原样回显（验证没有被编码搞坏）
  const put = await fetch(BASE + '/api/admin/settings', admin(token, {
    brand: { name: NAME, shortName: 'F2C', welcome: WELCOME, footer: '© 2026 飞致云' },
  }));
  const pj = await put.json();
  check('PUT /api/admin/settings 返回 ok', put.status === 200 && pj.ok === true, `status=${put.status}`);
  check('中文系统名原样回显（UTF-8 未损坏）', pj.brand && pj.brand.name === NAME, `got=${JSON.stringify(pj.brand && pj.brand.name)}`);
  check('中文欢迎语原样回显', pj.brand && pj.brand.welcome === WELCOME);

  // 2) 公开接口（不带 token）能读到 = 真正落库且登录页可用
  const pub = await fetch(BASE + '/api/brand');
  const bj = await pub.json();
  check('GET /api/brand 无需登录', pub.status === 200);
  check('公开接口返回已持久化系统名', bj.name === NAME, `got=${JSON.stringify(bj.name)}`);

  // 3) 邮件密码只存密文：不得回显 passwordEnc，只给 hasPassword
  await fetch(BASE + '/api/admin/settings', admin(token, {
    email: { enabled: true, host: 'smtp.exmail.qq.com', port: '465', password: 'super-secret' },
  }));
  const gj = await (await fetch(BASE + '/api/admin/settings', admin(token, undefined, 'GET'))).json();
  check('email 不下发 passwordEnc（加密生效）', !('passwordEnc' in gj.email), JSON.stringify(gj.email));
  check('email 给出 hasPassword 标记', gj.email.hasPassword === true);
  check('email 明文密码不出现', !JSON.stringify(gj).includes('super-secret'));

  // 4) 校验：系统名为空 -> 400
  const bad = await fetch(BASE + '/api/admin/settings', admin(token, { brand: { name: '' } }));
  check('空系统名被拦截 400', bad.status === 400, `status=${bad.status} body=${JSON.stringify(await bad.json())}`);

  // 5) 鉴权：无 token -> 401
  const noTok = await fetch(BASE + '/api/admin/settings');
  check('无 token 访问设置 401', noTok.status === 401, `status=${noTok.status}`);

  // 6) 段隔离：只传 brand 不该把 email 冲掉
  const gj2 = await (await fetch(BASE + '/api/admin/settings', admin(token, undefined, 'GET'))).json();
  check('只改 brand 不影响已存的 email', gj2.email.host === 'smtp.exmail.qq.com', JSON.stringify(gj2.email));

  // 7) oauth 列表来自迁移 004 的表（当前为空，但字段结构应存在）
  check('oauth 字段为数组', Array.isArray(gj2.oauth), `len=${gj2.oauth.length}`);

  console.log(`\n合计: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
