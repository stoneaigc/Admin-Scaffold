# ============================================================================
# All-in-One 镜像：一个容器 = 后端 API + 前端静态资源，同一个端口（默认 3000）
#
#   docker build -t admin-scaffold .
#   docker run -d --name admin-scaffold -p 3000:3000 \
#     -v admin-scaffold-data:/app/server/data \
#     -e JWT_SECRET=$(openssl rand -hex 32) \
#     -e SEED_ADMIN_PASSWORD='你的密码' \
#     admin-scaffold
#
# 目录布局（改了就失效，动之前先看 app.js 的静态托管逻辑）：
#   /app/server/         后端源码      -> node server/index.js
#   /app/portal/dist/    前端构建产物  -> app.js 用 __dirname/../portal/dist 找它，同源托管
#   /app/server/data/    SQLite 库     -> 挂载卷，首次启动自动建库建表 + 建初始管理员
# ============================================================================

# ---------- 阶段 1：构建前端 ----------
FROM node:22-bookworm-slim AS frontend
WORKDIR /build
# 先只拷依赖清单，改代码不会让这层缓存失效
COPY portal/package.json portal/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY portal/ ./
RUN npm run build

# ---------- 阶段 2：安装后端依赖 ----------
FROM node:22-bookworm-slim AS backend
WORKDIR /build
# ⚠️ 基础镜像必须是 Debian 系：better-sqlite3 只发布 glibc 预编译包，
#    alpine(musl) 下要现场编译，镜像没装 python3/make/g++ 会直接构建失败。
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 阶段 3：运行时 ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    DB_TYPE=sqlite \
    SQLITE_PATH=/app/server/data/app.db

WORKDIR /app

# 依赖与源码分开拷：改业务代码不会重装依赖
COPY --from=backend /build/node_modules ./server/node_modules
COPY server ./server
COPY --from=frontend /build/dist ./portal/dist

# SQLite 主库 + WAL/SHM 都在这里；挂载卷后首次启动由应用自己建库建表
RUN mkdir -p /app/server/data

EXPOSE 3000

# 健康检查打 /api/health（免鉴权）。node 22 自带 fetch，不必为它在镜像里装 curl/wget。
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 以 root 运行是刻意的：数据目录常被挂载成宿主的 root:root 755，
# 切成 node 用户反而写不进 app.db，一键部署当场翻车。
# 需要非 root 的话：把挂载目录 chown 1000:1000，再加一行 USER node。
CMD ["node", "server/index.js"]
