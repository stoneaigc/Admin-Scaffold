// server/index.js
require('dotenv').config();
require('./db'); // 初始化 global.db（统一驱动层）
const app = require('./app');
const { run } = require('./lib/migrator');
const bcrypt = require('bcryptjs');

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

async function main() {
  await run();
  await seedAdmin();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`admin-scaffold server 监听 http://localhost:${port}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
