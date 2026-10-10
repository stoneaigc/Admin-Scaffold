-- 002: 权限原子 + 内置角色 + 种子
INSERT INTO permissions (module, action, key, name) VALUES
('user',     'view',   'user:view',     '用户查看'),
('user',     'create', 'user:create',   '用户创建'),
('user',     'edit',   'user:edit',     '用户编辑'),
('user',     'delete', 'user:delete',   '用户删除'),
('user',     'password','user:password', '用户改密'),
('user',     'assign', 'user:assign',   '用户分配角色'),
('role',     'view',   'role:view',     '角色查看'),
('role',     'create', 'role:create',   '角色创建'),
('role',     'edit',   'role:edit',     '角色编辑'),
('role',     'delete', 'role:delete',   '角色删除'),
('group',    'view',   'group:view',    '资源组查看'),
('group',    'create', 'group:create',  '资源组创建'),
('group',    'edit',   'group:edit',     '资源组编辑'),
('group',    'delete', 'group:delete',  '资源组删除'),
('group',    'assign', 'group:assign',  '资源组授权'),
('resource', 'view',   'resource:view', '资源查看'),
('resource', 'create', 'resource:create','资源创建'),
('resource', 'edit',   'resource:edit', '资源编辑'),
('resource', 'delete', 'resource:delete','资源删除'),
('system',   'config', 'system:config', '系统配置')
ON CONFLICT (key) DO NOTHING;

-- 后台菜单权限（前端据此显示/隐藏后台入口与菜单项）
INSERT INTO permissions (module, action, key, name) VALUES
('menu', 'admin-users',  'menu:admin-users',  '菜单-用户管理'),
('menu', 'admin-roles',  'menu:admin-roles',  '菜单-角色权限'),
('menu', 'admin-groups', 'menu:admin-groups', '菜单-资源组'),
('menu', 'admin-config', 'menu:admin-config', '菜单-系统设置')
ON CONFLICT (key) DO NOTHING;

INSERT INTO roles (name, description, is_system) VALUES
('admin', '超级管理员（实际鉴权走 is_portal_admin）', TRUE),
('user',  '普通用户', TRUE)
ON CONFLICT DO NOTHING;

-- user 角色默认权限（登录即可看自己的资源）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND r.is_system = TRUE
  AND p.key IN ('user:view', 'resource:view', 'group:view')
ON CONFLICT (role_id, permission_id) DO NOTHING;
