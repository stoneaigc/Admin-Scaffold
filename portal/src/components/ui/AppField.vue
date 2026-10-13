<template>
  <label class="block">
    <span v-if="label" class="flex items-center gap-1 text-sm text-ink-700 mb-1.5">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
      <span v-if="badge" class="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 text-ink-500 font-normal">{{ badge }}</span>
    </span>
    <slot />
    <span v-if="error" class="mt-1.5 block text-xs text-red-600">{{ error }}</span>
    <span v-else-if="hint" class="mt-1.5 block text-xs text-ink-400 leading-relaxed">{{ hint }}</span>
  </label>
</template>

<script setup>
// 表单字段容器：统一「标签 + 控件 + 提示/错误」的间距与字重，
// 避免每个设置项各写一遍 label 版式。
defineProps({
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  badge: { type: String, default: '' },
});
</script>
