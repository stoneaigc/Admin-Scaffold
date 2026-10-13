// server/routes/settings.js
// 系统设置读写。挂载在 /api/admin 下，全部用 requirePermission('system:config') 守卫。
//
// 注意：公开的品牌信息走 GET /api/brand（见 routes/portal.js），
// 登录页在未登录状态下也要能取到系统名 / Logo，所以不能挂在这里。
const router = require('express').Router();
const { verifyUser, requirePermission } = require('../auth');
const { getSettings, maskSecrets, parseJson, EMPTY } = require('../lib/settings');
const { encrypt } = require('../lib/crypto');
const { sendMail, loadMailConfig } = require('../lib/mailer');

// 白名单式取字段：前端传什么都不会有多余的键落库
const BRAND_KEYS = ['name', 'shortName', 'welcome', 'description', 'logo', 'footer'];
const APPEARANCE_KEYS = ['defaultMode', 'defaultAccent', 'defaultCollapsed'];
const EMAIL_KEYS = ['enabled', 'host', 'port', 'encryption', 'from', 'fromName', 'username', 'password'];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/**
 * 兜底包装：把未捕获异常转成 500 JSON。
 * 不这么做的话，任何一个 DB 异常都会变成 unhandled rejection 直接把 node 进程打挂
 * （本次就是这么撞出来的：占位符个数不匹配导致整个服务退出）。
 */
function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error('[settings] 操作失败:', err.message);
      res.status(500).json({ error: '系统设置操作失败' });
    }
  };
}

