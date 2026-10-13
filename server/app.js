// server/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth');
// apiLimiter 之前只导出没挂载：所有接口裸奔，既挡不住扫描也不挡得住误用导致的打爆
const { apiLimiter } = require('./auth');
const rbacRoutes = require('./routes/rbac');
const portalRoutes = require('./routes/portal');
const settingsRoutes = require('./routes/settings');

const app = express();
app.use(cors());
app.use(express.json());

// 若前端已构建（portal/dist 存在），同源托管静态资源 + SPA 回退。
// 这样浏览器同端口访问，/api 同源调用，无需额外的 dev 代理。
const portalDist = path.join(__dirname, '..', 'portal', 'dist');
const servePortal = fs.existsSync(portalDist);
if (servePortal) {
  // 缓存策略：入口 HTML 不缓存（保证重新构建后刷新即拿到新的 chunk 名），
  // 带 hash 的静态资源长缓存。
  app.use(
    express.static(portalDist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else if (path.extname(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
}

app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/admin', rbacRoutes);
// 系统设置同样挂在 /api/admin 下（与 rbac 共用前缀，各自用 requirePermission 守卫）
app.use('/api/admin', settingsRoutes);
app.use('/api', portalRoutes);

// SPA 回退：非 /api 的 GET 一律返回 index.html（仅启用静态托管时）
if (servePortal) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    // 带扩展名的静态资源不存在时不要回退成 HTML：否则浏览器会拿到
    // text/html 当 JS 解析，动态 import 静默失败 -> 页面空白却无明确报错。
    if (path.extname(req.path)) return res.status(404).send('Not found');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.sendFile(path.join(portalDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// 统一错误处理
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: '服务器错误' });
});

module.exports = app;
