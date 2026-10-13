// portal/src/composables/useBrand.js
// 全局单例：系统品牌信息（名称 / Logo / 描述）。
//
// 数据来源（M2 起）：服务端 DB 为主，localStorage 为兜底。
//   - 启动时 initBrand -> loadBrandFromServer：拉 GET /api/brand（公开接口，登录页也能用）。
//   - 保存走 saveBrandToServer：PUT /api/admin/settings，落 system_settings 表。
//   - 后端不可用时不阻断渲染：保留本地/默认值。
// 组件层只依赖 brand 这个响应式对象，切换数据源无需改动任何模板。
import { reactive, ref } from 'vue';
import { api } from '../lib/apiBase';

const STORAGE_KEY = 'as_brand';

export const DEFAULT_BRAND = {
  name: 'Admin Scaffold',
  shortName: 'AS',
  description: '开箱即用的后台管理脚手架：RBAC 权限内核 + Vue3 + Express',
  welcome: '欢迎回来',
  footer: '© 2026 Admin Scaffold',
  logo: '', // dataURL；为空则用内置 logo 图标
};

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_BRAND, ...JSON.parse(raw) } : { ...DEFAULT_BRAND };
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

const brand = reactive(read());
const saving = ref(false);

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...brand }));
  } catch {
    /* 图片过大或隐私模式可能写失败，忽略 */
  }
}

function applyDocumentTitle() {
  if (typeof document !== 'undefined') {
    document.title = `${brand.name} · 后台管理`;
  }
}

/**
 * 从服务端读取品牌（公开接口 GET /api/brand，登录页未登录也能取到）。
 * 失败时保留本地/默认值，不影响首屏渲染。
 */
export async function loadBrandFromServer() {
  const data = await api('/api/brand');
  if (data && Object.keys(data).length) {
    Object.assign(brand, data);
    persist(); // 本地留一份，离线/后端异常时不至于退回默认值
    applyDocumentTitle();
  }
  return brand;
}

/**
 * 保存到服务端（PUT /api/admin/settings），同时本地兜底。
 * 服务端失败会抛错，由调用方（设置页）提示。
 *
 * @param {object} patch 品牌字段
 * @param {object} [extra] 同批提交的其他段（如 email）——设置页是一次性保存多个 Tab 的，
 *                         拆成两次 PUT 会出现「品牌存了、邮件没存」的中间态。
 */
export async function saveBrandToServer(patch = {}, extra = {}) {
  Object.assign(brand, patch);
  persist();
  applyDocumentTitle();
  await api('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ brand: patch, ...extra }),
  });
  return brand;
}

/** mount 之前调用，避免标题先闪一下默认值 */
export function initBrand() {
  applyDocumentTitle(); // 先用本地/默认撑住首屏
  // 再异步覆盖为服务端品牌：登录页也能拿到系统名 / Logo
  loadBrandFromServer().catch(() => {});
}

export function useBrand() {
  /** 局部保存（传 patch），字段级更新，避免整表覆盖 */
  function save(patch = {}) {
    Object.assign(brand, patch);
    persist();
    applyDocumentTitle();
  }

  function reset() {
    Object.assign(brand, DEFAULT_BRAND);
    persist();
    applyDocumentTitle();
  }

  /** 读取图片文件为 dataURL；超过 300KB 直接拒绝，避免撑爆 localStorage 配额 */
  function readLogoFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('未选择文件'));
      if (!/^image\//.test(file.type)) return reject(new Error('请选择图片文件（PNG / SVG / JPG）'));
      if (file.size > 300 * 1024) return reject(new Error('图片需小于 300KB，建议使用 SVG 或压缩后的 PNG'));
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsDataURL(file);
    });
  }

  return { brand, save, reset, readLogoFile, saving };
}
