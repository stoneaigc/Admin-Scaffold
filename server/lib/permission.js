// server/lib/permission.js
// 权限查询 + 资源可见性纯函数。零 HTTP 依赖，可单测。
// 与 resource-types.js 存在循环依赖：本文件延迟 require resource-types.js 打破循环。
const db = () => global.db;

async function getPortalUser(userId) {
  const r = await db().query(
    'SELECT id, username, name, status, is_portal_admin FROM portal_users WHERE id = $1',
    [userId]
  );
  return r.rowCount ? r.rows[0] : null;
}

// 用户权限原子列表 + is_portal_admin + 角色名
async function getUserPermissions(userId) {
  const user = await getPortalUser(userId);
  if (!user) return { permissions: [], is_portal_admin: false, roles: [] };
  if (user.is_portal_admin) {
    const all = await db().query('SELECT key FROM permissions');
    return { permissions: all.rows.map(r => r.key), is_portal_admin: true, roles: ['admin'] };
  }
  const r = await db().query(`
    SELECT DISTINCT p.key FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = $1
  `, [userId]);
  const roles = await db().query(`
    SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1
  `, [userId]);
  return {
    permissions: r.rows.map(row => row.key),
    is_portal_admin: false,
    roles: roles.rows.map(row => row.name),
  };
}

async function hasPermission(userId, permissionKey) {
  const { permissions, is_portal_admin } = await getUserPermissions(userId);
  return is_portal_admin || permissions.includes(permissionKey);
}

// 用户是否后台角色（持有任一 menu:admin-* 菜单权限）
async function isAdminRoleUser(userId) {
  const r = await db().query(`
    SELECT 1 FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = $1 AND p.key LIKE 'menu:admin-%'
    LIMIT 1
  `, [userId]);
  return r.rowCount > 0;
}

// 管理类权限位清单（前端据此判断是否展示后台入口）
const ADMIN_PERMS = [
  'role:view', 'role:create', 'role:edit', 'role:delete',
  'group:view', 'group:create', 'group:edit', 'group:delete', 'group:assign',
  'user:view', 'user:edit', 'user:create', 'user:delete', 'user:password', 'user:assign',
  'resource:view', 'resource:create', 'resource:edit', 'resource:delete',
  'system:config',
];

// 用户是否有后台入口：超管 / 有 menu:admin-* / 有任一管理权限位
async function hasAdminEntry(userId) {
  const { permissions, is_portal_admin } = await getUserPermissions(userId);
  if (is_portal_admin) return true;
  return permissions.some(k => k.startsWith('menu:admin-'))
    || ADMIN_PERMS.some(k => permissions.includes(k));
}

// 全量资源（调每个注册适配器 listAll，合并）。延迟 require 打破循环依赖。
async function getAllResources() {
  const { getAllResourceTypes, getResourceType } = require('./resource-types');
  const result = {};
  for (const type of getAllResourceTypes()) {
    const adapter = getResourceType(type.key);
    if (adapter?.listAll) result[type.key] = await adapter.listAll();
  }
  return result;
}

// 用户是否可访问某资源（下载/详情）。超管/后台角色放行；否则必须其资源组勾选了该资源。
async function canUserAccessResource(userId, resourceType, resourceId) {
  const user = await getPortalUser(userId);
  if (!user) return false;
  if (user.is_portal_admin) return true;
  if (await isAdminRoleUser(userId)) return true;
  const r = await db().query(`
    SELECT 1 FROM resource_group_items i
    JOIN resource_group_members m ON m.group_id = i.group_id
    WHERE m.user_id = $1 AND i.resource_type = $2 AND i.resource_id = $3
    LIMIT 1
  `, [userId, resourceType, resourceId]);
  return r.rowCount > 0;
}

// 用户可见资源（资源组勾选 = 严格白名单）。兜底：超管/后台角色看全量；非超管不在任何资源组 -> 各类型空数组。
async function getVisibleResourcesForUser(userId) {
  const { getAllResourceTypes, getResourceType } = require('./resource-types');
  const portalUser = await getPortalUser(userId);
  if (!portalUser || portalUser.is_portal_admin) return getAllResources();
  if (await isAdminRoleUser(userId)) return getAllResources();

  const items = await db().query(`
    SELECT resource_type, resource_id FROM resource_group_items
    WHERE group_id IN (SELECT group_id FROM resource_group_members WHERE user_id = $1)
  `, [userId]);

  if (items.rowCount === 0) {
    const empty = {};
    for (const type of getAllResourceTypes()) empty[type.key] = [];
    return empty;
  }

  const byType = {};
  for (const r of items.rows) (byType[r.resource_type] ??= []).push(r.resource_id);

  const result = {};
  for (const type of getAllResourceTypes()) {
    const ids = byType[type.key];
    const adapter = getResourceType(type.key);
    if (!ids || !ids.length) result[type.key] = [];
    else if (adapter?.isVisibleToUser) result[type.key] = await adapter.isVisibleToUser(userId, ids);
    else result[type.key] = ids;
  }
  return result;
}

module.exports = {
  getPortalUser,
  getUserPermissions,
  hasPermission,
  isAdminRoleUser,
  hasAdminEntry,
  ADMIN_PERMS,
  getAllResources,
  canUserAccessResource,
  getVisibleResourcesForUser,
};
