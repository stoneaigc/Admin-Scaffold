// server/routes/rbac.js
// 用户 / 角色 / 权限 / 资源组 管理接口。每个接口用 requirePermission 守卫。
//
// 三条硬约束（都是踩过坑才立的）：
//   1. 所有 handler 必须包 wrap()：任何一个 DB 异常都要变成 500 JSON，
//      而不是 unhandled rejection 把 node 进程直接打挂。
//   2. 「先删后插」的整体替换必须走 db.tx()：中途失败会留下「旧的已删、新的没写」的脏数据。
//   3. 写接口必须校验参数有效性 + 目标存在性，不存在的目标返回 404 而不是 ok:true。
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { verifyUser, requirePermission } = require('../auth');

// 异步 handler 兜底
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// ---------------------------------------------------------------- 校验工具
/** 路径参数转正整数 ID，非法返回 null（NaN / 0 / 负数 / 小数都挡掉） */
function toId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
const STATUSES = ['active', 'disabled'];
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const MAX_PAGE_SIZE = 500;
const MAX_ITEMS = 1000; // 单次提交的组内资源上限
const MAX_MEMBERS = 5000; // 单次提交的成员上限

function badRequest(res, msg) {
  return res.status(400).json({ error: msg });
}

/** 剩余可用超管数量（用于阻止把系统里最后一个超管删掉/禁用） */
async function countAdmins() {
  const r = await global.db.query("SELECT COUNT(*) AS c FROM portal_users WHERE is_portal_admin = TRUE AND status = 'active'");
  return Number(r.rows[0].c);
}

// ---------- 权限原子 ----------
router.get('/permissions', verifyUser, requirePermission('role:view'), wrap(async (req, res) => {
  const r = await global.db.query(
    'SELECT id, module, action, key, name, is_dangerous FROM permissions ORDER BY module, action'
  );
  res.json(r.rows);
}));

// ---------- 角色 ----------
router.get('/roles', verifyUser, requirePermission('role:view'), wrap(async (req, res) => {
  const r = await global.db.query(
    `SELECT r.id, r.name, r.description, r.is_system,
            (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
     FROM roles r ORDER BY r.is_system DESC, r.id`
  );
  res.json(r.rows);
}));

router.get('/roles/:id', verifyUser, requirePermission('role:view'), wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(404).json({ error: '角色不存在' });
  const r = await global.db.query('SELECT id, name, description, is_system FROM roles WHERE id = $1', [id]);
  if (!r.rowCount) return res.status(404).json({ error: '角色不存在' });
  const perms = await global.db.query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [id]);
  res.json({ ...r.rows[0], permissionIds: perms.rows.map((p) => p.permission_id) });
}));

router.post('/roles', verifyUser, requirePermission('role:create'), wrap(async (req, res) => {
  const { name, description } = req.body || {};
  const clean = String(name || '').trim();
  if (!clean) return badRequest(res, '角色名必填');
  if (clean.length > 32) return badRequest(res, '角色名不能超过 32 个字符');
  // 重名会让「按名找角色」类的逻辑（前端回选、脚本用例）变得不可预测，直接拒绝
  const dup = await global.db.query('SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1)', [clean]);
  if (dup.rowCount) return res.status(409).json({ error: '角色名已存在' });
  const r = await global.db.query(
    'INSERT INTO roles (name, description, is_system) VALUES ($1, $2, FALSE) RETURNING *',
    [clean, description || null]
  );
  res.status(201).json(r.rows[0]);
}));

// 给角色勾选权限位（整体替换）
router.put('/roles/:id/permissions', verifyUser, requirePermission('role:edit'), wrap(async (req, res) => {
  const roleId = toId(req.params.id);
  if (!roleId) return res.status(404).json({ error: '角色不存在' });
  const exists = await global.db.query('SELECT 1 FROM roles WHERE id = $1', [roleId]);
  if (!exists.rowCount) return res.status(404).json({ error: '角色不存在' });

  const raw = Array.isArray(req.body?.permissionIds) ? req.body.permissionIds : [];
  if (raw.length > MAX_ITEMS) return badRequest(res, '单次提交的权限数量超限');
  const ids = [...new Set(raw.map(Number).filter(Number.isInteger))];

  // 先校验全部权限位真实存在：不存在的 id 直接拒绝，而不是静默忽略
  // （静默忽略会让前端以为保存成功，实际勾选被丢掉）
  if (ids.length) {
    const valid = await global.db.query(
      `SELECT id FROM permissions WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`,
      ids
    );
    const got = new Set(valid.rows.map((r) => r.id));
    const missing = ids.filter((id) => !got.has(id));
    if (missing.length) return badRequest(res, `权限位不存在：${missing.join(', ')}`);
  }

  // 原子替换：DELETE + 批量 INSERT 要么都成，要么都不成
  await global.db.tx(async (q) => {
    await q('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    for (const pid of ids) {
      await q(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleId, pid]
      );
    }
  });
  res.json({ ok: true, count: ids.length });
}));

