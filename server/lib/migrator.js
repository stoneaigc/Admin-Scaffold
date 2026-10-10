// server/lib/migrator.js
// 顺序执行 migrations/<dialect>/*.sql（dialect = sqlite | postgres，由 DB_TYPE 决定）。
// 已执行的记录在 _migrations 表，幂等可重跑。
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function ensureMigrationsTable() {
  if (db.dialect === 'postgres') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

async function appliedNames() {
  const r = await db.query('SELECT name FROM _migrations');
  return new Set(r.rows.map((row) => row.name));
}

async function run() {
  const dir = path.join(__dirname, '..', 'migrations', db.dialect);
  if (!fs.existsSync(dir)) {
    throw new Error(`找不到迁移目录: ${dir}（请确认 DB_TYPE=${db.dialect} 对应的 migrations/${db.dialect} 存在）`);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort(); // 001_* < 002_* ...

  await ensureMigrationsTable();
  const done = await appliedNames();

  for (const file of files) {
    if (done.has(file)) {
      console.log(`[migrate] 跳过已执行: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`[migrate] 执行: ${file}`);
    try {
      await db.runMigration(sql, file);
    } catch (err) {
      console.error(`[migrate] 失败: ${file} -> ${err.message}`);
      throw err;
    }
  }
  console.log('[migrate] 完成');
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { run };
