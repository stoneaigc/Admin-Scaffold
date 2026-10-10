// portal/src/composables/usePermissions.js
// 全局单例：登录后从 /api/auth/me 拉权限 + 是否后台入口。前端按钮/菜单据此控制。
import { ref } from 'vue';
import { api, clearToken } from '../lib/apiBase';

const permissions = ref([]);
const adminEntry = ref(false);
const user = ref(null);
let loaded = false;

export function usePermissions() {
  async function load() {
    try {
      const me = await api('/api/auth/me');
      permissions.value = me.permissions || [];
      adminEntry.value = me.adminEntry;
      user.value = me.user;
      loaded = true;
    } catch {
      permissions.value = [];
      adminEntry.value = false;
      user.value = null;
    }
  }

  function can(key) {
    return permissions.value.includes(key);
  }

  if (!loaded) load();

  function logout() {
    clearToken();
    permissions.value = [];
    adminEntry.value = false;
    user.value = null;
    loaded = false;
    location.href = '/login';
  }

  return { permissions, adminEntry, user, load, can, logout };
}
