<template>
  <div class="min-h-screen flex items-center justify-center bg-[#F1EFE8]">
    <div class="w-80 bg-white border border-[#D3D1C7] rounded-xl p-6">
      <h1 class="text-base font-medium mb-4 text-[#0C447C]">登录</h1>
      <input v-model="username" placeholder="用户名" class="w-full border border-[#D3D1C7] rounded-md px-3 py-2 mb-3 text-sm" />
      <input v-model="password" type="password" placeholder="密码" class="w-full border border-[#D3D1C7] rounded-md px-3 py-2 mb-3 text-sm" @keyup.enter="login" />
      <p v-if="error" class="text-red-600 text-xs mb-2">{{ error }}</p>
      <button class="w-full bg-brand-600 text-white rounded-md py-2 text-sm" @click="login">登录</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, setToken } from '../lib/apiBase';
import { usePermissions } from '../composables/usePermissions';

const username = ref('');
const password = ref('');
const error = ref('');
const router = useRouter();
const { load } = usePermissions();

async function login() {
  error.value = '';
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    setToken(data.token);
    await load();
    router.push(data.adminEntry ? '/admin/users' : '/');
  } catch (e) {
    error.value = e.message;
  }
}
</script>
