// server/index.js
const fs = require('fs');
const path = require('path');
require('dotenv').config();
require('./db'); // 初始化 global.db（统一驱动层）
const app = require('./app');
const { run } = require('./lib/migrator');
const bcrypt = require('bcryptjs');
require('./resource-types.setup'); // 注册业务资源类型（业务接入点）

// 首次启动按 .env 创建初始管理员（可留空关闭）
async function seedAdmin() {
  const { SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME } = process.env;
  if (!SEED_ADMIN_USERNAME || !SEED_ADMIN_PASSWORD) return;
  const exist = await global.db.query('SELECT 1 FROM portal_users WHERE username = $1', [SEED_ADMIN_USERNAME]);
  if (exist.rowCount) return;
  const hash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
  await global.db.query(
    'INSERT INTO portal_users (username, name, password_hash, status, is_portal_admin) VALUES ($1, $2, $3, $4, 1)',
    [SEED_ADMIN_USERNAME, SEED_ADMIN_NAME || SEED_ADMIN_USERNAME, hash, 'active']
  );
  console.log(`[seed] 已创建初始管理员: ${SEED_ADMIN_USERNAME}`);
}

/**
 * 启动自检：把「能启动但显然不对」的状态在第一行日志就说清楚。
 * 全新 clone 后最常见的四件事：没 cp .env、前端没 build、还在用示例口令、JWT 密钥还是示例值。
 * 这四条都不报错，但都会让人以为「项目坏了」（或上线后出事），所以主动喊出来。
 */
function preflight() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath) && !process.env.JWT_SECRET) {
    console.warn(
      '\n[preflight] 未找到 server/.env，也没有设置 JWT_SECRET。\n' +
        '           请先执行: cp server/.env.example server/.env（Windows: copy server\\.env.example server\\.env）\n'
    );
  }

  const dist = path.join(__dirname, '..', 'portal', 'dist', 'index.html');
  if (!fs.existsSync(dist)) {
    console.warn(
      '\n[preflight] 未找到 portal/dist —— 现在只能访问后端 API，浏览器打开会看到 {"error":"Not found"}。\n' +
        '           构建前端: cd portal && npm install && npm run build\n' +
        '           或直接开发模式: cd portal && npm run dev（访问 http://localhost:5173，已配好 /api 代理）\n'
    );
  }

  const secret = process.env.JWT_SECRET || '';
  if (secret === 'change-me-to-a-random-secret' || (secret && secret.length < 16)) {
    console.warn(
      '\n[preflight] 警告: JWT_SECRET 仍是示例值或过短，任何人都能伪造登录 token。\n' +
        '           生成一个: openssl rand -hex 32（Windows 可用 node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"）\n'
    );
  }

  if (process.env.SEED_ADMIN_PASSWORD === 'admin123456') {
    console.warn(
      '\n[preflight] 警告: 仍在用示例口令 admin123456，请改 server/.env 的 SEED_ADMIN_PASSWORD（或 docker-compose 的同名变量）。\n'
    );
  }
}

async function main() {
  preflight();
  await run();
  await seedAdmin();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`admin-scaffold server 监听 http://localhost:${port}`);
    if (fs.existsSync(path.join(__dirname, '..', 'portal', 'dist', 'index.html'))) {
      console.log(`前端已构建: 直接打开 http://localhost:${port} 即可`);
    }
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
