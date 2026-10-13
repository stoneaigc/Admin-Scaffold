<template>
  <div class="flex min-h-screen bg-ink-50">
    <!-- 移动端抽屉遮罩 -->
    <Transition name="modal-fade">
      <div
        v-if="mobileOpen"
        class="fixed inset-0 z-30 bg-scrim/40 backdrop-blur-sm lg:hidden"
        @click="closeMobile"
      ></div>
    </Transition>

    <!-- ============ 侧边栏 ============
         桌面端：在文档流内，宽度随折叠在 240 / 68 之间过渡。
         移动端：改为 fixed 抽屉，用位移滑入滑出，不占内容宽度。 -->
    <aside
      class="shrink-0 bg-sidebar border-r border-hairline flex flex-col h-full
             fixed inset-y-0 left-0 z-40
             lg:sticky lg:top-0 lg:h-screen lg:z-auto
             transition-[width,transform] duration-200 ease-out"
      :class="[asideWidth, mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0']"
    >
      <!-- 品牌区：折叠时只留 Logo 标记。整块可点，跳前台首页（前台有「进入后台」可回来） -->
      <router-link
        to="/"
        title="前往前台首页"
        class="h-16 shrink-0 flex items-center border-b border-hairline hover:bg-ink-50/60 transition-colors"
        :class="showLabels ? 'gap-2.5 px-4' : 'justify-center px-0'"
        @click="closeMobile"
      >
        <img
          v-if="brand.logo"
          :src="brand.logo"
          alt=""
          class="w-8 h-8 rounded-lg object-contain shrink-0"
        />
        <span
          v-else
          class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0"
        >
          <AppIcon name="logo" class="w-5 h-5" />
        </span>
        <span v-if="showLabels" class="text-ink-900 font-semibold tracking-tight truncate">
          {{ brand.name }}
        </span>
      </router-link>

      <!-- 导航 -->
      <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" :class="showLabels ? '' : 'px-2'">
        <p
          v-if="showLabels && menus.length"
          class="px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-2"
        >
          管理
        </p>

        <!-- 一个后台菜单都没有时别留空白侧栏：否则「登录成功但一片空白」无从判断原因 -->
        <p
          v-if="!menus.length && !soonMenus.length"
          class="px-3 py-8 text-center text-xs text-ink-500 leading-relaxed"
        >
          {{ showLabels ? '当前账号没有任何后台菜单权限，请联系管理员分配角色。' : '无权限' }}
        </p>

        <router-link
          v-for="m in menus"
          :key="m.to"
          :to="m.to"
          :title="showLabels ? undefined : m.label"
          class="group flex items-center rounded-md text-sm border-l-2 border-transparent transition-colors"
          :class="[
            showLabels ? 'gap-3 px-3 py-2' : 'justify-center h-10 px-0',
            isActive(m.to)
              ? 'bg-brand-50 text-ink-900 font-medium border-brand-500'
              : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
          ]"
          @click="closeMobile"
        >
          <AppIcon
            :name="m.icon"
            class="w-[18px] h-[18px] shrink-0"
            :class="isActive(m.to) ? 'text-brand-500' : ''"
          />
          <span v-if="showLabels" class="flex-1 truncate">{{ m.label }}</span>
        </router-link>

        <!-- 占位菜单（功能未上线） -->
        <div
          v-for="m in soonMenus"
          :key="m.to"
          :title="showLabels ? undefined : `${m.label}（即将上线）`"
          class="relative flex items-center rounded-md text-sm text-ink-400 cursor-not-allowed"
          :class="showLabels ? 'gap-3 px-3 py-2' : 'justify-center h-10 px-0'"
        >
          <AppIcon :name="m.icon" class="w-[18px] h-[18px] shrink-0" />
          <template v-if="showLabels">
            <span class="flex-1 truncate">{{ m.label }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 text-ink-500">soon</span>
          </template>
          <span v-else class="absolute right-2 top-2 w-1 h-1 rounded-full bg-ink-300"></span>
        </div>
      </nav>

      <!-- 底部用户区：折叠时收敛为「头像 + 退出」竖排 -->
      <div class="shrink-0 border-t border-hairline" :class="showLabels ? 'px-3 py-4' : 'p-2'">
        <div v-if="!showLabels" class="flex flex-col items-center gap-2">
          <span
            class="w-9 h-9 rounded-full bg-ink-100 text-ink-900 flex items-center justify-center font-medium text-sm"
            :title="user?.name || user?.username"
          >
            {{ initial }}
          </span>
          <button
            class="text-ink-500 hover:text-ink-900 p-1.5 rounded-md hover:bg-ink-100 transition"
            title="退出登录"
            aria-label="退出登录"
            @click="logout"
          >
            <AppIcon name="logout" class="w-[18px] h-[18px]" />
          </button>
        </div>

        <div v-else class="flex items-center gap-3 px-2">
          <span class="w-9 h-9 rounded-full bg-ink-100 text-ink-900 flex items-center justify-center font-medium shrink-0">
            {{ initial }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-ink-900 truncate">{{ user?.name || user?.username }}</p>
            <p class="text-xs text-ink-500 truncate">
              {{ user?.is_portal_admin ? '超级管理员' : '成员' }}
            </p>
          </div>
          <button
            class="text-ink-500 hover:text-ink-900 p-1.5 rounded-md hover:bg-ink-100 transition shrink-0"
            title="退出登录"
            aria-label="退出登录"
            @click="logout"
          >
            <AppIcon name="logout" class="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>

    <!-- ============ 主区 ============ -->
    <div class="flex-1 flex flex-col min-w-0">
      <header
        class="h-16 bg-panel/70 backdrop-blur-md border-b border-hairline flex items-center justify-between gap-3 px-4 lg:px-6 sticky top-0 z-10"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <!-- 移动端：唤起抽屉 -->
          <button
            class="lg:hidden w-9 h-9 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 flex items-center justify-center transition shrink-0"
            title="打开菜单"
            aria-label="打开菜单"
            @click="toggleMobile"
          >
            <AppIcon name="menu" class="w-5 h-5" />
          </button>

          <!-- 桌面端：折叠 / 展开侧栏 -->
          <button
            class="hidden lg:flex w-9 h-9 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 items-center justify-center transition shrink-0"
            :title="collapsed ? '展开侧栏' : '收起侧栏'"
            :aria-label="collapsed ? '展开侧栏' : '收起侧栏'"
            :aria-expanded="collapsed ? 'false' : 'true'"
            @click="toggleCollapse"
          >
            <AppIcon name="panel-left" class="w-5 h-5" />
          </button>

          <h1 class="text-base font-semibold text-ink-900 truncate">{{ currentTitle }}</h1>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <!-- 全局搜索尚未实现：宁可明确禁用，也不要放一个能输入却毫无反应的框 -->
          <div
            class="hidden md:flex items-center gap-2 bg-ink-100/60 rounded-lg px-3 h-9 text-ink-400 transition"
            title="全局搜索尚未实现"
          >
            <AppIcon name="search" class="w-4 h-4" />
            <input
              disabled
              placeholder="搜索…"
              class="bg-transparent text-sm outline-none w-36 placeholder:text-ink-400 cursor-not-allowed"
            />
          </div>

          <!-- 主题外观切换 -->
          <ThemeSwitcher />

          <!-- 通知功能未接入：常亮的红点等于永远宣称「有未读」，属误导，先去掉 -->
          <button
            class="relative w-9 h-9 rounded-lg hover:bg-ink-100 flex items-center justify-center text-ink-500 transition"
            title="通知（未接入）"
            aria-label="通知（未接入）"
          >
            <AppIcon name="bell" class="w-5 h-5" />
          </button>

          <span
            class="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-medium"
          >
            {{ initial }}
          </span>
        </div>
      </header>

      <main class="flex-1 p-4 lg:p-6 overflow-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePermissions } from '../composables/usePermissions';
import { useSidebar } from '../composables/useSidebar';
import { useBrand } from '../composables/useBrand';
import { ADMIN_MENUS } from '../lib/menus';
import AppIcon from './ui/AppIcon.vue';
import ThemeSwitcher from './ui/ThemeSwitcher.vue';

const { user, logout, can } = usePermissions();
const { collapsed, mobileOpen, isMobile, toggleCollapse, toggleMobile, closeMobile } = useSidebar();
const { brand } = useBrand();
const route = useRoute();

// 菜单按 menu:* 权限过滤：没有对应权限的用户看不到该菜单，
// 避免"菜单点进去 403 白屏"（后端仍会鉴权，这里只做可见性收敛）。
const permitted = computed(() => ADMIN_MENUS.filter((m) => !m.perm || can(m.perm)));
const menus = computed(() => permitted.value.filter((m) => !m.soon));
const soonMenus = computed(() => permitted.value.filter((m) => m.soon));

// 是否展示文字标签：折叠态只留图标；移动端抽屉始终是完整宽度，必须带文字
const showLabels = computed(() => isMobile.value || !collapsed.value);
const asideWidth = computed(() => (showLabels.value ? 'w-60' : 'w-[68px]'));

const initial = computed(() => (user.value?.name || user.value?.username || '?')[0]?.toUpperCase());
const currentTitle = computed(() => ADMIN_MENUS.find((m) => m.to === route.path)?.title || '后台');

function isActive(to) {
  return route.path === to;
}

// 路由切换后自动收起移动端抽屉，否则点完菜单遮罩还挂在屏上
watch(
  () => route.path,
  () => closeMobile()
);
</script>
