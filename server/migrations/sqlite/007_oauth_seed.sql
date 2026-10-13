-- 007: 第三方登录占位数据（SQLite 方言）
-- 迁移 004 只建了 oauth_providers 表，没插任何行。
-- 这里补三条默认关闭的 provider，让「后台显示的三个开关」在库里有对应的落点，
-- 接入授权流程时只需填 config / 置 enabled=1，不必再手工插数据。
INSERT INTO oauth_providers (provider, name, enabled, config, sort_order) VALUES
('wecom',    '企业微信', 0, '{}', 10),
('dingtalk', '钉钉',     0, '{}', 20),
('feishu',   '飞书',     0, '{}', 30)
ON CONFLICT (provider) DO NOTHING;
