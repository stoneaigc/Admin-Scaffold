// server/routes/rbac.js
// 用户 / 角色 / 权限 / 资源组 管理接口。每个接口用 requirePermission 守卫。
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { verifyUser, requirePermission } = require('../auth');

// ---------- 权限原子 ----------
router.get('/permissions', verifyUser, requirePermission('role:view'), async (req, res) => {
  const r = await global.db.query(
    'SELECT id, module, action, key, name, is_dangerous FROM permissions ORDER BY module, action'
  );
  res.json(r.rows);
});

// ---------- 角色 ----------
router.get('/roles', verifyUser, requirePermission('role:view'), async (req, res) => {
  const r = await global.db.query(
    `SELECT r.id, r.name, r.description, r.is_system,
            (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
     FROM roles r ORDER BY r.is_system DESC, r.id`
  );
  res.json(r.rows);
});

router.get('/roles/:id', verifyUser, requirePermission('role:view'), async (req, res) => {
  const r = await global.db.query(
    'SELECT id, name, description, is_system FROM roles WHERE id = $1',
    [Number(req.params.id)]
  );
  if (!r.rowCount) return res.status(404).json({ error: '角色不存在' });
  const perms = await global.db.query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [Number(req.params.id)]);
  res.json({ ...r.rows[0], permissionIds: perms.rows.map(p => p.permission_id) });
});

router.post('/roles', verifyUser, requirePermission('role:create'), async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: '角色名必填' });
  const r = await global.db.query(
    'INSERT INTO roles (name, description, is_system) VALUES ($1, $2, FALSE) RETURNING *',
    [name, description || null]
  );
  res.status(201).json(r.rows[0]);
});

// 给角色勾选权限位
router.put('/roles/:id/permissions', verifyUser, requirePermission('role:edit'), async (req, res) => {
  const roleId = Number(req.params.id);
  const ids = Array.isArray(req.body?.permissionIds) ? req.body.permissionIds.map(Number) : [];
  await global.db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
  for (const pid of ids) {
    await global.db.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleId, pid]
    );
  }
  res.json({ ok: true });
});

router.delete('/roles/:id', verifyUser, requirePermission('role:delete'), async (req, res) => {
  const roleId = Number(req.params.id);
  const sys = await global.db.query('SELECT is_system FROM roles WHERE id = $1', [roleId]);
  if (sys.rowCount && sys.rows[0].is_system) return res.status(400).json({ error: '系统角色不可删除' });
  await global.db.query('DELETE FROM roles WHERE id = $1', [roleId]);
  res.json({ ok: true });
});

// ---------- 用户 ----------
router.get('/users', verifyUser, requirePermission('user:view'), async (req, res) => {
  const { q = '', page = 1, pageSize = 20 } = req.query;
  const offset = (Math.max(1, Number(page)) - 1) * Number(pageSize);
  const like = `%${q}%`;
  const r = await global.db.query(
    `SELECT id, username, name, status, is_portal_admin, created_at
     FROM portal_users WHERE username LIKE $1 OR name LIKE $2 ORDER BY id LIMIT $3 OFFSET $4`,
    [like, like, Number(pageSize), offset]
  );
  // 把本页用户的角色名聚合到各行（端口无关写法，避开 ARRAY_AGG 这类方言函数）
  const items = r.rows;
  if (items.length) {
    const ids = items.map((u) => u.id);
    const roleRows = await global.db.query(
      `SELECT ur.user_id AS user_id, roles.name AS name
       FROM roles JOIN user_roles ur ON ur.role_id = roles.id
       WHERE ur.user_id IN (${ids.map((_, i) => `$${i + 5}`).join(',')})`,
      ids
    );
    const byUser = {};
    for (const rr of roleRows.rows) (byUser[rr.user_id] ??= []).push(rr.name);
    for (const u of items) u.roles = byUser[u.id] || [];
  }
  const c = await global.db.query('SELECT COUNT(*) AS count FROM portal_users WHERE username LIKE $1 OR name LIKE $2', [like, like]);
  res.json({ items, total: Number(c.rows[0].count) });
});

