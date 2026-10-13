-- 006: 清理死 schema（PostgreSQL 方言）
-- 迁移 003 建的 resource_types 表（含 intersect_panel 列）从未被任何代码读写：
-- 真正生效的资源类型注册表是 server/lib/resource-types.js 里的内存 Map，
-- 由 server/resource-types.setup.js 在启动时填充。留着这张表只会误导接手的人。
DROP TABLE IF EXISTS resource_types;
