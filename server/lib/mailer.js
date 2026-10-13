// server/lib/mailer.js
// SMTP 发信封装。配置取自 system_settings.email（密码是密文，这里解密后使用）。
//
// 业务代码只需要：
//   const { sendMail } = require('../lib/mailer');
//   await sendMail({ to, subject, text, html });
// 不关心 SMTP 在哪里配、密码怎么存。
//
// 当前真正接入的入口是「系统设置 → 邮件配置 → 发送测试邮件」（POST /api/admin/settings/email/test）。
// 业务侧发信（邀请、通知、密码重置）等有了调用方再接，sendMail 已经是现成的。
const nodemailer = require('nodemailer');
const { getSettings } = require('./settings');
const { decrypt } = require('./crypto');

// 企业内网 SMTP 常用自签证书。默认严格校验证书；确需放行时显式设
// SMTP_TLS_REJECT_UNAUTHORIZED=false，别默认关掉（等于放弃中间人防护）。
const REJECT_UNAUTHORIZED = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';

const ERROR_HINT = {
  EAUTH: 'SMTP 认证失败：用户名或密码不对（多数邮箱要用「授权码」而不是登录密码）',
  ECONNECTION: '连不上 SMTP 服务器：检查主机名与端口是否正确',
  ETIMEDOUT: '连接超时：检查网络或防火墙是否放行该端口',
  ESOCKET: 'Socket 错误：常见原因是端口与加密方式不匹配（465 用 SSL，587 用 STARTTLS）',
  EENVELOPE: '收件人被服务器拒绝：检查收件人地址',
  EMESSAGE: '邮件内容被服务器拒绝',
  EDNS: '域名解析失败：检查 SMTP 主机名',
};

function friendlyError(err) {
  const hint = ERROR_HINT[err?.code];
  return hint ? `${hint}（${err.code}）` : err?.message || '未知错误';
}

/** encryption(ssl/starttls/none) + port -> nodemailer 的传输参数 */
function normalize(cfg = {}) {
  const enc = cfg.encryption || (Number(cfg.port) === 465 ? 'ssl' : 'starttls');
  const port = Number(cfg.port) || (enc === 'ssl' ? 465 : enc === 'none' ? 25 : 587);
  return {
    host: String(cfg.host || '').trim(),
    port,
    secure: enc === 'ssl', // 465 直连 TLS
    requireTLS: enc === 'starttls', // 587 明文起连后升级
    ignoreTLS: enc === 'none',
    user: String(cfg.username || cfg.from || '').trim(),
    pass: cfg.password || '',
    from: String(cfg.from || '').trim(),
    fromName: String(cfg.fromName || '').trim(),
  };
}

/** 从库里读邮件配置，并把 passwordEnc 解密成明文密码（只存在于内存中，不落日志） */
async function loadMailConfig() {
  const settings = await getSettings();
  const e = settings.email || {};
  return { ...e, password: decrypt(e.passwordEnc) || '' };
}

/** 返回错误说明字符串，没问题返回 null */
function validateMailConfig(cfg = {}) {
  const n = normalize(cfg);
  if (!n.host) return '缺少 SMTP 服务器地址';
  if (!n.port || n.port < 1 || n.port > 65535) return '端口不合法';
  if (!n.from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n.from)) return '发件人邮箱不合法';
  return null;
}

function buildTransport(cfg) {
  const n = normalize(cfg);
  return nodemailer.createTransport({
    host: n.host,
    port: n.port,
    secure: n.secure,
    requireTLS: n.requireTLS,
    ignoreTLS: n.ignoreTLS,
    auth: n.user ? { user: n.user, pass: n.pass } : undefined,
    tls: { rejectUnauthorized: REJECT_UNAUTHORIZED },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

function formatFrom(n) {
  // 显示名要去掉引号与换行：直接拼进 From 头时，一个半角引号就会让整行变成
  // 非法的 RFC5322 地址（发信直接失败），换行更是标准的头注入面。
  const safe = n.fromName.replace(/["'\r\n<>]/g, '').trim();
  return safe ? `"${safe}" <${n.from}>` : n.from;
}

/**
 * 发一封邮件。
 * @param {object} opts { to, subject, text, html }
 * @param {object} [opts.config] 临时配置（含明文 password）；不传则读库里已保存的配置
 * @returns {Promise<{messageId, accepted, rejected, response}>}
 */
async function sendMail(opts = {}) {
  const cfg = opts.config || (await loadMailConfig());
  const invalid = validateMailConfig(cfg);
  if (invalid) throw Object.assign(new Error(invalid), { code: 'EBADCONFIG' });

  const to = String(opts.to || '').trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw Object.assign(new Error('收件人地址不合法'), { code: 'EBADTO' });
  }

  const transport = buildTransport(cfg);
  try {
    const info = await transport.sendMail({
      from: formatFrom(normalize(cfg)),
      to,
      subject: opts.subject || '(无主题)',
      text: opts.text || '',
      html: opts.html || undefined,
    });
    return {
      messageId: info.messageId,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
      response: info.response || '',
    };
  } catch (err) {
    throw Object.assign(new Error(friendlyError(err)), { code: err.code, cause: err });
  } finally {
    transport.close();
  }
}

/**
 * 只验证「能不能连上并登录」，不发信。
 * 与 sendMail 分开：排查配置时不必真的发出一封邮件。
 */
async function verifyConnection(cfg) {
  const config = cfg || (await loadMailConfig());
  const invalid = validateMailConfig(config);
  if (invalid) return { ok: false, error: invalid };

  const transport = buildTransport(config);
  try {
    await transport.verify();
    return { ok: true, host: normalize(config).host, port: normalize(config).port };
  } catch (err) {
    return { ok: false, error: friendlyError(err), code: err.code };
  } finally {
    transport.close();
  }
}

module.exports = { sendMail, verifyConnection, loadMailConfig, validateMailConfig, normalize };
