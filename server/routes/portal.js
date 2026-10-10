// server/routes/portal.js
// 公开/半公开接口：健康检查、资源可见性。
const router = require('express').Router();
const { optionalUser } = require('../auth');
const { getVisibleResourcesForUser, getAllResources } = require('../lib/permission');
const { getAllResourceTypes } = require('../lib/resource-types');

router.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// 资源类型清单（前端首页渲染广场用）。只暴露展示所需字段。
router.get('/resource-types', (req, res) => {
  res.json(getAllResourceTypes().map((t) => ({ key: t.key, name: t.name, sortOrder: t.sortOrder || 0 })));
});

// 当前用户可见资源（资源组白名单）。访客返回全量（由适配器/前端决定是否展示）。
router.get('/resources', optionalUser, async (req, res) => {
  const data = req.portalUser
    ? await getVisibleResourcesForUser(req.portalUser.id)
    : await getAllResources();
  res.json(data);
});

module.exports = router;
