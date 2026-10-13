<template>
  <div>
    <PageHeader title="用户管理" subtitle="管理系统成员与角色分配">
      <template #actions>
        <AppButton v-if="can('user:create')" @click="openCreate">
          <AppIcon name="plus" class="w-4 h-4" />新建用户
        </AppButton>
      </template>
    </PageHeader>

    <div class="bg-panel rounded-xl border border-ink-200 shadow-card overflow-hidden">
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
            <!-- 错误态：请求失败给出重试入口，避免整页白屏 -->
            <tr v-if="usersReq.error">
              <td colspan="5" class="px-5 py-12 text-center">
                <p class="text-red-600 font-medium">加载失败：{{ usersReq.error }}</p>
                <AppButton variant="secondary" class="mt-3" @click="usersReq.run()">重试</AppButton>
              </td>
            </tr>
            <!-- 加载态：居中 Spinner + 文案 -->
            <tr v-else-if="usersReq.loading">
              <td colspan="5" class="px-5 py-12">
                <div class="flex flex-col items-center gap-2 text-ink-500">
                  <AppSpinner :size="24" />
                  <span class="text-sm">加载中…</span>
                </div>
              </td>
            </tr>
            <template v-else>
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
                      class="w-8 h-8 rounded-lg text-ink-400 hover:text-brand-700 hover:bg-brand-50 flex items-center justify-center transition"
                      title="编辑"
                      @click="openEdit(u)"
                    >
                      <AppIcon name="edit" class="w-4 h-4" />
                    </button>
                    <button
                      v-if="can('user:delete')"
                      class="w-8 h-8 rounded-lg text-ink-400 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition"
                      title="删除"
                      aria-label="删除用户"
                      @click="askDelete(u)"
                    >
                      <AppIcon name="trash" class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!users.length">
                <td colspan="5" class="px-5 py-12 text-center text-ink-500">暂无用户</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 分页条：让「还有更多」这件事可见 -->
    <div
      v-if="total > PAGE_SIZE"
      class="mt-3 flex items-center justify-between text-sm text-ink-500"
    >
      <span>共 {{ total }} 名用户 · 第 {{ page }} / {{ totalPages }} 页</span>
      <div class="flex items-center gap-2">
        <AppButton size="sm" variant="secondary" :disabled="page <= 1" @click="goPage(page - 1)">
          上一页
        </AppButton>
        <AppButton size="sm" variant="secondary" :disabled="page >= totalPages" @click="goPage(page + 1)">
          下一页
        </AppButton>
      </div>
    </div>

    <AppModal v-model="showForm" :title="editing ? '编辑用户' : '新建用户'">
      <div class="space-y-3">
        <AppField label="用户名">
          <AppInput v-model="form.username" :disabled="!!editing" />
        </AppField>
        <AppField label="显示名">
          <AppInput v-model="form.name" />
        </AppField>
        <AppField :label="editing ? '重置密码（留空不修改）' : '初始密码'">
          <AppInput v-model="form.password" type="password" />
        </AppField>
        <AppField v-if="editing" label="状态">
          <AppSelect v-model="form.status" :options="STATUS_OPTIONS" />
        </AppField>
        <AppField label="分配角色">
          <AppSelect v-model="form.roleId" :options="roleOptions" />
        </AppField>

        <p
          v-if="multiRole"
          class="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300"
        >
          该用户当前有 {{ editing.roles.length }} 个角色（{{ editing.roles.join('、') }}）。
          本表单为单选，保存后只保留所选的一个，其余会被移除。
        </p>
        <p
          v-if="formError"
          class="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
        >
          {{ formError }}
        </p>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="showForm = false">取消</AppButton>
        <AppButton :disabled="saving" @click="save">
          {{ saving ? '处理中…' : editing ? '保存' : '创建' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 删除确认（替换原生 confirm） -->
    <AppModal v-model="showDelete" title="删除用户">
      <p class="text-sm text-ink-700">
        确认删除用户「<span class="font-medium text-ink-900">{{ pendingDelete?.username }}</span>」？
      </p>
      <p class="text-xs text-ink-500 mt-2">该用户的角色分配会一并解除，操作不可撤销。</p>
      <p
        v-if="deleteError"
        class="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
      >
        {{ deleteError }}
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="showDelete = false">取消</AppButton>
        <AppButton variant="danger" :disabled="deleting" @click="doDelete">
          {{ deleting ? '删除中…' : '删除' }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../lib/apiBase';
import { usePermissions } from '../../composables/usePermissions';
import { useAsync } from '../../composables/useAsync';
import PageHeader from '../../components/ui/PageHeader.vue';
import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';
import AppBadge from '../../components/ui/AppBadge.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import AppSpinner from '../../components/ui/AppSpinner.vue';
import AppField from '../../components/ui/AppField.vue';
import AppInput from '../../components/ui/AppInput.vue';
import AppSelect from '../../components/ui/AppSelect.vue';

const { can } = usePermissions();
const users = ref([]);
const roles = ref([]);
const showForm = ref(false);
const editing = ref(null);
const form = ref({ username: '', name: '', password: '', status: 'active', roleId: null });

// 分页：后端默认每页 20，前端原先不传分页参数 —— 用户超过 20 个时，
// 列表会静默少掉一部分，且没有任何提示说明「还有更多」。
const page = ref(1);
const PAGE_SIZE = 20;
const total = ref(0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

// 保存 / 删除的失败反馈：接口报错时不能默默什么都不做
const formError = ref('');
const saving = ref(false);
const showDelete = ref(false);
const pendingDelete = ref(null);
const deleting = ref(false);
const deleteError = ref('');

const STATUS_OPTIONS = [
  { value: 'active', label: '正常' },
  { value: 'disabled', label: '禁用' },
];
// 第一项用 null 表示「不分配」，依赖 AppSelect 走 _value 往返，null 不会被串化成 "null"
const roleOptions = computed(() => [
  { value: null, label: '不分配' },
  ...roles.value.map((r) => ({ value: r.id, label: r.name })),
]);

const usersReq = useAsync(async () => {
  const d = await api(`/api/admin/users?page=${page.value}&pageSize=${PAGE_SIZE}`);
  users.value = d.items || [];
  total.value = d.total || 0;
});
const rolesReq = useAsync(async () => {
  roles.value = await api('/api/admin/roles');
});
function goPage(p) {
  page.value = Math.min(Math.max(1, p), totalPages.value);
  usersReq.run();
}
function openCreate() {
  editing.value = null;
  formError.value = '';
  form.value = { username: '', name: '', password: '', status: 'active', roleId: null };
  showForm.value = true;
}
function openEdit(u) {
  editing.value = u;
  formError.value = '';
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

// 后端是「整体替换角色」，而这里只有一个下拉：多角色用户保存后会被压成单角色。
// 不提示的话，管理员以为只是改了个名字，实际把人的权限改没了。
const multiRole = computed(() => (editing.value?.roles?.length || 0) > 1);

async function save() {
  const f = form.value;
  const id = editing.value?.id;
  saving.value = true;
  formError.value = '';
  try {
    if (editing.value) {
      const patch = { name: f.name, status: f.status };
      if (f.password) patch.password = f.password;
      await api(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
      if (can('user:assign')) {
        await api(`/api/admin/users/${id}/roles`, {
          method: 'PUT',
          body: JSON.stringify({ roleIds: f.roleId ? [Number(f.roleId)] : [] }),
        });
      }
    } else {
      await api('/api/admin/users', { method: 'POST', body: JSON.stringify(f) });
    }
    showForm.value = false;
    await usersReq.run();
  } catch (e) {
    // 用户名已存在、密码过短等都要说出来，否则弹窗原地不动、用户以为没点上
    formError.value = e.message || '保存失败';
  } finally {
    saving.value = false;
  }
}

function askDelete(u) {
  pendingDelete.value = u;
  deleteError.value = '';
  showDelete.value = true;
}
async function doDelete() {
  const u = pendingDelete.value;
  if (!u) return;
  deleting.value = true;
  deleteError.value = '';
  try {
    await api('/api/admin/users/' + u.id, { method: 'DELETE' });
    showDelete.value = false;
    pendingDelete.value = null;
    // 删的是当页最后一条时页码要退回，否则停在空页上
    if (users.value.length === 1 && page.value > 1) page.value -= 1;
    await usersReq.run();
  } catch (e) {
    deleteError.value = e.message || '删除失败';
  } finally {
    deleting.value = false;
  }
}
onMounted(() => {
  usersReq.run();
  rolesReq.run();
});
</script>
