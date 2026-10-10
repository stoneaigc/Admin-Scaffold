-- 003: 资源类型 + 资源组（SQLite 方言；资源隔离扩展位，业务无关）
CREATE TABLE IF NOT EXISTS resource_types (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    intersect_panel INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS resource_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resource_group_items (
    group_id INTEGER NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    PRIMARY KEY (group_id, resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS resource_group_members (
    group_id INTEGER NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rgi_group ON resource_group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_rgm_user ON resource_group_members(user_id);
