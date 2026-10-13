<template>
  <div class="flex items-center gap-1 border-b border-ink-200 -mb-px overflow-x-auto">
    <button
      v-for="t in items"
      :key="t.key"
      type="button"
      class="relative shrink-0 px-3.5 py-2.5 text-sm transition-colors flex items-center gap-1.5 border-b-2"
      :class="
        isActive(t.key)
          ? 'border-brand-600 text-ink-900 font-medium'
          : 'border-transparent text-ink-500 hover:text-ink-900'
      "
      :aria-current="isActive(t.key) ? 'page' : undefined"
      @click="$emit('update:modelValue', t.key)"
    >
      <AppIcon v-if="t.icon" :name="t.icon" class="w-4 h-4" />
      {{ t.label }}
      <span
        v-if="t.badge"
        class="text-[10px] px-1.5 py-0.5 rounded-full"
        :class="isActive(t.key) ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-500'"
      >
        {{ t.badge }}
      </span>
    </button>
  </div>
</template>

<script setup>
import AppIcon from './AppIcon.vue';

const props = defineProps({
  modelValue: { type: String, required: true },
  items: { type: Array, default: () => [] }, // [{ key, label, icon?, badge? }]
});
defineEmits(['update:modelValue']);

function isActive(key) {
  return props.modelValue === key;
}
</script>
