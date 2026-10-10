<template>
  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" :class="cls">
    <span v-if="dot" class="w-1.5 h-1.5 rounded-full" :class="dotCls"></span>
    <slot />
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ color: { type: String, default: 'gray' }, dot: Boolean });

const map = {
  gray: ['bg-ink-100 text-ink-700', 'bg-ink-500'],
  green: ['bg-emerald-50 text-emerald-700', 'bg-emerald-500'],
  brand: ['bg-brand-50 text-brand-700', 'bg-brand-500'],
  amber: ['bg-amber-50 text-amber-700', 'bg-amber-500'],
  red: ['bg-red-50 text-red-600', 'bg-red-500'],
  violet: ['bg-violet-50 text-violet-700', 'bg-violet-500'],
};

const cls = computed(() => (map[props.color] || map.gray)[0]);
const dotCls = computed(() => (map[props.color] || map.gray)[1]);
</script>
