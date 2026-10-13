<template>
  <AppDropdown
    panel-class="w-[272px] rounded-xl border border-ink-200 bg-panel shadow-pop p-3"
  >
    <template #trigger="{ toggle, open }">
      <button
        type="button"
        class="w-9 h-9 rounded-lg flex items-center justify-center transition"
        :class="open ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'"
        title="主题外观"
        aria-label="主题外观"
        :aria-expanded="open ? 'true' : 'false'"
        @click="toggle"
      >
        <AppIcon name="palette" class="w-5 h-5" />
      </button>
    </template>

    <div>
      <!-- 外观模式 -->
      <p class="px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-2">外观模式</p>
      <div class="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="外观模式">
        <button
          v-for="m in MODES"
          :key="m.key"
          type="button"
          role="radio"
          :aria-checked="mode === m.key ? 'true' : 'false'"
          class="flex flex-col items-center gap-1.5 py-2.5 rounded-lg border text-xs transition"
          :class="
            mode === m.key
              ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
              : 'border-ink-200 text-ink-600 hover:bg-ink-100'
          "
          @click="setMode(m.key)"
        >
          <AppIcon :name="m.icon" class="w-[18px] h-[18px]" />
          {{ m.label }}
        </button>
      </div>

      <div class="my-3 border-t border-ink-100"></div>

      <!-- 主题色 -->
      <div class="flex items-center justify-between px-1 mb-2">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-400">主题色</p>
        <span class="text-[11px] text-ink-400">{{ currentAccent.label }}</span>
      </div>
      <div class="grid grid-cols-6 gap-1.5 px-1" role="radiogroup" aria-label="主题色">
        <button
          v-for="a in ACCENTS"
          :key="a.key"
          type="button"
          role="radio"
          :aria-checked="accent === a.key ? 'true' : 'false'"
          :aria-label="a.label"
          :title="a.label"
          class="relative w-full aspect-square rounded-full transition flex items-center justify-center hover:scale-110"
          :style="{ background: a.value }"
          @click="setAccent(a.key)"
        >
          <AppIcon
            v-if="accent === a.key"
            name="check"
            class="w-3.5 h-3.5 text-white"
          />
        </button>
      </div>

      <div class="mt-3 pt-2.5 border-t border-ink-100 flex items-center justify-between px-1">
        <span class="text-[11px] text-ink-400">
          当前：{{ currentModeLabel }} · {{ currentAccent.label }}
        </span>
        <button
          type="button"
          class="text-[11px] text-ink-500 hover:text-brand-700 transition"
          @click="resetTheme"
        >
          恢复默认
        </button>
      </div>
    </div>
  </AppDropdown>
</template>

<script setup>
import { computed } from 'vue';
import AppDropdown from './AppDropdown.vue';
import AppIcon from './AppIcon.vue';
import { useTheme } from '../../composables/useTheme';

const { mode, accent, setMode, setAccent, resetTheme, ACCENTS, MODES } = useTheme();

const currentModeLabel = computed(() => MODES.find((m) => m.key === mode.value)?.label || '');
const currentAccent = computed(() => ACCENTS.find((a) => a.key === accent.value) || ACCENTS[0]);
</script>
