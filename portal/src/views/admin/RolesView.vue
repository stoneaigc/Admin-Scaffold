<template>
  <div>
    <PageHeader title="角色权限" subtitle="定义角色并勾选其拥有的权限原子">
      <template #actions>
        <AppButton v-if="can('role:create')" @click="openCreate">
          <AppIcon name="plus" class="w-4 h-4" />新建角色
        </AppButton>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <!-- 角色列表 -->
      <div class="bg-white rounded-xl border border-ink-200 shadow-card p-2 self-start">
        <button
          v-for="r in roles"
          :key="r.id"
          class="w-full text-left px-3 py-3 rounded-lg transition flex items-center justify-between gap-2"
          :class="selected?.id === r.id ? 'bg-ink-50 ring-1 ring-ink-200' : 'hover:bg-ink-50/60'"
          @click="selectRole(r)"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-ink-900 truncate">{{ r.name }}</span>
              <AppBadge v-if="r.is_system" color="amber">系统</AppBadge>
            </div>
            <p class="text-xs text-ink-500 mt-0.5">{{ r.user_count }} 名成员</p>
          </div>
          <button
            v-if="can('role:delete') && !r.is_system"
            class="w-7 h-7 shrink-0 rounded-md text-ink-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition"
            title="删除角色"
            @click.stop="del(r)"
          >
            <AppIcon name="trash" class="w-4 h-4" />
          </button>
        </button>
        <p v-if="!roles.length" class="px-3 py-8 text-center text-ink-500 text-sm">暂无角色</p>
      </div>

      <!-- 权限矩阵 -->
      <div v-if="selected" class="space-y-4">
        <div class="bg-white rounded-xl border border-ink-200 shadow-card p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-semibold text-ink-900">权限位 · {{ selected.name }}</h3>
              <p class="text-xs text-ink-500 mt-0.5">勾选即赋予该角色对应能力</p>
            </div>
            <AppBadge color="brand">{{ checked.size }} 项已选</AppBadge>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="g in groups"
              :key="g.module"
              class="rounded-lg border border-ink-200 p-4"
            >
              <p class="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2.5">
                {{ moduleName(g.module) }}
              </p>
              <label
                v-for="p in g.list"
                :key="p.id"
                class="flex items-start gap-2.5 py-1.5 rounded-md px-1.5 hover:bg-ink-50/60 cursor-pointer transition"
              >
                <span
                  class="mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition"
                  :class="checked.has(p.id) ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-white'"
                >
                  <AppIcon v-if="checked.has(p.id)" name="check" class="w-3 h-3" />
                </span>
                <input
                  type="checkbox"
                  class="sr-only"
                  :checked="checked.has(p.id)"
                  @change="toggle(p.id, $event.target.checked)"
                />
                <span class="min-w-0">
                  <span class="text-sm text-ink-900">{{ p.name }}</span>
                  <span class="block text-xs text-ink-400 font-mono">{{ p.key }}</span>
                </span>
              </label>
            </div>
          </div>

          <div class="flex justify-end mt-5 pt-4 border-t border-ink-100">
            <AppButton v-if="can('role:edit')" @click="save">保存权限</AppButton>
          </div>
        </div>
      </div>

      <div
        v-else
        class="bg-white rounded-xl border border-dashed border-ink-300 flex items-center justify-center text-ink-500 text-sm min-h-[200px]"
      >
        从左侧选择一个角色查看权限
      </div>
    </div>

    <AppModal v-model="showCreate" title="新建角色">
      <label class="block">
        <span class="text-sm text-ink-700">角色名</span>
        <input
          v-model="newName"
          placeholder="如：运营"
          class="mt-1 w-full h-10 px-3 rounded-lg border border-ink-300 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          @keyup.enter="createRole"
        />
      </label>
      <template #footer>
        <AppButton variant="secondary" @click="showCreate = false">取消</AppButton>
        <AppButton @click="createRole">创建</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../lib/apiBase';
import { usePermissions } from '../../composables/usePermissions';
import PageHeader from '../../components/ui/PageHeader.vue';
import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';
import AppBadge from '../../components/ui/AppBadge.vue';
import AppIcon from '../../components/ui/AppIcon.vue';

const { can } = usePermissions();
const roles = ref([]);
const perms = ref([]);
const selected = ref(null);
const checked = ref(new Set());
const showCreate = ref(false);
const newName = ref('');

// 权限模块 -> 中文名。未登记的模块兜底显示原始 module 值。
const MODULE_LABEL = {
  user: '用户',
  role: '角色',
  menu: '菜单',
  resource: '资源',
  group: '资源组',
  system: '系统',
  config: '系统配置',
};
// 分组展示顺序（未登记的模块排在最后）
const MODULE_ORDER = ['user', 'role', 'menu', 'resource', 'group', 'system', 'config'];

function moduleName(m) {
  return MODULE_LABEL[m] || m;
}

const groups = computed(() => {
  const map = {};
  for (const p of perms.value) (map[p.module] ||= []).push(p);
  const keys = Object.keys(map).sort((a, b) => {
    const ia = MODULE_ORDER.indexOf(a);
    const ib = MODULE_ORDER.indexOf(b);
    return (ia < 0 ? MODULE_ORDER.length : ia) - (ib < 0 ? MODULE_ORDER.length : ib);
  });
  return keys.map((module) => ({ module, list: map[module] }));
});

async function loadRoles() {
  roles.value = await api('/api/admin/roles');
  if (!selected.value && roles.value.length) selectRole(roles.value[0]);
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
function openCreate() {
  newName.value = '';
  showCreate.value = true;
}
async function createRole() {
  const name = newName.value.trim();
  if (!name) return;
  await api('/api/admin/roles', { method: 'POST', body: JSON.stringify({ name }) });
  showCreate.value = false;
  await loadRoles();
}
async function save() {
  await api('/api/admin/roles/' + selected.value.id + '/permissions', {
    method: 'PUT',
    body: JSON.stringify({ permissionIds: [...checked.value] }),
  });
}
async function del(r) {
  if (!confirm(`确认删除角色「${r.name}」？`)) return;
  await api('/api/admin/roles/' + r.id, { method: 'DELETE' });
  if (selected.value?.id === r.id) selected.value = null;
  await loadRoles();
}
onMounted(() => {
  loadRoles();
  loadPerms();
});
</script>
