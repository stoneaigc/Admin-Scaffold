<template>
  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" :class="cls">
    <span v-if="dot" class="w-1.5 h-1.5 rounded-full" :class="dotCls"></span>
    <slot />
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ color: { type: String, default: 'gray' }, dot: Boolean });

// gray / brand 走 ink / brand 令牌（本身已是变量，暗色自动翻转）；
// 语义色（green/amber/red/violet）没有对应令牌，用半透明底 + 提亮文字来适配暗色，
// 否则暗底上会糊一块浅色标签，刺眼且层级错乱。
const map = {
  gray: ['bg-ink-100 text-ink-700', 'bg-ink-500'],
  green: ['bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', 'bg-emerald-500'],
  brand: ['bg-brand-50 text-brand-700', 'bg-brand-500'],
  amber: ['bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', 'bg-amber-500'],
  red: ['bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300', 'bg-red-500'],
  violet: ['bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', 'bg-violet-500'],
};

const cls = computed(() => (map[props.color] || map.gray)[0]);
const dotCls = computed(() => (map[props.color] || map.gray)[1]);
</script>