router.post('/users', verifyUser, requirePermission('user:create'), async (req, res) => {
  const { username, name, password, roleId } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
  const exist = await global.db.query('SELECT 1 FROM portal_users WHERE username = $1', [username]);
  if (exist.rowCount) return res.status(409).json({ error: '用户名已存在' });
  const hash = await bcrypt.hash(password, 10);
  const r = await global.db.query(
    'INSERT INTO portal_users (username, name, password_hash, status) VALUES ($1, $2, $3, $4) RETURNING id, username, name, status',
    [username, name || username, hash, 'active']
  );
  const newId = r.rows[0].id;
  if (roleId) {
    await global.db.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newId, Number(roleId)]);
  }
  res.status(201).json(r.rows[0]);
});

router.put('/users/:id', verifyUser, requirePermission('user:edit'), async (req, res) => {
  const id = Number(req.params.id);
  const { name, status, password } = req.body || {};
  const sets = [];
  const params = [];
  let i = 1;
  if (name !== undefined) { sets.push(`name = $${i++}`); params.push(name); }
  if (status !== undefined) { sets.push(`status = $${i++}`); params.push(status); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    sets.push(`password_hash = $${i++}`); params.push(hash);
  }
  if (!sets.length) return res.status(400).json({ error: '无更新字段' });
  params.push(id);
  await global.db.query(`UPDATE portal_users SET ${sets.join(', ')} WHERE id = $${i}`, params);
  res.json({ ok: true });
});

router.delete('/users/:id', verifyUser, requirePermission('user:delete'), async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.portalUser.id) return res.status(400).json({ error: '不能删除自己' });
  await global.db.query('DELETE FROM portal_users WHERE id = $1', [id]);
  res.json({ ok: true });
});

// 分配角色
router.put('/users/:id/roles', verifyUser, requirePermission('user:assign'), async (req, res) => {
  const id = Number(req.params.id);
  const roleIds = Array.isArray(req.body?.roleIds) ? req.body.roleIds.map(Number) : [];
  await global.db.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
  for (const rid of roleIds) {
    await global.db.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, rid]);
  }
  res.json({ ok: true });
});

// ---------- 资源组（资源隔离扩展位）----------
router.get('/groups', verifyUser, requirePermission('group:view'), async (req, res) => {
  const r = await global.db.query(
    `SELECT g.id, g.name, g.description,
            (SELECT COUNT(*) FROM resource_group_members m WHERE m.group_id = g.id) AS member_count,
            (SELECT COUNT(*) FROM resource_group_items i WHERE i.group_id = g.id) AS resource_count
     FROM resource_groups g ORDER BY g.id`
  );
  res.json(r.rows);
});

router.post('/groups', verifyUser, requirePermission('group:create'), async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: '资源组名必填' });
  const r = await global.db.query(
    'INSERT INTO resource_groups (name, description) VALUES ($1, $2) RETURNING *',
    [name, description || null]
  );
  res.status(201).json(r.rows[0]);
});

// 配置组内资源（按 resource_type 整体替换勾选）
router.put('/groups/:id/items', verifyUser, requirePermission('group:edit'), async (req, res) => {
  const groupId = Number(req.params.id);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  await global.db.query('DELETE FROM resource_group_items WHERE group_id = $1', [groupId]);
  for (const it of items) {
    if (!it.resourceType || it.resourceId === undefined) continue;
    await global.db.query(
      'INSERT INTO resource_group_items (group_id, resource_type, resource_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [groupId, String(it.resourceType), String(it.resourceId)]
    );
  }
  res.json({ ok: true });
});

// 管理授权成员
router.put('/groups/:id/members', verifyUser, requirePermission('group:assign'), async (req, res) => {
  const groupId = Number(req.params.id);
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.map(Number) : [];
  await global.db.query('DELETE FROM resource_group_members WHERE group_id = $1', [groupId]);
  for (const uid of userIds) {
    await global.db.query('INSERT INTO resource_group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, uid]);
  }
  res.json({ ok: true });
});

router.delete('/groups/:id', verifyUser, requirePermission('group:delete'), async (req, res) => {
  await global.db.query('DELETE FROM resource_groups WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