/** 只更新本次传进来的段，未传的段保持原值（避免整段被覆盖丢失） */
async function writeSettings({ brand, email, appearance }, userId) {
  const cur = await getSettings();
  const next = {
    brand: { ...cur.brand, ...(brand || {}) },
    email: { ...cur.email, ...(email || {}) },
    appearance: { ...cur.appearance, ...(appearance || {}) },
  };

  // SMTP 密码语义（重要）：
  //   不传 / 传空串 -> 保持库里已存的密码不动（否则「只改个系统名」也会把邮件密码冲掉）
  //   传非空字符串  -> 重新加密落库
  //   显式传 null   -> 清除已保存的密码
  if (next.email.password !== undefined) {
    const p = next.email.password;
    if (p === null) delete next.email.passwordEnc;
    else if (String(p) !== '') next.email.passwordEnc = encrypt(String(p));
    delete next.email.password;
  }

  await global.db.query(
    // ⚠️ 占位符只能出现一次：sqlite 侧会把每个 $n 逐个展开成 ?，
    //    若 DO UPDATE 里再写一遍 $1..$4 就会变成 8 个 ? 却只传 4 个参数（直接崩进程）。
    //    所以用 excluded.xxx 引用待插入值 —— pg 与 sqlite 都支持。
    `INSERT INTO system_settings (id, brand, email, appearance, updated_by, updated_at)
     VALUES (1, $1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       brand = excluded.brand,
       email = excluded.email,
       appearance = excluded.appearance,
       updated_by = excluded.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(next.brand), JSON.stringify(next.email), JSON.stringify(next.appearance), userId || null]
  );
  return next;
}

// ---------------------------------------------------------------- 后台读写

router.get('/settings', verifyUser, requirePermission('system:config'), wrap(async (req, res) => {
  const settings = await getSettings();

  // 第三方登录：读迁移 004 已有的 oauth_providers；secret 一律不下发，只给 hasSecret
  const p = await global.db.query(
    'SELECT provider, name, enabled, config, sort_order FROM oauth_providers ORDER BY sort_order, provider'
  );
  const oauth = p.rows.map((row) => {
    const cfg = parseJson(row.config);
    const { secret, ...safe } = cfg;
    return {
      provider: row.provider,
      name: row.name,
      enabled: !!row.enabled,
      config: { ...safe, hasSecret: !!secret },
      sortOrder: row.sort_order,
    };
  });

  res.json({
    brand: { ...EMPTY().brand, ...settings.brand },
    email: maskSecrets(settings.email),
    appearance: { ...EMPTY().appearance, ...settings.appearance },
    oauth,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  });
}));

// 保存前的值域校验。品牌名这类字段前端已经限制过，但接口不能只靠前端守：
// logo 是 data URL，不设上限能把几百 KB 甚至上 MB 的字符串塞进单行配置里；
// 不限制协议前缀则可能被塞进外链地址，变成每个页面都加载的第三方资源。
const MAX_LOGO_CHARS = 512 * 1024;
const MAX_TEXT = 500;
const MODES = ['light', 'dark', 'system'];
const ENCRYPTIONS = ['ssl', 'starttls', 'none'];

function validateSettings({ brand, email, appearance }) {
  if (brand) {
    if (brand.name !== undefined) {
      const n = String(brand.name || '').trim();
      if (!n) return '系统名称不能为空';
      if (n.length > 64) return '系统名称不能超过 64 个字符';
    }
    if (brand.logo !== undefined && brand.logo !== null && String(brand.logo) !== '') {
      const logo = String(brand.logo);
      if (logo.length > MAX_LOGO_CHARS) return 'Logo 体积过大（上限 512KB）';
      // 只允许内联图片：http(s) 外链会成为所有页面都去加载的第三方资源
      if (!/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(logo)) {
        return 'Logo 需为 base64 内联图片（data:image/...）';
      }
    }
    for (const k of ['shortName', 'welcome', 'description', 'footer']) {
      if (brand[k] !== undefined && String(brand[k]).length > MAX_TEXT) {
        return `${k} 不能超过 ${MAX_TEXT} 个字符`;
      }
    }
  }
  if (email) {
    if (email.encryption !== undefined && !ENCRYPTIONS.includes(email.encryption)) {
      return `加密方式只能是 ${ENCRYPTIONS.join(' / ')}`;
    }
    if (email.port !== undefined && String(email.port) !== '') {
      const p = Number(email.port);
      if (!Number.isInteger(p) || p < 1 || p > 65535) return '端口需为 1-65535 的整数';
    }
    if (email.from !== undefined && String(email.from) !== '' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email.from))) {
      return '发件人邮箱格式不正确';
    }
  }
  if (appearance) {
    if (appearance.defaultMode !== undefined && !MODES.includes(appearance.defaultMode)) {
      return `默认外观只能是 ${MODES.join(' / ')}`;
    }
    if (appearance.defaultAccent !== undefined && !/^[a-z]{3,20}$/.test(String(appearance.defaultAccent))) {
      return '主题色标识不合法';
    }
    if (appearance.defaultCollapsed !== undefined && typeof appearance.defaultCollapsed !== 'boolean') {
      return '默认折叠需为布尔值';
    }
  }
  return null;
}

router.put('/settings', verifyUser, requirePermission('system:config'), wrap(async (req, res) => {
  const body = req.body || {};
  const brand = body.brand ? pick(body.brand, BRAND_KEYS) : undefined;
  const appearance = body.appearance ? pick(body.appearance, APPEARANCE_KEYS) : undefined;
  const email = body.email ? pick(body.email, EMAIL_KEYS) : undefined;

  const invalid = validateSettings({ brand, email, appearance });
  if (invalid) return res.status(400).json({ error: invalid });

  const next = await writeSettings(
    { brand, email, appearance },
    req.portalUser && req.portalUser.id
  );
  res.json({ ok: true, brand: next.brand, updatedAt: new Date().toISOString() });
}));

// ---------------------------------------------------------------- 邮件：发送测试

/**
 * 发一封测试邮件，验证 SMTP 是否配好。
 * body: { to, config? }
 *   config 不传 -> 直接用库里已保存的配置
 *   config 传了 -> 用「库里配置 + 本次覆盖」试发，方便改完还没保存就先验证
 *   注意：config.password 为空时不覆盖库里已存的密码，避免「测一下把密码测没了」
 */
router.post('/settings/email/test', verifyUser, requirePermission('system:config'), async (req, res) => {
  const { to, config } = req.body || {};
  if (!to || !String(to).trim()) {
    return res.status(400).json({ error: '请填写收件人地址' });
  }

  try {
    let cfg;
    if (config && typeof config === 'object' && Object.keys(config).length) {
      const override = { ...config };
      if (override.password === '' || override.password == null) delete override.password;
      cfg = { ...(await loadMailConfig()), ...override };
    }

    const settings = await getSettings();
    const sysName = settings.brand?.name || 'Admin Scaffold';
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    const info = await sendMail({
      to: String(to).trim(),
      subject: `【${sysName}】邮件服务连通性测试`,
      text: [
        `这是一封来自「${sysName}」的测试邮件。`,
        '',
        '收到这封邮件说明 SMTP 配置正确，系统可以正常发信。',
        `发送时间：${now}`,
      ].join('\n'),
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#1d1d1f">
  <h3 style="margin:0 0 12px">${sysName} · 邮件服务测试</h3>
  <p style="margin:0 0 8px">收到这封邮件说明 SMTP 配置正确，系统可以正常发信。</p>
  <p style="margin:0;color:#6e6e73;font-size:13px">发送时间：${now}</p>
</div>`,
      config: cfg,
    });

    res.json({ ok: true, to, messageId: info.messageId, response: info.response });
  } catch (err) {
    // 配置类问题给 400，SMTP 端问题给 502：别让运维到一堆 500 里翻 SMTP 报错
    const status = err.code === 'EBADCONFIG' || err.code === 'EBADTO' ? 400 : 502;
    console.error('[settings] 测试邮件发送失败:', err.message);
    res.status(status).json({ error: err.message, code: err.code || 'ESMTP' });
  }
});

module.exports = router;
