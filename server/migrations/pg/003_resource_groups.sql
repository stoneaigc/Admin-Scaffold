-- 003: 资源类型 + 资源组（资源隔离扩展位，业务无关）
CREATE TABLE IF NOT EXISTS resource_types (
    key VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    intersect_panel BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS resource_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resource_group_items (
    group_id INTEGER NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (group_id, resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS resource_group_members (
    group_id INTEGER NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rgi_group ON resource_group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_rgm_user ON resource_group_members(user_id);
