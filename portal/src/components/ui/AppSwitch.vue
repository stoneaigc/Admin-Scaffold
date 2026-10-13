<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-label="ariaLabel || undefined"
    :disabled="disabled"
    class="relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
    :class="[modelValue ? 'bg-brand-600' : 'bg-ink-300', sizeTrack]"
    @click="toggle"
  >
    <span
      class="inline-block rounded-full bg-white shadow-sm transition-transform duration-200"
      :class="[sizeThumb, modelValue ? sizeOn : 'translate-x-0.5']"
    ></span>
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  disabled: Boolean,
  size: { type: String, default: 'md' }, // sm | md
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const sizeTrack = computed(() => (props.size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'));
const sizeThumb = computed(() => (props.size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'));
// 开启态的位移量要跟轨道/滑块尺寸配套，否则滑块会压到边缘
const sizeOn = computed(() => (props.size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]'));

function toggle() {
  if (props.disabled) return;
  emit('update:modelValue', !props.modelValue);
}
</script>
