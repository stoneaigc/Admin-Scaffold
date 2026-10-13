<template>
  <div class="min-h-screen bg-ink-50">
    <!-- 顶栏 -->
    <header class="sticky top-0 z-10 bg-panel/70 backdrop-blur-md border-b border-ink-200">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <img v-if="brand.logo" :src="brand.logo" alt="" class="w-8 h-8 rounded-lg object-contain" />
          <span
            v-else
            class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white"
          >
            <AppIcon name="logo" class="w-5 h-5" />
          </span>
          <span class="font-semibold text-ink-900">{{ brand.name }}</span>
        </div>
        <nav class="hidden md:flex items-center gap-7 text-sm text-ink-500">
          <a class="hover:text-ink-900 cursor-pointer transition">首页</a>
          <a class="hover:text-ink-900 cursor-pointer transition">资源</a>
          <a class="hover:text-ink-900 cursor-pointer transition">文档</a>
        </nav>
        <div class="flex items-center gap-3">
          <AppButton v-if="adminMenu" variant="secondary" size="sm" @click="goAdmin">进入后台</AppButton>
          <button class="text-sm text-ink-500 hover:text-ink-900 transition" @click="logout">退出</button>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="border-b border-ink-200 bg-panel">
      <div class="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700 text-xs px-3 py-1 font-medium">
          ✦ 开源 · Vue 3 + Express + SQLite
        </span>
        <h1 class="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-ink-900">一站式资源自助平台</h1>
        <p class="mt-4 text-base text-ink-500 max-w-xl mx-auto leading-relaxed">
          浏览、申请、管理你需要的资源，全程自助。基于可插拔的资源类型注册表，按业务自由扩展。
        </p>
        <div class="mt-8 flex items-center justify-center gap-3">
          <AppButton @click="browse">立即浏览</AppButton>
          <AppButton v-if="adminMenu" variant="secondary" @click="goAdmin">管理后台</AppButton>
        </div>
      </div>
    </section>

    <!-- 资源网格 -->
    <section class="max-w-6xl mx-auto px-6 py-16">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-if="resReq.error"
          class="col-span-full flex flex-col items-center gap-3 text-center text-red-600 py-10 bg-panel rounded-xl border border-dashed border-red-200"
        >
          <p class="font-medium">资源加载失败：{{ resReq.error }}</p>
          <AppButton variant="secondary" @click="resReq.run()">重试</AppButton>
        </div>
        <div
          v-else-if="resReq.loading"
          class="col-span-full flex items-center justify-center gap-2 text-ink-400 py-10"
        >
          <AppSpinner :size="22" />
          <span>加载中…</span>
        </div>
        <template v-else>
          <div
            v-for="r in resources"
            :key="r"
            class="group bg-panel rounded-xl border border-ink-200 p-5 shadow-card hover:border-brand-200 hover:-translate-y-0.5 transition-all duration-200"
          >
            <span class="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <AppIcon name="logo" class="w-5 h-5" />
            </span>
            <p class="mt-3 font-medium text-ink-900 text-sm">{{ r.name }}</p>
            <p class="text-xs text-ink-500 mt-1 font-mono">{{ r.key }}</p>
          </div>
          <div
            v-if="!resources.length"
            class="col-span-full text-center text-ink-500 text-sm py-10 bg-panel rounded-xl border border-dashed border-ink-300"
          >
            暂无资源类型，请在后端 <code class="px-1.5 py-0.5 rounded bg-ink-100">resource-types.setup.js</code> 注册。
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../lib/apiBase';
import { usePermissions } from '../composables/usePermissions';
import { useBrand } from '../composables/useBrand';
import { firstVisibleMenu } from '../lib/menus';
import AppIcon from '../components/ui/AppIcon.vue';
import AppButton from '../components/ui/AppButton.vue';
import AppSpinner from '../components/ui/AppSpinner.vue';
import { useAsync } from '../composables/useAsync';

const { logout, can } = usePermissions();
const { brand } = useBrand();
const router = useRouter();
const resources = ref([]);
// 与登录落地页同一套判断：只有真的有可见后台菜单才展示入口
const adminMenu = computed(() => firstVisibleMenu(can));

const resReq = useAsync(async () => {
  resources.value = await api('/api/resource-types');
});
onMounted(() => {
  resReq.run();
});

function goAdmin() {
  const m = adminMenu.value;
  router.push(m ? m.to : '/');
}
function browse() {
  document.querySelector('section:last-of-type')?.scrollIntoView({ behavior: 'smooth' });
}
</script>
