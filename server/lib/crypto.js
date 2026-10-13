// server/lib/crypto.js
// 系统设置中敏感字段（SMTP 密码 / OAuth Secret）的对称加密。
//
// 设计要点：
// 1) 用 aes-256-gcm —— 自带认证标签，密文被篡改时能直接解密失败而不是静默产出垃圾。
// 2) 密钥由 SETTINGS_ENC_KEY 经 sha256 派生为 32 字节：
//    这样环境变量里写任意长度的口令都能满足 aes-256 的密钥长度要求，不必人工数 32 字节。
// 3) 密文格式 iv:tag:data（全 hex），解密时三段齐全才尝试，格式不对或密钥变更都返回 null。
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

const PASSPHRASE = (() => {
  const k = process.env.SETTINGS_ENC_KEY;
  if (k) return k;
  console.warn('[crypto] 未设置 SETTINGS_ENC_KEY，正在使用开发默认密钥（生产环境务必配置）');
  return 'dev-only-insecure-settings-key';
})();

// sha256 -> 恰好 32 字节，满足 aes-256 要求
const KEY = crypto.createHash('sha256').update(PASSPHRASE).digest();

function encrypt(plain) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), enc.toString('hex')].join(':');
}

/** 解密失败一律返回 null：换过密钥的旧密文当作「未配置」处理，由用户重新填写，不让它崩掉请求 */
function decrypt(payload) {
  if (!payload) return null;
  const [iv, tag, data] = String(payload).split(':');
  if (!iv || !tag || !data) return null;
  try {
    const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };
