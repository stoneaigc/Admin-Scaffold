# Admin Scaffold

通用「后台管理 + 前端展示」脚手架。业务无关，开箱即用地提供：

- **RBAC 权限内核**：用户 / 角色 / 权限 / 资源组（用户-角色-权限三元 + 资源白名单隔离）
- **鉴权中间件**：JWT 登录、`requirePermission(key)` 接口守卫、`optionalUser` 访客放行、登录/接口限流
- **系统设置中心**：系统名 / Logo / 主题色 / 默认外观 / SMTP 邮件配置（全部落库，支持发测试邮件）
- **前端骨架**：Apple 风浅色主题、明暗双模式、侧栏折叠、主题色切换（Vue3 + Vite + Tailwind，零 UI 库依赖）
- **部署**：本地零依赖直跑（SQLite）或 `docker-compose` 一键起（server + nginx 前端）

适合「企业内部资源自助平台 / 管理后台」这类项目：`clone` 下来，注册自己的资源类型，改皮即上线。

## 环境要求

- **Node.js >= 18（推荐 22，仓库带 `.nvmrc`）**
  - 后端用 `better-sqlite3`（原生模块），官方只提供到 Node 18/20/22 的预编译包；
    Node 23+ 可能要现场编译（需 Python + C++ 构建工具）。装不上就切回 22。
- 不需要装数据库，默认 SQLite 文件库（生产可切 PostgreSQL）

## 快速开始（本地，3 步）

```bash
git clone <your-repo-url> admin-scaffold && cd admin-scaffold
cp server/.env.example server/.env     # Windows: copy server\.env.example server\.env
npm run setup                          # 装后端+前端依赖 → 建库建表 → 构建前端
npm start                              # 启动，浏览器打开 http://localhost:3000
```

- 初始管理员：`.env` 里的 `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`（默认 `admin` / `admin123456`，**上线前务必改**）
- 后端端口：`.env` 的 `PORT`（默认 3000）
- 数据文件：`server/data/app.db`（已在 `.gitignore` 中，不入库）

`npm run setup` 等价于：

```bash
cd server && npm install
cd ../portal && npm install
cd ../server && npm run migrate     # 建表 + 种子权限/角色
cd ../portal && npm run build       # 产出 portal/dist（后端同源托管）
```

### 开发模式（前后端分离，热更新）

```bash
npm run dev:server    # http://localhost:3000（API）
npm run dev:portal    # http://localhost:5173（页面，已配 /api 代理到 3000）
```

改 `PORT` 后记得同步 `portal/vite.config.js` 里 `proxy['/api']` 的目标端口。

## Docker

```bash
cp server/.env.example server/.env   # 改 JWT_SECRET / SEED_ADMIN_PASSWORD
docker compose up -d --build
```

- 后端 API：http://localhost:3000
- 前端页面：http://localhost:8080（容器内构建静态产物，nginx 反代 `/api` 到 server）
- SQLite 数据落在仓库根的 `./data` 挂载卷

> server 镜像用 `node:22-bookworm-slim` 而不是 alpine：`better-sqlite3` 只有 glibc 预编译包，
> alpine(musl) 下要现场编译，缺构建工具链会直接构建失败。

## 切 PostgreSQL（生产）

```bash
# server/.env：
DB_TYPE=postgres
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DATABASE=admin_scaffold
# 然后照常：npm run migrate && npm start
# docker 方式见 docker-compose.yml 内注释段（取消注释 postgres 服务并改 server 环境变量）
```

迁移 SQL 按方言分目录（`migrations/sqlite`、`migrations/pg`），`DB_TYPE` 决定跑哪一套；业务 SQL 统一写 `$1` 占位符，SQLite 侧自动转换。

## 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| 打开 `localhost:3000` 只有 `{"error":"Not found"}` | 前端没构建。跑 `npm run build`（或 `cd portal && npm run dev` 用 5173） |
| 启动报「缺少 JWT_SECRET」 | 没复制 `.env`：`cp server/.env.example server/.env` |
| `EADDRINUSE: port 3000` | 改 `.env` 的 `PORT`，并同步 `portal/vite.config.js` 的 proxy 端口 |
| `npm install` 卡在 `better-sqlite3` 编译 | 切到 Node 22（`nvm use`），或确保装了 Python + C++ 构建工具 |
| 想重置数据 | 停服务后删 `server/data/app.db`（含 `-wal`/`-shm`），再 `npm run migrate && npm start` |
| 后台看不到「系统设置」菜单 | 需要 `system:config` / `menu:admin-config` 权限；超管（`is_portal_admin`）默认全放行 |

