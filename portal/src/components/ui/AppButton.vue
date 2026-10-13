<template>
  <button
    :type="type"
    class="inline-flex items-center justify-center gap-1.5 font-medium rounded-lg text-sm transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-50 disabled:pointer-events-none"
    :class="classes"
  >
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  variant: { type: String, default: 'primary' }, // primary | secondary | ghost | danger
  size: { type: String, default: 'md' }, // sm | md
  type: { type: String, default: 'button' },
});

const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-9 px-4' };
const variants = {
  // 暗色下 brand-600 已被压暗到「白字刚达标」，所以 hover 不能切到更亮的 700 档
  // （那会把白字对比度打到 3.5 以下），改成保持同色并整体压暗，既保留交互反馈又可读。
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm dark:hover:bg-brand-600 dark:hover:brightness-90 dark:active:brightness-75',
  secondary: 'bg-panel text-ink-700 border border-ink-300 hover:bg-ink-100',
  ghost: 'text-ink-500 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-panel text-red-700 border border-red-200 hover:bg-red-50',
};

const classes = computed(() => `${sizes[props.size]} ${variants[props.variant] || variants.primary}`);
</script>