router.delete('/roles/:id', verifyUser, requirePermission('role:delete'), wrap(async (req, res) => {
  const roleId = toId(req.params.id);
  if (!roleId) return res.status(404).json({ error: '角色不存在' });
  const r = await global.db.query('SELECT is_system FROM roles WHERE id = $1', [roleId]);
  if (!r.rowCount) return res.status(404).json({ error: '角色不存在' });
  if (r.rows[0].is_system) return badRequest(res, '系统角色不可删除');
  await global.db.query('DELETE FROM roles WHERE id = $1', [roleId]);
  res.json({ ok: true });
}));

// ---------- 用户 ----------
router.get('/users', verifyUser, requirePermission('user:view'), wrap(async (req, res) => {
  const { q = '' } = req.query;
  // page/pageSize 必须兜底：NaN 会直接让 LIMIT/OFFSET 变成非法 SQL 报 500，
  // 无上限则一次请求就能把整表拉走。
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  // 不转义 % / _ ：ESCAPE 子句在 pg / sqlite 间字面量写法不一致，而这里只是模糊搜索，
  // 输入 % 顶多匹配到全部行，不构成越权（真正的过滤靠后端权限位）。
  const like = `%${String(q)}%`;
  const r = await global.db.query(
    `SELECT id, username, name, status, is_portal_admin, created_at
     FROM portal_users WHERE username LIKE $1 OR name LIKE $2 ORDER BY id LIMIT $3 OFFSET $4`,
    [like, like, pageSize, offset]
  );
  // 把本页用户的角色名聚合到各行（端口无关写法，避开 ARRAY_AGG 这类方言函数）
  const items = r.rows;
  if (items.length) {
    const ids = items.map((u) => u.id);
    const roleRows = await global.db.query(
      `SELECT ur.user_id AS user_id, roles.name AS name
       FROM roles JOIN user_roles ur ON ur.role_id = roles.id
       WHERE ur.user_id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`,
      ids
    );
    const byUser = {};
    for (const rr of roleRows.rows) (byUser[rr.user_id] ??= []).push(rr.name);
    for (const u of items) u.roles = byUser[u.id] || [];
  }
  const c = await global.db.query('SELECT COUNT(*) AS count FROM portal_users WHERE username LIKE $1 OR name LIKE $2', [like, like]);
  res.json({ items, total: Number(c.rows[0].count), page, pageSize });
}));

