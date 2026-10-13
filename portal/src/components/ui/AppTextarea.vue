<template>
  <textarea
    :value="modelValue"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    class="block py-2 leading-relaxed resize-y"
    :class="[controlBase, controlBorder, controlFocus, controlSize[size]]"
    @input="$emit('update:modelValue', $event.target.value)"
  ></textarea>
</template>

<script setup>
import { controlBase, controlBorder, controlFocus, controlSize } from '../../lib/ui';

defineProps({
  modelValue: { type: String, default: '' },
  rows: { type: [Number, String], default: 3 },
  placeholder: { type: String, default: '' },
  disabled: Boolean,
  size: { type: String, default: 'md' },
});
defineEmits(['update:modelValue']);
</script>
