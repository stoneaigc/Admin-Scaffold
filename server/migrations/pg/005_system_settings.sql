-- 005: 系统设置（单租户：固定 id=1 的单行配置表）
-- 说明：这里刻意使用 TEXT 而非 JSONB —— 为了与 sqlite 方言共用同一套路由 SQL，
-- 序列化的差异统一由 server/lib/settings.js 屏蔽（对单行配置表没有索引需求）。
CREATE TABLE IF NOT EXISTS system_settings (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    brand       TEXT NOT NULL DEFAULT '{}',
    email       TEXT NOT NULL DEFAULT '{}',
    appearance  TEXT NOT NULL DEFAULT '{}',
    updated_by  INTEGER,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
