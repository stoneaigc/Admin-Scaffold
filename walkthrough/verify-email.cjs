// walkthrough/verify-email.cjs
// 邮件服务（M3）验证：起一个本地 SMTP 桩，真发一封信，验证整条链路。
//   配置落库 -> 密码加密且不外泄 -> 发信成功 -> 「只改品牌不会冲掉密码」-> 失败有可读提示
const { start, received, PORT, USER, PASS } = require('./smtp-stub.cjs');

const BASE = process.env.BASE || 'http://localhost:3100';

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
}

async function req(p, opts = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + p, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

(async () => {
  const stub = await start();
  console.log(`[stub] SMTP 桩监听 127.0.0.1:${PORT}\n`);

  const login = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  const token = login.body.token;
  ok('T01 登录成功', !!token);

  // ---- 参数与配置校验 ----
  const noTo = await req('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({}),
  }, token);
  ok('T02 缺收件人 -> 400', noTo.status === 400, JSON.stringify(noTo.body));

  const badTo = await req('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({ to: 'not-an-email' }),
  }, token);
  ok('T03 收件人格式非法 -> 400', badTo.status === 400, badTo.body.error);

  const noAuth = await req('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({ to: 'a@b.com' }),
  });
  ok('T04 无 token -> 401', noAuth.status === 401);

  // ---- 先清空，验证「未配置」时有明确报错 ----
  await req('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ email: { host: '', from: '', password: null } }),
  }, token);
  const emptyCfg = await req('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({ to: 'a@b.com' }),
  }, token);
  ok('T05 未配置 SMTP -> 400 且提示缺什么', emptyCfg.status === 400, emptyCfg.body.error);

  // ---- 写入可用配置（密码明文只在这一次请求里出现）----
  const put = await req('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({
      email: {
        enabled: true,
        host: '127.0.0.1',
        port: String(PORT),
        encryption: 'none',
        from: USER,
        fromName: '系统通知',
        username: USER,
        password: PASS,
      },
    }),
  }, token);
  ok('T06 保存邮件配置 200', put.status === 200, JSON.stringify(put.body));

  const get = await req('/api/admin/settings', {}, token);
  const e = get.body.email || {};
  ok('T07 配置已落库', e.host === '127.0.0.1' && e.from === USER);
  ok('T08 有密码标记但不下发密文', e.hasPassword === true && e.passwordEnc === undefined);
  ok('T09 明文密码不下发', e.password === undefined);

  // ---- 真发一封 ----
  const sent = await req('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({ to: 'someone@example.com' }),
  }, token);
  ok('T10 测试邮件发送成功 -> 200', sent.status === 200, JSON.stringify(sent.body));
  ok('T11 SMTP 桩确实收到了信', received.length === 1, 'received=' + received.length);
  // SMTP 报文里的中文主题/显示名是 =?UTF-8?B?...?= 编码的，匹配前先解码，
  // 否则会误判成「没发出去」（报文其实是对的）
  const decodeMime = (s) =>
    String(s)
      .replace(/\r?\n[ \t]+/g, '') // 长主题会被折行成多段编码词，先并起来
      .replace(/=\?UTF-8\?B\?([^?]*)\?=/gi, (_, b64) =>
        Buffer.from(b64, 'base64').toString('utf8')
      );

  if (received.length) {
    const m = received[0];
    const raw = decodeMime(m.body);
    ok('T12 收件人正确', m.to === 'someone@example.com', m.to);
    ok('T13 主题含测试邮件标识', /邮件服务/.test(raw) && /测试/.test(raw), (raw.match(/Subject:.*/) || [''])[0].trim());
    ok('T14 发件人带显示名', /系统通知/.test(raw), (raw.match(/From:.*/) || [''])[0].trim());
  }

  // ---- 关键回归：只改品牌，不能把 SMTP 密码冲掉 ----
  await req('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ brand: { name: '飞致云控制台' } }),
  }, token);
  const after = await req('/api/admin/settings', {}, token);
  ok('T15 只改品牌后密码仍在', after.body.email.hasPassword === true);
  const sent2 = await req('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({ to: 'again@example.com' }),
  }, token);
  ok('T16 改品牌后仍能发信（密码没被清）', sent2.status === 200, JSON.stringify(sent2.body));

  // ---- 失败路径要有可读提示 ----
  const badHost = await req('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({ to: 'a@b.com', config: { host: '127.0.0.1', port: '9', encryption: 'none' } }),
  }, token);
  ok('T17 连不上 SMTP -> 502', badHost.status === 502, badHost.body.error);

  const badAuth = await req('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({ to: 'a@b.com', config: { password: 'wrong-password' } }),
  }, token);
  ok('T18 密码错 -> 502 且提示认证失败', badAuth.status === 502 && /认证失败/.test(badAuth.body.error || ''), badAuth.body.error);

  // ---- 临时配置：改完没保存也能测 ----
  const temp = await req('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({ to: 'temp@example.com', config: { fromName: '临时发件人' } }),
  }, token);
  ok('T19 临时配置试发成功', temp.status === 200, JSON.stringify(temp.body));

  // ---- 收尾：清掉测试配置 ----
  await req('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ email: { enabled: false, host: '', from: '', username: '', password: null } }),
  }, token);
  const cleaned = await req('/api/admin/settings', {}, token);
  ok('T20 清理后密码已移除', cleaned.body.email.hasPassword === false);

  stub.close();
  console.log(`\n---- ${pass} passed, ${fail} failed ----`);
  process.exit(fail ? 1 : 0);
})();
