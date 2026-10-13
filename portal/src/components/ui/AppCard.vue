<template>
  <div :class="padded ? 'p-5' : ''" class="bg-panel rounded-xl border border-ink-200 shadow-card">
    <div
      v-if="title || $slots.actions || $slots.header"
      class="flex items-start justify-between gap-4"
      :class="padded && (title || desc) ? 'mb-4' : ''"
    >
      <slot name="header">
        <div>
          <h3 v-if="title" class="text-sm font-semibold text-ink-900 tracking-tight">{{ title }}</h3>
          <p v-if="desc" class="text-xs text-ink-500 mt-1 leading-relaxed">{{ desc }}</p>
        </div>
      </slot>
      <div v-if="$slots.actions" class="shrink-0 flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <slot />
    <div v-if="$slots.footer" class="mt-4 pt-4 border-t border-ink-100 flex items-center justify-end gap-2">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  padded: { type: Boolean, default: true },
});
</script>
