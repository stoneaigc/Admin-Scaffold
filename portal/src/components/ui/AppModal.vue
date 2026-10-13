<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- 遮罩用 scrim 令牌而非 ink-900：暗色模式下 ink-900 是浅色文字色，会变成白幕 -->
        <div class="absolute inset-0 bg-scrim/40 backdrop-blur-sm" @click="close"></div>
        <div
          ref="panel"
          class="relative w-full max-w-md bg-panel rounded-xl shadow-pop animate-pop-in overflow-hidden"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <div class="flex items-center justify-between px-5 py-4 border-b border-ink-100">
            <h3 :id="titleId" class="text-base font-semibold text-ink-900">{{ title }}</h3>
            <button
              type="button"
              class="text-ink-500 hover:text-ink-900 p-1 -mr-1 rounded-md hover:bg-ink-100 transition"
              aria-label="关闭"
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
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({ modelValue: Boolean, title: String });
const emit = defineEmits(['update:modelValue']);

const panel = ref(null);
// aria-labelledby 需要稳定唯一 id：同屏可能挂多个弹窗，写死会指向错误标题
const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let lastFocused = null;
let scrollLock = null;

function close() {
  emit('update:modelValue', false);
}

/** 打开时锁背景滚动：不锁的话滚轮会滚到弹窗后面的页面上 */
function lockScroll() {
  const y = window.scrollY || 0;
  scrollLock = { y, prev: document.body.style.cssText };
  document.body.style.position = 'fixed';
  document.body.style.top = `-${y}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockScroll() {
  if (!scrollLock) return;
  document.body.style.cssText = scrollLock.prev;
  window.scrollTo(0, scrollLock.y);
  scrollLock = null;
}

/** Tab 循环限制在弹窗内：不拦的话焦点会跑到被遮住的页面上，键盘用户直接迷失 */
function onKeydown(e) {
  if (!props.modelValue) return;
  if (e.key === 'Escape') {
    e.stopPropagation();
    close();
    return;
  }
  if (e.key !== 'Tab' || !panel.value) return;
  const items = [...panel.value.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  } else if (!panel.value.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      lastFocused = document.activeElement;
      lockScroll();
      document.addEventListener('keydown', onKeydown, true);
      await nextTick();
      // 打开后把焦点移进弹窗，否则键盘用户按 Tab 还在背景页面上
      const target = panel.value?.querySelector('input, textarea, button') || panel.value;
      target?.focus?.();
    } else {
      document.removeEventListener('keydown', onKeydown, true);
      unlockScroll();
      // 关闭后把焦点还给触发元素，避免焦点掉到 body 顶部
      if (lastFocused && document.contains(lastFocused)) lastFocused.focus?.();
      lastFocused = null;
    }
  }
);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true);
  unlockScroll();
});
</script>
