<template>
  <div>
    <PageHeader title="用户管理" subtitle="管理系统成员与角色分配">
      <template #actions>
        <AppButton v-if="can('user:create')" @click="openCreate">
          <AppIcon name="plus" class="w-4 h-4" />新建用户
        </AppButton>
      </template>
    </PageHeader>

    <div class="bg-white rounded-xl border border-ink-200 shadow-card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-ink-500 bg-ink-50 border-b border-ink-200">
              <th class="font-medium px-5 py-3">用户</th>
              <th class="font-medium px-5 py-3">角色</th>
              <th class="font-medium px-5 py-3">状态</th>
              <th class="font-medium px-5 py-3">类型</th>
              <th class="font-medium px-5 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in users"
              :key="u.id"
              class="border-b border-ink-100 last:border-0 hover:bg-ink-50/60 transition-colors"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <span class="w-9 h-9 rounded-full bg-ink-100 text-ink-600 flex items-center justify-center text-sm font-medium">
                    {{ (u.name || u.username)[0] }}
                  </span>
                  <div>
                    <p class="font-medium text-ink-900">{{ u.username }}</p>
                    <p class="text-xs text-ink-500">{{ u.name }}</p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3 text-ink-700">
                <span v-if="u.roles?.length" class="flex flex-wrap gap-1">
                  <AppBadge v-for="r in u.roles" :key="r" color="brand">{{ r }}</AppBadge>
                </span>
                <span v-else class="text-ink-400">—</span>
              </td>
              <td class="px-5 py-3">
                <AppBadge :color="u.status === 'active' ? 'green' : 'amber'" dot>
                  {{ u.status === 'active' ? '正常' : '禁用' }}
                </AppBadge>
              </td>
              <td class="px-5 py-3">
                <AppBadge v-if="u.is_portal_admin" color="brand">管理员</AppBadge>
                <span v-else class="text-ink-400">成员</span>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <button
                    v-if="can('user:edit')"
                    class="w-8 h-8 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition"
                    title="编辑"
                    @click="openEdit(u)"
                  >
                    <AppIcon name="edit" class="w-4 h-4" />
                  </button>
                  <button
                    v-if="can('user:delete')"
                    class="w-8 h-8 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition"
                    title="删除"
                    @click="del(u)"
                  >
                    <AppIcon name="trash" class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!users.length">
              <td colspan="5" class="px-5 py-12 text-center text-ink-500">暂无用户</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppModal v-model="showForm" :title="editing ? '编辑用户' : '新建用户'">
      <div class="space-y-3">
        <label class="block">
          <span class="text-sm text-ink-700">用户名</span>
          <input
            v-model="form.username"
            :disabled="editing"
            class="mt-1 w-full h-10 px-3 rounded-lg border border-ink-300 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:bg-ink-100"
          />
        </label>
        <label class="block">
          <span class="text-sm text-ink-700">显示名</span>
          <input
            v-model="form.name"
            class="mt-1 w-full h-10 px-3 rounded-lg border border-ink-300 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
        <label class="block">
          <span class="text-sm text-ink-700">
            {{ editing ? '重置密码（留空不修改）' : '初始密码' }}
          </span>
          <input
            v-model="form.password"
            type="password"
            class="mt-1 w-full h-10 px-3 rounded-lg border border-ink-300 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
        <label v-if="editing" class="block">
          <span class="text-sm text-ink-700">状态</span>
          <select
            v-model="form.status"
            class="mt-1 w-full h-10 px-3 rounded-lg border border-ink-300 bg-white text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          >
            <option value="active">正常</option>
            <option value="disabled">禁用</option>
          </select>
        </label>
        <label class="block">
          <span class="text-sm text-ink-700">分配角色</span>
          <select
            v-model="form.roleId"
            class="mt-1 w-full h-10 px-3 rounded-lg border border-ink-300 bg-white text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          >
            <option :value="null">不分配</option>
            <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </label>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="showForm = false">取消</AppButton>
        <AppButton @click="save">{{ editing ? '保存' : '创建' }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../../lib/apiBase';
import { usePermissions } from '../../composables/usePermissions';
import PageHeader from '../../components/ui/PageHeader.vue';
import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';
import AppBadge from '../../components/ui/AppBadge.vue';
import AppIcon from '../../components/ui/AppIcon.vue';

const { can } = usePermissions();
const users = ref([]);
const roles = ref([]);
const showForm = ref(false);
const editing = ref(null);
const form = ref({ username: '', name: '', password: '', status: 'active', roleId: null });

async function load() {
  const d = await api('/api/admin/users');
  users.value = d.items;
}
async function loadRoles() {
  roles.value = await api('/api/admin/roles');
}
function openCreate() {
  editing.value = null;
  form.value = { username: '', name: '', password: '', status: 'active', roleId: null };
  showForm.value = true;
}
function openEdit(u) {
  editing.value = u;
  // 用户当前角色是名称数组，回查成 roleId 预填，避免保存时误清空
  const roleId = u.roles?.length ? roles.value.find((r) => r.name === u.roles[0])?.id ?? null : null;
  form.value = {
    username: u.username,
    name: u.name || '',
    password: '',
    status: u.status || 'active',
    roleId,
  };
  showForm.value = true;
}
async function save() {
  const f = form.value;
  if (editing.value) {
    const patch = { name: f.name, status: f.status };
    if (f.password) patch.password = f.password;
    await api(`/api/admin/users/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(patch) });
    if (can('user:assign')) {
      await api(`/api/admin/users/${editing.value.id}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roleIds: f.roleId ? [Number(f.roleId)] : [] }),
      });
    }
  } else {
    await api('/api/admin/users', { method: 'POST', body: JSON.stringify(f) });
  }
  showForm.value = false;
  load();
}
async function del(u) {
  if (!confirm(`确认删除用户「${u.username}」？`)) return;
  await api('/api/admin/users/' + u.id, { method: 'DELETE' });
  load();
}
onMounted(() => {
  load();
  loadRoles();
});
</script>
