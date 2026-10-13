# 用 Debian 系基础镜像而不是 alpine：better-sqlite3 只发布了 glibc 的预编译二进制，
# alpine(musl) 下必须现场编译，镜像里没装 python3/make/g++ 就会在 npm install 阶段直接失败。
FROM node:22-bookworm-slim
WORKDIR /app

# 先只拷依赖清单，利用构建缓存；带 lock 才能用 npm ci 保证版本可复现
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

# SQLite 默认库落在 /app/data（与 docker-compose 的挂载卷一致）
RUN mkdir -p data

EXPOSE 3000
CMD ["node", "index.js"]
