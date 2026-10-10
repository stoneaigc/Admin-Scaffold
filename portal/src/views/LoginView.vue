<template>
  <div class="min-h-screen grid lg:grid-cols-[minmax(0,42%)_1fr]">
    <!-- 品牌区（纯深色，无渐变） -->
    <div class="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden bg-sidebar">
      <div class="flex items-center gap-2.5">
        <span class="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
          <AppIcon name="logo" class="w-5 h-5" />
        </span>
        <span class="font-semibold text-lg tracking-tight">Admin Scaffold</span>
      </div>

      <div>
        <h1 class="text-3xl font-bold leading-snug tracking-tight">开箱即用的<br />后台管理脚手架</h1>
        <p class="mt-4 text-ink-400 text-sm leading-relaxed max-w-sm">
          内置 RBAC 权限内核、用户角色管理、动态菜单与资源隔离。默认 SQLite，一行切到 PostgreSQL。
        </p>
        <ul class="mt-8 space-y-3 text-sm text-ink-300">
          <li v-for="f in features" :key="f" class="flex items-center gap-2.5">
            <span class="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-brand-400">
              <AppIcon name="check" class="w-3.5 h-3.5" />
            </span>
            {{ f }}
          </li>
        </ul>
      </div>

      <p class="text-xs text-ink-600">© Admin Scaffold · 基于 MIT 协议开源</p>
    </div>

    <!-- 表单 -->
    <div class="flex items-center justify-center p-6 bg-ink-50">
      <div class="w-full max-w-sm animate-fade-in">
        <div class="lg:hidden flex items-center gap-2.5 mb-8">
          <span class="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white">
            <AppIcon name="logo" class="w-5 h-5" />
          </span>
          <span class="font-semibold text-lg text-ink-900">Admin Scaffold</span>
        </div>

        <h2 class="text-2xl font-bold text-ink-900 tracking-tight">欢迎回来</h2>
        <p class="text-sm text-ink-500 mt-1.5 mb-7">登录以管理你的资源后台</p>

        <form @submit.prevent="login">
          <label class="block mb-4">
            <span class="text-sm font-medium text-ink-700">用户名</span>
            <input
              v-model="username"
              autocomplete="username"
              placeholder="请输入用户名"
              class="mt-1.5 w-full h-11 px-3.5 rounded-lg border border-ink-300 bg-white text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
            />
          </label>
          <label class="block mb-2">
            <span class="text-sm font-medium text-ink-700">密码</span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="请输入密码"
              class="mt-1.5 w-full h-11 px-3.5 rounded-lg border border-ink-300 bg-white text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              @keyup.enter="login"
            />
          </label>
          <p v-if="error" class="text-red-500 text-xs mt-2 mb-1">{{ error }}</p>

          <AppButton type="submit" class="w-full mt-4" :disabled="loading">
            {{ loading ? '登录中…' : '登 录' }}
          </AppButton>
        </form>

        <p class="mt-6 text-xs text-ink-500 text-center">
          默认账号
          <code class="px-1.5 py-0.5 rounded bg-white border border-ink-200 text-ink-700">admin / admin123456</code>
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
import { firstVisibleMenu } from '../lib/menus';
import AppIcon from '../components/ui/AppIcon.vue';
import AppButton from '../components/ui/AppButton.vue';

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();
const { load, can } = usePermissions();

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
