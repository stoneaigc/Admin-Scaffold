<template>
  <div class="min-h-screen bg-[#F1EFE8]">
    <header class="border-b border-[#D3D1C7] bg-white flex items-center justify-between px-6 py-3">
      <span class="font-medium">资源中心</span>
      <div class="text-sm text-[#5F5E5A] flex items-center gap-4">
        <router-link v-if="adminEntry" to="/admin/users" class="hover:text-[#0C447C]">后台</router-link>
        <button class="hover:text-[#0C447C]" @click="logout">退出</button>
      </div>
    </header>

    <section class="bg-brand-50 px-6 py-10">
      <h1 class="text-lg font-medium mb-2">一站式资源自助平台</h1>
      <p class="text-sm text-[#5F5E5A] mb-4">浏览、申请、管理你需要的资源，全程自助。</p>
      <button class="bg-brand-600 text-white rounded-md px-4 py-2 text-sm">立即浏览</button>
    </section>

    <section class="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
      <div v-for="r in resources" :key="r" class="border border-[#D3D1C7] rounded-lg p-3 bg-white">
        <p class="text-sm font-medium">资源占位</p>
        <p class="text-xs text-[#5F5E5A] mt-1">按业务替换：{{ r }}</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../lib/apiBase';
import { usePermissions } from '../composables/usePermissions';

const { adminEntry, logout } = usePermissions();
const resources = ref([]);

onMounted(async () => {
  try {
    const data = await api('/api/resources');
    resources.value = Object.keys(data);
  } catch {
    resources.value = [];
  }
});
</script>
