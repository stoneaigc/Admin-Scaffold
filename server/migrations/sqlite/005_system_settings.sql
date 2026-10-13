-- 005: 系统设置（单租户：固定 id=1 的单行配置表）
-- brand / email / appearance 一律用 TEXT 存 JSON 字符串（与 oauth_providers.config 同策略），
-- 这样 pg 与 sqlite 两套方言可以共用完全相同的路由 SQL，只在 JS 侧 JSON.stringify / JSON.parse。
CREATE TABLE IF NOT EXISTS system_settings (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    brand       TEXT NOT NULL DEFAULT '{}',
    email       TEXT NOT NULL DEFAULT '{}',
    appearance  TEXT NOT NULL DEFAULT '{}',
    updated_by  INTEGER,
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (id) VALUES (1) ON CONFLICT(id) DO NOTHING;
