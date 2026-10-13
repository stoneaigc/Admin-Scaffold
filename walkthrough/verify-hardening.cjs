// walkthrough/verify-hardening.cjs
// 对抗用例：专挑「正常点不出来、但会造成真实损害」的边界去打。
// 每条断言都对应这次审出来的一个问题，跑一次即可确认修复生效且未伤及正常路径。
const BASE = 'http://localhost:3100';

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
  cond ? pass++ : fail++;
};

let token, H, J;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(options.headers || {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

(async () => {
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  token = (await lr.json()).token;
  H = { Authorization: 'Bearer ' + token };
  J = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  const send = (p, o) => req(p, o);

  // ---------------------------------------------------------------- 分页参数
  console.log('\n--- 分页参数兜底 ---');
  let r = await send('/api/admin/users?pageSize=abc');
  ok('T01 pageSize=abc 不再 500（返回 200）', r.status === 200, 'status=' + r.status);
  ok('T02 pageSize=abc 时回落默认 20', r.body?.pageSize === 20, 'pageSize=' + r.body?.pageSize);

  r = await send('/api/admin/users?pageSize=99999');
  ok('T03 pageSize 超大被夹到上限 500', r.body?.pageSize === 500, 'pageSize=' + r.body?.pageSize);

  r = await send('/api/admin/users?page=0&pageSize=-5');
  // 负数应被夹到下限 1，而不是原样传进 LIMIT/OFFSET 变成非法 SQL
  ok('T04 page/pageSize 负数被夹到下限 1', r.body?.page === 1 && r.body?.pageSize === 1,
    `page=${r.body?.page} pageSize=${r.body?.pageSize}`);

  // ---------------------------------------------------------------- 用户写接口
  console.log('\n--- 用户写接口校验 ---');
  r = await send('/api/admin/users', { method: 'POST', body: JSON.stringify({ username: 'ab', password: '123456' }) });
  ok('T05 用户名过短被拒（400）', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/users', { method: 'POST', body: JSON.stringify({ username: 'okname', password: '123' }) });
  ok('T06 密码过短被拒（400）', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/users', { method: 'POST', body: JSON.stringify({ username: 'ADMIN', password: '123456' }) });
  ok('T07 重名（大小写不同）被拒 409', r.status === 409, 'status=' + r.status);

  r = await send('/api/admin/users', { method: 'POST', body: JSON.stringify({ username: 'tmpuser1', password: '123456', roleId: 999999 }) });
  ok('T08 建用户带不存在的角色被拒 400', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/users', { method: 'POST', body: JSON.stringify({ username: 'tmpuser2', password: '123456' }) });
  ok('T09 正常建用户仍成功 201', r.status === 201, 'status=' + r.status);
  const tmpUser = r.body;

  r = await send('/api/admin/users/' + tmpUser.id, { method: 'PUT', body: JSON.stringify({ status: 'bogus' }) });
  ok('T10 非法状态值被拒 400', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/users/999999', { method: 'PUT', body: JSON.stringify({ name: 'x' }) });
  ok('T11 改不存在的用户返回 404（而不是 ok:true）', r.status === 404, 'status=' + r.status);

  r = await send('/api/admin/users/999999', { method: 'DELETE' });
  ok('T12 删不存在的用户返回 404（而不是 ok:true）', r.status === 404, 'status=' + r.status);

  // 超管自我保护
  const me = (await send('/api/auth/me')).body;
  r = await send('/api/admin/users/' + me.user.id, { method: 'PUT', body: JSON.stringify({ status: 'disabled' }) });
  ok('T13 不能停用自己（否则当场把自己锁在门外）', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/users/' + me.user.id, { method: 'DELETE' });
  ok('T14 不能删除自己', r.status === 400, 'status=' + r.status);

  const admins = (await send('/api/admin/users?q=&pageSize=500')).body.items.filter((u) => u.is_portal_admin);
  if (admins.length === 1) {
    r = await send('/api/admin/users/' + admins[0].id, { method: 'PUT', body: JSON.stringify({ status: 'disabled' }) });
    ok('T15 唯一超管不可被停用（否则后台无人可管）', r.status === 400, 'status=' + r.status);
    r = await send('/api/admin/users/' + admins[0].id, { method: 'DELETE' });
    ok('T16 唯一超管不可被删除', r.status === 400, 'status=' + r.status);
  } else {
    ok('T15 唯一超管不可被停用（否则后台无人可管）', true, '库中有多个超管，跳过');
    ok('T16 唯一超管不可被删除', true, '库中有多个超管，跳过');
  }

  r = await send('/api/admin/users/' + tmpUser.id + '/roles', { method: 'PUT', body: JSON.stringify({ roleIds: [999999] }) });
  ok('T17 分配不存在的角色被拒 400', r.status === 400, 'status=' + r.status);

  // ---------------------------------------------------------------- 角色写接口
  console.log('\n--- 角色写接口与原子性 ---');
  r = await send('/api/admin/roles', { method: 'POST', body: JSON.stringify({ name: '   ' }) });
  ok('T18 空白角色名被拒 400', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/roles', { method: 'POST', body: JSON.stringify({ name: 'admin' }) });
  ok('T19 重名角色被拒 409', r.status === 409, 'status=' + r.status);

  r = await send('/api/admin/roles/999999', { method: 'DELETE' });
  ok('T20 删不存在的角色返回 404（而不是 ok:true）', r.status === 404, 'status=' + r.status);

  r = await send('/api/admin/roles/999999/permissions', { method: 'PUT', body: JSON.stringify({ permissionIds: [1] }) });
  ok('T21 给不存在的角色写权限返回 404', r.status === 404, 'status=' + r.status);

  // ★ 原子性：这是最要命的一条。旧实现先 DELETE 再逐条 INSERT，
  //   一旦 ids 里有非法值导致 INSERT 失败，角色权限就被清空了。
  const roles = (await send('/api/admin/roles')).body;
  const target = roles.find((x) => x.name === 'user') || roles[0];
  const before = (await send('/api/admin/roles/' + target.id)).body.permissionIds || [];
  r = await send('/api/admin/roles/' + target.id + '/permissions', {
    method: 'PUT',
    body: JSON.stringify({ permissionIds: [...before, 999999] }),
  });
  ok('T22 权限 id 非法时整体拒绝 400', r.status === 400, 'status=' + r.status);
  const after = (await send('/api/admin/roles/' + target.id)).body.permissionIds || [];
  ok('T23 ★非法提交后原权限完好无损（未被清空）',
    after.length === before.length && before.every((x) => after.includes(x)),
    `${before.length} -> ${after.length}`);

  // ---------------------------------------------------------------- 资源组
  console.log('\n--- 资源组 ---');
  // 用真实存在的组来测：不存在的组会先命中 404，测不到成员校验
  const g = (await send('/api/admin/groups', { method: 'POST', body: JSON.stringify({ name: '临时校验组' }) })).body;
  r = await send('/api/admin/groups/' + g.id + '/members', { method: 'PUT', body: JSON.stringify({ userIds: [999999] }) });
  ok('T24 成员含不存在的用户被拒 400', r.status === 400, 'status=' + r.status);
  await send('/api/admin/groups/' + g.id, { method: 'DELETE' });

  r = await send('/api/admin/groups/999999', { method: 'DELETE' });
  ok('T25 删不存在的资源组返回 404', r.status === 404, 'status=' + r.status);

  r = await send('/api/admin/groups', { method: 'POST', body: JSON.stringify({ name: '  ' }) });
  ok('T26 空白资源组名被拒 400', r.status === 400, 'status=' + r.status);

  // ---------------------------------------------------------------- 系统设置
  console.log('\n--- 系统设置值域 ---');
  r = await send('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ brand: { logo: 'https://evil.example/x.png' } }) });
  ok('T27 Logo 不允许外链（防全站加载第三方资源）', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ brand: { name: 'x'.repeat(200) } }) });
  ok('T28 超长系统名被拒 400', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ email: { port: '99999' } }) });
  ok('T29 非法端口被拒 400', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ email: { from: 'not-an-email' } }) });
  ok('T30 非法发件人被拒 400', r.status === 400, 'status=' + r.status);

  r = await send('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ appearance: { defaultMode: 'neon' } }) });
  ok('T31 非法外观模式被拒 400', r.status === 400, 'status=' + r.status);

  // ---------------------------------------------------------------- 清理
  console.log('\n--- 清理 ---');
  await send('/api/admin/users/' + tmpUser.id, { method: 'DELETE' });
  const left = (await send('/api/admin/users?q=&pageSize=500')).body;
  ok('T32 用例用户已清理', !left.items.some((u) => u.username === 'tmpuser2'),
    '剩余: ' + left.items.map((u) => u.username).join(','));
  ok('T33 服务仍然健康（未被异常请求打挂）', (await fetch(BASE + '/api/health').then((x) => x.json())).ok === true);

  console.log(`\nHARDENING_CHECKS passed=${pass} failed=${fail}`);
  process.exit(fail ? 1 : 0);
})();
