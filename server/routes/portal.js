// server/routes/portal.js
// 公开/半公开接口：健康检查、资源可见性。
const router = require('express').Router();
const { optionalUser } = require('../auth');
const { getVisibleResourcesForUser, getAllResources } = require('../lib/permission');
const { getAllResourceTypes } = require('../lib/resource-types');
const { getSettings } = require('../lib/settings');

router.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// 资源类型清单（前端首页渲染广场用）。只暴露展示所需字段。
router.get('/resource-types', (req, res) => {
  res.json(getAllResourceTypes().map((t) => ({ key: t.key, name: t.name, sortOrder: t.sortOrder || 0 })));
});

// 公开：系统品牌（登录页在未登录状态下也要能取到系统名 / Logo）。
// 只返回 brand 段，天然不含 email / oauth 等任何密文。
router.get('/brand', async (req, res) => {
  try {
    const s = await getSettings();
    res.json(s.brand || {});
  } catch {
    // 表不存在（迁移未跑）时不要让登录页直接挂掉，返回空对象由前端回退默认值
    res.json({});
  }
});

// 当前用户可见资源（资源组白名单）。访客返回全量（由适配器/前端决定是否展示）。
router.get('/resources', optionalUser, async (req, res, next) => {
  try {
    const data = req.portalUser
      ? await getVisibleResourcesForUser(req.portalUser.id)
      : await getAllResources();
    res.json(data);
  } catch (err) {
    // 和 admin 路由同一个道理：DB 异常要变成 500 JSON，不能变成 unhandled rejection 打死进程
    console.error('[portal] 资源查询失败:', err.message);
    res.status(500).json({ error: '资源查询失败' });
  }
});

module.exports = router;