router.post('/users', verifyUser, requirePermission('user:create'), wrap(async (req, res) => {
  const { username, name, password, roleId } = req.body || {};
  const uname = String(username || '').trim();
  if (!uname || !password) return badRequest(res, '用户名和密码必填');
  if (!USERNAME_RE.test(uname)) return badRequest(res, '用户名需为 3-32 位字母、数字、点、下划线或连字符');
  if (String(password).length < 6) return badRequest(res, '密码至少 6 位');

  const exist = await global.db.query('SELECT 1 FROM portal_users WHERE LOWER(username) = LOWER($1)', [uname]);
  if (exist.rowCount) return res.status(409).json({ error: '用户名已存在' });

  const hash = await bcrypt.hash(String(password), 10);
  const created = await global.db.tx(async (q) => {
    const r = await q(
      'INSERT INTO portal_users (username, name, password_hash, status) VALUES ($1, $2, $3, $4) RETURNING id, username, name, status',
      [uname, String(name || uname).trim() || uname, hash, 'active']
    );
    const newId = r.rows[0].id;
    const rid = toId(roleId);
    if (rid) {
      const ok = await q('SELECT 1 FROM roles WHERE id = $1', [rid]);
      if (!ok.rowCount) throw Object.assign(new Error('角色不存在'), { status: 400 });
      await q('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newId, rid]);
    }
    return r.rows[0];
  }).catch((e) => {
    if (e.status === 400) return null;
    throw e;
  });
  if (!created) return badRequest(res, '角色不存在');
  res.status(201).json(created);
}));

router.put('/users/:id', verifyUser, requirePermission('user:edit'), wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(404).json({ error: '用户不存在' });
  const { name, status, password } = req.body || {};

  const cur = await global.db.query('SELECT id, is_portal_admin FROM portal_users WHERE id = $1', [id]);
  if (!cur.rowCount) return res.status(404).json({ error: '用户不存在' });

  if (status !== undefined && !STATUSES.includes(status)) {
    return badRequest(res, `状态只能是 ${STATUSES.join(' / ')}`);
  }
  const disabling = status === 'disabled';
  if (disabling) {
    // 把自己禁用 = 当场把自己踢出门，且没人能再救回来
    if (id === req.portalUser.id) return badRequest(res, '不能停用自己的账号');
    // 把最后一个超管停用 = 整个后台再也没人能改配置
    if (cur.rows[0].is_portal_admin && (await countAdmins()) <= 1) {
      return badRequest(res, '至少需保留一名启用的超级管理员');
    }
  }

  const sets = [];
  const params = [];
  let i = 1;
  if (name !== undefined) { sets.push(`name = $${i++}`); params.push(String(name).trim()); }
  if (status !== undefined) { sets.push(`status = $${i++}`); params.push(status); }
  if (password) {
    if (String(password).length < 6) return badRequest(res, '密码至少 6 位');
    const hash = await bcrypt.hash(String(password), 10);
    sets.push(`password_hash = $${i++}`); params.push(hash);
  }
  if (!sets.length) return badRequest(res, '无更新字段');
  params.push(id);
  await global.db.query(`UPDATE portal_users SET ${sets.join(', ')} WHERE id = $${i}`, params);
  res.json({ ok: true });
}));

router.delete('/users/:id', verifyUser, requirePermission('user:delete'), wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(404).json({ error: '用户不存在' });
  if (id === req.portalUser.id) return badRequest(res, '不能删除自己');

  const cur = await global.db.query('SELECT is_portal_admin FROM portal_users WHERE id = $1', [id]);
  if (!cur.rowCount) return res.status(404).json({ error: '用户不存在' });
  if (cur.rows[0].is_portal_admin && (await countAdmins()) <= 1) {
    return badRequest(res, '至少需保留一名超级管理员');
  }
  await global.db.query('DELETE FROM portal_users WHERE id = $1', [id]);
  res.json({ ok: true });
}));

// 分配角色（整体替换）
router.put('/users/:id/roles', verifyUser, requirePermission('user:assign'), wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(404).json({ error: '用户不存在' });
  const exists = await global.db.query('SELECT 1 FROM portal_users WHERE id = $1', [id]);
  if (!exists.rowCount) return res.status(404).json({ error: '用户不存在' });

  const raw = Array.isArray(req.body?.roleIds) ? req.body.roleIds : [];
  const roleIds = [...new Set(raw.map(Number).filter(Number.isInteger))];
  if (roleIds.length) {
    const valid = await global.db.query(
      `SELECT id FROM roles WHERE id IN (${roleIds.map((_, i) => `$${i + 1}`).join(',')})`,
      roleIds
    );
    const got = new Set(valid.rows.map((r) => r.id));
    const missing = roleIds.filter((x) => !got.has(x));
    if (missing.length) return badRequest(res, `角色不存在：${missing.join(', ')}`);
  }

  await global.db.tx(async (q) => {
    await q('DELETE FROM user_roles WHERE user_id = $1', [id]);
    for (const rid of roleIds) {
      await q('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, rid]);
    }
  });
  res.json({ ok: true, count: roleIds.length });
}));

// ---------- 资源组（资源隔离扩展位）----------
router.get('/groups', verifyUser, requirePermission('group:view'), wrap(async (req, res) => {
  const r = await global.db.query(
    `SELECT g.id, g.name, g.description,
            (SELECT COUNT(*) FROM resource_group_members m WHERE m.group_id = g.id) AS member_count,
            (SELECT COUNT(*) FROM resource_group_items i WHERE i.group_id = g.id) AS resource_count
     FROM resource_groups g ORDER BY g.id`
  );
  res.json(r.rows);
}));

