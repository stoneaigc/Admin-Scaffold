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
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm active:bg-brand-800',
  secondary: 'bg-white text-ink-700 border border-ink-300 hover:bg-ink-100',
  ghost: 'text-ink-500 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
};

const classes = computed(() => `${sizes[props.size]} ${variants[props.variant] || variants.primary}`);
</script>
