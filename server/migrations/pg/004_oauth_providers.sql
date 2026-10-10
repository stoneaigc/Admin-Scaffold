-- 004: 第三方登录 Provider（通用骨架，不内置任何厂商）
-- 具体厂商（企业微信 / GitHub / Google ...）作为 adapters 接入，本表只存配置。
CREATE TABLE IF NOT EXISTS oauth_providers (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_identities (
    user_id INTEGER NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    profile JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, provider, external_id)
);