// 资源组明细：组内资源勾选 + 成员，供后台 UI 回显（列表只给计数，无法还原勾选态）
router.get('/groups/:id', verifyUser, requirePermission('group:view'), wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(404).json({ error: '资源组不存在' });
  const g = await global.db.query('SELECT id, name, description FROM resource_groups WHERE id = $1', [id]);
  if (!g.rowCount) return res.status(404).json({ error: '资源组不存在' });
  const items = await global.db.query(
    'SELECT resource_type, resource_id FROM resource_group_items WHERE group_id = $1 ORDER BY resource_type, resource_id',
    [id]
  );
  const members = await global.db.query('SELECT user_id FROM resource_group_members WHERE group_id = $1', [id]);
  res.json({
    id,
    name: g.rows[0].name,
    description: g.rows[0].description,
    items: items.rows.map((r) => ({ resourceType: r.resource_type, resourceId: r.resource_id })),
    memberIds: members.rows.map((r) => r.user_id),
  });
}));

router.post('/groups', verifyUser, requirePermission('group:create'), wrap(async (req, res) => {
  const { name, description } = req.body || {};
  const clean = String(name || '').trim();
  if (!clean) return badRequest(res, '资源组名必填');
  if (clean.length > 64) return badRequest(res, '资源组名不能超过 64 个字符');
  const dup = await global.db.query('SELECT 1 FROM resource_groups WHERE LOWER(name) = LOWER($1)', [clean]);
  if (dup.rowCount) return res.status(409).json({ error: '资源组名已存在' });
  const r = await global.db.query(
    'INSERT INTO resource_groups (name, description) VALUES ($1, $2) RETURNING *',
    [clean, description || null]
  );
  res.status(201).json(r.rows[0]);
}));

async function assertGroupExists(groupId) {
  const r = await global.db.query('SELECT 1 FROM resource_groups WHERE id = $1', [groupId]);
  return r.rowCount > 0;
}

// 配置组内资源（整体替换勾选：传空数组即清空）
router.put('/groups/:id/items', verifyUser, requirePermission('group:edit'), wrap(async (req, res) => {
  const groupId = toId(req.params.id);
  if (!groupId || !(await assertGroupExists(groupId))) {
    return res.status(404).json({ error: '资源组不存在' });
  }
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length > MAX_ITEMS) return badRequest(res, `单次最多提交 ${MAX_ITEMS} 项资源`);

  const clean = items
    .filter((it) => it && it.resourceType && it.resourceId !== undefined && it.resourceId !== null)
    .map((it) => ({ resourceType: String(it.resourceType), resourceId: String(it.resourceId) }));

  await global.db.tx(async (q) => {
    await q('DELETE FROM resource_group_items WHERE group_id = $1', [groupId]);
    for (const it of clean) {
      await q(
        'INSERT INTO resource_group_items (group_id, resource_type, resource_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [groupId, it.resourceType, it.resourceId]
      );
    }
  });
  res.json({ ok: true, count: clean.length });
}));

// 管理授权成员（整体替换）
router.put('/groups/:id/members', verifyUser, requirePermission('group:assign'), wrap(async (req, res) => {
  const groupId = toId(req.params.id);
  if (!groupId || !(await assertGroupExists(groupId))) {
    return res.status(404).json({ error: '资源组不存在' });
  }
  const raw = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  if (raw.length > MAX_MEMBERS) return badRequest(res, `单次最多提交 ${MAX_MEMBERS} 名成员`);
  let userIds = [...new Set(raw.map(Number).filter(Number.isInteger))];

  // 只接受真实存在的用户：否则注入一个不存在的 id 会让「成员数」虚高
  if (userIds.length) {
    const valid = await global.db.query(
      `SELECT id FROM portal_users WHERE id IN (${userIds.map((_, i) => `$${i + 1}`).join(',')})`,
      userIds
    );
    const got = new Set(valid.rows.map((r) => r.id));
    const missing = userIds.filter((x) => !got.has(x));
    if (missing.length) return badRequest(res, `用户不存在：${missing.join(', ')}`);
  }

  await global.db.tx(async (q) => {
    await q('DELETE FROM resource_group_members WHERE group_id = $1', [groupId]);
    for (const uid of userIds) {
      await q('INSERT INTO resource_group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, uid]);
    }
  });
  res.json({ ok: true, count: userIds.length });
}));

router.delete('/groups/:id', verifyUser, requirePermission('group:delete'), wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(404).json({ error: '资源组不存在' });
  // 关联行靠 ON DELETE CASCADE 清理；sqlite 需显式开启外键（db.js 已处理）
  const r = await global.db.query('DELETE FROM resource_groups WHERE id = $1', [id]);
  if (!r.rowCount) return res.status(404).json({ error: '资源组不存在' });
  res.json({ ok: true });
}));

module.exports = router;
