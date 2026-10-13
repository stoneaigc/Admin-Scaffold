// portal/src/composables/useAsync.js
// 统一封装异步任务，暴露 loading / error / data 三态。
// 视图里用 run() 触发；任务抛错时错误落在 error 上而不冒泡到渲染期，从根上避免白屏。
// 注意：返回值用 reactive 包裹。若返回普通对象，模板里的 usersReq.error / usersReq.loading
// 会拿到 ref 对象本身（Vue 只自动解包顶层 ref），导致 v-if 恒为真、错误态永远显示。
import { reactive, ref } from 'vue';

export function useAsync(fn, options = {}) {
  const { immediate = false, initial = null } = options;
  const data = ref(initial);
  const loading = ref(false);
  const error = ref(null);

  async function run(...args) {
    loading.value = true;
    error.value = null;
    try {
      return await fn(...args);
    } catch (e) {
      error.value = e?.message || '请求失败';
      return undefined;
    } finally {
      loading.value = false;
    }
  }

  if (immediate) run();

  return reactive({ data, loading, error, run });
}
