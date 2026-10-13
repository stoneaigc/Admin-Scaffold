// server/lib/settings.js
// 系统设置的读写封装。单租户：固定读 id=1 那一行。
//
// JSON 列统一以 TEXT 落库（见 migrations/005_system_settings.sql），
// 两种方言共用同一条 SQL，序列化差异在这里屏蔽。
const EMPTY = () => ({ brand: {}, email: {}, appearance: {} });

/** 兼容「pg 若改成 JSONB 会直接返回对象」的情况 */
function parseJson(v) {
  if (v == null || v === '') return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

async function getSettings() {
  const r = await global.db.query(
    'SELECT brand, email, appearance, updated_by, updated_at FROM system_settings WHERE id = 1'
  );
  if (!r.rowCount) return { ...EMPTY(), updatedBy: null, updatedAt: null };
  const row = r.rows[0];
  return {
    brand: parseJson(row.brand),
    email: parseJson(row.email),
    appearance: parseJson(row.appearance),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

/**
 * 对外输出前抹掉密文：邮件密码只保留 hasPassword 标记，
 * 绝不对前端下发 passwordEnc（否则加密形同虚设）。
 */
function maskSecrets(email = {}) {
  const out = { ...email };
  out.hasPassword = !!out.passwordEnc;
  delete out.passwordEnc;
  return out;
}

module.exports = { parseJson, getSettings, maskSecrets, EMPTY };
