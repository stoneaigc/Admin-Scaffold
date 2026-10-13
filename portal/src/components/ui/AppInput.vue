<template>
  <div class="relative">
    <span
      v-if="$slots.prefix"
      class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none flex items-center"
    >
      <slot name="prefix" />
    </span>
    <input
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      class="block"
      :class="[controlBase, controlBorder, controlFocus, controlSize[size], readonly ? controlReadonly : '', $slots.prefix ? 'pl-9' : '']"
      @input="$emit('update:modelValue', $event.target.value)"
      @change="$emit('change', $event)"
    />
  </div>
</template>

<script setup>
import { controlBase, controlBorder, controlFocus, controlReadonly, controlSize } from '../../lib/ui';

defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  disabled: Boolean,
  readonly: Boolean,
  autocomplete: { type: String, default: 'off' },
  size: { type: String, default: 'md' }, // sm | md | lg
});
defineEmits(['update:modelValue', 'change']);
</script>
