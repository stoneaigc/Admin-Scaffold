<template>
  <div class="flex min-h-screen bg-[#F1EFE8]">
    <aside class="w-52 bg-[#F1EFE8] border-r border-[#D3D1C7] py-4 px-2 text-sm">
      <div class="px-3 py-2 font-medium text-[#0C447C]">管理后台</div>
      <router-link
        v-for="m in menus"
        :key="m.to"
        :to="m.to"
        class="block px-3 py-2 rounded-md text-[#5F5E5A] hover:bg-white"
        active-class="bg-brand-600 text-white"
      >
        {{ m.label }}
      </router-link>
    </aside>

    <div class="flex-1 flex flex-col">
      <header class="h-12 border-b border-[#D3D1C7] bg-white flex items-center justify-between px-4">
        <span class="text-sm font-medium">资源中心 · 后台</span>
        <div class="flex items-center gap-3 text-sm">
          <span v-if="user">{{ user.name || user.username }}</span>
          <button class="text-[#5F5E5A] hover:text-[#0C447C]" @click="logout">退出</button>
        </div>
      </header>
      <main class="flex-1 p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePermissions } from '../composables/usePermissions';

const { can, adminEntry, user, logout } = usePermissions();

// 菜单按权限动态渲染：持有对应 menu:admin-* 或管理权限才显示
const allMenus = [
  { to: '/admin/users', label: '用户管理', perm: 'menu:admin-users' },
  { to: '/admin/roles', label: '角色权限', perm: 'menu:admin-roles' },
  { to: '/admin/groups', label: '资源组', perm: 'menu:admin-groups' },
  { to: '/admin/config', label: '系统设置', perm: 'menu:admin-config' },
];

const menus = computed(() =>
  adminEntry.value ? allMenus.filter((m) => can(m.perm)) : []
);
</script>
