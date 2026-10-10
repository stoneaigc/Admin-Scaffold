// server/app.js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const rbacRoutes = require('./routes/rbac');
const portalRoutes = require('./routes/portal');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', rbacRoutes);
app.use('/api', portalRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// 统一错误处理
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: '服务器错误' });
});

module.exports = app;
