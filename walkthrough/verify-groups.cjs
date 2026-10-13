// 资源组后端验证：明细接口回显、整体替换语义、404 守卫、级联删除（含 sqlite 外键是否真生效）。
// 用 node 而非 curl 跑：Git Bash 走 GBK 代码页会吃掉 JSON 里的中文，看着像存坏了。
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:3100';
const DB_PATH = path.join(__dirname, '..', 'server', 'data', 'app.db');

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log('PASS  ' + name + (extra ? '  ' + extra : ''));
  } else {
    fail++;
    console.log('FAIL  ' + name + (extra ? '  ' + extra : ''));
  }
}

async function req(p, opts = {}) {
  const res = await fetch(BASE + p, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function sqliteProbe() {
  if (!fs.existsSync(DB_PATH)) return null;
  // eslint-disable-next-line global-require
  const Database = require(path.join(__dirname, '..', 'server', 'node_modules', 'better-sqlite3'));
  const db = new Database(DB_PATH);
  const fk = db.pragma('foreign_keys', { simple: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  return {
    fk,
    hasResourceTypes: tables.includes('resource_types'),
    count: (sql, ...args) => db.prepare(sql).get(...args).c,
    close: () => db.close(),
  };
}

(async () => {
  // ---- 登录 ----
  const login = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  const token = login.body.token;
  ok('T01 login', login.status === 200 && !!token);
  const H = { Authorization: 'Bearer ' + token };

  // ---- 迁移 006 + 外键 ----
  const dbp = sqliteProbe();
  if (dbp) {
    ok('T02 migration 006 dropped resource_types', dbp.hasResourceTypes === false);
    ok('T03 sqlite foreign_keys pragma ON', dbp.fk === 1, 'fk=' + dbp.fk);
  } else {
    ok('T02 migration 006 (pg mode, skip)', true, 'skipped');
    ok('T03 sqlite foreign_keys pragma ON', true, 'skipped');
  }

  // ---- 资源池（前端勾选矩阵的数据源）----
  const pool = await req('/api/resources', { headers: H });
  ok('T04 GET /api/resources 200', pool.status === 200);
  ok(
    'T05 resource pool has sample types',
    Array.isArray(pool.body.service) && Array.isArray(pool.body.dataset),
    JSON.stringify(pool.body)
  );

  // ---- 列表 ----
  const list0 = await req('/api/admin/groups', { headers: H });
  ok('T06 GET /api/admin/groups 200', list0.status === 200 && Array.isArray(list0.body));

  // ---- 创建 ----
  const NAME = '验证组-' + Date.now();
  const created = await req('/api/admin/groups', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ name: NAME, description: '自动化验证' }),
  });
  ok('T07 POST /api/admin/groups 201', created.status === 201, JSON.stringify(created.body));
  const gid = created.body.id;

  // ---- 空名校验 ----
  const badName = await req('/api/admin/groups', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ name: '   ' }),
  });
  ok('T08 POST empty name -> 400', badName.status === 400);

  // ---- 初始明细为空 ----
  let detail = await req('/api/admin/groups/' + gid, { headers: H });
  ok(
    'T09 detail empty on create',
    detail.status === 200 && detail.body.items.length === 0 && detail.body.memberIds.length === 0
  );

  // ---- 勾选资源 + 回显 ----
  const putItems = await req('/api/admin/groups/' + gid + '/items', {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({
      items: [
        { resourceType: 'service', resourceId: 'gateway' },
        { resourceType: 'dataset', resourceId: 'internal' },
      ],
    }),
  });
  ok('T10 PUT items 200', putItems.status === 200, JSON.stringify(putItems.body));
  detail = await req('/api/admin/groups/' + gid, { headers: H });
  const keys = detail.body.items.map((i) => i.resourceType + ':' + i.resourceId).sort();
  ok(
    'T11 detail reflects saved items',
    JSON.stringify(keys) === JSON.stringify(['dataset:internal', 'service:gateway']),
    JSON.stringify(keys)
  );

  // ---- 整体替换：再传一项应覆盖而非追加 ----
  await req('/api/admin/groups/' + gid + '/items', {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({ items: [{ resourceType: 'service', resourceId: 'scheduler' }] }),
  });
  detail = await req('/api/admin/groups/' + gid, { headers: H });
  ok(
    'T12 PUT items replaces (not appends)',
    detail.body.items.length === 1 && detail.body.items[0].resourceId === 'scheduler'
  );

  // ---- 成员 ----
  const users = await req('/api/admin/users?page=1&pageSize=500', { headers: H });
  const uid = users.body.items?.[0]?.id;
  const putMembers = await req('/api/admin/groups/' + gid + '/members', {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({ userIds: [uid] }),
  });
  ok('T13 PUT members 200', putMembers.status === 200, JSON.stringify(putMembers.body));
  detail = await req('/api/admin/groups/' + gid, { headers: H });
  ok(
    'T14 detail reflects members',
    detail.body.memberIds.length === 1 && detail.body.memberIds[0] === uid
  );

  // ---- 列表计数同步 ----
  const list1 = await req('/api/admin/groups', { headers: H });
  const row = list1.body.find((g) => g.id === gid);
  ok(
    'T15 list counts updated',
    row && row.resource_count === 1 && row.member_count === 1,
    JSON.stringify(row)
  );

  // ---- 404 守卫 ----
  const ghost = await req('/api/admin/groups/999999/items', {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({ items: [] }),
  });
  ok('T16 PUT items on missing group -> 404', ghost.status === 404, 'status=' + ghost.status);
  const ghostDetail = await req('/api/admin/groups/999999', { headers: H });
  ok('T17 GET missing group detail -> 404', ghostDetail.status === 404);

  // ---- 鉴权 ----
  const noAuth = await req('/api/admin/groups');
  ok('T18 GET groups without token -> 401', noAuth.status === 401);

  // ---- 删除 + 级联 ----
  const del = await req('/api/admin/groups/' + gid, { method: 'DELETE', headers: H });
  ok('T19 DELETE group 200', del.status === 200);
  const delAgain = await req('/api/admin/groups/' + gid, { method: 'DELETE', headers: H });
  ok('T20 DELETE missing group -> 404', delAgain.status === 404);

  if (dbp) {
    const itemsLeft = dbp.count('SELECT COUNT(*) AS c FROM resource_group_items WHERE group_id = ?', gid);
    const membersLeft = dbp.count('SELECT COUNT(*) AS c FROM resource_group_members WHERE group_id = ?', gid);
    ok('T21 cascade cleared resource_group_items', itemsLeft === 0, 'left=' + itemsLeft);
    ok('T22 cascade cleared resource_group_members', membersLeft === 0, 'left=' + membersLeft);
    dbp.close();
  } else {
    ok('T21 cascade (pg mode, skip)', true, 'skipped');
    ok('T22 cascade (pg mode, skip)', true, 'skipped');
  }

  console.log('\n---- ' + pass + ' passed, ' + fail + ' failed ----');
  process.exit(fail ? 1 : 0);
})();
