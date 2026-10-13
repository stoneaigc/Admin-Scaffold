<template>
  <div ref="root" class="relative">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <Transition name="modal-fade">
      <div
        v-if="open"
        ref="panel"
        class="absolute z-50 mt-2 animate-slide-in"
        :class="[align === 'right' ? 'right-0' : 'left-0', panelClass]"
        role="dialog"
        @keydown.esc.stop="close"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';

defineProps({
  align: { type: String, default: 'right' }, // right | left
  panelClass: {
    type: String,
    default: 'w-72 rounded-xl border border-ink-200 bg-panel shadow-pop p-2',
  },
});
const emit = defineEmits(['open', 'close']);

const root = ref(null);
const open = ref(false);

function toggle() {
  open.value = !open.value;
}
function close() {
  open.value = false;
}

function onDocPointerDown(e) {
  if (!open.value) return;
  if (root.value && !root.value.contains(e.target)) close();
}
function onKeydown(e) {
  if (e.key === 'Escape' && open.value) close();
}

// 只在展开期间挂全局监听，避免一堆下拉常驻 document 上抢事件
watch(open, (v) => {
  emit(v ? 'open' : 'close');
  if (v) {
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKeydown);
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onKeydown);
});

defineExpose({ close, open });
</script>
