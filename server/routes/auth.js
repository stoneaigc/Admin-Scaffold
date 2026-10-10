// server/routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { verifyUser, signPortalToken, signAdminToken } = require('../auth');
const { getUserPermissions, hasAdminEntry } = require('../lib/permission');

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
  const r = await global.db.query('SELECT * FROM portal_users WHERE username = $1', [username]);
  if (r.rowCount === 0) return res.status(401).json({ error: '用户名或密码错误' });
  const user = r.rows[0];
  if (user.status !== 'active') return res.status(403).json({ error: '账号已禁用' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: '用户名或密码错误' });

  const token = user.is_portal_admin ? signAdminToken(user) : signPortalToken(user);
  const { permissions, roles } = await getUserPermissions(user.id);
  const adminEntry = await hasAdminEntry(user.id);
  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, is_portal_admin: user.is_portal_admin, roles },
    permissions,
    adminEntry,
  });
});

router.get('/me', verifyUser, async (req, res) => {
  const { permissions, roles } = await getUserPermissions(req.portalUser.id);
  const adminEntry = await hasAdminEntry(req.portalUser.id);
  res.json({
    user: {
      id: req.portalUser.id, username: req.portalUser.username, name: req.portalUser.name,
      is_portal_admin: req.portalUser.is_portal_admin, roles,
    },
    permissions,
    adminEntry,
  });
});

router.post('/logout', verifyUser, (req, res) => res.json({ ok: true }));

module.exports = router;
