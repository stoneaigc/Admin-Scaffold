<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" @click="close"></div>
        <div
          class="relative w-full max-w-md bg-white rounded-xl shadow-pop animate-pop-in overflow-hidden"
        >
          <div class="flex items-center justify-between px-5 py-4 border-b border-ink-100">
            <h3 class="text-base font-semibold text-ink-900">{{ title }}</h3>
            <button
              class="text-ink-500 hover:text-ink-900 p-1 -mr-1 rounded-md hover:bg-ink-100 transition"
              @click="close"
            >
              <AppIcon name="close" class="w-4 h-4" />
            </button>
          </div>
          <div class="px-5 py-4">
            <slot />
          </div>
          <div
            v-if="$slots.footer"
            class="px-5 py-3 bg-ink-100/50 border-t border-ink-100 flex justify-end gap-2"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import AppIcon from './AppIcon.vue';

const props = defineProps({ modelValue: Boolean, title: String });
const emit = defineEmits(['update:modelValue']);

function close() {
  emit('update:modelValue', false);
}
</script>
