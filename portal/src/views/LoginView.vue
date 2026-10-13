<template>
  <div class="min-h-screen grid lg:grid-cols-[minmax(0,42%)_1fr]">
    <!-- 品牌区（浅色 hero；暗色模式下跟随令牌翻成深色，不再是固定浅色块） -->
    <div
      class="relative hidden lg:flex flex-col justify-between p-12 text-ink-900 overflow-hidden border-r border-hairline
             bg-gradient-to-br from-[#f5f8ff] to-[#eef4ff]
             dark:from-ink-100 dark:to-ink-50"
    >
      <div class="flex items-center gap-2.5">
        <img v-if="brand.logo" :src="brand.logo" alt="" class="w-9 h-9 rounded-lg object-contain" />
        <span
          v-else
          class="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white"
        >
          <AppIcon name="logo" class="w-5 h-5" />
        </span>
        <span class="font-semibold text-lg tracking-tight">{{ brand.name }}</span>
      </div>

      <div>
        <h1 class="text-4xl md:text-5xl font-bold leading-[1.12] tracking-tight">
          开箱即用的<br />后台管理脚手架
        </h1>
        <p class="mt-4 text-ink-500 text-sm leading-relaxed max-w-sm">
          {{ brand.description }}
        </p>
        <ul class="mt-8 space-y-3 text-sm text-ink-600">
          <li v-for="f in features" :key="f" class="flex items-center gap-2.5">
            <span class="w-5 h-5 rounded-full bg-ink-100 flex items-center justify-center text-brand-700">
              <AppIcon name="check" class="w-3.5 h-3.5" />
            </span>
            {{ f }}
          </li>
        </ul>
      </div>

      <p v-if="brand.footer" class="text-xs text-ink-400">{{ brand.footer }}</p>
    </div>

    <!-- 表单 -->
    <div class="flex items-center justify-center p-6 bg-ink-50">
      <div class="w-full max-w-sm animate-fade-in">
        <div class="lg:hidden flex items-center gap-2.5 mb-8">
          <img v-if="brand.logo" :src="brand.logo" alt="" class="w-9 h-9 rounded-lg object-contain" />
          <span
            v-else
            class="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white"
          >
            <AppIcon name="logo" class="w-5 h-5" />
          </span>
          <span class="font-semibold text-lg text-ink-900">{{ brand.name }}</span>
        </div>

        <h2 class="text-2xl font-bold text-ink-900 tracking-tight">{{ brand.welcome || '欢迎回来' }}</h2>
        <p class="text-sm text-ink-500 mt-1.5 mb-7">登录以管理你的资源后台</p>

        <form @submit.prevent="login">
          <AppField label="用户名">
            <AppInput
              v-model="username"
              size="lg"
              autocomplete="username"
              placeholder="请输入用户名"
            />
          </AppField>

          <AppField label="密码" class="mt-4">
            <AppInput
              v-model="password"
              type="password"
              size="lg"
              autocomplete="current-password"
              placeholder="请输入密码"
              @keyup.enter="login"
            />
          </AppField>

          <p v-if="error" class="text-red-500 text-xs mt-2">{{ error }}</p>

          <AppButton type="submit" class="w-full mt-4 h-11" :disabled="loading">
            {{ loading ? '登录中…' : '登 录' }}
          </AppButton>
        </form>

        <p class="mt-6 text-xs text-ink-500 text-center">
          默认账号
          <code class="px-1.5 py-0.5 rounded bg-panel border border-ink-200 text-ink-700">
            admin / admin123456
          </code>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, setToken } from '../lib/apiBase';
import { usePermissions } from '../composables/usePermissions';
import { useBrand } from '../composables/useBrand';
import { firstVisibleMenu } from '../lib/menus';
import AppIcon from '../components/ui/AppIcon.vue';
import AppButton from '../components/ui/AppButton.vue';
import AppField from '../components/ui/AppField.vue';
import AppInput from '../components/ui/AppInput.vue';

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();
const { load, can } = usePermissions();
const { brand } = useBrand();

const features = ['RBAC 用户 / 角色 / 权限模型', '动态菜单 + 按钮级权限控制', 'SQLite 默认 · PostgreSQL 可选'];

async function login() {
  error.value = '';
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码';
    return;
  }
  loading.value = true;
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    setToken(data.token);
    await load();
    // 落地页：有可见后台菜单就进该菜单，否则落前端展示首页。
    // 不能只看 adminEntry —— 它只表示"有后台身份"，不代表能进具体菜单。
    const target = firstVisibleMenu(can);
    router.push(target ? target.to : '/');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
