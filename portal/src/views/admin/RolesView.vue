<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-medium">角色权限</h2>
      <button v-if="can('role:create')" class="bg-brand-600 text-white text-sm rounded-md px-3 py-1.5" @click="createRole">新建角色</button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white border border-[#D3D1C7] rounded-lg p-4">
        <h3 class="text-sm font-medium mb-2">角色</h3>
        <div
          v-for="r in roles"
          :key="r.id"
          class="flex items-center justify-between px-2 py-2 border-b border-[#EEE] text-sm cursor-pointer hover:bg-[#F1EFE8]"
          @click="selectRole(r)"
        >
          <span>{{ r.name }} <span class="text-xs text-[#5F5E5A]">({{ r.user_count }})</span></span>
          <span class="text-xs text-[#5F5E5A]">{{ r.is_system ? '系统' : '' }}</span>
        </div>
      </div>

      <div class="bg-white border border-[#D3D1C7] rounded-lg p-4" v-if="selected">
        <h3 class="text-sm font-medium mb-2">权限位 · {{ selected.name }}</h3>
        <label v-for="p in perms" :key="p.id" class="flex items-center gap-2 text-sm py-1">
          <input type="checkbox" :checked="checked.has(p.id)" @change="toggle(p.id, $event.target.checked)" />
          <span>{{ p.name }}</span>
          <span class="text-xs text-[#5F5E5A]">{{ p.key }}</span>
        </label>
        <button v-if="can('role:edit')" class="mt-3 bg-brand-600 text-white text-sm rounded-md px-3 py-1.5" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../../lib/apiBase';
import { usePermissions } from '../../composables/usePermissions';

const { can } = usePermissions();
const roles = ref([]);
const perms = ref([]);
const selected = ref(null);
const checked = ref(new Set());

async function loadRoles() {
  roles.value = await api('/api/admin/roles');
}
async function loadPerms() {
  perms.value = await api('/api/admin/permissions');
}
async function selectRole(r) {
  selected.value = r;
  const detail = await api('/api/admin/roles/' + r.id);
  checked.value = new Set(detail.permissionIds || []);
}
function toggle(id, on) {
  const s = new Set(checked.value);
  on ? s.add(id) : s.delete(id);
  checked.value = s;
}
async function createRole() {
  const name = prompt('角色名');
  if (!name) return;
  await api('/api/admin/roles', { method: 'POST', body: JSON.stringify({ name }) });
  loadRoles();
}
async function save() {
  await api('/api/admin/roles/' + selected.value.id + '/permissions', {
    method: 'PUT',
    body: JSON.stringify({ permissionIds: [...checked.value] }),
  });
}
onMounted(() => {
  loadRoles();
  loadPerms();
});
</script>
