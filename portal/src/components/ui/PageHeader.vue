<template>
  <div class="flex items-start justify-between mb-5 gap-4">
    <div>
      <h2 class="text-lg font-semibold text-ink-900 tracking-tight">{{ title }}</h2>
      <p v-if="subtitle" class="text-sm text-ink-500 mt-1">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
defineProps({ title: String, subtitle: String });
</script>
