// server/auth.js
// 鉴权中间件 + JWT 签发。业务无关，可直接用于任意项目的 RBAC 接入。
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('缺少 JWT_SECRET 环境变量，请在 .env 中配置（示例: JWT_SECRET=openssl rand -hex 32）');
  process.exit(1);
}

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试次数过多，请 5 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 校验登录用户（Bearer token -> portal_users）
const verifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'portal_user' && decoded.type !== 'admin') {
      return res.status(401).json({ error: 'Token 无效' });
    }
    const result = await global.db.query(
      'SELECT id, username, name, status, is_portal_admin FROM portal_users WHERE id = $1',
      [decoded.id]
    );
    if (result.rowCount === 0 || result.rows[0].status !== 'active') {
      return res.status(401).json({ error: '用户不存在或已禁用' });
    }
    req.portalUser = result.rows[0];
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
};

// 可选用户中间件：访客放行，登录用户附 req.portalUser
const optionalUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
    if (decoded.type === 'portal_user' || decoded.type === 'admin') {
      const result = await global.db.query(
        'SELECT id, is_portal_admin FROM portal_users WHERE id = $1 AND status = $2',
        [decoded.id, 'active']
      );
      if (result.rowCount) req.portalUser = result.rows[0];
    }
  } catch {
    // 无效 token 静默放行（访客语义）
  }
  next();
};

// 权限中间件：依赖 verifyUser 设的 req.portalUser
function requirePermission(permissionKey) {
  return async (req, res, next) => {
    if (!req.portalUser) return res.status(401).json({ error: '未登录' });
    if (req.portalUser.is_portal_admin) return next();
    const { hasPermission } = require('./lib/permission');
    const ok = await hasPermission(req.portalUser.id, permissionKey);
    if (!ok) return res.status(403).json({ code: 'FORBIDDEN', error: '权限不足' });
    next();
  };
}

// 查看类权限：超管 / 后台角色放行；普通用户需对应查看权限
function requirePermissionOrAdminRole(permissionKey) {
  return async (req, res, next) => {
    if (!req.portalUser) return res.status(401).json({ error: '未登录' });
    if (req.portalUser.is_portal_admin) return next();
    const { hasPermission, isAdminRoleUser } = require('./lib/permission');
    if (await isAdminRoleUser(req.portalUser.id)) return next();
    const ok = await hasPermission(req.portalUser.id, permissionKey);
    if (!ok) return res.status(403).json({ code: 'FORBIDDEN', error: '权限不足' });
    next();
  };
}

function resolveTokenExpires(user, fallback = Number(process.env.TOKEN_TTL || 86400)) {
  const sec = user && user.session_timeout;
  const n = Number(sec);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function signPortalToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, type: 'portal_user' },
    JWT_SECRET,
    { expiresIn: resolveTokenExpires(user) }
  );
}

function signAdminToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: 'admin', type: 'admin' },
    JWT_SECRET,
    { expiresIn: resolveTokenExpires(user) }
  );
}

// 一次性 ticket（5 分钟），用于 OAuth 登录/绑定流程的临时凭证
const TICKET_TTL = '5m';
const usedJti = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of usedJti) if (v < now) usedJti.delete(k);
}, 60_000).unref?.();

function signOauthTicket(payload) {
  const jti = crypto.randomBytes(8).toString('hex');
  return jwt.sign({ ...payload, type: 'oauth_ticket', jti }, JWT_SECRET, { expiresIn: TICKET_TTL });
}

function consumeTicket(token, expectedType) {
  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); }
  catch { throw new Error('OAUTH_TICKET_INVALID'); }
  if (decoded.type !== expectedType) throw new Error('OAUTH_TICKET_INVALID');
  if (!decoded.jti || usedJti.has(decoded.jti)) throw new Error('OAUTH_TICKET_INVALID');
  usedJti.set(decoded.jti, Date.now() + 5 * 60 * 1000);
  return decoded;
}

module.exports = {
  JWT_SECRET,
  loginLimiter,
  apiLimiter,
  verifyUser,
  optionalUser,
  requirePermission,
  requirePermissionOrAdminRole,
  signPortalToken,
  signAdminToken,
  signOauthTicket,
  consumeTicket,
};
