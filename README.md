# Admin Scaffold

通用「后台管理 + 前端展示」脚手架。业务无关，开箱即用地提供：

- **RBAC 权限内核**：用户 / 角色 / 权限 / 资源组（用户-角色-权限三元 + 资源白名单隔离）
- **鉴权中间件**：JWT 登录、`requirePermission(key)` 接口守卫、`optionalUser` 访客放行
- **前端展示页 + 后台管理** 的最小 Tailwind 骨架（登录 / 用户管理 / 角色权限）
- **一键部署**：`docker-compose` 起 Express（默认 SQLite，可选 PostgreSQL）

适合「企业内部资源自助平台 / 管理后台」这类项目：`clone` 下来，注册自己的资源类型，改皮即上线。

## 技术栈

- 后端：Node.js (Express, CommonJS)
- 数据库：**默认 SQLite**（零外部依赖，开箱即跑）；生产切 **PostgreSQL**（`DB_TYPE=postgres`，迁移按方言分目录）
- 前端：Vue 3 + Vite + Tailwind CSS（零 UI 组件库依赖，轻量）
- 鉴权：JSON Web Token

## 快速开始

### 默认：本地直接跑（SQLite，无需装数据库）

```bash
cp server/.env.example server/.env   # DB_TYPE 默认 sqlite，不用改
cd server && npm install
npm run migrate                       # 在 server/data/app.db 建表 + 种子
npm start                             # 启动，自动建初始管理员
```

后端默认 `http://localhost:3000`。

### 方式二：Docker（默认 SQLite）

```bash
cp server/.env.example server/.env   # 改 JWT_SECRET / 初始管理员密码
docker-compose up -d                  # 起 server（SQLite 文件库），自动迁移 + 建初始管理员
```

### 方式三：切 PostgreSQL（生产）

```bash
# server/.env 里：
DB_TYPE=postgres
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DATABASE=admin_scaffold
# 然后与 SQLite 相同：npm run migrate && npm start
# 或 docker-compose 取消注释 postgres 服务段（见 docker-compose.yml 内说明）
```

初始管理员账号来自 `.env` 的 `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`。

## 目录结构

```
.
├── server/                # Express 后端（RBAC 内核，SQLite/PostgreSQL 双方言）
│   ├── index.js           # 启动：自动迁移 + 建初始管理员 + 监听
│   ├── app.js             # 路由挂载
│   ├── auth.js            # JWT + verifyUser / requirePermission 中间件
│   ├── db.js              # 统一驱动层（默认 SQLite，DB_TYPE=postgres 切 PG）
│   ├── lib/
│   │   ├── permission.js  # 权限查询 + 资源可见性纯函数
│   │   ├── resource-types.js # 资源类型注册表（业务接入点）
│   │   └── migrator.js    # 按 migrations/<dialect> 顺序执行
│   ├── routes/            # auth(登录) / rbac(用户·角色·权限·资源组) / portal(资源)
│   └── migrations/
│       ├── sqlite/        # 001 RBAC 核心 / 002 种子 / 003 资源组 / 004 OAuth
│       └── pg/           # 同上，PostgreSQL 方言版
├── portal/                # Vue3 + Vite + Tailwind 前端骨架
└── docker-compose.yml
```

## 怎么改成自己的项目

1. **注册资源类型**（后端 `server/lib/resource-types.js`）
   每个业务对象（模型 / 文档 / 商品 …）调用 `registerResourceType({ key, name, listAll })`，
   权限引擎据此做资源组白名单可见性，前端据此渲染广场。

2. **加权限原子**：在 `server/migrations/<dialect>/002_rbac_seed.sql`（`sqlite` / `pg` 两套都要加）追加 `permissions` 行，
   接口用 `requirePermission('your:perm')` 守卫，前端用 `usePermissions()` 的 `can()` 控制按钮。

3. **换皮**：前端 `portal/src/views` 复制 `UsersView` / `RolesView` 改成你的业务页，
   `AdminLayout.vue` 的侧边菜单按 `menu:admin-*` 权限动态渲染。

4. **接第三方**：网关 / 企业微信 / OAuth 等作为 `adapters/` 接入，配置走 `.env`，不污染内核。

## 权限模型

- `is_portal_admin = true` 的用户拥有全部权限（超管）。
- 普通用户通过 `user_roles` → `role_permissions` → `permissions` 获得权限原子。
- 资源可见性：用户所属 `resource_group_members` 勾选的 `resource_group_items` 构成严格白名单；
  超管 / 后台角色看全量。
- 前端后台入口：持有 `menu:admin-*` 或任一管理权限位即显示后台菜单（见 `permission.js` 的 `ADMIN_PERMS`）。

## 开源说明

本仓库为通用模板，不含任何厂商品牌、密钥或内部引用。第三方对接以 `adapters/` 示例形式提供，
不内置业务。欢迎 fork 改造。
