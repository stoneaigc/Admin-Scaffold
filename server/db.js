// server/db.js
// 统一数据库驱动层。默认 SQLite（零外部依赖，开箱即跑），生产可切 PostgreSQL。
//   默认: DB_TYPE 留空 / =sqlite  -> better-sqlite3（文件库 server/data/app.db）
//   切换: DB_TYPE=postgres        -> pg 连接池（读 PG_* 环境变量）
//
// 统一接口（路由/权限/鉴权全部走它，业务代码无需关心方言）：
//   await db.query(sql, params) -> { rows, rowCount }   // pg 风格返回，屏蔽方言差异
//   await db.exec(sql)                                  // 多语句 DDL（迁移用）
//   await db.tx(fn)                                     // 事务：fn(query) 内的语句同生共死
//   await db.runMigration(sql, name)                    // 单文件迁移（自带事务 + 记录）
//
// 占位符约定：业务 SQL 统一用 PostgreSQL 风格 $1/$2...；SQLite 端在 query 内自动转成 ?。
//   ILIKE 在 SQLite 端自动降级为 LIKE（SQLite 的 LIKE 对 ASCII 默认大小写不敏感）。
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase();
// 相对路径一律按 server/ 目录解析：否则 `node server/index.js`（在仓库根执行）
// 会把库建到 ./data/app.db，和 `cd server && npm start` 用的不是同一个库，
// 表现为「刚才建好的管理员没了」，极难排查。
const SQLITE_PATH = path.resolve(
  __dirname,
  process.env.SQLITE_PATH || path.join('data', 'app.db')
);

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
    /**
     * 事务：fn 内用同一个连接，收到一个 query(sql, params) 执行器。
     * 为什么需要：像「整体替换角色权限」这种 DELETE + 批量 INSERT，
     * 中途任何一条失败都会留下「旧的已删、新的没写」的脏数据（等于权限被清空）。
     */
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(async (sql, params = []) => {
          const r = await client.query(sql, params);
          return { rows: r.rows, rowCount: r.rowCount };
        });
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
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
  // SQLite 默认关闭外键约束（每个连接独立），不开则 schema 里写的
  // ON DELETE CASCADE 全部失效：删资源组会留下 resource_group_items / members 孤儿行，
  // 而孤儿行仍能被「用户←成员←组←资源」的 join 命中，导致已删除组的资源依旧可见。
  sqlite.pragma('foreign_keys = ON');

  // 真正执行一条语句（同步完成，只是为了统一接口才包成 Promise）
  const run = (sql, params = []) => {
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
  };

  // better-sqlite3 是同步驱动、单连接，但 query 对外是 async：
  // 一旦在事务里 await，其他请求的语句就可能插进这个事务。所以显式串行化，
  // 保证任一时刻只有「一条语句」或「一整个事务」在跑。
  let chain = Promise.resolve();
  const serialize = (fn) => {
    const p = chain.then(fn);
    chain = p.catch(() => {});
    return p;
  };

  api = {
    dialect: 'sqlite',
    query(sql, params = []) {
      return serialize(() => run(sql, params));
    },
    /** 事务：fn 收到的 query 执行器不走锁（已在事务独占窗口内），否则会自己等自己 */
    tx(fn) {
      return serialize(async () => {
        sqlite.exec('BEGIN');
        try {
          const out = await fn(run);
          sqlite.exec('COMMIT');
          return out;
        } catch (e) {
          try { sqlite.exec('ROLLBACK'); } catch { /* 回滚失败也要把原始错误抛出去 */ }
          throw e;
        }
      });
    },
    exec(sql) { return serialize(() => { sqlite.exec(sql); }); },
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
