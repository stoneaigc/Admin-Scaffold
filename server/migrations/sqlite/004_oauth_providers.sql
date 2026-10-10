-- 004: 第三方登录 Provider（SQLite 方言；通用骨架，不内置任何厂商）
-- 具体厂商（企业微信 / GitHub / Google ...）作为 adapters 接入，本表只存配置。
-- JSONB 在 SQLite 侧用 TEXT 存 JSON 字符串（适配器读取时 JSON.parse）。
CREATE TABLE IF NOT EXISTS oauth_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    config TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_identities (
    user_id INTEGER NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    profile TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, provider, external_id)
);
