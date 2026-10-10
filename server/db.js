// server/db.js
// 统一数据库驱动层。默认 SQLite（零外部依赖，开箱即跑），生产可切 PostgreSQL。
//   默认: DB_TYPE 留空 / =sqlite  -> better-sqlite3（文件库 server/data/app.db）
//   切换: DB_TYPE=postgres        -> pg 连接池（读 PG_* 环境变量）
//
// 统一接口（路由/权限/鉴权全部走它，业务代码无需关心方言）：
//   await db.query(sql, params) -> { rows, rowCount }   // pg 风格返回，屏蔽方言差异
//   await db.exec(sql)                                  // 多语句 DDL（迁移用）
//   await db.runMigration(sql, name)                    // 单文件迁移（自带事务 + 记录）
//
// 占位符约定：业务 SQL 统一用 PostgreSQL 风格 $1/$2...；SQLite 端在 query 内自动转成 ?。
//   ILIKE 在 SQLite 端自动降级为 LIKE（SQLite 的 LIKE 对 ASCII 默认大小写不敏感）。
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase();
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'data', 'app.db');

// 把 PostgreSQL 风格 SQL 转成 SQLite 可执行的等价写法
function translateForSqlite(sql) {
  return sql
    .replace(/\bILIKE\b/gi, 'LIKE') // ILIKE -> LIKE（SQLite 无 ILIKE）
    .replace(/\$(\d+)/g, '?');      // $1/$2... -> ?（参数按出现顺序绑定）
}

let api;

if (DB_TYPE === 'postgres') {
  // ---------- PostgreSQL ----------
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DATABASE || 'admin_scaffold',
    max: Number(process.env.PG_MAX || 10),
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (err) => console.error('[db] 连接池异常:', err.message));

  api = {
    dialect: 'postgres',
    async query(sql, params = []) {
      const res = await pool.query(sql, params);
      return { rows: res.rows, rowCount: res.rowCount };
    },
    async exec(sql) { await pool.query(sql); },
    async runMigration(sql, name) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
} else {
  // ---------- SQLite（默认）----------
  const Database = require('better-sqlite3');
  fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
  const sqlite = new Database(SQLITE_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');

  api = {
    dialect: 'sqlite',
    query(sql, params = []) {
      const tSql = translateForSqlite(sql);
      const returnsData = /^\s*(SELECT|WITH|PRAGMA|VALUES)\b/i.test(tSql) || /\bRETURNING\b/i.test(tSql);
      const stmt = sqlite.prepare(tSql);
      if (returnsData) {
        const rows = stmt.all(...params);
        const rowCount = rows.length || sqlite.changes;
        return Promise.resolve({ rows, rowCount });
      }
      const info = stmt.run(...params);
      return Promise.resolve({ rows: [], rowCount: info.changes });
    },
    exec(sql) { sqlite.exec(sql); return Promise.resolve(); },
    runMigration(sql, name) {
      const tx = sqlite.transaction(() => {
        sqlite.exec(sql);
        sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
      });
      tx();
      return Promise.resolve();
    },
    close: () => sqlite.close(),
  };
}

global.db = api;
module.exports = api;
