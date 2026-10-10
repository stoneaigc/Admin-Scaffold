// portal/src/lib/menus.js
// 后台菜单唯一定义源。perm 决定该菜单是否对当前用户可见（按钮级/菜单级权限同一套 key）。
// 新增菜单：在这里加一项，并在后端 permissions 种子里补对应的 menu:* 权限。
export const ADMIN_MENUS = [
  { to: '/admin/users', label: '用户管理', icon: 'users', perm: 'menu:admin-users', title: '用户管理' },
  { to: '/admin/roles', label: '角色权限', icon: 'roles', perm: 'menu:admin-roles', title: '角色权限' },
  { to: '/admin/groups', label: '资源组', icon: 'groups', perm: 'menu:admin-groups', title: '资源组', soon: true },
  { to: '/admin/config', label: '系统设置', icon: 'config', perm: 'menu:admin-config', title: '系统设置', soon: true },
];

// 当前用户可见的第一个正式菜单，作为登录后的落地页；无可见菜单则返回 null（落首页）
export function firstVisibleMenu(can) {
  return ADMIN_MENUS.find((m) => !m.soon && (!m.perm || can(m.perm))) || null;
}
