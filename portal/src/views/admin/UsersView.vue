<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-medium">用户管理</h2>
      <button v-if="can('user:create')" class="bg-brand-600 text-white text-sm rounded-md px-3 py-1.5" @click="showCreate = true">新建用户</button>
    </div>

    <div class="bg-white border border-[#D3D1C7] rounded-lg overflow-hidden">
      <div v-for="u in users" :key="u.id" class="flex items-center gap-3 px-4 py-3 border-b border-[#EEE] text-sm">
        <span class="w-7 h-7 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">{{ (u.name || u.username)[0] }}</span>
        <span class="flex-1">{{ u.username }}</span>
        <span v-if="u.is_portal_admin" class="text-xs bg-[#EAF3DE] text-[#27500A] rounded-full px-2 py-0.5">管理员</span>
        <span class="text-xs text-[#5F5E5A]">{{ u.status }}</span>
        <button v-if="can('user:delete')" class="text-red-600 text-xs" @click="del(u.id)">删除</button>
      </div>
    </div>

    <div v-if="showCreate" class="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div class="bg-white rounded-xl p-5 w-80">
        <input v-model="form.username" placeholder="用户名" class="w-full border border-[#D3D1C7] rounded-md px-3 py-2 mb-2 text-sm" />
        <input v-model="form.name" placeholder="显示名" class="w-full border border-[#D3D1C7] rounded-md px-3 py-2 mb-2 text-sm" />
        <input v-model="form.password" type="password" placeholder="密码" class="w-full border border-[#D3D1C7] rounded-md px-3 py-2 mb-3 text-sm" />
        <div class="flex justify-end gap-2">
          <button class="text-sm px-3 py-1.5" @click="showCreate = false">取消</button>
          <button class="bg-brand-600 text-white text-sm rounded-md px-3 py-1.5" @click="create">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../../lib/apiBase';
import { usePermissions } from '../../composables/usePermissions';

const { can } = usePermissions();
const users = ref([]);
const showCreate = ref(false);
const form = ref({ username: '', name: '', password: '' });

async function load() {
  const d = await api('/api/admin/users');
  users.value = d.items;
}
async function create() {
  await api('/api/admin/users', { method: 'POST', body: JSON.stringify(form.value) });
  showCreate.value = false;
  form.value = { username: '', name: '', password: '' };
  load();
}
async function del(id) {
  if (!confirm('确认删除？')) return;
  await api('/api/admin/users/' + id, { method: 'DELETE' });
  load();
}
onMounted(load);
</script>
