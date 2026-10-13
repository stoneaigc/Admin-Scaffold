<template>
  <div>
    <PageHeader
      title="资源组"
      subtitle="白名单授权：组内资源仅对成员可见；用户不属于任何组时看不到任何资源"
    >
      <template #actions>
        <AppButton v-if="can('group:create')" @click="openCreate">
          <AppIcon name="plus" class="w-4 h-4" />新建资源组
        </AppButton>
      </template>
    </PageHeader>

    <!-- 轻提示：保存结果反馈 -->
    <div
      v-if="toast"
      class="mb-4 px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300"
    >
      {{ toast }}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <!-- 左：资源组列表 -->
      <div class="bg-panel rounded-xl border border-ink-200 shadow-card p-2 self-start min-h-[120px]">
        <div v-if="groupsReq.error" class="px-3 py-8 text-center">
          <p class="text-red-600 font-medium text-sm">加载失败：{{ groupsReq.error }}</p>
          <AppButton variant="secondary" class="mt-3" @click="groupsReq.run()">重试</AppButton>
        </div>
        <div v-else-if="groupsReq.loading" class="px-3 py-10 flex flex-col items-center gap-2 text-ink-500">
          <AppSpinner :size="22" />
          <span class="text-xs">加载中…</span>
        </div>
        <template v-else>
          <button
            v-for="g in groups"
            :key="g.id"
            class="w-full text-left px-3 py-3 rounded-lg transition flex items-center justify-between gap-2"
            :class="selected?.id === g.id ? 'bg-ink-50 ring-1 ring-ink-200' : 'hover:bg-ink-50/60'"
            @click="selectGroup(g)"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-ink-900 truncate">{{ g.name }}</span>
              </div>
              <p class="text-xs text-ink-500 mt-0.5">
                {{ g.member_count }} 名成员 · {{ g.resource_count }} 项资源
              </p>
            </div>
            <button
              v-if="can('group:delete')"
              class="w-7 h-7 shrink-0 rounded-md text-ink-400 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition"
              title="删除资源组"
              aria-label="删除资源组"
              @click.stop="askDelete(g)"
            >
              <AppIcon name="trash" class="w-4 h-4" />
            </button>
          </button>
          <p v-if="!groups.length" class="px-3 py-8 text-center text-ink-500 text-sm">
            暂无资源组，先新建一个
          </p>
        </template>
      </div>

      <!-- 右：组详情 -->
      <div v-if="selected" class="space-y-4">
        <AppTabs v-model="tab" :items="tabs" />

        <div v-if="metaReq.error" class="px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          <span>资源清单加载失败：{{ metaReq.error }}</span>
          <AppButton variant="secondary" class="ml-3" @click="metaReq.run()">重试</AppButton>
        </div>

        <!-- 明细加载 / 失败 -->
        <div v-if="detailLoading" class="bg-panel rounded-xl border border-ink-200 shadow-card px-3 py-12 flex flex-col items-center gap-2 text-ink-500">
          <AppSpinner :size="22" />
          <span class="text-xs">加载组配置…</span>
        </div>
        <div v-else-if="detailError" class="bg-panel rounded-xl border border-ink-200 shadow-card px-3 py-12 text-center">
          <p class="text-red-600 text-sm">组配置加载失败：{{ detailError }}</p>
          <AppButton variant="secondary" class="mt-3" @click="selectGroup(selected)">重试</AppButton>
        </div>

        <!-- ===== 资源 Tab ===== -->
        <div v-else-if="tab === 'resources'" class="bg-panel rounded-xl border border-ink-200 shadow-card p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-semibold text-ink-900">组内资源 · {{ selected.name }}</h3>
              <p class="text-xs text-ink-500 mt-0.5">勾选的资源对全部组成员可见</p>
            </div>
            <AppBadge color="brand">{{ checkedRes.size }} 项已选</AppBadge>
          </div>

          <div class="px-3 py-2.5 mb-4 rounded-lg bg-ink-50 border border-ink-100 text-xs text-ink-500 leading-relaxed flex gap-2">
            <AppIcon name="info" class="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              资源类型由 <code class="font-mono">server/resource-types.setup.js</code> 注册。当前是脚手架自带的两个示例（服务 / 数据集），接业务时替换成你自己的类型即可。
            </span>
          </div>

          <div v-if="metaReq.loading" class="py-8 flex justify-center text-ink-500">
            <AppSpinner :size="20" />
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="t in typeCards" :key="t.key" class="rounded-lg border border-ink-200 p-4">
              <div class="flex items-center justify-between mb-2.5">
                <p class="text-xs font-semibold uppercase tracking-wider text-ink-500">{{ t.name }}</p>
                <button
                  v-if="can('group:edit')"
                  class="text-xs text-brand-700 hover:underline"
                  @click="toggleType(t)"
                >
                  {{ t.ids.every((id) => checkedRes.has(key(t.key, id))) ? '全不选' : '全选' }}
                </button>
              </div>
              <p v-if="!t.ids.length" class="text-xs text-ink-500 py-1">该类型暂无可授权资源</p>
              <label
                v-for="id in t.ids"
                :key="id"
                class="flex items-start gap-2.5 py-1.5 rounded-md px-1.5 hover:bg-ink-50/60 cursor-pointer transition"
              >
                <span
                  class="mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition"
                  :class="checkedRes.has(key(t.key, id)) ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-panel'"
                >
                  <AppIcon v-if="checkedRes.has(key(t.key, id))" name="check" class="w-3 h-3" />
                </span>
                <input
                  type="checkbox"
                  class="sr-only"
                  :checked="checkedRes.has(key(t.key, id))"
                  :disabled="!can('group:edit')"
                  @change="toggleRes(t.key, id, $event.target.checked)"
                />
                <span class="text-sm text-ink-900 font-mono">{{ id }}</span>
              </label>
            </div>
          </div>

          <div class="flex justify-end mt-5 pt-4 border-t border-ink-100">
            <AppButton v-if="can('group:edit')" :disabled="saving" @click="saveItems">
              {{ saving ? '保存中…' : '保存资源授权' }}
            </AppButton>
          </div>
        </div>

        <!-- ===== 成员 Tab ===== -->
        <div v-else class="bg-panel rounded-xl border border-ink-200 shadow-card p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-semibold text-ink-900">组成员 · {{ selected.name }}</h3>
              <p class="text-xs text-ink-500 mt-0.5">成员可访问本组勾选的全部资源</p>
            </div>
            <AppBadge color="brand">{{ checkedUsers.size }} 人已选</AppBadge>
          </div>

          <div v-if="!permissions.length" class="px-3 py-8 text-center text-ink-500 text-sm">
            权限校验中…
          </div>
          <div v-else-if="!can('user:view')" class="px-3 py-8 text-center text-ink-500 text-sm">
            缺少 <code class="font-mono">user:view</code> 权限，无法加载用户清单
          </div>
          <div v-else-if="usersReq.error" class="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
            <span>用户加载失败：{{ usersReq.error }}</span>
            <AppButton variant="secondary" class="ml-3" @click="usersReq.run()">重试</AppButton>
          </div>
          <template v-else>
            <div class="relative mb-3 max-w-xs">
              <AppIcon name="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <AppInput v-model="userQuery" placeholder="搜索用户名 / 姓名" class="pl-9" />
            </div>

            <div v-if="usersReq.loading" class="py-8 flex justify-center text-ink-500">
              <AppSpinner :size="20" />
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[380px] overflow-y-auto">
              <label
                v-for="u in filteredUsers"
                :key="u.id"
                class="flex items-center gap-2.5 py-1.5 rounded-md px-1.5 hover:bg-ink-50/60 cursor-pointer transition"
              >
                <span
                  class="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition"
                  :class="checkedUsers.has(u.id) ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-panel'"
                >
                  <AppIcon v-if="checkedUsers.has(u.id)" name="check" class="w-3 h-3" />
                </span>
                <input
                  type="checkbox"
                  class="sr-only"
                  :checked="checkedUsers.has(u.id)"
                  :disabled="!can('group:assign')"
                  @change="toggleUser(u.id, $event.target.checked)"
                />
                <span class="min-w-0">
                  <span class="text-sm text-ink-900">{{ u.name || u.username }}</span>
                  <span class="block text-xs text-ink-500 font-mono truncate">{{ u.username }}</span>
                </span>
                <AppBadge v-if="u.is_portal_admin" color="amber" class="ml-auto">超管</AppBadge>
              </label>
              <p v-if="!filteredUsers.length" class="text-sm text-ink-500 py-4">没有匹配的用户</p>
            </div>

            <div class="flex justify-end mt-5 pt-4 border-t border-ink-100">
              <AppButton v-if="can('group:assign')" :disabled="saving" @click="saveMembers">
                {{ saving ? '保存中…' : '保存成员' }}
              </AppButton>
            </div>
          </template>
        </div>
      </div>

      <div
        v-else
        class="bg-panel rounded-xl border border-dashed border-ink-300 flex items-center justify-center text-ink-500 text-sm min-h-[200px]"
      >
        从左侧选择一个资源组
      </div>
    </div>

    <AppModal v-model="showCreate" title="新建资源组">
      <AppField label="资源组名" hint="如：默认可见、研发全员">
        <AppInput v-model="form.name" placeholder="资源组名称" @keyup.enter="createGroup" />
      </AppField>
      <AppField label="描述" class="mt-3">
        <AppTextarea v-model="form.description" :rows="3" placeholder="这个组授权给谁、覆盖哪些资源" />
      </AppField>
      <p
        v-if="createError"
        class="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
      >
        {{ createError }}
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="showCreate = false">取消</AppButton>
        <AppButton :disabled="creating || !form.name.trim()" @click="createGroup">
          {{ creating ? '创建中…' : '创建' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 删除确认（替换原生 confirm） -->
    <AppModal v-model="showDelete" title="删除资源组">
      <p class="text-sm text-ink-700">
        确认删除资源组「<span class="font-medium text-ink-900">{{ pendingDelete?.name }}</span>」？
      </p>
      <p class="text-xs text-ink-500 mt-2">
        组内的资源与成员授权会一并解除（{{ pendingDelete?.member_count || 0 }} 名成员、
        {{ pendingDelete?.resource_count || 0 }} 项资源），操作不可撤销。
      </p>
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
import { computed, reactive, ref, watch, onMounted } from 'vue';
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
import AppTextarea from '../../components/ui/AppTextarea.vue';
import AppTabs from '../../components/ui/AppTabs.vue';

const { can, permissions } = usePermissions();

const groups = ref([]);
const selected = ref(null);
const tab = ref('resources');
const resourceTypes = ref([]); // [{ key, name, sortOrder }]
const resourcePool = ref({}); // { [typeKey]: [resourceId] }
const users = ref([]);
const checkedRes = ref(new Set()); // "type:id"
const checkedUsers = ref(new Set()); // userId
const detailLoading = ref(false);
const detailError = ref('');
const saving = ref(false);
const creating = ref(false);
const deleting = ref(false);
const createError = ref('');
const deleteError = ref('');
const pendingDelete = ref(null);
const showDelete = ref(false);
const toast = ref('');
const userQuery = ref('');
const showCreate = ref(false);
const form = reactive({ name: '', description: '' });

function flash(msg) {
  toast.value = msg;
  setTimeout(() => {
    if (toast.value === msg) toast.value = '';
  }, 2600);
}

const tabs = computed(() => [
  { key: 'resources', label: '资源', icon: 'globe', badge: String(checkedRes.value.size) },
  { key: 'members', label: '成员', icon: 'users', badge: String(checkedUsers.value.size) },
]);

// 资源类型 -> 可授权资源（按 sortOrder 排序；类型来自注册表，资源来自 /api/resources）
const typeCards = computed(() =>
  resourceTypes.value
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((t) => ({ key: t.key, name: t.name, ids: resourcePool.value[t.key] || [] }))
);

const filteredUsers = computed(() => {
  const q = userQuery.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter(
    (u) => (u.username || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)
  );
});

function key(type, id) {
  return type + ':' + id;
}

const groupsReq = useAsync(async () => {
  groups.value = await api('/api/admin/groups');
});
const metaReq = useAsync(async () => {
  const [types, pool] = await Promise.all([api('/api/resource-types'), api('/api/resources')]);
  resourceTypes.value = types || [];
  resourcePool.value = pool || {};
});
const usersReq = useAsync(async () => {
  const r = await api('/api/admin/users?page=1&pageSize=500');
  users.value = r?.items || [];
});

// 权限是 /api/auth/me 异步拉回来的：onMounted 那一刻 can() 必然是 false，
// 若只在挂载时判断权限，成员列表会永远停在「未加载」。权限就绪后补跑一次。
watch(
  () => can('user:view'),
  (yes) => {
    if (yes && !users.value.length && !usersReq.loading) usersReq.run();
  },
  { immediate: true } // 权限可能已在别处加载完（从其他页切进来），此时不会触发变化
);

/**
 * 同角色页：连点切换组时，旧请求可能后返回并覆盖新组的勾选态，
 * 接着点保存就会把 A 组的授权写进 B 组。用自增序号丢弃过期响应。
 */
let detailSeq = 0;
async function selectGroup(g) {
  const seq = ++detailSeq;
  selected.value = g;
  detailLoading.value = true;
  detailError.value = '';
  try {
    const d = await api('/api/admin/groups/' + g.id);
    if (seq !== detailSeq) return;
    checkedRes.value = new Set((d.items || []).map((it) => key(it.resourceType, it.resourceId)));
    checkedUsers.value = new Set(d.memberIds || []);
  } catch (e) {
    if (seq !== detailSeq) return;
    detailError.value = e?.message || '请求失败';
  } finally {
    // 只有仍是最新一次请求才收起 loading，否则会盖掉后发起请求的加载态
    if (seq === detailSeq) detailLoading.value = false;
  }
}

function toggleRes(type, id, on) {
  const s = new Set(checkedRes.value);
  on ? s.add(key(type, id)) : s.delete(key(type, id));
  checkedRes.value = s;
}
function toggleType(t) {
  const allOn = t.ids.every((id) => checkedRes.value.has(key(t.key, id)));
  const s = new Set(checkedRes.value);
  for (const id of t.ids) allOn ? s.delete(key(t.key, id)) : s.add(key(t.key, id));
  checkedRes.value = s;
}
function toggleUser(id, on) {
  const s = new Set(checkedUsers.value);
  on ? s.add(id) : s.delete(id);
  checkedUsers.value = s;
}

async function saveItems() {
  saving.value = true;
  try {
    const items = [...checkedRes.value].map((k) => {
      const i = k.indexOf(':');
      return { resourceType: k.slice(0, i), resourceId: k.slice(i + 1) };
    });
    await api(`/api/admin/groups/${selected.value.id}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
    flash(`已保存：${items.length} 项资源授权`);
    await groupsReq.run();
  } catch (e) {
    detailError.value = e?.message || '保存失败';
  } finally {
    saving.value = false;
  }
}

async function saveMembers() {
  saving.value = true;
  try {
    const userIds = [...checkedUsers.value];
    await api(`/api/admin/groups/${selected.value.id}/members`, {
      method: 'PUT',
      body: JSON.stringify({ userIds }),
    });
    flash(`已保存：${userIds.length} 名成员`);
    await groupsReq.run();
  } catch (e) {
    detailError.value = e?.message || '保存失败';
  } finally {
    saving.value = false;
  }
}

function openCreate() {
  form.name = '';
  form.description = '';
  showCreate.value = true;
}
async function createGroup() {
  const name = form.name.trim();
  if (!name) return;
  creating.value = true;
  createError.value = '';
  try {
    const created = await api('/api/admin/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description: form.description.trim() || null }),
    });
    showCreate.value = false;
    await groupsReq.run();
    // 建完直接选中新组，否则右侧还停在「从左侧选择」的空提示上，得再点一次才能配
    const fresh = groups.value.find((g) => g.id === created?.id);
    if (fresh) await selectGroup(fresh);
    flash(`已创建资源组「${name}」`);
  } catch (e) {
    // 重名等失败要讲出来，否则弹窗停在那儿、用户不知道为什么没建成
    createError.value = e?.message || '创建失败';
  } finally {
    creating.value = false;
  }
}

function askDelete(g) {
  pendingDelete.value = g;
  deleteError.value = '';
  showDelete.value = true;
}
async function doDelete() {
  const g = pendingDelete.value;
  if (!g) return;
  deleting.value = true;
  deleteError.value = '';
  try {
    await api('/api/admin/groups/' + g.id, { method: 'DELETE' });
    if (selected.value?.id === g.id) selected.value = null;
    showDelete.value = false;
    pendingDelete.value = null;
    await groupsReq.run();
    flash(`已删除资源组「${g.name}」`);
  } catch (e) {
    deleteError.value = e?.message || '删除失败';
  } finally {
    deleting.value = false;
  }
}

// 用户清单改由上面的 watch 触发（要等权限就绪），这里只拉组与资源池
onMounted(() => {
  groupsReq.run();
  metaReq.run();
});
</script>
