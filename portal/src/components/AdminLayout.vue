<template>
  <div class="flex min-h-screen bg-ink-50">
    <!-- 侧边栏 -->
    <aside class="w-60 shrink-0 bg-sidebar text-ink-400 flex flex-col">
      <div class="h-16 flex items-center gap-2.5 px-5 border-b border-white/5">
        <span class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
          <AppIcon name="logo" class="w-5 h-5" />
        </span>
        <span class="text-white font-semibold tracking-tight">Admin Scaffold</span>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p class="px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2">管理</p>
        <router-link
          v-for="m in menus"
          v-show="!m.soon"
          :key="m.to"
          :to="m.to"
          class="group flex items-center gap-3 px-3 py-2 rounded-md text-sm border-l-2 border-transparent transition-colors"
          :class="
            isActive(m.to)
              ? 'bg-white/[0.07] text-white font-medium'
              : 'text-ink-400 hover:bg-white/[0.04] hover:text-ink-200'
          "
        >
          <AppIcon :name="m.icon" class="w-[18px] h-[18px] shrink-0" :class="isActive(m.to) ? 'text-brand-400' : ''" />
          <span class="flex-1">{{ m.label }}</span>
        </router-link>

        <div
          v-for="m in menus.filter((x) => x.soon)"
          :key="m.to"
          class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-ink-600 cursor-not-allowed"
        >
          <AppIcon :name="m.icon" class="w-[18px] h-[18px] shrink-0" />
          <span class="flex-1">{{ m.label }}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-ink-500">soon</span>
        </div>
      </nav>

      <div class="px-3 py-4 border-t border-white/5">
        <div class="flex items-center gap-3 px-2">
          <span class="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center font-medium">
            {{ initial }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-white truncate">{{ user?.name || user?.username }}</p>
            <p class="text-xs text-ink-500 truncate">{{ user?.is_portal_admin ? '超级管理员' : '成员' }}</p>
          </div>
          <button class="text-ink-500 hover:text-white p-1.5 rounded-md hover:bg-white/5 transition" title="退出" @click="logout">
            <AppIcon name="logout" class="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>

    <!-- 主区 -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 bg-white border-b border-ink-200 flex items-center justify-between px-6 sticky top-0 z-10">
        <h1 class="text-base font-semibold text-ink-900">{{ currentTitle }}</h1>
        <div class="flex items-center gap-2">
          <div class="hidden md:flex items-center gap-2 bg-ink-100 rounded-lg px-3 h-9 text-ink-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition">
            <AppIcon name="search" class="w-4 h-4" />
            <input placeholder="搜索…" class="bg-transparent text-sm outline-none w-36 placeholder:text-ink-400" />
          </div>
          <button class="relative w-9 h-9 rounded-lg hover:bg-ink-100 flex items-center justify-center text-ink-500 transition">
            <AppIcon name="bell" class="w-5 h-5" />
            <span class="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-red-500"></span>
          </button>
          <span class="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-medium">
            {{ initial }}
          </span>
        </div>
      </header>

      <main class="flex-1 p-6 overflow-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { usePermissions } from '../composables/usePermissions';
import AppIcon from './ui/AppIcon.vue';

const { user, logout } = usePermissions();
const route = useRoute();

const allMenus = [
  { to: '/admin/users', label: '用户管理', icon: 'users', perm: 'menu:admin-users', title: '用户管理' },
  { to: '/admin/roles', label: '角色权限', icon: 'roles', perm: 'menu:admin-roles', title: '角色权限' },
  { to: '/admin/groups', label: '资源组', icon: 'groups', perm: 'menu:admin-groups', title: '资源组', soon: true },
  { to: '/admin/config', label: '系统设置', icon: 'config', perm: 'menu:admin-config', title: '系统设置', soon: true },
];

const menus = computed(() => allMenus);
const initial = computed(() => (user.value?.name || user.value?.username || '?')[0]?.toUpperCase());
const currentTitle = computed(() => allMenus.find((m) => m.to === route.path)?.title || '后台');

function isActive(to) {
  return route.path === to;
}
</script>
