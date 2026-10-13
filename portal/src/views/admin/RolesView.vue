<template>
  <div>
    <PageHeader title="角色权限" subtitle="定义角色并勾选其拥有的权限原子">
      <template #actions>
        <AppButton v-if="can('role:create')" @click="openCreate">
          <AppIcon name="plus" class="w-4 h-4" />新建角色
        </AppButton>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
      <!-- ==================== 左：角色列表 ==================== -->
      <div class="bg-panel rounded-xl border border-ink-200 shadow-card p-2 lg:sticky lg:top-20">
        <div class="px-1.5 pt-1.5 pb-2">
          <AppInput v-model="roleQuery" size="sm" placeholder="搜索角色…">
            <template #prefix><AppIcon name="search" class="w-3.5 h-3.5" /></template>
          </AppInput>
        </div>

        <div v-if="rolesReq.error" class="px-3 py-8 text-center">
          <p class="text-red-600 font-medium text-sm">加载失败：{{ rolesReq.error }}</p>
          <AppButton variant="secondary" class="mt-3" @click="rolesReq.run()">重试</AppButton>
        </div>
        <div v-else-if="rolesReq.loading" class="px-3 py-10 flex flex-col items-center gap-2 text-ink-500">
          <AppSpinner :size="22" />
          <span class="text-xs">加载中…</span>
        </div>
        <template v-else>
          <button
            v-for="r in filteredRoles"
            :key="r.id"
            :data-role-id="r.id"
            class="w-full text-left px-3 py-2.5 rounded-lg transition flex items-center justify-between gap-2"
            :class="selected?.id === r.id ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-ink-50/60'"
            @click="selectRole(r)"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="font-medium truncate"
                  :class="selected?.id === r.id ? 'text-brand-700' : 'text-ink-900'"
                >{{ r.name }}</span>
                <AppBadge v-if="r.is_system" color="amber">系统</AppBadge>
              </div>
              <p class="text-xs text-ink-500 mt-0.5">
                {{ r.user_count }} 名成员<span v-if="r.permission_count"> · {{ r.permission_count }} 项权限</span>
              </p>
            </div>
            <span
              v-if="can('role:delete') && !r.is_system"
              class="w-7 h-7 shrink-0 rounded-md text-ink-400 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition"
              title="删除角色"
              role="button"
              tabindex="0"
              @click.stop="askDelete(r)"
              @keyup.enter.stop="askDelete(r)"
            >
              <AppIcon name="trash" class="w-4 h-4" />
            </span>
          </button>
          <p v-if="!filteredRoles.length" class="px-3 py-8 text-center text-ink-500 text-sm">
            {{ roles.length ? `没有匹配「${roleQuery}」的角色` : '暂无角色' }}
          </p>
        </template>
      </div>

      <!-- ==================== 右：权限位 ==================== -->
      <div v-if="selected" class="bg-panel rounded-xl border border-ink-200 shadow-card overflow-hidden">
        <!-- 卡头 + 工具条 -->
        <div class="px-4 py-3.5 border-b border-ink-100 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div class="min-w-0">
            <h3 class="font-semibold text-ink-900 flex items-center gap-2">
              权限位 · {{ selected.name }}
              <AppBadge v-if="selected.is_system" color="amber">系统</AppBadge>
            </h3>
            <p class="text-xs text-ink-500 mt-0.5">勾选即赋予该角色对应能力，点保存后生效</p>
          </div>

          <div class="flex items-center gap-2 ml-auto flex-wrap">
            <div class="w-40">
              <AppInput v-model="permQuery" size="sm" placeholder="搜索权限…">
                <template #prefix><AppIcon name="search" class="w-3.5 h-3.5" /></template>
              </AppInput>
            </div>
            <AppBadge :color="checked.size ? 'brand' : 'gray'" data-testid="picked-count">
              {{ checked.size }} / {{ perms.length }} 已选
            </AppBadge>
            <AppButton size="sm" variant="secondary" @click="toggleAllGroups">
              {{ allOpen ? '全部收起' : '全部展开' }}
            </AppButton>
          </div>
        </div>

        <div
          v-if="permsReq.error"
          class="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
        >
          <span>权限加载失败：{{ permsReq.error }}</span>
          <AppButton variant="secondary" size="sm" class="ml-3" @click="permsReq.run()">重试</AppButton>
        </div>

        <div v-else-if="permsReq.loading" class="px-3 py-16 flex flex-col items-center gap-2 text-ink-500">
          <AppSpinner :size="22" />
          <span class="text-xs">权限清单加载中…</span>
        </div>

        <!-- 分组：每个 module 一个可折叠区块，组内多列紧凑排布 -->
        <div v-else class="p-3 space-y-2">
          <section
            v-for="g in visibleGroups"
            :key="g.module"
            :data-module="g.module"
            class="rounded-lg border border-ink-200 overflow-hidden"
          >
            <header class="flex items-center gap-2 h-10 px-2 bg-ink-50/70">
              <button
                class="flex items-center gap-2 flex-1 min-w-0 h-full text-left"
                :aria-expanded="isOpen(g.module) ? 'true' : 'false'"
                @click="toggleGroup(g.module)"
              >
                <AppIcon
                  name="chevron-right"
                  class="w-3.5 h-3.5 shrink-0 text-ink-400 transition-transform duration-150"
                  :class="isOpen(g.module) ? 'rotate-90' : ''"
                />
                <span class="text-sm font-medium text-ink-900">{{ moduleName(g.module) }}</span>
                <code class="text-[11px] text-ink-500 font-mono truncate hidden sm:inline">{{ g.module }}</code>
              </button>
              <AppBadge :color="groupPicked(g) === g.list.length ? 'green' : groupPicked(g) ? 'brand' : 'gray'">
                {{ groupPicked(g) }} / {{ g.list.length }}
              </AppBadge>
              <button
                v-if="can('role:edit')"
                class="text-xs px-1.5 py-1 rounded transition shrink-0"
                :class="groupPicked(g) === g.list.length ? 'text-ink-500 hover:text-red-700 hover:bg-red-50' : 'text-ink-500 hover:text-brand-700 hover:bg-brand-50'"
                @click="setGroup(g, groupPicked(g) !== g.list.length)"
              >
                {{ groupPicked(g) === g.list.length ? '取消全选' : '全选' }}
              </button>
            </header>

            <div
              v-show="isOpen(g.module)"
              class="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-1.5 gap-y-0.5"
            >
              <label
                v-for="p in g.list"
                :key="p.id"
                class="flex items-center gap-2 h-9 px-2 rounded-md cursor-pointer transition"
                :class="checked.has(p.id) ? 'bg-brand-50/60 hover:bg-brand-50' : 'hover:bg-ink-50'"
                :title="`${p.name} · ${p.key}`"
              >
                <span
                  class="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition"
                  :class="checked.has(p.id) ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-panel'"
                >
                  <AppIcon v-if="checked.has(p.id)" name="check" class="w-3 h-3" />
                </span>
                <input
                  type="checkbox"
                  class="sr-only"
                  :checked="checked.has(p.id)"
                  :disabled="!can('role:edit')"
                  @change="toggle(p.id, $event.target.checked)"
                />
                <span
                  class="text-sm truncate"
                  :class="checked.has(p.id) ? 'text-brand-700 font-medium' : 'text-ink-900'"
                >{{ p.name }}</span>
                <AppBadge v-if="p.is_dangerous" color="red">危险</AppBadge>
                <code class="ml-auto pl-2 text-[11px] font-mono text-ink-500 truncate hidden xl:block">
                  {{ p.key }}
                </code>
              </label>
            </div>
          </section>

          <p v-if="!visibleGroups.length" class="py-12 text-center text-ink-500 text-sm">
            没有匹配「{{ permQuery }}」的权限
          </p>
        </div>

        <!-- 底栏 -->
        <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-ink-100 bg-ink-50/40">
          <p class="text-xs text-ink-500">
            共 {{ perms.length }} 个权限位
            <span v-if="errorHint" class="text-red-600 font-medium">· {{ errorHint }}</span>
            <span v-else-if="dirty" class="text-amber-600 font-medium">· 有未保存的修改</span>
            <span v-else-if="savedHint" class="text-emerald-600 font-medium">· {{ savedHint }}</span>
          </p>
          <div class="flex items-center gap-2">
            <AppButton v-if="can('role:edit')" size="sm" variant="secondary" :disabled="!dirty || saving" @click="resetChecked">
              还原
            </AppButton>
            <AppButton v-if="can('role:edit')" size="sm" :disabled="saving" @click="save">
              {{ saving ? '保存中…' : '保存权限' }}
            </AppButton>
          </div>
        </div>
      </div>

      <div
        v-else
        class="bg-panel rounded-xl border border-dashed border-ink-300 flex items-center justify-center text-ink-500 text-sm min-h-[220px]"
      >
        从左侧选择一个角色查看权限
      </div>
    </div>

    <!-- 新建角色 -->
    <AppModal v-model="showCreate" title="新建角色">
      <AppField label="角色名" hint="创建后可在右侧勾选其权限">
        <AppInput v-model="newName" placeholder="如：运营" @keyup.enter="createRole" />
      </AppField>
      <p
        v-if="createError"
        class="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
      >
        {{ createError }}
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="showCreate = false">取消</AppButton>
        <AppButton :disabled="creating || !newName.trim()" @click="createRole">
          {{ creating ? '创建中…' : '创建' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 删除确认（替换原生 confirm，保持视觉一致） -->
    <AppModal v-model="showDelete" title="删除角色">
      <p class="text-sm text-ink-700">
        确认删除角色「<span class="font-medium text-ink-900">{{ pendingDelete?.name }}</span>」？
      </p>
      <p class="text-xs text-ink-500 mt-2">
        该角色下的 {{ pendingDelete?.user_count || 0 }} 名成员将失去这些权限，操作不可撤销。
      </p>
      <p
        v-if="deleteError"
        class="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
      >
        {{ deleteError }}
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="showDelete = false">取消</AppButton>
        <AppButton variant="danger" @click="doDelete">删除</AppButton>
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

const { can } = usePermissions();
const roles = ref([]);
const perms = ref([]);
const selected = ref(null);
const checked = ref(new Set());
const snapshot = ref(new Set()); // 用于判断「有未保存修改」与「还原」
const showCreate = ref(false);
const showDelete = ref(false);
const pendingDelete = ref(null);
const newName = ref('');
const roleQuery = ref('');
const permQuery = ref('');
/* 折叠状态记「被收起的组」，默认空集合 = 全部展开。
   若反过来记「展开的组」，权限列表异步到达时初始值为空会导致首屏全折叠、一个权限都看不到。 */
const collapsedGroups = ref(new Set());
const saving = ref(false);
const savedHint = ref('');
const errorHint = ref('');
const deleteError = ref('');
const creating = ref(false);
const createError = ref('');

/* ------------------------------------------------------------------
 * 权限分组：完全由后端 permissions.module 驱动，前端不做任何硬编码枚举。
 * 以后新增权限位只要往 permissions 表插一行，这里会自动多出对应勾选项；
 * 新增 module 时无需改代码，未登记中文名的分组会退回原始 module 名并排在最后。
 * ------------------------------------------------------------------ */
const MODULE_LABEL = {
  user: '用户',
  role: '角色',
  menu: '菜单',
  resource: '资源',
  group: '资源组',
  system: '系统',
  config: '系统配置',
};
const MODULE_ORDER = ['user', 'role', 'member', 'menu', 'resource', 'group', 'system', 'config'];

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

const visibleGroups = computed(() => {
  const q = permQuery.value.trim().toLowerCase();
  if (!q) return groups.value;
  return groups.value
    .map((g) => ({
      module: g.module,
      list: g.list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.list.length);
});

const filteredRoles = computed(() => {
  const q = roleQuery.value.trim().toLowerCase();
  if (!q) return roles.value;
  return roles.value.filter((r) => String(r.name).toLowerCase().includes(q));
});

/** 搜索时强制展开命中分组，避免「搜到了却在折叠里」 */
function isOpen(module) {
  return permQuery.value.trim() ? true : !collapsedGroups.value.has(module);
}
const allOpen = computed(() => groups.value.length > 0 && collapsedGroups.value.size === 0);
function toggleGroup(module) {
  const s = new Set(collapsedGroups.value);
  s.has(module) ? s.delete(module) : s.add(module);
  collapsedGroups.value = s;
}
function toggleAllGroups() {
  collapsedGroups.value = allOpen.value ? new Set(groups.value.map((g) => g.module)) : new Set();
}

function groupPicked(g) {
  return g.list.filter((p) => checked.value.has(p.id)).length;
}
function setGroup(g, on) {
  const s = new Set(checked.value);
  for (const p of g.list) (on ? s.add(p.id) : s.delete(p.id));
  checked.value = s;
  clearHints();
}

function toggle(id, on) {
  const s = new Set(checked.value);
  on ? s.add(id) : s.delete(id);
  checked.value = s;
  clearHints();
}

function clearHints() {
  savedHint.value = '';
  errorHint.value = '';
}

const dirty = computed(() => {
  const a = checked.value;
  const b = snapshot.value;
  if (a.size !== b.size) return true;
  for (const id of a) if (!b.has(id)) return true;
  return false;
});

const rolesReq = useAsync(async () => {
  const list = await api('/api/admin/roles');
  roles.value = list;
  if (!selected.value && list.length) selectRole(list[0]);
});
const permsReq = useAsync(async () => {
  perms.value = await api('/api/admin/permissions');
});

/**
 * 切换角色时要防竞态：连点 A→B，A 的详情请求可能后于 B 返回，
 * 一旦直接赋值就会把 A 的勾选盖到 B 上 —— 看起来是「B 有这些权限」，
 * 此时点保存就是把 A 的权限写进 B，属于真实的越权配置事故。
 * 用自增序号丢弃过期响应。
 */
let detailSeq = 0;
async function selectRole(r) {
  const seq = ++detailSeq;
  selected.value = r;
  clearHints();
  try {
    const detail = await api('/api/admin/roles/' + r.id);
    if (seq !== detailSeq) return; // 已经切到别的角色，这次结果作废
    checked.value = new Set(detail.permissionIds || []);
  } catch (e) {
    if (seq !== detailSeq) return;
    checked.value = new Set();
    errorHint.value = `权限加载失败：${e.message || r.name}`;
  }
  if (seq !== detailSeq) return;
  snapshot.value = new Set(checked.value);
}

function resetChecked() {
  checked.value = new Set(snapshot.value);
  clearHints();
}

function openCreate() {
  newName.value = '';
  showCreate.value = true;
}
async function createRole() {
  const name = newName.value.trim();
  if (!name) return;
  creating.value = true;
  createError.value = '';
  try {
    const created = await api('/api/admin/roles', { method: 'POST', body: JSON.stringify({ name }) });
    showCreate.value = false;
    await rolesReq.run();
    const hit = roles.value.find((r) => r.id === created?.id) || roles.value.find((r) => r.name === name);
    if (hit) selectRole(hit);
  } catch (e) {
    // 重名等失败必须说出来：否则弹窗静默卡住，用户以为没点上
    createError.value = e.message || '创建失败';
  } finally {
    creating.value = false;
  }
}

async function save() {
  const roleId = selected.value?.id;
  if (!roleId) return;
  saving.value = true;
  try {
    await api('/api/admin/roles/' + roleId + '/permissions', {
      method: 'PUT',
      body: JSON.stringify({ permissionIds: [...checked.value] }),
    });
    // 保存期间可能已经切到别的角色：此时不能再改 snapshot / 提示，否则状态错位
    if (selected.value?.id !== roleId) return;
    snapshot.value = new Set(checked.value);
    savedHint.value = '已保存';
    rolesReq.run();
    setTimeout(() => (savedHint.value = ''), 3000);
  } catch (e) {
    if (selected.value?.id === roleId) {
      savedHint.value = '';
      errorHint.value = e.message || '保存失败';
    }
  } finally {
    saving.value = false;
  }
}

function askDelete(r) {
  pendingDelete.value = r;
  deleteError.value = '';
  showDelete.value = true;
}
async function doDelete() {
  const r = pendingDelete.value;
  if (!r) return;
  try {
    await api('/api/admin/roles/' + r.id, { method: 'DELETE' });
    if (selected.value?.id === r.id) {
      selected.value = null;
      checked.value = new Set();
      snapshot.value = new Set();
    }
    showDelete.value = false;
    pendingDelete.value = null;
    rolesReq.run();
  } catch (e) {
    deleteError.value = e.message || '删除失败';
  }
}

onMounted(() => {
  rolesReq.run();
  permsReq.run();
});
</script>