## 目录结构

```
.
├── package.json               # 统一入口脚本（setup / start / dev:server / dev:portal）
├── server/                    # Express 后端（RBAC 内核，SQLite/PostgreSQL 双方言）
│   ├── index.js               # 启动：自检 + 自动迁移 + 建初始管理员 + 监听
│   ├── app.js                 # 路由挂载 + 同源托管 portal/dist + SPA 回退
│   ├── auth.js                # JWT + verifyUser / requirePermission / 限流
│   ├── db.js                  # 统一驱动层（默认 SQLite，DB_TYPE=postgres 切 PG）
│   ├── resource-types.setup.js # ★ 业务接入点：在这里注册你的资源类型
│   ├── lib/
│   │   ├── permission.js      # 权限查询 + 资源可见性纯函数
│   │   ├── resource-types.js  # 资源类型注册表的引擎实现（一般不改）
│   │   ├── settings.js        # system_settings 读写（JSON 段 + 密钥脱敏）
│   │   ├── crypto.js          # AES-256-GCM（SMTP 密码等敏感配置加密落库）
│   │   ├── mailer.js          # SMTP 发信封装（含中文错误提示）
│   │   └── migrator.js        # 按 migrations/<dialect> 顺序执行，幂等
│   ├── routes/                # auth(登录) / rbac(用户·角色·权限·资源组) / portal(资源·品牌) / settings(系统设置·邮件)
│   └── migrations/
│       ├── sqlite/            # 001 核心 / 002 种子 / 003 资源组 / 004 OAuth / 005 系统设置 / 006 清理死表
│       └── pg/                # 同上，PostgreSQL 方言版
├── portal/                    # Vue3 + Vite + Tailwind 前端
│   ├── src/views              # Home(资源广场) / Login / admin(Users·Roles·Groups·Settings)
│   ├── src/composables        # useTheme(主题色) / useBrand(品牌) / useSidebar / usePermissions / useAsync
│   └── dist/                  # 构建产物（不入库，由 npm run build 产出）
└── docker-compose.yml         # server(3000) + frontend-nginx(8080)
```

## 怎么改成自己的项目

1. **注册资源类型**（后端 `server/resource-types.setup.js`）
   每个业务对象（模型 / 文档 / 商品 …）调用 `registerResourceType({ key, name, listAll })`，
   权限引擎据此做资源组白名单可见性，前端据此渲染广场。
   默认带 `服务` / `数据集` 两个示例，接业务时直接替换或删除。

2. **加权限原子**：在 `server/migrations/<dialect>/002_rbac_seed.sql`（`sqlite` / `pg` 两套都要加）追加 `permissions` 行，
   接口用 `requirePermission('your:perm')` 守卫，前端用 `usePermissions()` 的 `can()` 控制按钮。

3. **换皮**：前端 `portal/src/views` 复制 `UsersView` / `RolesView` 改成你的业务页，
   `AdminLayout.vue` 的侧边菜单按 `menu:admin-*` 权限动态渲染。系统名/Logo/主题色不用改代码，后台「系统设置」里改。

4. **接第三方**：网关 / 企业微信 / OAuth 等作为 `adapters/` 接入，配置走 `.env`，不污染内核。
   （OAuth  providers 表与后台 UI 占位已就绪，登录流程按需实现。）

## 权限模型

- `is_portal_admin = true` 的用户拥有全部权限（超管）。
- 普通用户通过 `user_roles` → `role_permissions` → `permissions` 获得权限原子。
- 资源可见性：用户所属 `resource_group_members` 勾选的 `resource_group_items` 构成严格白名单；
  超管 / 后台角色看全量。
- 前端后台入口：持有 `menu:admin-*` 或任一管理权限位即显示后台菜单（见 `permission.js` 的 `ADMIN_PERMS`）。

## 上线前检查清单

- [ ] 改 `.env`：`JWT_SECRET`（`openssl rand -hex 32`）、`SEED_ADMIN_PASSWORD`、`SETTINGS_ENC_KEY`
- [ ] `NODE_ENV=production`，按需收紧 `app.js` 里的 `cors()`（当前是全放开）
- [ ] 后台「系统设置 → 邮件配置」填好 SMTP 并点「发送测试邮件」验证
- [ ] 生产建议 `DB_TYPE=postgres`；继续用 SQLite 的话备份 `server/data/app.db`

## 开源说明

本仓库为通用模板，不含任何厂商品牌、密钥或内部引用。第三方对接以 `adapters/` 示例形式提供，
不内置业务。欢迎 fork 改造。
