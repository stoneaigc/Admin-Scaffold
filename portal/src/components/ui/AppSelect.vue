<template>
  <select
    v-model="selected"
    :disabled="disabled"
    class="block cursor-pointer"
    :class="[
      controlBase,
      controlBorder,
      controlFocus,
      controlSize[size],
      disabled ? 'cursor-not-allowed' : '',
    ]"
  >
    <!--
      用 v-model 而非 :value + @change：
      Vue 会在 option 上挂 _value，null / 数字 / 对象等非字符串值才能原样往返；
      若走 $event.target.value，null 会退化成 "null" 字符串，导致「不分配」被当成有效 ID。
    -->
    <option v-if="placeholder" :value="null" disabled>{{ placeholder }}</option>
    <option v-for="o in options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
    <slot />
  </select>
</template>

<script setup>
import { computed } from 'vue';
import { controlBase, controlBorder, controlFocus, controlSize } from '../../lib/ui';

// options: [{ value, label }]；需要分组的复杂场景可直接用默认插槽塞 <optgroup>
const props = defineProps({
  modelValue: { type: [String, Number, null], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  disabled: Boolean,
  size: { type: String, default: 'md' },
});
const emit = defineEmits(['update:modelValue']);

const selected = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
</script>
